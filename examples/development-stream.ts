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

// 只能从 src/index.ts 引入
import {AIChatPanel, Agent, createAssistantMessage, type Message, type StreamResult} from '../src';

const main = async () => {
  const container = document.getElementById('container');
  const panel = new AIChatPanel({container});
  /**
   * agent 必须用工厂模式创建
   */
  const agent = await Agent.create({
    model: 'doubao-seed-2-0-pro-260215', // 大模型 ID
    url: 'http://localhost:8080/api/chat/completions', // 大模型 API 的代理接口
    mcpClientOptions: {
      serverUrl: 'https://learn.microsoft.com/api/mcp',
    },
  });

  const init = async () => {
    await panel.pushMessage(createAssistantMessage({content: 'hello'}));
  };

  const isMessage = (v: Message | StreamResult): v is Message => {
    return 'role' in v;
  };

  const processGenerator = async (generator: StreamResult): Promise<void> => {
    const message = createAssistantMessage({content: '', loading: true});
    const id = message.id;
    await panel.pushMessage(message);
    let reasoningContentMarkdownStr = '';
    let contentMarkdownStr = '';
    for (;;) {
      const {value, done} = await generator.next();
      if (done) {
        if (value) {
          await panel.updateMessage({id, field: 'loading', value: false});
          if (isMessage(value)) {
            agent.pushMessage(value);
          } else {
            await processGenerator(value);
          }
        }
        break;
      }
      const delta = value.choices?.[0]?.delta;
      if (delta?.reasoning_content) {
        reasoningContentMarkdownStr += delta.reasoning_content;
        await panel.updateMessage({
          id,
          field: 'reasoning_content',
          value: reasoningContentMarkdownStr,
        });
      }
      if (delta?.content) {
        contentMarkdownStr += delta.content;
        await panel.updateMessage({id, field: 'content', value: contentMarkdownStr});
      }
    }
  };

  panel.on('send', async (payload: Message) => {
    try {
      agent.pushMessage(payload);
      const generator = agent.invokeStream();
      await processGenerator(generator);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error, null, 2);

      console.error('操作失败:', msg);
    }
  });

  panel.on('create', async () => {
    agent.resetMessages();
    await init();
  });

  panel.on('stop', () => {
    agent.abort();
  });

  await init();
};

main().catch(console.error);
