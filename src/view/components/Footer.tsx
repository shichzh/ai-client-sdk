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

import {memo, type KeyboardEvent, type RefObject} from 'react';
import type {Message} from '../../types';
import CreateIcon from './icons/CreateIcon';
import DeleteIcon from './icons/DeleteIcon';
import StopIcon from './icons/StopIcon';
import SendIcon from './icons/SendIcon';
import HistoryIcon from './icons/HistoryIcon';

interface FooterProps {
  context: string;
  streamingMessage: Message | null;
  userInputValue: string;
  userInputRef: RefObject<HTMLTextAreaElement | null>;
  handleCreate: () => Promise<void>;
  handleOpenHistoryModal: () => void;
  handleDeleteContext: () => void;
  handleTranslate: () => Promise<void>;
  handleSend: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  setUserInputValue: (value: string) => void;
}

const Footer = ({
  context,
  streamingMessage,
  userInputValue,
  userInputRef,
  handleCreate,
  handleOpenHistoryModal,
  handleDeleteContext,
  handleTranslate,
  handleSend,
  handleStop,
  handleKeyDown,
  setUserInputValue,
}: FooterProps) => {
  return (
    <div className="bottom-container">
      <div className="action-bar">
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
        <button
          className="icon square plain"
          type="button"
          aria-label="历史对话"
          onClick={handleOpenHistoryModal}
          disabled={!!streamingMessage}
        >
          <HistoryIcon />
        </button>
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Footer);
