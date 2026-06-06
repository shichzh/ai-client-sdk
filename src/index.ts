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

import {eventManager} from './view/event';
import {init, type Result} from './view/index';
import {tools} from './utils/tools';
import {Agent, type Message, type StreamResult, type AssistantMessage} from './utils/agent';

export interface PanelElement extends HTMLElement {
  ready(): Promise<void>;
  pushMessage(message: Message): Promise<void>;
  pushMessages(messages: Message[]): Promise<void>;
  pushLoadingMessage(): Promise<void>;
  updateLoadingMessage(field: 'content' | 'reasoning_content', value: string): Promise<void>;
  updateContext(content: string): Promise<void>;
}

class Panel extends HTMLElement implements PanelElement {
  private appRef: Result | null = null;
  private promise: Promise<void>;
  private resolve: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.promise = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      this.appRef = init({domNode: this.shadowRoot, onReady: () => this.resolve?.()});
    }
  }

  ready(): Promise<void> {
    return this.promise;
  }

  async pushMessage(message: Message): Promise<void> {
    await this.promise;
    this.appRef?.current?.pushMessage(message);
  }

  async pushMessages(messages: Message[]): Promise<void> {
    await this.promise;
    this.appRef?.current?.pushMessages(messages);
  }

  async pushLoadingMessage(): Promise<void> {
    await this.promise;
    this.appRef?.current?.pushLoadingMessage();
  }

  async updateLoadingMessage(field: 'content' | 'reasoning_content', value: string): Promise<void> {
    await this.promise;
    this.appRef?.current?.updateLoadingMessage(field, value);
  }

  async updateContext(content: string): Promise<void> {
    await this.promise;
    this.appRef?.current?.updateContext(content);
  }
}

customElements.define('ai-chat-panel', Panel);

interface AIChatPanelConfig {
  container: HTMLElement | null;
}

export class AIChatPanel {
  on = eventManager.on;
  private readonly panelElement: PanelElement;

  constructor(config: AIChatPanelConfig) {
    const {container} = config;
    if (!container) {
      throw new Error('未提供有效的 container');
    }
    this.panelElement = document.createElement('ai-chat-panel') as PanelElement;
    container.appendChild(this.panelElement);
  }

  ready(): Promise<void> {
    return this.panelElement.ready();
  }

  pushMessage(message: Message): Promise<void> {
    return this.panelElement.pushMessage(message);
  }

  pushMessages(messages: Message[]): Promise<void> {
    return this.panelElement.pushMessages(messages);
  }

  pushLoadingMessage(): Promise<void> {
    return this.panelElement.pushLoadingMessage();
  }

  updateLoadingMessage(field: 'content' | 'reasoning_content', value: string): Promise<void> {
    return this.panelElement.updateLoadingMessage(field, value);
  }

  updateContext(content: string): Promise<void> {
    return this.panelElement.updateContext(content);
  }
}

export {tools, Agent, type Message, type StreamResult, type AssistantMessage};
