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

import type {Message, AssistantMessage} from '../models/Message';
import type {ToolCallDelta} from '../types';

export const isAssistantMessage = (message: Message): message is AssistantMessage => {
  return message.role === 'assistant' || message.role === null;
};

/** 聚合只依赖 index，其余字段在 #mergeToolCalls / 归一化阶段再判空 */
export const isToolCallDeltaArray = (value: unknown): value is ToolCallDelta[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'index' in item &&
        typeof item.index === 'number',
    )
  );
};
