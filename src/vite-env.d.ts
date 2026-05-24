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

/**
 * 引入 Vite 的客户端类型声明
 *
 * 提供以下 Vite 特有的类型支持：
 * - 支持 Vite 的查询参数导入语法（如 `?inline`、`?url`）
 * - 支持 `import.meta.env` 和 `import.meta.hot` 等 Vite API
 * - 支持 Vite 注入的全局变量
 *
 * 本项目中用于支持 CSS inline 导入：import styles from './css/index.css?inline'
 */
/// <reference types="vite/client" />
