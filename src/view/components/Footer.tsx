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

import CreateIcon from './icons/CreateIcon';
import DeleteIcon from './icons/DeleteIcon';
import StopIcon from './icons/StopIcon';
import SendIcon from './icons/SendIcon';
import HistoryIcon from './icons/HistoryIcon';
import {useChat} from './Chat';

/* ─────────────────────────────────────────────────────────────────────
 * Frame — Footer 容器骨架
 * ───────────────────────────────────────────────────────────────────── */
function Frame({children}: {children: React.ReactNode}) {
  return <div className="bottom-container">{children}</div>;
}

/* ─────────────────────────────────────────────────────────────────────
 * ActionBar — 顶部操作按钮区（新对话 / 历史对话）
 * ───────────────────────────────────────────────────────────────────── */
function ActionBar() {
  const {state, actions} = useChat();
  const {streamingMessage} = state;
  const {create, openHistoryModal} = actions;

  return (
    <div className="action-bar">
      <button
        className="icon square plain"
        type="button"
        aria-label="新对话"
        onClick={() => {
          void create();
        }}
        disabled={!!streamingMessage}
      >
        <CreateIcon />
      </button>
      <button
        className="icon square plain"
        type="button"
        aria-label="历史对话"
        onClick={openHistoryModal}
        disabled={!!streamingMessage}
      >
        <HistoryIcon />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Context — 上下文展示区（含翻译快捷按钮）
 * ───────────────────────────────────────────────────────────────────── */
function Context() {
  const {state, actions} = useChat();
  const {context} = state;
  const {deleteContext, translate} = actions;

  if (!context) {
    return null;
  }

  return (
    <>
      <div className="context-container">
        <p className="context-text">{context}</p>
        <button
          className="context-delete"
          type="button"
          aria-label="删除上下文"
          onClick={deleteContext}
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
            void translate();
          }}
        >
          翻译
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 显式 Variant 按钮 — SendButton / StopButton
 * ───────────────────────────────────────────────────────────────────── */
function SendButton() {
  const {actions} = useChat();
  const {send} = actions;

  return (
    <button
      className="icon square plain"
      type="button"
      aria-label="发送 (↵)"
      onClick={() => {
        void send();
      }}
    >
      <div className="send-icon">
        <SendIcon />
      </div>
    </button>
  );
}

function StopButton() {
  const {actions} = useChat();
  const {stop} = actions;

  return (
    <button
      className="icon square plain"
      type="button"
      aria-label="停止"
      onClick={() => {
        void stop();
      }}
    >
      <div className="stop-icon">
        <StopIcon />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * UserInput — 输入框 + 发送/停止按钮（根据 streaming 状态选择 variant）
 * ───────────────────────────────────────────────────────────────────── */
function UserInput() {
  const {state, actions, meta} = useChat();
  const {streamingMessage, userInputValue} = state;
  const {keyDown, setUserInputValue} = actions;
  const {userInputRef} = meta;

  return (
    <div className="user-input-container">
      <textarea
        name="user-input"
        className="user-input"
        placeholder="发消息..."
        value={userInputValue}
        onChange={(e) => {
          setUserInputValue(e.target.value);
        }}
        onKeyDown={keyDown}
        ref={userInputRef}
      />
      <div className="button-wrap">{streamingMessage ? <StopButton /> : <SendButton />}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 复合组件对象
 * ───────────────────────────────────────────────────────────────────── */
export const Footer = {
  Frame,
  ActionBar,
  Context,
  UserInput,
  SendButton,
  StopButton,
};
