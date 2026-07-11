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
import {ConfigProvider} from 'antd';
import {StyleProvider, createCache} from '@ant-design/cssinjs';
import type {Resolve} from '../types';

interface Params {
  domNode: ShadowRoot;
  onReady: Resolve;
}

export const init = ({domNode, onReady}: Params): void => {
  const cache = createCache();

  const root = ReactDOM.createRoot(domNode);
  root.render(
    <StrictMode>
      <StyleProvider cache={cache} container={domNode}>
        <ConfigProvider getPopupContainer={() => domNode}>
          <App onReady={onReady} />
        </ConfigProvider>
      </StyleProvider>
    </StrictMode>,
  );
};
