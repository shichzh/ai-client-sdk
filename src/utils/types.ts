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

interface StringParameter {
  type: 'string';
  description?: string;
  enum?: string[];
  pattern?: string;
  format?: string;
  default?: string;
  minLength?: number;
  maxLength?: number;
}

interface NumberParameter {
  type: 'number' | 'integer';
  description?: string;
  enum?: number[];
  minimum?: number;
  maximum?: number;
  default?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
}

interface BooleanParameter {
  type: 'boolean';
  description?: string;
  default?: boolean;
}

interface ArrayParameter {
  type: 'array';
  description?: string;
  items: Parameters;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  default?: unknown[];
}

interface ObjectParameter {
  type: 'object';
  description?: string;
  properties: Record<string, object>;
  required?: string[];
  default?: Record<string, unknown>;
  additionalProperties?: boolean;
}

type Parameters =
  | StringParameter
  | NumberParameter
  | BooleanParameter
  | ArrayParameter
  | ObjectParameter;

type DefinitionType = 'function';

export interface Definition {
  type: DefinitionType;
  function: {
    name: string;
    description: string;
    parameters: Extract<Parameters, {type: 'object'}>;
  };
}

export interface AgentConfig {
  model: string;
  url: string;
  systemMessageContent?: string;
  maxRounds?: number;
  mcpServerUrl?: string;
}

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
  role: 'assistant';
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

export interface Params {
  roundsLeft?: number;
}

export interface Chunk {
  choices: Array<{
    delta: AssistantMessage;
  }>;
}

export type StreamResult = AsyncGenerator<Chunk, AssistantMessage | StreamResult | undefined, void>;
