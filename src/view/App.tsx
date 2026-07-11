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
  useReducer,
  startTransition,
  useMemo,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {debounce} from 'lodash-es';
import {isAssistantMessage} from '../utils/guard';
import type {Message, UpdateMessagePayload, Resolve} from '../types';
import AssistantMessageItem from './components/AssistantMessageItem';
import UserMessageItem from './components/UserMessageItem';
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

interface State {
  completedMessages: Message[];
  streamingMessage: Message | null;
  historyList: HistoryItem[];
  currentId: string;
}

type Action =
  | {type: 'UPDATE_MESSAGE'; payload: UpdateMessagePayload}
  | {type: 'PUSH_MESSAGE'; payload: Message}
  | {type: 'SET_COMPLETED_MESSAGES'; payload: Message[]}
  | {type: 'ADD_COMPLETED_MESSAGE'; payload: Message}
  | {type: 'STOP'}
  | {type: 'CREATE'}
  | {type: 'SELECT_HISTORY'; payload: HistoryItem}
  | {type: 'DELETE_HISTORY'; payload: string};

const getHistoryList = (): HistoryItem[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as HistoryItem[];
    } catch {
      console.error('Failed to parse saved history:', saved);
    }
  }
  return [];
};

const createHistory = (historyList: HistoryItem[]): State => {
  const newHistoryItem = new HistoryItem();
  return {
    completedMessages: [],
    streamingMessage: null,
    historyList: [...historyList, newHistoryItem],
    currentId: newHistoryItem.id,
  };
};

const addCompletedMessage = (state: State, message: Message): State => {
  const newCompletedMessages = [...state.completedMessages, message];
  if (state.currentId === '') {
    const newHistoryItem = new HistoryItem(newCompletedMessages);
    return {
      completedMessages: newCompletedMessages,
      streamingMessage: null,
      historyList: [...state.historyList, newHistoryItem],
      currentId: newHistoryItem.id,
    };
  }
  return {
    ...state,
    completedMessages: newCompletedMessages,
    streamingMessage: null,
    historyList: state.historyList.map((item) => {
      if (item.id === state.currentId) {
        item.messages = newCompletedMessages;
      }
      return item;
    }),
  };
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'UPDATE_MESSAGE': {
      const {id, field, value} = action.payload;
      if (state.streamingMessage?.id !== id) {
        return state;
      }
      const message = {
        ...state.streamingMessage,
        [field]: value,
      };
      if (isAssistantMessage(message) && message.loading === false) {
        return addCompletedMessage(state, message);
      }
      return {
        ...state,
        streamingMessage: message,
      };
    }
    case 'PUSH_MESSAGE': {
      const payload = action.payload;
      const message = payload.id ? payload : {...payload, id: generateId()};
      if (isAssistantMessage(message) && message.loading) {
        return {
          ...state,
          streamingMessage: message,
        };
      }
      return addCompletedMessage(state, message);
    }
    case 'SET_COMPLETED_MESSAGES': {
      return {
        ...state,
        completedMessages: action.payload,
      };
    }
    case 'ADD_COMPLETED_MESSAGE': {
      return addCompletedMessage(state, action.payload);
    }
    case 'STOP': {
      if (!state.streamingMessage || !isAssistantMessage(state.streamingMessage)) {
        return state;
      }
      const message = {...state.streamingMessage, loading: false};
      return addCompletedMessage(state, message);
    }
    case 'CREATE': {
      return createHistory(state.historyList);
    }
    case 'SELECT_HISTORY': {
      const {messages, id} = action.payload;
      return {
        ...state,
        completedMessages: messages,
        streamingMessage: null,
        currentId: id,
      };
    }
    case 'DELETE_HISTORY': {
      const newHistoryList = state.historyList.filter((item) => item.id !== action.payload);
      if (state.currentId === action.payload) {
        return createHistory(newHistoryList);
      }
      return {
        ...state,
        historyList: newHistoryList,
      };
    }
    default:
      throw Error('Unknown action');
  }
};

class HistoryItem {
  id: string;
  createdAt: number;
  messages: Message[];

  constructor(messages: Message[] = []) {
    this.id = generateId();
    this.createdAt = Date.now();
    this.messages = messages;
  }
}

interface AppProps {
  onReady: Resolve;
}

const App = ({onReady}: AppProps) => {
  const [{completedMessages, streamingMessage, historyList, currentId}, dispatch] = useReducer(
    reducer,
    {
      completedMessages: [],
      streamingMessage: null,
      historyList: getHistoryList(),
      currentId: '',
    },
  );
  const [userInputValue, setUserInputValue] = useState('');
  const [context, setContext] = useState('');
  const [api, contextHolder] = notification.useNotification();
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /**
   * TODO: 多页面场景下 localStorage 数据同步
   */
  const debouncedSaveHistory = useMemo(
    () =>
      debounce((historyList: HistoryItem[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyList));
      }, 500),
    [],
  );

  useEffect(() => {
    onReady(undefined);
  }, [onReady]);

  useEffect(() => {
    debouncedSaveHistory(historyList);
    return () => {
      debouncedSaveHistory.flush();
      debouncedSaveHistory.cancel();
    };
  }, [historyList, debouncedSaveHistory]);

  /**
   * 如果开发者会使用 pushMessage 添加 user message
   * 则可能需要像 handleSend 一样，需要添加滚动逻辑
   * 暂时没有添加滚动逻辑是认为开发者应该只添加 assistant message
   * 而 user message 只在 user-input 里输入
   */
  const pushMessage = useCallback((payload: Message) => {
    dispatch({type: 'PUSH_MESSAGE', payload});
  }, []);

  const updateMessage = useCallback((payload: UpdateMessagePayload) => {
    startTransition(() => {
      dispatch({type: 'UPDATE_MESSAGE', payload});
    });
  }, []);

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
      disposers.forEach((disposer) => {
        disposer();
      });
    };
  }, [pushMessage, updateMessage, updateContext]);

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
        dispatch({type: 'ADD_COMPLETED_MESSAGE', payload: message});
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
    dispatch({type: 'STOP'});
    userInputRef.current?.focus();
    api.info({
      title: '已停止',
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api]);

  const create = useCallback(() => {
    dispatch({type: 'CREATE'});
  }, []);

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
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleOpenHistoryModal = useCallback(() => {
    setIsHistoryModalVisible(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setIsHistoryModalVisible(false);
  }, []);

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    dispatch({type: 'SELECT_HISTORY', payload: item});
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
          dispatch({type: 'DELETE_HISTORY', payload: item.id});
          api.warning({
            title: '已删除',
            description: '历史对话已删除',
            placement: 'top',
            closable: false,
          });
        },
      });
    },
    [api],
  );

  const getMessageItem = useCallback(
    (message: Message) =>
      isAssistantMessage(message) ? (
        <AssistantMessageItem key={message.id} message={message} />
      ) : (
        <UserMessageItem key={message.id} message={message} />
      ),
    [],
  );

  const completedMessageItems = useMemo(
    () => completedMessages.map(getMessageItem),
    [completedMessages, getMessageItem],
  );

  const messageItems = useMemo(
    () =>
      streamingMessage
        ? [...completedMessageItems, getMessageItem(streamingMessage)]
        : completedMessageItems,
    [completedMessageItems, streamingMessage, getMessageItem],
  );

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
              onClick={() => {
                void handleCreate();
              }}
              disabled={!!streamingMessage}
            >
              <CreateIcon />
            </button>
          </Tooltip>
          <Tooltip title="历史对话" placement="bottomLeft">
            <button
              className="icon square plain"
              type="button"
              aria-label="历史对话"
              onClick={handleOpenHistoryModal}
              disabled={!!streamingMessage}
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
                onClick={() => {
                  void handleTranslate();
                }}
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
            onChange={(e) => {
              setUserInputValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            ref={userInputRef}
          />
          <div className="button-wrap">
            {streamingMessage ? (
              <Tooltip title="停止" placement="topLeft">
                <button
                  className="icon square plain"
                  type="button"
                  aria-label="停止"
                  onClick={() => {
                    void handleStop();
                  }}
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
                  onClick={() => {
                    void handleSend();
                  }}
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
        onCancel={handleCloseHistoryModal}
        footer={null}
      >
        {isHistoryModalVisible && (
          <div className="history-list">
            {historyList.length === 0 ? (
              <div className="history-empty">暂无历史对话</div>
            ) : (
              <ul className="history-items">
                {historyList.map((item) => (
                  <li
                    key={item.id}
                    className={`history-item ${currentId === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      handleSelectHistory(item);
                    }}
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
                      onClick={(e) => {
                        handleDeleteHistory(item, e);
                      }}
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
