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

import {useState, useEffect, useRef, forwardRef, MouseEvent} from 'react';
import {type Message, type AssistantMessage} from '../../utils/agent';
import {Tooltip} from 'antd';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';

interface MessageItemProps {
  message: Message;
}

const MessageItem = forwardRef<HTMLDivElement, MessageItemProps>(({message}, ref) => {
  const [isCopied, setIsCopied] = useState(false);
  const [parsedReasoningContent, setParsedReasoningContent] = useState('');
  const [parsedContent, setParsedContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseMarkdown = async (content: string): Promise<string> => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, {allowDangerousHtml: true})
      .use(rehypeStringify, {allowDangerousHtml: true})
      .process(content);

    const dirty = String(file);
    return DOMPurify.sanitize(dirty);
  };

  const isAssistantMessage = (message: Message): message is AssistantMessage => {
    return message.role === 'assistant';
  };

  useEffect(() => {
    if (message.content) {
      parseMarkdown(message.content).then(setParsedContent);
    } else {
      setParsedContent('');
    }

    const reasoningContent = isAssistantMessage(message) ? message.reasoning_content : undefined;
    if (reasoningContent) {
      parseMarkdown(reasoningContent).then(setParsedReasoningContent);
    } else {
      setParsedReasoningContent('');
    }
  }, [message.content, isAssistantMessage(message) ? message.reasoning_content : undefined]);

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

  const isLoading = !message.content;

  return (
    <div ref={ref} className={`message ${message.role} ${isLoading ? 'loading' : ''}`}>
      {isAssistantMessage(message) && parsedReasoningContent && (
        <div className={`reasoning-container ${isCollapsed ? 'collapsed' : ''}`}>
          <div className="reasoning-header" onClick={handleToggle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1024 1024">
              <path
                d="M724.48 521.728c-1.8432 7.7824-5.7344 14.848-11.3664 20.48l-341.9136 342.016c-16.6912 16.6912-43.7248 16.6912-60.3136 0s-16.6912-43.7248 0-60.3136L622.6944 512 310.8864 200.0896c-16.6912-16.6912-16.6912-43.7248 0-60.3136 16.6912-16.6912 43.7248-16.6912 60.3136 0l341.9136 341.9136c10.8544 10.8544 14.6432 26.112 11.3664 40.0384z"
                fill="currentColor"
              />
            </svg>
            思考过程
          </div>
          <div
            className="reasoning-content"
            dangerouslySetInnerHTML={{__html: parsedReasoningContent}}
          />
        </div>
      )}
      <div className="body-container">
        {isLoading ? (
          <p className="loading-dots"></p>
        ) : (
          <div className="content-container" dangerouslySetInnerHTML={{__html: parsedContent}} />
        )}
      </div>
      <div className="button-container">
        <Tooltip title="复制" placement={message.role === 'user' ? 'bottomLeft' : 'bottomRight'}>
          <button
            className="icon square plain"
            type="button"
            aria-label="复制"
            onClick={handleCopy}
          >
            {isCopied ? (
              <span>Copied</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1024 1024">
                <path d="M298.667 256V128a42.667 42.667 0 0 1 42.666-42.667h512A42.667 42.667 0 0 1 896 128v597.333A42.667 42.667 0 0 1 853.333 768h-128v128c0 23.552-19.2 42.667-42.965 42.667H170.965A42.71 42.71 0 0 1 128 896l.128-597.333c0-23.552 19.2-42.667 42.923-42.667h127.616zm-85.248 85.333-.086 512H640v-512H213.419zM384 256h341.333v426.667h85.334v-512H384V256z" />
              </svg>
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
});

export default MessageItem;
