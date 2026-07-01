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

import {memo, useState, useEffect, useRef, type MouseEvent} from 'react';
import {isAssistantMessage, type Message} from '../../utils/types';
import {Tooltip} from 'antd';
import ArrowIcon from './icons/ArrowIcon';
import CopyIcon from './icons/CopyIcon';
import LoadingIcon from './icons/LoadingIcon';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';

interface MessageItemProps {
  message: Message;
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeStringify, {allowDangerousHtml: true});

const parseMarkdown = async (content: string): Promise<string> => {
  const file = await markdownProcessor.process(content);
  const dirty = String(file);
  return DOMPurify.sanitize(dirty);
};

const MessageItem = ({message}: MessageItemProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [parsedReasoningContent, setParsedReasoningContent] = useState('');
  const [parsedContent, setParsedContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reasoningContent = isAssistantMessage(message) ? message.reasoning_content : '';

  useEffect(() => {
    if (message.content) {
      parseMarkdown(message.content).then(setParsedContent);
    } else {
      setParsedContent('');
    }
  }, [message.content]);

  useEffect(() => {
    if (reasoningContent) {
      parseMarkdown(reasoningContent).then(setParsedReasoningContent);
    } else {
      setParsedReasoningContent('');
    }
  }, [reasoningContent]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    const text = message.content;
    navigator.clipboard
      .writeText(text)
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      })
      .finally(() => {
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }
        setIsCopied(true);
        copiedTimerRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 1500);
      });
  };

  const isLoading = isAssistantMessage(message) && message.loading;

  return (
    <div className={`message ${message.role}`}>
      {isAssistantMessage(message) && parsedReasoningContent && (
        <div className={`reasoning-container ${isCollapsed ? 'collapsed' : ''}`}>
          <button className="reasoning-header plain" type="button" onClick={handleToggle}>
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
        {isLoading && !parsedContent ? (
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
        <Tooltip
          title="复制"
          placement={isAssistantMessage(message) ? 'bottomLeft' : 'bottomRight'}
        >
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

export default memo(MessageItem);
