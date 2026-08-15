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
  useMemo,
  createContext,
  use,
  startTransition,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import debounce from 'lodash-es/debounce';
import {isAssistantMessage} from '../../utils/guard';
import {createUserMessage, type Message} from '../../models/Message';
import type {UpdateMessagePayload, Resolve, ShowModalPayload, ModalType} from '../../types';
import AssistantMessageItem from './AssistantMessageItem';
import UserMessageItem from './UserMessageItem';
import type {EventBus} from '../../utils/eventBus';
import {Modal, notification, type NotificationArgsProps} from 'antd';
import type {HistoryItem} from '../../models/HistoryItem';
import {STORAGE_KEY, reducer, init} from '../reducer';
import {Footer} from './Footer';
import HistoryModal from './HistoryModal';

/* ─────────────────────────────────────────────────────────────────────
 * 1. Context Interface (state / actions / meta 三段式契约)
 *    任何 Provider 只要实现此接口，UI 组件即可零改动复用
 * ───────────────────────────────────────────────────────────────────── */

export interface State {
  completedMessages: Message[];
  streamingMessage: Message | null;
  historyList: HistoryItem[];
  currentId: string;
  userInputValue: string;
  context: string;
  isHistoryModalVisible: boolean;
}

export interface Actions {
  pushMessage: (payload: Message) => void;
  updateMessage: (payload: UpdateMessagePayload) => void;
  updateContext: (payload: string) => void;
  showNotification: (payload: NotificationArgsProps) => void;
  showModal: (payload: ShowModalPayload) => void;
  closeModal: () => void;
  deleteContext: () => void;
  send: () => Promise<void>;
  translate: () => Promise<void>;
  stop: () => Promise<void>;
  create: () => Promise<void>;
  keyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  selectHistory: (item: HistoryItem) => void;
  deleteHistory: (item: HistoryItem) => void;
  setUserInputValue: (value: string) => void;
}

export interface Meta {
  userInputRef: RefObject<HTMLTextAreaElement | null>;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
}

export interface ContextValue {
  state: State;
  actions: Actions;
  meta: Meta;
}

const Context = createContext<ContextValue | null>(null);

/* ─────────────────────────────────────────────────────────────────────
 * 2. Helper Hook — 消费 Context（React 19 使用 use() 而非 useContext()）
 * ───────────────────────────────────────────────────────────────────── */

export function useChat(): ContextValue {
  const value = use(Context);
  if (!value) {
    throw new Error('Chat.* components must be used within <Chat.Provider>');
  }
  return value;
}

/* ─────────────────────────────────────────────────────────────────────
 * 3. Provider — 唯一知道状态如何管理的地方
 *    封装 useReducer / useState / eventBus / localStorage / antd modal+notification
 * ───────────────────────────────────────────────────────────────────── */

interface ProviderProps {
  children: React.ReactNode;
  onReady: Resolve;
  eventBus: EventBus;
}

function Provider({children, onReady, eventBus}: ProviderProps) {
  const [{completedMessages, streamingMessage, historyList, currentId}, dispatch] = useReducer(
    reducer,
    undefined,
    init,
  );
  const [userInputValue, setUserInputValue] = useState('');
  const [context, setContext] = useState('');
  const [api, notificationContextHolder] = notification.useNotification();
  const [modal, modalContextHolder] = Modal.useModal();
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReturnType<(typeof modal)[ModalType]> | null>(null);

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
    onReady();
  }, [onReady]);

  useEffect(() => {
    debouncedSaveHistory(historyList);
    return () => {
      debouncedSaveHistory.flush();
      debouncedSaveHistory.cancel();
    };
  }, [historyList, debouncedSaveHistory]);

  /* ──────── Actions ──────── */

  /**
   * 如果开发者会使用 pushMessage 添加 user message
   * 则可能需要像 send 一样，需要添加滚动逻辑
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

  const showNotification = useCallback(
    (payload: NotificationArgsProps) => {
      api.open(payload);
    },
    [api],
  );

  const showModal = useCallback(
    (payload: ShowModalPayload) => {
      const {type, ...rest} = payload;
      instanceRef.current = modal[type](rest);
    },
    [modal],
  );

  const closeModal = useCallback(() => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
  }, []);

  const deleteContext = useCallback(() => {
    setContext('');
  }, []);

  const submitMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return;
      }
      try {
        setUserInputValue('');
        const finalContent = context.trim() ? `${context}\n\n${trimmedContent}` : trimmedContent;
        const message: Message = createUserMessage(finalContent);
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
    [context, eventBus],
  );

  const send = useCallback(async () => {
    await submitMessage(userInputValue);
  }, [userInputValue, submitMessage]);

  const translate = useCallback(async () => {
    await submitMessage('翻译');
  }, [submitMessage]);

  const stop = useCallback(async () => {
    await eventBus.publish('stop');
    dispatch({type: 'STOP'});
    userInputRef.current?.focus();
    api.info({
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api, eventBus]);

  const create = useCallback(async () => {
    dispatch({type: 'CREATE'});
    userInputRef.current?.focus();
    await eventBus.publish('create');
    api.success({
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api, eventBus]);

  const keyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  const openHistoryModal = useCallback(() => {
    setIsHistoryModalVisible(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setIsHistoryModalVisible(false);
  }, []);

  const selectHistory = useCallback((item: HistoryItem) => {
    dispatch({type: 'SELECT_HISTORY', payload: item});
    setIsHistoryModalVisible(false);
  }, []);

  const deleteHistory = useCallback(
    (item: HistoryItem) => {
      modal.confirm({
        title: '确认删除',
        content: '确定要删除这条历史对话吗？此操作无法撤销。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          dispatch({type: 'DELETE_HISTORY', payload: item.id});
          api.warning({
            description: '历史对话已删除',
            placement: 'top',
            closable: false,
          });
        },
      });
    },
    [api, modal],
  );

  /* ──────── EventBus 订阅 ──────── */

  useEffect(() => {
    const disposers = [
      eventBus.subscribe('pushMessage', pushMessage),
      eventBus.subscribe('updateMessage', updateMessage),
      eventBus.subscribe('updateContext', updateContext),
      eventBus.subscribe('showNotification', showNotification),
      eventBus.subscribe('showModal', showModal),
      eventBus.subscribe('closeModal', closeModal),
    ];
    return () => {
      disposers.forEach((disposer) => {
        disposer();
      });
    };
  }, [
    pushMessage,
    updateMessage,
    updateContext,
    showNotification,
    showModal,
    closeModal,
    eventBus,
  ]);

  /* ──────── 组装 Context Value ──────── */

  const state: State = {
    completedMessages,
    streamingMessage,
    historyList,
    currentId,
    userInputValue,
    context,
    isHistoryModalVisible,
  };

  const actions: Actions = {
    pushMessage,
    updateMessage,
    updateContext,
    showNotification,
    showModal,
    closeModal,
    deleteContext,
    send,
    translate,
    stop,
    create,
    keyDown,
    openHistoryModal,
    closeHistoryModal,
    selectHistory,
    deleteHistory,
    setUserInputValue,
  };

  const meta: Meta = {
    userInputRef,
    messagesContainerRef,
  };

  return (
    <Context value={{state, actions, meta}}>
      {notificationContextHolder}
      {modalContextHolder}
      {children}
    </Context>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 4. Compound Sub-Components
 * ───────────────────────────────────────────────────────────────────── */

function Frame({children}: {children: React.ReactNode}) {
  return <div className="app-container">{children}</div>;
}

function Messages() {
  const {state, meta} = useChat();
  const {completedMessages, streamingMessage} = state;

  const getMessageItem = useCallback(
    (message: Message) =>
      isAssistantMessage(message) ? (
        <AssistantMessageItem key={message.id} message={message} />
      ) : (
        <UserMessageItem key={message.id} message={message} />
      ),
    [],
  );

  const items = useMemo(() => {
    const completed = completedMessages.map(getMessageItem);
    if (streamingMessage) {
      return [...completed, getMessageItem(streamingMessage)];
    }
    return completed;
  }, [completedMessages, streamingMessage, getMessageItem]);

  const {messagesContainerRef} = meta;
  return (
    <div className="messages-container" ref={messagesContainerRef}>
      {items}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 5. 导出复合组件对象
 * ───────────────────────────────────────────────────────────────────── */

export const Chat = {
  Provider,
  Frame,
  Messages,
  Footer,
  HistoryModal,
};
