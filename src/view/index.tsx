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

import {createRef, StrictMode, RefObject} from 'react';
import ReactDOM from 'react-dom/client';
import App, {AppRef} from './App';
import buttonCSS from './css/button.css?inline';
import tooltipCSS from './css/tooltip.css?inline';
import loadingCSS from './css/loading.css?inline';
import panelCSS from './css/panel.css?inline';
import commonCSS from './css/common.css?inline';
import {ConfigProvider} from 'antd';
import {StyleProvider, createCache} from '@ant-design/cssinjs';

const combinedCSS = [buttonCSS, tooltipCSS, loadingCSS, panelCSS, commonCSS].join('\n');

interface Params {
  domNode: ShadowRoot;
  onReady: () => void;
}

type Result = RefObject<AppRef | null>;

const init = ({domNode, onReady}: Params): Result => {
  const style = document.createElement('style');
  style.textContent = combinedCSS;
  domNode.appendChild(style);

  const cache = createCache();
  const appRef = createRef<AppRef>();

  const root = ReactDOM.createRoot(domNode);
  root.render(
    <StrictMode>
      <StyleProvider cache={cache} container={domNode}>
        <ConfigProvider getPopupContainer={() => domNode}>
          <App ref={appRef} onReady={onReady} />
        </ConfigProvider>
      </StyleProvider>
    </StrictMode>,
  );

  return appRef;
};

export {init, type Result};
