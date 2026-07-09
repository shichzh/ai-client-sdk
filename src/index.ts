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

import {eventBus} from './utils/eventBus';
import {init} from './view/index';
import {Agent} from './utils/agent';
import type {
  Message,
  StreamResult,
  AssistantMessage,
  UpdateMessagePayload,
  Resolve,
} from './utils/types';

class Panel extends HTMLElement {
  readonly #promise: Promise<undefined>;
  readonly #resolve: Resolve;

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    const {promise, resolve} = Promise.withResolvers<undefined>();
    this.#promise = promise;
    this.#resolve = resolve;
  }

  connectedCallback() {
    if (this.shadowRoot) {
      init({domNode: this.shadowRoot, onReady: this.#resolve});
    }
  }

  ready() {
    return this.#promise;
  }
}

customElements.define('ai-chat-panel', Panel);

interface AIChatPanelConfig {
  container: HTMLElement | null;
}

export class AIChatPanel {
  on = eventBus.subscribe.bind(eventBus);
  readonly #panel: Panel;

  constructor(config: AIChatPanelConfig) {
    const {container} = config;
    if (!container) {
      throw new Error('未提供有效的 container');
    }
    this.#panel = document.createElement('ai-chat-panel') as Panel;
    container.appendChild(this.#panel);
  }

  async pushMessage(payload: Message): Promise<void> {
    await this.#panel.ready();
    await eventBus.publish('pushMessage', payload);
  }

  async updateMessage(payload: UpdateMessagePayload): Promise<void> {
    await this.#panel.ready();
    await eventBus.publish('updateMessage', payload);
  }

  async updateContext(payload: string): Promise<void> {
    await this.#panel.ready();
    await eventBus.publish('updateContext', payload);
  }
}

export {Agent, type Message, type StreamResult, type AssistantMessage};
