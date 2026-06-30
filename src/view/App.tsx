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
  useEffect,
  useCallback,
  startTransition,
  useMemo,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {debounce} from 'lodash-es';
import {isAssistantMessage, type Message, type UpdateMessagePayload} from '../utils/types';
import MessageItem from './components/MessageItem';
import {eventBus} from '../utils/eventBus';
import {notification, Tooltip, Modal} from 'antd';
import CreateIcon from './components/icons/CreateIcon';
import DeleteIcon from './components/icons/DeleteIcon';
import StopIcon from './components/icons/StopIcon';
import SendIcon from './components/icons/SendIcon';
import HistoryIcon from './components/icons/HistoryIcon';
import styles from './css/index.css?inline';
import dayjs from 'dayjs';
import {generateId} from '../utils/uuid';

const STORAGE_KEY = 'chatHistory';

interface HistoryItem {
  id: string;
  createdAt: number;
  messages: Message[];
}

interface AppProps {
  onReady: () => void;
}

const App = ({onReady}: AppProps) => {
  const [completedMessages, setCompletedMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [userInputValue, setUserInputValue] = useState('');
  const [context, setContext] = useState('');
  const [api, contextHolder] = notification.useNotification();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [currentId, setCurrentId] = useState<string>('');
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const historyRef = useRef<HistoryItem[]>([]);

  const createNewHistoryItem = useCallback(
    (): HistoryItem => ({id: generateId(), createdAt: Date.now(), messages: []}),
    [],
  );

  /**
   * TODO: 多页面场景下 localStorage 数据同步
   */
  const saveHistoryToStorage = useCallback((historyList: HistoryItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyList));
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
    const savedHistory = localStorage.getItem(STORAGE_KEY);
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
    setCurrentId(defaultItem.id);
  }, [onReady, createNewHistoryItem]);

  useEffect(() => {
    if (completedMessages.length === 0) {
      return;
    }
    setHistory((prev) =>
      prev.map((item) => (item.id === currentId ? {...item, messages: completedMessages} : item)),
    );
  }, [completedMessages.length, currentId]);

  useEffect(() => {
    debouncedSaveHistory();
  }, [history, debouncedSaveHistory]);

  /**
   * 如果开发者会使用 pushMessage 添加 user message
   * 则可能需要像 handleSend 一样，需要添加滚动逻辑
   * 暂时没有添加滚动逻辑是认为开发者应该只添加 assistant message
   * 而 user message 只在 user-input 里输入
   */
  const pushMessage = useCallback((payload: Message) => {
    const _message = payload.id ? payload : {...payload, id: generateId()};
    if (isAssistantMessage(_message) && _message.loading) {
      setCurrentMessage(_message);
    } else {
      setCompletedMessages((prev) => [...prev, _message]);
    }
  }, []);

  const updateMessage = useCallback((payload: UpdateMessagePayload) => {
    const {id, field, value} = payload;
    startTransition(() => {
      setCurrentMessage((prev) => {
        if (prev?.id === id) {
          return {
            ...prev,
            [field]: value,
          };
        }
        return prev;
      });
    });
  }, []);

  useEffect(() => {
    if (currentMessage && isAssistantMessage(currentMessage) && currentMessage.loading === false) {
      setCompletedMessages((prev) => [...prev, currentMessage]);
      setCurrentMessage(null);
    }
  }, [currentMessage]);

  const updateContext = useCallback((payload: string) => {
    setContext(payload);
  }, []);

  useEffect(() => {
    const disposers = [
      eventBus.subscribe('pushMessage', pushMessage),
      eventBus.subscribe('updateMessage', updateMessage),
      eventBus.subscribe('updateContext', updateContext),
    ];

    return () => {
      disposers.forEach((disposer) => disposer());
    };
  }, [pushMessage, updateMessage, updateContext]);

  useEffect(() => {
    return () => {
      debouncedSaveHistory.cancel();
      saveHistoryToStorage(historyRef.current);
    };
  }, [debouncedSaveHistory, saveHistoryToStorage]);

  const handleDeleteContext = useCallback(() => {
    setContext('');
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return;
      }

      try {
        setUserInputValue('');
        const finalContent = context.trim() ? `${context}\n\n${trimmedContent}` : trimmedContent;
        const message: Message = {id: generateId(), role: 'user', content: finalContent};
        setCompletedMessages((prev) => [...prev, message]);
        /**
         * messages-container 滚动到最底部
         * 将最新一轮对话里的 user message 显示在屏幕顶部
         */
        if (!messagesContainerRef.current) {
          return;
        }
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        await eventBus.publish('send', message);
      } finally {
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
    await eventBus.publish('stop');
    if (currentMessage) {
      const stoppedMessage = {...currentMessage, loading: false};
      setCompletedMessages((prev) => [...prev, stoppedMessage]);
      setCurrentMessage(null);
    }
    userInputRef.current?.focus();
    api.info({
      title: '已停止',
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api, currentMessage]);

  const create = useCallback(() => {
    const newHistoryItem = createNewHistoryItem();
    setHistory((prev) => [...prev, newHistoryItem]);
    setCurrentId(newHistoryItem.id);
    setCompletedMessages([]);
    setCurrentMessage(null);
  }, [createNewHistoryItem]);

  const handleCreate = useCallback(async () => {
    create();
    userInputRef.current?.focus();
    await eventBus.publish('create');
    api.success({
      title: '已创建',
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api, create]);

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
    setCompletedMessages(item.messages);
    setCurrentMessage(null);
    setCurrentId(item.id);
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
          if (currentId === item.id) {
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
    [currentId, create, api],
  );

  const completedMessageItems = useMemo(
    () => completedMessages.map((message) => <MessageItem key={message.id} message={message} />),
    [completedMessages],
  );

  const currentMessageItem = useMemo(() => {
    if (!currentMessage) {
      return null;
    }
    return <MessageItem key={currentMessage.id} message={currentMessage} />;
  }, [currentMessage]);

  return (
    <div className="app-container">
      <style>{styles}</style>
      {contextHolder}
      <div className="messages-container" ref={messagesContainerRef}>
        {completedMessageItems}
        {currentMessageItem}
      </div>
      <div className="bottom-container">
        <div className="action-bar">
          <Tooltip title="新对话" placement="bottomLeft">
            <button
              className="icon square plain"
              type="button"
              aria-label="新对话"
              onClick={handleCreate}
              disabled={!!currentMessage}
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
              disabled={!!currentMessage}
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
              <button
                className="text square plain"
                type="button"
                aria-label="翻译"
                onClick={handleTranslate}
              >
                翻译
              </button>
            </div>
          </>
        )}
        <div className="user-input-container">
          <textarea
            name="user-input"
            className="user-input"
            placeholder="发消息..."
            value={userInputValue}
            onChange={(e) => setUserInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={userInputRef}
          />
          <div className="button-wrap">
            {currentMessage ? (
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
                  aria-label="发送 (↵)"
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
                    className={`history-item ${currentId === item.id ? 'selected' : ''}`}
                    onClick={() => handleSelectHistory(item)}
                  >
                    <div className="history-info">
                      <div className="history-content">{item.messages[0]?.content || '无对话'}</div>
                      <div className="history-time">
                        {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
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
};

export default App;
