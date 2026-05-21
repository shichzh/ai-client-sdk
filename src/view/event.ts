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

import {type Message} from '../utils/agent';

type EventType = 'send' | 'create' | 'stop';

type EventParams = {
  send: [message: Message];
  create: []; // 空数组表示无参数
  stop: [];
};

type EventListener<T extends EventType> = (...args: EventParams[T]) => void | Promise<void>;

class EventManager {
  private events: {
    [K in EventType]: EventListener<K>[];
  } = {
    send: [],
    create: [],
    stop: [],
  };

  on = <T extends EventType>(type: T, listener: EventListener<T>): void => {
    this.events[type].push(listener);
  };

  emit = async <T extends EventType>(type: T, ...args: EventParams[T]): Promise<void> => {
    for (const listener of this.events[type]) {
      try {
        await listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${type}:`, error);
      }
    }
  };
}

const eventManager = new EventManager();

export {eventManager};
