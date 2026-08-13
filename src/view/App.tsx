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
} from 'react';
import {debounce} from 'lodash-es';
import {isAssistantMessage} from '../utils/guard';
import {createUserMessage, type Message} from '../models/Message';
import type {UpdateMessagePayload, Resolve, ShowModalPayload, ModalType} from '../types';
import AssistantMessageItem from './components/AssistantMessageItem';
import UserMessageItem from './components/UserMessageItem';
import HistoryModal from './components/HistoryModal';
import Footer from './components/Footer';
import type {EventBus} from '../utils/eventBus';
import {Modal, notification, type NotificationArgsProps} from 'antd';
import styles from './css/index.css?inline';
import type {HistoryItem} from '../models/HistoryItem';
import {STORAGE_KEY, reducer, getHistoryList} from './reducer';

interface AppProps {
  onReady: Resolve;
  eventBus: EventBus;
}

const App = ({onReady, eventBus}: AppProps) => {
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
  const [api, notificationContextHolder] = notification.useNotification();
  const [modal, modalContextHolder] = Modal.useModal();
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
    onReady();
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

  const handleShowNotification = useCallback(
    (payload: NotificationArgsProps) => {
      api.open(payload);
    },
    [api],
  );

  const instanceRef = useRef<ReturnType<(typeof modal)[ModalType]> | null>(null);

  const handleShowModal = useCallback(
    (payload: ShowModalPayload) => {
      const {type, ...rest} = payload;
      instanceRef.current = modal[type](rest);
    },
    [modal],
  );

  const handleCloseModal = useCallback(() => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
  }, []);

  useEffect(() => {
    const disposers = [
      eventBus.subscribe('pushMessage', pushMessage),
      eventBus.subscribe('updateMessage', updateMessage),
      eventBus.subscribe('updateContext', updateContext),
      eventBus.subscribe('showNotification', handleShowNotification),
      eventBus.subscribe('showModal', handleShowModal),
      eventBus.subscribe('closeModal', handleCloseModal),
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
    handleShowNotification,
    handleShowModal,
    handleCloseModal,
    eventBus,
  ]);

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
      description: '对话已停止',
      placement: 'top',
      closable: false,
    });
  }, [api, eventBus]);

  const create = useCallback(() => {
    dispatch({type: 'CREATE'});
  }, []);

  const handleCreate = useCallback(async () => {
    create();
    userInputRef.current?.focus();
    await eventBus.publish('create');
    api.success({
      description: '新对话已创建',
      placement: 'top',
      closable: false,
    });
  }, [api, create, eventBus]);

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
      {notificationContextHolder}
      {modalContextHolder}
      <div className="messages-container" ref={messagesContainerRef}>
        {messageItems}
      </div>
      <Footer
        context={context}
        streamingMessage={streamingMessage}
        userInputValue={userInputValue}
        userInputRef={userInputRef}
        handleCreate={handleCreate}
        handleOpenHistoryModal={handleOpenHistoryModal}
        handleDeleteContext={handleDeleteContext}
        handleTranslate={handleTranslate}
        handleSend={handleSend}
        handleStop={handleStop}
        handleKeyDown={handleKeyDown}
        setUserInputValue={setUserInputValue}
      />
      <HistoryModal
        isHistoryModalVisible={isHistoryModalVisible}
        historyList={historyList}
        currentId={currentId}
        handleCloseHistoryModal={handleCloseHistoryModal}
        handleSelectHistory={handleSelectHistory}
        handleDeleteHistory={handleDeleteHistory}
      />
    </div>
  );
};

export default App;
