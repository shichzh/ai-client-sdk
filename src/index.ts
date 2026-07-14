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

import {EventBus} from './utils/eventBus';
import {init} from './view/index';
import {Agent} from './utils/agent';
import type {Message, StreamResult, AssistantMessage, UpdateMessagePayload} from './types';

interface AIChatPanelOptions {
  container: HTMLElement | null;
}

export class AIChatPanel {
  readonly #eventBus: EventBus;
  readonly #promise: Promise<undefined>;
  readonly on: EventBus['subscribe'];

  constructor(options: AIChatPanelOptions) {
    const {container} = options;
    if (!container) {
      throw new Error('未提供有效的 container');
    }
    this.#eventBus = new EventBus();
    this.on = this.#eventBus.subscribe.bind(this.#eventBus);
    const {promise, resolve} = Promise.withResolvers<undefined>();
    this.#promise = promise;
    const shadowRoot = container.attachShadow({mode: 'open'});
    init({domNode: shadowRoot, onReady: resolve, eventBus: this.#eventBus});
  }

  async pushMessage(payload: Message): Promise<void> {
    await this.#promise;
    await this.#eventBus.publish('pushMessage', payload);
  }

  async updateMessage(payload: UpdateMessagePayload): Promise<void> {
    await this.#promise;
    await this.#eventBus.publish('updateMessage', payload);
  }

  async updateContext(payload: string): Promise<void> {
    await this.#promise;
    await this.#eventBus.publish('updateContext', payload);
  }
}

export {
  Agent,
  type AIChatPanelOptions,
  type Message,
  type UpdateMessagePayload,
  type StreamResult,
  type AssistantMessage,
};
