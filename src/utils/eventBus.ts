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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<T = any> = (payload: T) => void | Promise<void>;

class EventBus {
  #handlers = new Map<string, Set<Handler>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async publish<T = any>(type: string, payload?: T): Promise<void> {
    const handlers = this.#handlers.get(type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(async (handler) => {
          try {
            await handler(payload);
          } catch (error) {
            console.error(`Error in handler for ${type}:`, error);
          }
        }),
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe<T = any>(type: string, handler: Handler<T>): () => void {
    const handlers = this.#handlers.get(type) || new Set<Handler>();
    handlers.add(handler);
    this.#handlers.set(type, handlers);
    return () => handlers.delete(handler);
  }
}

export const eventBus = new EventBus();
