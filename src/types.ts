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

import type {AssistantMessage} from './models/Message';
import type {ModalFuncProps} from 'antd';

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
  StringParameter | NumberParameter | BooleanParameter | ArrayParameter | ObjectParameter;

type DefinitionType = 'function';

export interface Definition {
  type: DefinitionType;
  function: {
    name: string;
    description: string;
    parameters: Extract<Parameters, {type: 'object'}>;
  };
}

export interface AgentOptions {
  model: string;
  url: string;
  systemMessageContent?: string;
  maxRounds?: number;
}

export interface MCPClientOptions {
  serverUrl: string;
  headers?: Record<string, string>;
}

export type Arguments = Record<string, unknown>;

export interface Params {
  roundsLeft?: number;
}

export interface Chunk {
  choices?: Array<{
    delta?: AssistantMessage;
  }>;
}

export type StreamResult = AsyncGenerator<Chunk, AssistantMessage | StreamResult | undefined, void>;

export type UpdateMessagePayload =
  | {id: string; field: 'content'; value: string}
  | {id: string; field: 'reasoning_content'; value: string}
  | {id: string; field: 'loading'; value: boolean};

export type Resolve = (value: void | PromiseLike<void>) => void;

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface ShowModalPayload extends Omit<ModalFuncProps, 'type'> {
  type: ModalType;
}
