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
  type MouseEvent,
} from 'react';
import {debounce} from 'lodash-es';
import {type Message, type AssistantMessage} from '../utils/agent';
import MessageItem from './components/MessageItem';
import {eventManager} from './event';
import {notification, Tooltip, Modal} from 'antd';
import CreateIcon from './components/icons/CreateIcon';
import DeleteIcon from './components/icons/DeleteIcon';
import StopIcon from './components/icons/StopIcon';
import SendIcon from './components/icons/SendIcon';
import HistoryIcon from './components/icons/HistoryIcon';
import styles from './css/index.css?inline';
import {generateId} from '../utils/uuid';

interface HistoryItem {
  id: string;
  createdAt: number;
  messages: Message[];
}

export interface AppRef {
  pushMessage: (message: Message) => void;
  pushMessages: (messages: Message[]) => void;
  pushAssistantMessage: () => void;
  updateAssistantMessage: (field: 'content' | 'reasoning_content', value: string) => void;
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
  const historyRef = useRef<HistoryItem[]>([]);

  const createNewHistoryItem = useCallback((): HistoryItem => {
    const id = generateId();
    return {id, createdAt: Date.now(), messages: []};
  }, []);

  /**
   * TODO: 多页面场景下 localStorage 数据同步
   */
  const saveHistoryToStorage = useCallback((historyList: HistoryItem[]) => {
    localStorage.setItem('chatHistory', JSON.stringify(historyList));
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const debouncedSaveHistory = useCallback(
    debounce(() => {
      saveHistoryToStorage(historyRef.current);
    }, 500),
    [saveHistoryToStorage],
  );

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

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

    const defaultItem = createNewHistoryItem();
    setHistory([...initialHistory, defaultItem]);
    setCurrentChatId(defaultItem.id);
  }, [onReady, createNewHistoryItem]);

  // 监听 messages 变化，更新当前对话
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    setHistory((prev) =>
      prev.map((item) => (item.id === currentChatId ? {...item, messages} : item)),
    );
  }, [messages, currentChatId]);

  useEffect(() => {
    debouncedSaveHistory();
  }, [history, debouncedSaveHistory]);

  useEffect(() => {
    return () => {
      debouncedSaveHistory.cancel();
      saveHistoryToStorage(historyRef.current);
    };
  }, [debouncedSaveHistory, saveHistoryToStorage]);

  /**
   * 如果开发者会使用 pushMessage 或 pushMessages 添加 user message
   * 则可能需要像 handleSend 一样，需要添加滚动逻辑
   * 暂时没有添加滚动逻辑是认为开发者应该只添加 assistant message
   * 而 user message 只在 user-input 里输入
   */
  const pushMessage = useCallback((message: Message) => {
    const _message = message.id ? message : {...message, id: generateId()};
    setMessages((prev) => [...prev, _message]);
  }, []);

  const pushMessages = useCallback((messages: Message[]) => {
    if (!messages.length) {
      return;
    }

    const _messages = messages.map((message) => ({
      ...message,
      id: message.id || generateId(),
    }));

    setMessages((prev) => [...prev, ..._messages]);
  }, []);

  const pushAssistantMessage = useCallback(() => {
    const assistantMessage: AssistantMessage = {
      id: generateId(),
      role: 'assistant',
      reasoning_content: '',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }, []);

  const updateAssistantMessage = useCallback(
    (field: 'content' | 'reasoning_content', value: string) => {
      startTransition(() => {
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            const lastMessage = newMessages.at(-1);
            if (lastMessage?.role === 'assistant') {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                [field]: value,
              };
            }
          }
          return newMessages;
        });
      });
    },
    [],
  );

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
      pushAssistantMessage,
      updateAssistantMessage,
      updateContext,
    }),
    [pushMessage, pushMessages, pushAssistantMessage, updateAssistantMessage, updateContext],
  );

  const send = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return;
      }

      try {
        setIsChatting(true);
        setUserInputValue('');
        const finalContent = context.trim() ? `${context}\n\n${trimmedContent}` : trimmedContent;
        const message: Message = {id: generateId(), role: 'user', content: finalContent};
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
    },
    [context],
  );

  const handleSend = useCallback(async () => {
    await send(userInputValue);
  }, [userInputValue, send]);

  const handleTranslate = useCallback(async () => {
    await send('翻译');
  }, [send]);

  const handleStop = useCallback(async () => {
    await eventManager.emit('stop');
    setIsChatting(false);
    userInputRef.current?.focus();
    api.info({
      title: '已停止',
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api]);

  const create = useCallback(() => {
    const newHistoryItem = createNewHistoryItem();
    setHistory((prev) => [...prev, newHistoryItem]);
    setCurrentChatId(newHistoryItem.id);
    setMessages([]);
  }, [createNewHistoryItem]);

  const handleCreate = useCallback(async () => {
    create();
    userInputRef.current?.focus();
    await eventManager.emit('create');
    api.success({
      title: '已创建',
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api]);

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

  const handleDeleteHistory = useCallback(
    (item: HistoryItem, e: MouseEvent) => {
      e.stopPropagation();
      Modal.confirm({
        title: '确认删除',
        content: '确定要删除这条历史对话吗？此操作无法撤销。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          setHistory((prev) => prev.filter((h) => h.id !== item.id));
          if (currentChatId === item.id) {
            create();
          }
          api.warning({
            title: '已删除',
            description: '历史对话已删除',
            placement: 'top',
            closable: false,
          });
        },
      });
    },
    [currentChatId, create, api],
  );

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
          <>
            <div className="context-container">
              <p className="context-text">{context}</p>
              <button
                className="context-delete"
                type="button"
                aria-label="删除上下文"
                onClick={handleDeleteContext}
              >
                <DeleteIcon />
              </button>
            </div>
            <div className="shortcut-bar">
              <button className="text square plain" type="button" onClick={handleTranslate}>
                翻译
              </button>
            </div>
          </>
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
        {isHistoryModalVisible && (
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
                    <div className="history-info">
                      <div className="history-content">{item.messages[0]?.content || '无内容'}</div>
                      <div className="history-time">{formatDate(item.createdAt)}</div>
                    </div>
                    <button
                      className="history-delete"
                      type="button"
                      aria-label="删除历史对话"
                      onClick={(e) => handleDeleteHistory(item, e)}
                    >
                      <DeleteIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
});

export default App;
