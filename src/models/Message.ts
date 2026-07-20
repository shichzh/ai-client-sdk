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

import {generateId} from '../utils/uuid';

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export interface SimpleMessage {
  id: string;
  role: 'system' | 'user';
  content: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant' | null;
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[] | null;
  loading?: boolean;
}

export interface ToolMessage {
  id: string;
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type Message = SimpleMessage | AssistantMessage | ToolMessage;

export const createSystemMessage = (content: string): SimpleMessage => ({
  id: generateId(),
  role: 'system',
  content,
});

export const createUserMessage = (content: string): SimpleMessage => ({
  id: generateId(),
  role: 'user',
  content,
});

export const createAssistantMessage = (
  params: Omit<AssistantMessage, 'id' | 'role'>,
): AssistantMessage => ({
  ...params,
  id: generateId(),
  role: 'assistant',
});

export const createToolMessage = (params: Omit<ToolMessage, 'id' | 'role'>): ToolMessage => ({
  ...params,
  id: generateId(),
  role: 'tool',
});
