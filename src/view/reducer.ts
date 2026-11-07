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

import {isAssistantMessage} from '../utils/guard';
import type {Message} from '../models/Message';
import type {UpdateMessagePayload} from '../types';
import {type HistoryItem, createHistoryItem} from '../models/HistoryItem';

export const STORAGE_KEY = 'chatHistory';

interface State {
  completedMessages: Message[];
  streamingMessage: Message | null;
  historyList: HistoryItem[];
  currentId: string;
}

type Action =
  | {type: 'UPDATE_MESSAGE'; payload: UpdateMessagePayload}
  | {type: 'PUSH_MESSAGE'; payload: Message}
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

export const init = (): State => ({
  completedMessages: [],
  streamingMessage: null,
  historyList: getHistoryList(),
  currentId: '',
});

const createHistory = (historyList: HistoryItem[]): State => {
  const newHistoryItem = createHistoryItem();
  return {
    completedMessages: [],
    streamingMessage: null,
    historyList: [...historyList, newHistoryItem],
    currentId: newHistoryItem.id,
  };
};

const addCompletedMessage = (state: State, message: Message): State => {
  /* 非 loading 的 PUSH_MESSAGE 也复用这里：落库的同时会清空在途流式消息。
     正常使用中宿主不会在流式期间推入非流式消息（UI 在 streamingMessage 存在时
     已禁用发送/新建/历史入口），若发生则等同于丢弃在途流，它不会进入 completedMessages。 */
  const newCompletedMessages = [...state.completedMessages, message];
  if (state.currentId === '') {
    const newHistoryItem = createHistoryItem(newCompletedMessages);
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
        return {...item, messages: newCompletedMessages};
      }
      return item;
    }),
  };
};

/**
 * 状态不变量与宿主契约（违反契约的组合不在 reducer 内兜底，行为见各分支注释）：
 *
 * - 同一时刻只有一条「未落库」的流式消息（streamingMessage）。正确时序是
 *   pushMessage(loading: true) → updateMessage(...) → updateMessage(loading: false)，
 *   且上一条收尾后才能推入下一条。UI 内部（发送、新建、历史入口）已按此约束禁用，
 *   但宿主直接调用 panel.pushMessage / updateMessage 时无法拦截。
 * - message.id 由 generateId 生成，实际全局唯一。若重复使用同一个 id，
 *   UPDATE_MESSAGE 只会命中当前持有该 id 的消息，另一条被遮蔽。
 * - CREATE / SELECT_HISTORY / DELETE_HISTORY 会清空或切换当前会话，在途流式消息一并丢弃，
 *   之后到达的 UPDATE_MESSAGE 因 id 不存在而成为 no-op（刻意不复活已清空的消息）。
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'UPDATE_MESSAGE': {
      const {id, field, value} = action.payload;
      if (state.streamingMessage?.id === id) {
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
      if (!state.completedMessages.some((item) => item.id === id)) {
        /* 进入该分支的来源有三种，均刻意 no-op：id 从未被 push 过（宿主误用）；
           会话被 CREATE / SELECT_HISTORY / DELETE_HISTORY 清空或切换；
           宿主在收尾前推入了下一条，旧流式消息已被覆盖。
           此时已没有可安全落库的位置，不重建孤儿消息，也不抛出。
           重复收尾（id 已在 completedMessages）会走下面的已完成消息更新分支。 */
        return state;
      }
      const newCompletedMessages = state.completedMessages.map((item) => {
        if (item.id === id) {
          return {...item, [field]: value};
        }
        return item;
      });
      return {
        ...state,
        completedMessages: newCompletedMessages,
        historyList: state.historyList.map((item) => {
          if (item.id === state.currentId) {
            return {...item, messages: newCompletedMessages};
          }
          return item;
        }),
      };
    }
    case 'PUSH_MESSAGE': {
      if (isAssistantMessage(action.payload) && action.payload.loading) {
        /* 单流式槽位：直接覆盖在途消息。正确时序下上一条的 loading:false 已先派发并落库，
           因此新消息不会覆盖未结算的那条；若宿主违反契约（上一条收尾前就推入下一条），
           旧消息会被永久覆盖，其随后的 updateMessage 也会因 id 不存在而成为 no-op。 */
        return {
          ...state,
          streamingMessage: action.payload,
        };
      }
      return addCompletedMessage(state, action.payload);
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
        completedMessages: [...messages],
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
    default: {
      /* 穷尽性检查：所有 action 都被覆盖时 exhaustive 收窄为 never，此赋值合法；
         一旦 Action 新增变体却漏写 case，这里就会在编译期报错 */
      const exhaustive: never = action;
      throw new Error(`Unknown action: ${JSON.stringify(exhaustive)}`);
    }
  }
};
