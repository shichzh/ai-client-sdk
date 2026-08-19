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
  readonly #transport: StreamableHTTPClientTransport;
  #isConnected = false;
  #tools: Definition[] = [];
  #promise: Promise<void> | null = null;

  constructor(options: MCPClientOptions) {
    this.#transport = new StreamableHTTPClientTransport(new URL(options.serverUrl), {
      requestInit: {headers: options.headers || {}},
    });

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

    this.#promise = this.#client
      .connect(this.#transport)
      .then(() => {
        this.#isConnected = true;
        return this.#fetchTools();
      })
      .catch((error: unknown) => {
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

  /**
   * 主动关闭连接
   */
  async close(): Promise<void> {
    if (this.#isConnected) {
      await this.#transport.close();
      this.#isConnected = false;
      this.#tools = [];
    }
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
