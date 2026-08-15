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

import type {Resolve} from '../types';
import type {EventBus} from '../utils/eventBus';
import styles from './css/index.css?inline';
import {Chat} from './components/Chat';

interface AppProps {
  onReady: Resolve;
  eventBus: EventBus;
}

const App = ({onReady, eventBus}: AppProps) => {
  return (
    <Chat.Provider onReady={onReady} eventBus={eventBus}>
      <Chat.Frame>
        <style>{styles}</style>
        <Chat.Messages />
        <Chat.Footer.Frame>
          <Chat.Footer.ActionBar />
          <Chat.Footer.Context />
          <Chat.Footer.UserInput />
        </Chat.Footer.Frame>
        <Chat.HistoryModal />
      </Chat.Frame>
    </Chat.Provider>
  );
};

export default App;
