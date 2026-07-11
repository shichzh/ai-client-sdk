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

import {memo, useState, useEffect} from 'react';
import type {AssistantMessage} from '../../types';
import {parseMarkdown} from '../../utils/markdown';
import {Tooltip} from 'antd';
import ArrowIcon from './icons/ArrowIcon';
import CopyIcon from './icons/CopyIcon';
import LoadingIcon from './icons/LoadingIcon';
import {useMessage} from '../hooks/useMessage';

interface AssistantMessageItemProps {
  message: AssistantMessage;
}

const AssistantMessageItem = ({message}: AssistantMessageItemProps) => {
  const {parsedContent, handleCopy, isCopied} = useMessage(message);
  const [parsedReasoningContent, setParsedReasoningContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (message.reasoning_content) {
      parseMarkdown(message.reasoning_content)
        .then(setParsedReasoningContent)
        .catch((err: unknown) => {
          console.error('Failed to parse markdown:', err);
        });
    }
  }, [message.reasoning_content]);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="message assistant">
      {parsedReasoningContent && (
        <div className={`reasoning-container ${isCollapsed ? 'collapsed' : ''}`}>
          <button
            className="reasoning-header plain"
            type="button"
            aria-label="思考过程"
            onClick={handleToggle}
          >
            <ArrowIcon />
            思考过程
          </button>
          <div
            className="reasoning-content"
            dangerouslySetInnerHTML={{__html: parsedReasoningContent}}
          />
        </div>
      )}
      <div className="body-container">
        {message.loading && !parsedContent ? (
          <p>
            <LoadingIcon />
          </p>
        ) : (
          <div
            dangerouslySetInnerHTML={{
              __html: parsedContent || '<p>暂无正文</p>',
            }}
          />
        )}
      </div>
      <div className="button-container">
        <Tooltip title="复制" placement="bottomLeft">
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

export default memo(AssistantMessageItem);
