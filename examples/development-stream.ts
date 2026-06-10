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
import {AIChatPanel, Agent, type Message, type StreamResult, type AssistantMessage} from '../src';

const main = async () => {
  const container = document.getElementById('container');
  const panel = new AIChatPanel({container});
  /**
   * agent 必须用工厂模式创建
   */
  const agent = await Agent.create({
    model: 'doubao-seed-2-0-pro-260215', // 大模型 ID
    url: 'http://localhost:8080/api/chat/completions', // 大模型 API 的代理接口
    mcpServerUrl: 'https://learn.microsoft.com/api/mcp',
  });

  const init = async () => {
    await panel.pushMessage({id: crypto.randomUUID(), role: 'assistant', content: 'hello'});
  };

  await panel.ready();
  await init();

  function isAssistantMessage(v: AssistantMessage | StreamResult): v is AssistantMessage {
    return 'role' in v;
  }

  async function processGenerator(generator: StreamResult): Promise<void> {
    const id = crypto.randomUUID();
    await panel.pushMessage({id, role: 'assistant', content: '', loading: true});
    let reasoningContentMarkdownStr = '';
    let contentMarkdownStr = '';
    while (true) {
      const {value, done} = await generator.next();
      if (done) {
        if (value) {
          await panel.updateMessage(id, 'loading', false);
          if (isAssistantMessage(value)) {
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
        await panel.updateMessage(id, 'reasoning_content', reasoningContentMarkdownStr);
      }
      if (delta?.content) {
        contentMarkdownStr += delta.content;
        await panel.updateMessage(id, 'content', contentMarkdownStr);
      }
    }
  }

  panel.on('send', async (message: Message) => {
    try {
      agent.pushMessage(message);
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
};

main().catch(console.error);
