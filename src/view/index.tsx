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

import {StrictMode} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import styles from './css/index.css?inline';
import {ConfigProvider} from 'antd';
import {StyleProvider, createCache} from '@ant-design/cssinjs';
import type {Reject, Resolve} from '../types';
import type {EventBus} from '../services/eventBus';

interface MountParams {
  domNode: ShadowRoot;
  onReady: Resolve;
  onError: Reject;
  eventBus: EventBus;
}

export const mount = ({domNode, onReady, onError, eventBus}: MountParams): void => {
  const cache = createCache();

  const root = ReactDOM.createRoot(domNode);
  root.render(
    <StrictMode>
      {/* 样式挂在 ShadowRoot 顶层且在边界之外，保证兜底 UI 渲染时样式依然存在 */}
      <style>{styles}</style>
      {/* 边界包住 antd 的 StyleProvider/ConfigProvider，其渲染期异常同样能兜底 */}
      <ErrorBoundary onError={onError}>
        <StyleProvider cache={cache} container={domNode}>
          <ConfigProvider getPopupContainer={() => domNode}>
            <App onReady={onReady} eventBus={eventBus} />
          </ConfigProvider>
        </StyleProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
};
