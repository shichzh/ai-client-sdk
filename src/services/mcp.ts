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

import {Client} from '@modelcontextprotocol/sdk/client';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp';
import type {Arguments, Definition, MCPClientOptions} from '../types';

export class MCPClient {
  readonly #client: Client;
  readonly #serverUrl: URL;
  readonly #headers: Record<string, string>;
  #isConnected = false;
  #tools: Definition[] = [];
  #promise: Promise<void> | null = null;

  constructor(options: MCPClientOptions) {
    this.#serverUrl = new URL(options.serverUrl);
    this.#headers = options.headers || {};

    this.#client = new Client({
      name: 'OpenAI-compatible-mcp-client',
      version: '1.0.0',
    });
  }

  connect(): Promise<void> {
    if (this.#isConnected) {
      return Promise.resolve();
    }

    if (this.#promise) {
      return this.#promise;
    }

    // StreamableHTTPClientTransport 是一次性实例：start() 在 _abortController 已存在时抛
    // 'already started'，且 connect 失败后 SDK 内部会关闭 transport。因此每次 connect() 新建
    // transport 实例，保证失败后的重试可用；Client（协议层）在 _onclose 中会完整重置自身状态，可复用。
    const transport = new StreamableHTTPClientTransport(this.#serverUrl, {
      requestInit: {headers: this.#headers},
    });

    this.#promise = this.#client
      .connect(transport)
      .then(() => {
        this.#isConnected = true;
        return this.#fetchTools();
      })
      .catch((error: unknown) => {
        // 失败后清空，允许下次 connect() 重试
        this.#promise = null;
        throw error;
      });

    return this.#promise;
  }

  async callTool(name: string, args: Arguments) {
    return this.#client.callTool({
      name,
      arguments: args,
    });
  }

  get tools(): Definition[] {
    return [...this.#tools];
  }

  get connected(): boolean {
    return this.#isConnected;
  }

  /**
   * TODO: 核对 schema 结构
   */
  async #fetchTools(): Promise<void> {
    try {
      const result = await this.#client.listTools();
      this.#tools = result.tools.map((tool) => {
        const {name, description, inputSchema} = tool;
        return {
          type: 'function',
          function: {
            name,
            description: description || '',
            parameters: {
              type: 'object',
              properties: inputSchema.properties || {},
              required: inputSchema.required || [],
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      this.#tools = [];
    }
  }
}
