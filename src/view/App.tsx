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

import {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useCallback,
  startTransition,
  useMemo,
  type KeyboardEvent,
} from 'react';
import {debounce} from 'lodash-es';
import {type Message} from '../utils/agent';
import {abort} from '../utils/agent';
import MessageItem from './components/MessageItem';
import {eventManager} from './event';
import {notification, Tooltip, Modal} from 'antd';
import CreateIcon from './components/icons/CreateIcon';
import DeleteIcon from './components/icons/DeleteIcon';
import StopIcon from './components/icons/StopIcon';
import SendIcon from './components/icons/SendIcon';
import HistoryIcon from './components/icons/HistoryIcon';
import styles from './css/index.css?inline';

const createId = (): string => crypto.randomUUID();

interface HistoryItem {
  id: string;
  createdAt: number;
  messages: Message[];
}

export interface AppRef {
  pushMessage: (message: Message) => void;
  pushMessages: (messages: Message[]) => void;
  pushLoadingMessage: () => void;
  updateLoadingMessageReasoningContent: (content: string) => void;
  updateLoadingMessageContent: (content: string) => void;
  updateContext: (content: string) => void;
}

interface AppProps {
  onReady: () => void;
}

const App = forwardRef<AppRef, AppProps>(({onReady}, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInputValue, setUserInputValue] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [context, setContext] = useState('');
  const [api, contextHolder] = notification.useNotification();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const saveHistoryToStorage = useCallback((historyList: HistoryItem[]) => {
    localStorage.setItem('chatHistory', JSON.stringify(historyList));
  }, []);

  const debouncedSaveHistory = useMemo(() => {
    return debounce(saveHistoryToStorage, 500, {trailing: true});
  }, [saveHistoryToStorage]);

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    const defaultChatId = createId();
    setCurrentChatId(defaultChatId);

    onReady();
    const savedHistory = localStorage.getItem('chatHistory');
    let initialHistory: HistoryItem[] = [];

    if (savedHistory) {
      try {
        initialHistory = JSON.parse(savedHistory);
      } catch {
        initialHistory = [];
      }
    }

    const defaultItem = {id: defaultChatId, createdAt: Date.now(), messages: []};
    const updatedHistory = [...initialHistory, defaultItem];
    setHistory(updatedHistory);
  }, [onReady]);

  // 监听 messages 变化，更新当前对话
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    setHistory((prev) =>
      prev.map((item) => (item.id === currentChatId ? {...item, messages} : item)),
    );
  }, [messages, currentChatId]);

  // 监听 history 变化，自动保存到 localStorage
  useEffect(() => {
    if (history.length === 0) {
      return;
    }
    debouncedSaveHistory(history);

    return () => {
      debouncedSaveHistory.cancel();
      saveHistoryToStorage(history);
    };
  }, [history, debouncedSaveHistory, saveHistoryToStorage]);

  /**
   * 如果开发者会使用 pushMessage 或 pushMessages 添加 user message
   * 则可能需要像 handleSend 一样，需要添加滚动逻辑
   * 暂时没有添加滚动逻辑是认为开发者应该只添加 assistant message
   * 而 user message 只在 user-input 里输入
   */
  const pushMessage = useCallback((message: Message) => {
    if (!message.id) {
      message.id = createId();
    }
    setMessages((prev) => [...prev, message]);
  }, []);

  const pushMessages = useCallback((messages: Message[]) => {
    if (!messages.length) {
      return;
    }

    const newMessages = messages.map((message) => ({
      ...message,
      id: message.id || createId(),
    }));

    setMessages((prev) => [...prev, ...newMessages]);
  }, []);

  const pushLoadingMessage = useCallback(() => {
    const loadingMessage: Message = {
      id: createId(),
      role: 'assistant',
      reasoning_content: '',
      content: '',
    };
    setMessages((prev) => [...prev, loadingMessage]);
  }, []);

  const updateLoadingMessageReasoningContent = useCallback((content: string) => {
    startTransition(() => {
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
    });
  }, []);

  const updateLoadingMessageContent = useCallback((content: string) => {
    startTransition(() => {
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
    });
  }, []);

  const updateContext = useCallback((content: string) => {
    setContext(content);
  }, []);

  const handleDeleteContext = useCallback(() => {
    setContext('');
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pushMessage,
      pushMessages,
      pushLoadingMessage,
      updateLoadingMessageReasoningContent,
      updateLoadingMessageContent,
      updateContext,
    }),
    [
      pushMessage,
      pushMessages,
      pushLoadingMessage,
      updateLoadingMessageReasoningContent,
      updateLoadingMessageContent,
      updateContext,
    ],
  );

  const handleSend = useCallback(async () => {
    const content = userInputValue.trim();
    if (!content) {
      return;
    }

    try {
      setIsChatting(true);
      setUserInputValue('');
      const finalContent = context.trim() ? `${context}\n\n${content}` : content;
      const message: Message = {id: createId(), role: 'user', content: finalContent};
      setMessages((prev) => [...prev, message]);
      /**
       * messages-container 滚动到最底部
       * 将最新一轮对话里的 user message 显示在屏幕顶部
       */
      if (!messagesContainerRef.current) {
        return;
      }
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      await eventManager.emit('send', message);
    } finally {
      setIsChatting(false);
      userInputRef.current?.focus();
    }
  }, [userInputValue, context]);

  const handleStop = useCallback(() => {
    abort();
    setIsChatting(false);
    userInputRef.current?.focus();
    api.info({
      title: '已停止',
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api]);

  const handleCreate = useCallback(async () => {
    const newChatId = createId();
    const newHistoryItem: HistoryItem = {
      id: newChatId,
      createdAt: Date.now(),
      messages: [],
    };
    setHistory((prev) => [...prev, newHistoryItem]);
    setCurrentChatId(newChatId);
    setMessages([]);
    userInputRef.current?.focus();
    await eventManager.emit('create');
    api.success({
      title: '已创建',
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api, saveHistoryToStorage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleOpenHistory = useCallback(() => {
    setIsHistoryModalVisible(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryModalVisible(false);
  }, []);

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    setMessages(item.messages);
    setCurrentChatId(item.id);
    setIsHistoryModalVisible(false);
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }, []);

  const messageItems = useMemo(() => {
    return messages.map((message) => <MessageItem key={message.id} message={message} />);
  }, [messages]);

  return (
    <div className="app-container">
      <style>{styles}</style>
      {contextHolder}
      <div className="messages-container" ref={messagesContainerRef}>
        {messageItems}
      </div>
      <div className="bottom-container">
        <div className="action-bar">
          <Tooltip title="新对话" placement="bottomLeft">
            <button
              className="icon square plain"
              type="button"
              aria-label="新对话"
              onClick={handleCreate}
            >
              <CreateIcon />
            </button>
          </Tooltip>
          <Tooltip title="历史对话" placement="bottomLeft">
            <button
              className="icon square plain"
              type="button"
              aria-label="历史对话"
              onClick={handleOpenHistory}
            >
              <HistoryIcon />
            </button>
          </Tooltip>
        </div>
        {context && (
          <div className="context-container">
            <span className="context-text">{context}</span>
            <Tooltip title="删除上下文" placement="topLeft">
              <button
                className="context-delete"
                type="button"
                aria-label="删除上下文"
                onClick={handleDeleteContext}
              >
                <DeleteIcon />
              </button>
            </Tooltip>
          </div>
        )}
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
            {isChatting ? (
              <Tooltip title="停止" placement="topLeft">
                <button
                  className="icon square plain"
                  type="button"
                  aria-label="停止"
                  onClick={handleStop}
                >
                  <div className="stop-icon">
                    <StopIcon />
                  </div>
                </button>
              </Tooltip>
            ) : (
              <Tooltip title="发送 (↵)" placement="topLeft">
                <button
                  className="icon square plain"
                  type="button"
                  aria-label="发送"
                  onClick={handleSend}
                >
                  <div className="send-icon">
                    <SendIcon />
                  </div>
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      <Modal
        title="历史对话"
        open={isHistoryModalVisible}
        onCancel={handleCloseHistory}
        footer={null}
      >
        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">暂无历史对话</div>
          ) : (
            <ul className="history-items">
              {history.map((item) => (
                <li
                  key={item.id}
                  className={`history-item ${currentChatId === item.id ? 'selected' : ''}`}
                  onClick={() => handleSelectHistory(item)}
                >
                  <div className="history-content">{item.messages[0]?.content || ''}</div>
                  <div className="history-time">{formatDate(item.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
});

export default App;
