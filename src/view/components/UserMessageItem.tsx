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
import type {Message} from '../../types';
import {Tooltip} from 'antd';
import CopyIcon from './icons/CopyIcon';
import {useMessage} from '../hooks/useMessage';

interface UserMessageItemProps {
  message: Message;
}

const UserMessageItem = ({message}: UserMessageItemProps) => {
  const {parsedContent, handleCopy, isCopied} = useMessage(message);

  return (
    <div className="message user">
      <div className="body-container" dangerouslySetInnerHTML={{__html: parsedContent}} />
      <div className="button-container">
        <Tooltip title="复制" placement="bottomRight">
          <button
            className="icon square plain"
            type="button"
            aria-label="复制"
            onClick={handleCopy}
          >
            {isCopied ? 'Copied' : <CopyIcon />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default memo(UserMessageItem);
