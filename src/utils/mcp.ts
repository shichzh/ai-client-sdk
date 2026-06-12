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
import type {Definition, MCPClientOptions} from './types';

export class MCPClient {
  readonly #client: Client;
  readonly #transport: StreamableHTTPClientTransport;
  #isConnected = false;
  #tools: Definition[] = [];

  constructor(options: MCPClientOptions) {
    this.#transport = new StreamableHTTPClientTransport(new URL(options.serverUrl), {
      requestInit: {headers: options.headers || {}},
    });

    this.#client = new Client({
      name: 'OpenAI-compatible-mcp-client',
      version: '1.0.0',
    });
  }

  async connect(): Promise<void> {
    if (this.#isConnected) {
      return;
    }

    await this.#client.connect(this.#transport);
    this.#isConnected = true;
    await this.#fetchTools();
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.#client.callTool({
      name,
      arguments: args,
    });
  }

  /**
   * 主动关闭连接
   */
  close(): void {
    if (this.#isConnected) {
      this.#transport.close();
      this.#isConnected = false;
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
      this.#tools = (result.tools || []).map((tool) => {
        const {name, description, inputSchema} = tool;
        return {
          type: 'function',
          function: {
            name,
            description: description || '',
            parameters: {
              type: 'object',
              properties: inputSchema?.properties || {},
              required: inputSchema?.required || [],
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
