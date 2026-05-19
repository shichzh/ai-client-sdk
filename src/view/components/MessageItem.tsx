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

import {useState, useEffect, useRef, forwardRef, type MouseEvent} from 'react';
import {type Message, type AssistantMessage} from '../../utils/agent';
import {Tooltip} from 'antd';
import ArrowIcon from './icons/ArrowIcon';
import CopyIcon from './icons/CopyIcon';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';

interface MessageItemProps {
  message: Message;
}

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

const MessageItem = forwardRef<HTMLDivElement, MessageItemProps>(({message}, ref) => {
  const [isCopied, setIsCopied] = useState(false);
  const [parsedReasoningContent, setParsedReasoningContent] = useState('');
  const [parsedContent, setParsedContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            {isCopied ? <span>Copied</span> : <CopyIcon />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
});

export default MessageItem;
