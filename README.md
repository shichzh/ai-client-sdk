# AI Client SDK

支持开发者在任意 Web 应用中接入 AI 功能

## Features

- 支持所有 OpenAI-compatible 大模型
- AI 对话界面
- 配置系统消息
- 支持 MCP，将 AI 对话与业务逻辑相结合
- 基于 Web Components 开发，可在任意框架或原生 HTML 中使用
- 封装了与大模型交互的基础工具类（Agent class），开发者可基于此构建灵活的工作流

## 安装

使用 npm 或 pnpm

```bash
npm install ai-client-sdk
# 或
pnpm add ai-client-sdk
```

## 开发

### 安装依赖

```bash
pn install
```

### 构建

```bash
pn build
```

## 快速开始

### 初始化 AI 对话界面

实例化 `AIChatPanel` 把 Web 端的 AI 对话界面挂载到指定容器。

### 示例

```typescript
import {AIChatPanel} from 'ai-client-sdk';

const container = document.getElementById('container');
const panel = new AIChatPanel({container});
```

### 参数说明

| Parameter   | Type                  | Required | Description             |
| ----------- | --------------------- | :------: | ----------------------- |
| `container` | `HTMLElement \| null` |    Y     | 对话界面挂载的 DOM 容器 |

### 注意事项

- 在 DOM 准备就绪后实例化 `AIChatPanel`，确保 `container` 元素已存在。

## License

- [Apache 2.0](./LICENSE)
