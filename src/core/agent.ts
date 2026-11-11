/**
 * Copyright 2025 Hughe5
 * Copyright 2026 shichzh
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import mergeWith from 'lodash-es/mergeWith';
import type {MCPClient} from '../services/mcp';
import {isToolCallDeltaArray} from '../utils/guard';
import {
  createSystemMessage,
  createAssistantMessage,
  createToolMessage,
  type Message,
  type ToolCall,
} from '../models/Message';
import type {
  AgentOptions,
  Chunk,
  Definition,
  Params,
  StreamResult,
  Arguments,
  ToolCallDelta,
} from '../types';

const DEFAULT_MAX_ROUNDS = 4;

const DATA_PREFIX = 'data:';

export class Agent {
  #model = '';
  #url = '';
  #defaultParams: Required<Params> = {
    roundsLeft: DEFAULT_MAX_ROUNDS,
  };
  #controller: AbortController | null = null;
  #aborted = false;
  #mcpClient: MCPClient | null = null;
  #messages: Message[] = [];

  constructor(options: AgentOptions) {
    const {model, url, systemMessageContent, maxRounds} = options;
    this.#model = model;
    this.#url = url;
    if (typeof maxRounds === 'number') {
      this.#defaultParams.roundsLeft = maxRounds;
    }
    if (systemMessageContent) {
      this.#messages[0] = createSystemMessage(systemMessageContent);
    }
  }

  useMCP(client: MCPClient): void {
    this.#mcpClient = client;
  }

  abort(): void {
    this.#aborted = true;
    this.#abortCurrentController();
  }

  /**
   * 仅中止当前 controller 槽位（如果有）。
   * 与 abort() 不同：不设置 #aborted 标志，避免在 invokeStream 内部自调用时污染跨轮状态。
   */
  #abortCurrentController(): void {
    if (this.#controller) {
      this.#controller.abort();
      this.#controller = null;
    }
  }

  pushMessage(message: Message) {
    this.#messages.push(message);
  }

  resetMessages() {
    const systemMessage = this.#messages.find((element) => element.role === 'system');
    this.#messages = systemMessage ? [systemMessage] : [];
  }

  async *invokeStream(params: Params = this.#defaultParams, isRecursive = false): StreamResult {
    const roundsLeft = params.roundsLeft ?? this.#defaultParams.roundsLeft;

    if (isRecursive) {
      // 递归子 generator 启动时：跨轮间隙中 #controller 已被上一轮 finally 清空，
      // 此时 abort() 只能通过 #aborted 标志传递，必须在此拦截避免发起下一轮 fetch
      if (this.#aborted) {
        this.#aborted = false;
        throw new DOMException('Aborted', 'AbortError');
      }
    } else {
      // 外部新建调用：清除之前可能遗留的 abort 状态，保证 abort 后可以正常发起新请求
      this.#aborted = false;
    }

    // 清理可能仍在运行的上一个调用的 controller（消费方未等上一轮完成就发起新一轮的场景）
    this.#abortCurrentController();

    const controller = new AbortController();
    this.#controller = controller;

    try {
      const tools: Definition[] = this.#mcpClient?.connected ? this.#mcpClient.tools : [];

      const response = await fetch(this.#url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.#model,
          messages: this.#messages,
          tools,
          stream: true,
        }),
        signal: controller.signal,
      });

      controller.signal.throwIfAborted();

      // fetch 对 4xx/5xx 不会 reject，必须先校验状态码，避免把错误响应当 SSE 流解析导致静默失败
      if (!response.ok) {
        // 错误体可能是大段 HTML，截断后拼入异常信息，避免异常消息过大
        const errorText = (await response.text()).slice(0, 500);
        // statusText 在 HTTP/2 下恒为空串，过滤掉避免消息中出现多余空格
        const status = [String(response.status), response.statusText].filter(Boolean).join(' ');
        throw new Error(`HTTP ${status}: ${errorText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let result: Chunk | null = null;

      const decoder = new TextDecoder();

      let buffer = '';

      stream: for (;;) {
        const {done, value} = await reader.read();

        if (done) {
          // TextDecoder 在 stream 模式下会缓存不完整的 UTF-8 字节，流结束时必须 flush，
          // 否则流恰好截断在多字节字符中间时，尾部这段数据会丢失
          buffer += decoder.decode();
          // 残留为空说明所有事件都已处理完，直接结束
          if (buffer === '') {
            break;
          }
          // 流结束兜底：非规范服务端可能不发末尾的 \n\n，补一个虚拟分隔符让残留走统一的切分流程
          buffer += '\n\n';
        } else {
          // CRLF → LF 归一化，兼容 Windows 代理改写或旧式 SSE 服务器
          const chunk = decoder.decode(value, {stream: true});
          // 事件切分只认 \n\n，CRLF（\r\n\r\n）或孤立 \r 会切不出事件，需先统一为 \n。
          // /\r\n?/g 同时覆盖 CRLF 与孤立 CR；分块恰好切在 \r 与 \n 之间时也能正确归一化
          buffer += chunk.replace(/\r\n?/g, '\n');
        }

        // 按协议空行切出所有完整事件块；最后一段是尚未以 \n\n 结尾的残留，留回 buffer。
        // JSON 字符串内的换行必须转义为 \n，所以正文里不会出现裸 \n\n，切分是安全的
        const eventBlocks = buffer.split('\n\n');
        buffer = eventBlocks.pop() ?? '';

        for (const eventBlock of eventBlocks) {
          const {payload, isDone} = this.#parseEventBlock(eventBlock);
          if (isDone) {
            // 收到结束标记即终止读取：不能依赖服务端主动关流，否则 keep-alive 下 reader.read() 会一直挂起
            // cancel() 是清理动作，失败不影响已完整收到的业务结果；但也不静默，保留 debug 级别的排查信号
            try {
              await reader.cancel();
            } catch (error) {
              console.debug('[agent] SSE stream cancel failed after [DONE] (ignored):', error);
            }
            break stream;
          }
          if (payload !== null) {
            try {
              const json = JSON.parse(payload) as Chunk;
              result = this.#merge(result, json, ['content', 'reasoning_content']);
              yield json;
            } catch (error) {
              console.warn('JSON 解析失败', {error, payload});
            }
          }
        }

        if (done) {
          break;
        }
      }

      const delta = result?.choices?.[0]?.delta;

      if (!delta) {
        return;
      }

      const {content, reasoning_content} = delta;

      // delta 聚合后仍是分片结构，落库/执行前必须归一化成完整的 ToolCall
      const tool_calls = (delta.tool_calls ?? []).reduce<ToolCall[]>((acc, call) => {
        if (!call.id || !call.function?.name) {
          // 缺 id/name 无法与 tool 消息配对，丢弃比用空串污染消息序列安全
          console.warn('[agent] 丢弃字段不完整的 tool_call：', call);
          return acc;
        }
        acc.push({
          id: call.id,
          type: 'function',
          function: {
            name: call.function.name,
            arguments: call.function.arguments ?? '{}',
          },
        });
        return acc;
      }, []);

      if (!tool_calls.length) {
        // delta 不是完整消息（没有 id），补全后再交给宿主入档
        return createAssistantMessage({content: content ?? '', reasoning_content});
      }

      // 回填推理内容到 assistant 消息，保证多轮工具调用时思维链不丢失；
      // 值为 undefined 时 JSON.stringify 会自动省略该键，不输出此字段的后端不受影响
      this.#messages.push(
        createAssistantMessage({content: content ?? '', tool_calls, reasoning_content}),
      );
      await this.#executeTools(tool_calls);

      // executeTools 内部的 callTool 无法响应 signal 中断，期间发生的 abort 在此处拦截，避免继续发起下一轮
      controller.signal.throwIfAborted();

      // 剩余轮次 > 0 时继续回调
      if (roundsLeft - 1 > 0) {
        return this.invokeStream({roundsLeft: roundsLeft - 1}, true);
      }
    } finally {
      // 中止本次调用的在途请求：正常完成时流已读完，abort 是空操作；
      // 消费方提前放弃生成器（gen.return()）时，这里是掐断在途 fetch 的唯一时机
      controller.abort();
      // 仅当槽位仍属于本次调用时才清空，避免误清后续调用抢占的 controller
      if (this.#controller === controller) {
        this.#controller = null;
      }
    }
  }

  /**
   * 解析一个完整的 SSE 事件块（已不含 \n\n 分隔符）。
   * 严格遵循 WHATWG SSE 规范：只收集 data 字段的行，
   * value 去掉一个可选的前导空格，其余原样保留（包括行尾空白）。
   *
   * 返回值：
   * - payload: 拼接后的有效数据；事件块仅含注释/空行/空 data → null
   * - isDone: payload 去除首尾空白后为 '[DONE]' 时为 true
   */
  #parseEventBlock(eventBlock: string): {payload: string | null; isDone: boolean} {
    const values: string[] = [];
    for (const rawLine of eventBlock.split('\n')) {
      // 只有 data 字段参与拼接；注释行（: 开头）、event/id/retry 字段和空行都不以此前缀开头，自然跳过
      if (!rawLine.startsWith(DATA_PREFIX)) continue;

      // value：去掉 "data:" 前缀，再按规范去掉一个可选的前导空格
      let value = rawLine.slice(DATA_PREFIX.length);
      if (value.startsWith(' ')) value = value.slice(1);

      values.push(value);
    }

    // 没有任何 data 字段，或所有 data 字段的值均为空/仅空白 → 心跳帧，返回 null 避免走到 JSON.parse('')
    // 空数组的 every 返回 true，因此无需额外判断 length
    if (values.every((value) => value.trim() === '')) {
      return {payload: null, isDone: false};
    }
    const payload = values.join('\n');
    // [DONE] 是 OpenAI 约定而非合法 JSON，容忍行尾空白不会与任何合法 payload 冲突
    if (payload.trim() === '[DONE]') {
      return {payload: null, isDone: true};
    }
    return {payload, isDone: false};
  }

  #merge<T extends object, S extends object>(
    target: T | null,
    source: S,
    fieldsToConcat: string[] = [],
  ): T & S {
    return mergeWith(
      {}, // 避免直接修改原对象
      target,
      source,
      (objValue: unknown, srcValue: unknown, key: string) => {
        // tool_calls 必须按 index 聚合：lodash 默认按数组下标合并，
        // 而并行工具流的每个 chunk 通常只带一个元素，下标恒为 0，只有 index 能区分调用。
        // 约定：Chunk 中只有 choices[].delta.tool_calls 一处同名键；形状不符的值由 isToolCallDeltaArray 拦截。
        // 若未来其他层级引入同名字段，此处需改为路径判断
        if (key === 'tool_calls') {
          return this.#mergeToolCalls(objValue, srcValue);
        }
        // 检查当前键是否需要拼接且都是字符串类型
        if (fieldsToConcat.includes(key)) {
          const objStr = typeof objValue === 'string' ? objValue : '';
          const srcStr = typeof srcValue === 'string' ? srcValue : '';
          return objStr + srcStr;
        }
        // 其他情况使用默认合并行为
        return undefined;
      },
    );
  }

  /**
   * 按 index 聚合 tool_calls 增量。
   * id / type / name 只在首个分片出现，arguments 逐帧追加，因此同 index 的字段需要合并，
   * 不同 index 的调用必须保持独立，最后按 index 排序以稳定执行顺序。
   * 入参来自 lodash customizer（unknown），由守卫收窄；非法输入按空数组处理，
   * 同时天然兼容 wire 上常见的 "tool_calls": null。
   */
  #mergeToolCalls(target: unknown, source: unknown): ToolCallDelta[] {
    const targetCalls = isToolCallDeltaArray(target) ? target : [];
    const sourceCalls = isToolCallDeltaArray(source) ? source : [];
    const byIndex = new Map<number, ToolCallDelta>();

    // 先复制已有结果，避免后续写入污染上一轮的 result
    for (const call of targetCalls) {
      byIndex.set(call.index, {...call, function: call.function && {...call.function}});
    }

    for (const call of sourceCalls) {
      // index 在协议中必填，是区分并行调用的唯一依据
      const current = byIndex.get(call.index) ?? {index: call.index};

      if (call.id) current.id = call.id;
      if (call.type) current.type = call.type;

      if (call.function?.name) {
        current.function = {...current.function, name: call.function.name};
      }

      // 协议规定 arguments 是字符串增量；个别实现发成对象，直接拼接会得到 "[object Object]"
      const argsDelta = call.function?.arguments;
      if (typeof argsDelta === 'string' && argsDelta) {
        current.function = {
          ...current.function,
          arguments: (current.function?.arguments ?? '') + argsDelta,
        };
      }

      byIndex.set(call.index, current);
    }

    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  }

  async #executeTools(tool_calls: ToolCall[]): Promise<void> {
    // 未连接不能抛错：带 tool_calls 的 assistant 消息已入档，抛错会让它永远没有配对的 tool 应答，
    // 后续每轮请求都因消息序列不完整被 OpenAI 兼容 API 拒绝（400），只能 resetMessages 才能恢复
    const client = this.#mcpClient?.connected ? this.#mcpClient : null;
    const promises = tool_calls.map(async (element) => {
      const {
        function: {name, arguments: args},
        id,
      } = element;

      try {
        if (!client) {
          throw new Error('MCP 客户端未连接');
        }
        const result = await client.callTool(name, JSON.parse(args) as Arguments);
        const resp = typeof result === 'string' ? result : JSON.stringify(result);
        return {id, resp};
      } catch (error) {
        // 工具失败不中断对话：错误占位为 tool 消息回传，由模型决定下一步
        const message = error instanceof Error ? error.message : String(error);
        return {id, resp: JSON.stringify({error: message})};
      }
    });

    // 并发执行完所有工具后，按 tool_calls 原始顺序入档，保证 tool 消息与 tool_calls 一一对应
    const results = await Promise.all(promises);
    for (const {id, resp} of results) {
      this.#messages.push(createToolMessage({content: resp, tool_call_id: id}));
    }
  }
}
