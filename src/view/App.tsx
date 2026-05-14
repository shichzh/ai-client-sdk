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

import {useState, useRef, useImperativeHandle, forwardRef, useEffect, KeyboardEvent} from 'react';
import {type Message} from '../utils/agent';
import {abort} from '../utils/agent';
import MessageItem from './components/MessageItem';
import {eventManager} from './event';
import {notification} from 'antd';

export interface AppRef {
  pushMessage: (message: Message) => void;
  pushMessages: (messages: Message[]) => void;
  pushLoadingMessage: () => void;
  updateLoadingMessageReasoningContent: (content: string) => void;
  updateLoadingMessageContent: (content: string) => void;
}

interface AppProps {
  onReady: () => void;
}

const App = forwardRef<AppRef, AppProps>(({onReady}, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInputValue, setUserInputValue] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [api, contextHolder] = notification.useNotification();
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const MESSAGES_CONTAINER_PADDING_TOP = 12; // .messages-container 元素的 padding-top
    const BOTTOM_CONTAINER_CONTENT_HEIGHT = 142; // .bottom-container 元素的内容高度
    const BOTTOM_CONTAINER_MARGIN = 12; // .bottom-container 元素的 margin
    let height = 0;
    let animationId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const {height: newHeight} = entry.contentRect;
        if (newHeight === height) {
          continue;
        }
        height = newHeight;
        if (animationId !== null) {
          cancelAnimationFrame(animationId);
        }
        animationId = requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.style.paddingBottom = `${height - MESSAGES_CONTAINER_PADDING_TOP - BOTTOM_CONTAINER_CONTENT_HEIGHT - BOTTOM_CONTAINER_MARGIN * 2}px`;
          }
          animationId = null;
        });
      }
    });
    if (appContainerRef.current) {
      observer.observe(appContainerRef.current);
    }
    onReady();
    return () => {
      observer.disconnect();
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [onReady]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessageRef.current && lastMessage?.role === 'user') {
      /**
       * 把新加的 user message 滚动到距离顶部 12px 的位置，下面腾出来的空间用来渲染 assistant message
       * 12px 是两条 message 之间的间距，在 panel.css 里 message 的样式里
       * 一屏只展示一对 user message 和 assistant message
       */
      const MARGIN_BOTTOM = 12;
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTo({
          top: lastMessageRef.current.offsetTop - MARGIN_BOTTOM,
          behavior: 'smooth',
        });
      }
    }
  }, [messages]);

  const pushMessage = (message: Message | undefined) => {
    if (!message) {
      return;
    }
    if (!message.id) {
      message.id = crypto.randomUUID();
    }
    setMessages((prev) => [...prev, message]);
  };

  const pushMessages = (messages: Message[]) => {
    if (!messages.length) {
      return;
    }
    for (const message of messages) {
      pushMessage(message);
    }
  };

  const pushLoadingMessage = () => {
    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      reasoning_content: '',
      content: '',
    };
    setMessages((prev) => [...prev, loadingMessage]);
  };

  const updateLoadingMessageReasoningContent = (content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages.at(-1);
        if (lastMessage?.role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            reasoning_content: content,
          };
        }
      }
      return newMessages;
    });
  };

  const updateLoadingMessageContent = (content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages.at(-1);
        if (lastMessage?.role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: content,
          };
        }
      }
      return newMessages;
    });
  };

  useImperativeHandle(ref, () => ({
    pushMessage,
    pushMessages,
    pushLoadingMessage,
    updateLoadingMessageReasoningContent,
    updateLoadingMessageContent,
  }));

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handleSend = async () => {
    if (!userInputValue.trim()) {
      return;
    }

    try {
      setIsChatting(true);
      const content = escapeHtml(userInputValue.trim());
      setUserInputValue('');
      const message: Message = {id: crypto.randomUUID(), role: 'user', content};
      setMessages((prev) => [...prev, message]);
      await eventManager.emit('send', message);
    } finally {
      setIsChatting(false);
      userInputRef.current?.focus();
    }
  };

  const handleStop = () => {
    abort();
    setIsChatting(false);
    userInputRef.current?.focus();
    api.info({
      title: '已停止',
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  };

  const handleCreate = async () => {
    setMessages([]);
    userInputRef.current?.focus();
    await eventManager.emit('create');
    api.success({
      title: '已创建',
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container" ref={appContainerRef}>
      {contextHolder}
      <div className="messages-container" ref={messagesContainerRef}>
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            ref={index === messages.length - 1 ? lastMessageRef : null}
            message={message}
          />
        ))}
      </div>
      <div className="bottom-container">
        <div className="action-bar">
          <button
            className="icon square plain tooltip"
            type="button"
            aria-label="新对话"
            onClick={handleCreate}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1024 1024">
              <path d="M597.333 128v85.333H170.667v571.094l75.221-59.094h607.445V426.667h85.334V768A42.667 42.667 0 0 1 896 810.667H275.413L85.333 960V170.667A42.667 42.667 0 0 1 128 128h469.333zm213.334 0V0H896v128h128v85.333H896v128h-85.333v-128h-128V128h128z" />
            </svg>
            <span className="tooltip-text bottom-right">新对话</span>
          </button>
        </div>
        <div className="user-input-container">
          <textarea
            className="user-input"
            placeholder="发消息..."
            value={userInputValue}
            onChange={(e) => setUserInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={userInputRef}
          />
          <div className="button-wrap">
            <button
              className="icon square plain tooltip"
              type="button"
              aria-label="发送"
              onClick={handleSend}
              style={{display: isChatting ? 'none' : 'flex'}}
            >
              <div className="submit-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor">
                  <path d="M9 16V6.414L5.707 9.707a1 1 0 1 1-1.414-1.414l5-5 .076-.068a1 1 0 0 1 1.338.068l5 5 .068.076a1 1 0 0 1-1.406 1.406l-.076-.068L11 6.414V16a1 1 0 1 1-2 0Z" />
                </svg>
              </div>
              <span className="tooltip-text top-left">发送 (↵)</span>
            </button>
            <button
              className="icon square plain tooltip"
              type="button"
              aria-label="停止"
              onClick={handleStop}
              style={{display: isChatting ? 'flex' : 'none'}}
            >
              <div className="stop-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor">
                  <path d="M4.5 5.75c0-.69.56-1.25 1.25-1.25h8.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5Z" />
                </svg>
              </div>
              <span className="tooltip-text top-left">停止</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default App;
