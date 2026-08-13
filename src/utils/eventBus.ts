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

import type {Message} from '../models/Message';
import type {NotificationArgsProps} from 'antd';
import type {UpdateMessagePayload, ShowModalPayload} from '../types';

type Events = {
  pushMessage: [payload: Message];
  updateMessage: [payload: UpdateMessagePayload];
  updateContext: [payload: string];
  send: [payload: Message];
  create: [];
  stop: [];
  showNotification: [payload: NotificationArgsProps];
  showModal: [payload: ShowModalPayload];
  closeModal: [];
};

type Listener<T extends keyof Events> = (...args: Events[T]) => void | Promise<void>;

type Store = {
  [K in keyof Events]: Listener<K>[];
};

export class EventBus {
  #store: Store = {
    pushMessage: [],
    updateMessage: [],
    updateContext: [],
    send: [],
    create: [],
    stop: [],
    showNotification: [],
    showModal: [],
    closeModal: [],
  };

  async publish<T extends keyof Events>(type: T, ...args: Events[T]): Promise<void> {
    for (const listener of this.#store[type]) {
      try {
        await listener(...args);
      } catch (error) {
        console.error(`Error in listener for ${type}:`, error);
      }
    }
  }

  subscribe<T extends keyof Events>(type: T, listener: Listener<T>): () => void {
    this.#store[type].push(listener);
    return () => {
      const index = this.#store[type].indexOf(listener);
      if (index > -1) {
        this.#store[type].splice(index, 1);
      }
    };
  }
}
