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
import type {MCPClient} from './mcp';
import {
  createSystemMessage,
  createAssistantMessage,
  createToolMessage,
  type Message,
  type ToolCall,
} from '../models/Message';
import type {AgentOptions, Chunk, Definition, Params, StreamResult, Arguments} from '../types';

const DATA_PREFIX_REGEX = /^data: /;

export class Agent {
  #model = '';
  #url = '';
  #maxRounds = 4;
  #defaultParams: Params = {
    roundsLeft: this.#maxRounds,
  };
  #controller: AbortController | null = null;
  #mcpClient: MCPClient | null = null;
  #messages: Message[] = [];

  constructor(options: AgentOptions) {
    const {model, url, systemMessageContent, maxRounds} = options;
    this.#model = model;
    this.#url = url;
    if (typeof maxRounds === 'number') {
      this.#maxRounds = maxRounds;
    }
    if (systemMessageContent) {
      this.#messages[0] = createSystemMessage(systemMessageContent);
    }
  }

  useMCP(client: MCPClient): void {
    this.#mcpClient = client;
  }

  abort(): void {
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

  async *invokeStream(params = this.#defaultParams): StreamResult {
    const {roundsLeft = this.#maxRounds} = params;
    this.abort();
    this.#controller = new AbortController();

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
        signal: this.#controller.signal,
      });

      if (this.#controller.signal.aborted) {
        throw new DOMException('对话已停止', 'AbortError');
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let result: Chunk | null = null;

      const decoder = new TextDecoder();

      let buffer = '';

      for (;;) {
        const {done, value} = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, {stream: true});
        const arr = chunk.split('\n\n').filter((item) => item.trim() !== '');
        for (const item of arr) {
          if (item === 'data: [DONE]') {
            break;
          }
          const jsonStr = item.trim().replace(DATA_PREFIX_REGEX, '');
          try {
            const json = JSON.parse(buffer + jsonStr) as Chunk;
            result = this.#merge(result, json, ['content', 'arguments']);
            yield json;
            buffer = '';
          } catch (error) {
            console.warn('JSON 解析失败，等待下一个数据块继续拼接', {error, jsonStr});
            buffer += jsonStr;
          }
        }
      }

      const message = result?.choices?.[0]?.delta;

      if (!message) {
        return;
      }

      const {content, tool_calls} = message;

      if (!tool_calls?.length) {
        return message;
      }

      this.#messages.push(createAssistantMessage({content, tool_calls}));
      await this.#executeTools(tool_calls);

      // 剩余轮次 > 0 时继续回调
      if (roundsLeft - 1 > 0) {
        return this.invokeStream({roundsLeft: roundsLeft - 1});
      }
    } finally {
      this.#controller = null;
    }
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

  async #executeTools(tool_calls: ToolCall[]): Promise<void> {
    if (!this.#mcpClient?.connected) {
      throw new Error('MCP 客户端未连接');
    }

    const client = this.#mcpClient;
    const promises = tool_calls.map(async (element) => {
      const {
        function: {name, arguments: args},
        id,
      } = element;

      const result = await client.callTool(name, JSON.parse(args) as Arguments);
      const resp = typeof result === 'string' ? result : JSON.stringify(result);

      this.#messages.push(createToolMessage({content: resp, tool_call_id: id}));
    });
    await Promise.all(promises);
  }
}
