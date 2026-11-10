/**
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

import {describe, it, expect, vi, afterEach} from 'vitest';
import {Agent} from './agent';
import {createUserMessage} from '../models/Message';
import type {MCPClient} from '../services/mcp';
import type {Arguments} from '../types';

const chunk = (delta: object) => ({
  choices: [{delta, index: 0}],
  created: 1,
  object: 'chat.completion.chunk',
});

/** 新工具调用的首帧：携带 id / type / name，arguments 为空串 */
const start = (index: number, id: string, name: string) =>
  chunk({
    content: '',
    role: 'assistant',
    tool_calls: [{function: {arguments: '', name}, id, index, type: 'function'}],
  });

/** arguments 增量帧：只有 index 和增量值 */
const args = (index: number, value: unknown) =>
  chunk({content: '', role: 'assistant', tool_calls: [{function: {arguments: value}, index}]});

const sse = (chunks: object[]) =>
  `${chunks.map((item) => `data: ${JSON.stringify(item)}\n\n`).join('')}data: [DONE]\n\n`;

const run = async (body: string) => {
  const calls: Array<{name: string; args: Arguments}> = [];
  const mcp = {
    connected: true,
    tools: [],
    callTool: (name: string, a: Arguments) => {
      calls.push({name, args: a});
      return Promise.resolve('ok');
    },
  } as unknown as MCPClient;

  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, {status: 200}))),
  );

  const agent = new Agent({model: 'm', url: 'http://localhost/chat', maxRounds: 1});
  agent.useMCP(mcp);
  agent.pushMessage(createUserMessage('hi'));
  const gen = agent.invokeStream();
  for (;;) {
    const {done} = await gen.next();
    if (done) break;
  }
  return calls;
};

describe('并行 tool_calls 的流式聚合', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('交错流：不同 index 的调用保持独立，arguments 各自拼接', async () => {
    const calls = await run(
      sse([
        chunk({content: '', reasoning_content: '。', role: 'assistant'}),
        start(0, 'call_A', 'add_record'),
        start(1, 'call_B', 'get_time'),
        args(0, '{"content": "'),
        args(1, '{"tz": "'),
        args(0, 'bug'),
        args(1, 'Asia/Shanghai'),
        args(0, '"}'),
        args(1, '"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([
      {name: 'add_record', args: {content: 'bug'}},
      {name: 'get_time', args: {tz: 'Asia/Shanghai'}},
    ]);
  });

  it('顺序流：同一时刻只有一个 index 出现时也聚合正确', async () => {
    const calls = await run(
      sse([
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "bug"}'),
        start(1, 'call_B', 'get_time'),
        args(1, '{"tz": "Asia/Shanghai"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([
      {name: 'add_record', args: {content: 'bug'}},
      {name: 'get_time', args: {tz: 'Asia/Shanghai'}},
    ]);
  });

  it('乱序流：index 1 的分片先到达，执行顺序仍按 index 排序', async () => {
    const calls = await run(
      sse([
        start(1, 'call_B', 'get_time'),
        args(1, '{"tz": "Asia/Shanghai"}'),
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "bug"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([
      {name: 'add_record', args: {content: 'bug'}},
      {name: 'get_time', args: {tz: 'Asia/Shanghai'}},
    ]);
  });

  it('中间插入 "tool_calls": null 帧不影响已聚合结果', async () => {
    const calls = await run(
      sse([
        chunk({content: '', role: 'assistant', tool_calls: null}),
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "'),
        chunk({content: '', role: 'assistant', tool_calls: null}),
        args(0, 'bug"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([{name: 'add_record', args: {content: 'bug'}}]);
  });

  it('畸形的 tool_calls 值（非数组）被忽略而不是抛错', async () => {
    const calls = await run(
      sse([
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "bug"}'),
        chunk({content: '', role: 'assistant', tool_calls: 'not-an-array'}),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([{name: 'add_record', args: {content: 'bug'}}]);
  });

  it('对象型 arguments 增量被丢弃，不会被拼成 "[object Object]"', async () => {
    const calls = await run(
      sse([
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "'),
        args(0, {bad: true}),
        args(0, 'bug"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([{name: 'add_record', args: {content: 'bug'}}]);
  });

  it('缺 id 的调用被丢弃并告警，不进入执行与消息序列', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const calls = await run(
      sse([
        start(0, 'call_A', 'add_record'),
        args(0, '{"content": "bug"}'),
        // index 1 的调用从头到尾没有 id
        chunk({
          content: '',
          role: 'assistant',
          tool_calls: [{function: {arguments: '', name: 'get_time'}, index: 1, type: 'function'}],
        }),
        args(1, '{"tz": "Asia/Shanghai"}'),
        chunk({content: '', role: 'assistant'}),
      ]),
    );
    expect(calls).toEqual([{name: 'add_record', args: {content: 'bug'}}]);
    expect(warn).toHaveBeenCalledWith(
      '[agent] 丢弃字段不完整的 tool_call：',
      expect.objectContaining({index: 1}),
    );
  });
});
