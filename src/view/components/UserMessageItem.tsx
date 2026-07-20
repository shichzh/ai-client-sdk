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

import {memo} from 'react';
import type {Message} from '../../models/Message';
import {useMessage} from '../hooks/useMessage';
import ActionBar from './ActionBar';

interface UserMessageItemProps {
  message: Message;
}

const UserMessageItem = ({message}: UserMessageItemProps) => {
  const {parsedContent, handleCopy, isCopied} = useMessage(message);

  return (
    <div className="message user">
      <div className="body-container" dangerouslySetInnerHTML={{__html: parsedContent}} />
      <ActionBar handleCopy={handleCopy} isCopied={isCopied} />
    </div>
  );
};

export default memo(UserMessageItem);
