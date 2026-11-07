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
  type KeyboardEvent,
  type RefObject,
} from 'react';
import debounce from 'lodash-es/debounce';
import {isAssistantMessage} from '../../utils/guard';
import {createUserMessage, type Message} from '../../models/Message';
import type {UpdateMessagePayload, Resolve, ShowModalPayload, ModalType} from '../../types';
import AssistantMessageItem from './AssistantMessageItem';
import UserMessageItem from './UserMessageItem';
import type {EventBus} from '../../services/eventBus';
import {Modal, notification, type NotificationArgsProps} from 'antd';
import type {HistoryItem} from '../../models/HistoryItem';
import {STORAGE_KEY, reducer, init} from '../reducer';
import {Footer} from './Footer';
import HistoryModal from './HistoryModal';

/* ─────────────────────────────────────────────────────────────────────
 * 1. Context Interface (state / actions / meta 三段式契约)
 *    任何 Provider 只要实现此接口，UI 组件即可零改动复用
 * ───────────────────────────────────────────────────────────────────── */

interface State {
  completedMessages: Message[];
  streamingMessage: Message | null;
  historyList: HistoryItem[];
  currentId: string;
  userInputValue: string;
  context: string;
  isHistoryModalVisible: boolean;
}

interface Actions {
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

interface Meta {
  userInputRef: RefObject<HTMLTextAreaElement | null>;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
}

interface ContextValue {
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

  // 每次 historyList 变化只重新排期，不在 cleanup 里 flush，
  // 否则上一份快照会在下次变化时立刻落库，500ms 的合并窗口形同虚设
  useEffect(() => {
    debouncedSaveHistory(historyList);
  }, [historyList, debouncedSaveHistory]);

  // 仅在卸载时冲刷最后一次待写快照
  useEffect(
    () => () => {
      debouncedSaveHistory.flush();
    },
    [debouncedSaveHistory],
  );

  /* ──────── Actions ──────── */

  /**
   * 如果开发者会使用 pushMessage 添加 user message
   * 则可能需要像 send 一样，需要添加滚动逻辑
   * 暂时没有添加滚动逻辑是认为开发者应该只添加 assistant message
   * 而 user message 只在 user-input 里输入
   */
  const pushMessage = useCallback(
    (payload: Message) => {
      dispatch({type: 'PUSH_MESSAGE', payload});
    },
    [dispatch],
  );

  const updateMessage = useCallback(
    (payload: UpdateMessagePayload) => {
      // 直接派发，不做 rAF / transition 合并：
      // 合并会让「缓冲中的内容」与「立即派发的收尾动作」分处两个优先级，
      // 收尾可能先提交，导致完成态短暂带旧内容、甚至被下一条消息覆盖。
      dispatch({type: 'UPDATE_MESSAGE', payload});
    },
    [dispatch],
  );

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
      if (!trimmedContent || streamingMessage) {
        return;
      }
      try {
        setUserInputValue('');
        const trimmedContext = context.trim();
        const finalContent = trimmedContext
          ? `${trimmedContext}\n\n${trimmedContent}`
          : trimmedContent;
        const message: Message = createUserMessage(finalContent);
        dispatch({type: 'ADD_COMPLETED_MESSAGE', payload: message});
        /**
         * 滚动到 messages-container 底部，使最新一轮的 user message 显示在屏幕顶部。
         *
         * 注意（设计意图，勿当 bug 修）：
         * 此处 dispatch 之后同步读取 scrollHeight，此时 React 尚未提交新消息 DOM，
         * 拿到的是「旧内容 + padding-bottom」的高度。但 .messages-container 的
         * padding-bottom ≈ 100cqh（约一屏），会把旧底部撑到视口顶部附近；等新 user
         * message 提交后被追加在旧最后一条消息之后、padding 之前，正好落在视口顶部，
         * 从而实现「user message 顶到顶部」的需求。
         *
         * 若改成在 useEffect 里用提交后的 scrollHeight 滚到底，反而会把新消息顶到
         * 视口上方（只剩 padding），破坏需求。流式回复不滚动同样是既定需求，故此处
         * 不做流式跟随。
         */
        // 判空只保护滚动：宿主可能不渲染 Chat.Messages（无头/自定义布局），
        // 此时 ref 为空，但消息已上屏，'send' 事件必须照常派发
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
        await eventBus.publish('send', message);
      } finally {
        userInputRef.current?.focus();
      }
    },
    [context, dispatch, eventBus, streamingMessage],
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
  }, [api, dispatch, eventBus]);

  const create = useCallback(async () => {
    dispatch({type: 'CREATE'});
    userInputRef.current?.focus();
    await eventBus.publish('create');
    api.success({
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api, dispatch, eventBus]);

  const keyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // 输入法组合态（拼音候选/确认阶段）不触发发送
      if (e.nativeEvent.isComposing) {
        return;
      }
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

  const selectHistory = useCallback(
    (item: HistoryItem) => {
      dispatch({type: 'SELECT_HISTORY', payload: item});
      setIsHistoryModalVisible(false);
    },
    [dispatch],
  );

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
    [api, dispatch, modal],
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
