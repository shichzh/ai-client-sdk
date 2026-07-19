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
import type {Message, UpdateMessagePayload} from '../types';
import {type HistoryItem, createHistoryItem} from '../models/HistoryItem';

export const STORAGE_KEY = 'chatHistory';

export interface State {
  completedMessages: Message[];
  streamingMessage: Message | null;
  historyList: HistoryItem[];
  currentId: string;
}

export type Action =
  | {type: 'UPDATE_MESSAGE'; payload: UpdateMessagePayload}
  | {type: 'PUSH_MESSAGE'; payload: Message}
  | {type: 'SET_COMPLETED_MESSAGES'; payload: Message[]}
  | {type: 'ADD_COMPLETED_MESSAGE'; payload: Message}
  | {type: 'STOP'}
  | {type: 'CREATE'}
  | {type: 'SELECT_HISTORY'; payload: HistoryItem}
  | {type: 'DELETE_HISTORY'; payload: string};

export const getHistoryList = (): HistoryItem[] => {
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
  const newHistoryItem = createHistoryItem();
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

export const reducer = (state: State, action: Action): State => {
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
      if (isAssistantMessage(action.payload) && action.payload.loading) {
        return {
          ...state,
          streamingMessage: action.payload,
        };
      }
      return addCompletedMessage(state, action.payload);
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
