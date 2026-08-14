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

import {memo} from 'react';
import {Modal} from 'antd';
import dayjs from 'dayjs';
import type {HistoryItem} from '../../models/HistoryItem';
import DeleteIcon from './icons/DeleteIcon';

interface HistoryModalProps {
  isHistoryModalVisible: boolean;
  historyList: HistoryItem[];
  currentId: string;
  handleCloseHistoryModal: () => void;
  handleSelectHistory: (item: HistoryItem) => void;
  handleDeleteHistory: (item: HistoryItem) => void;
}

const HistoryModal = ({
  isHistoryModalVisible,
  historyList,
  currentId,
  handleCloseHistoryModal,
  handleSelectHistory,
  handleDeleteHistory,
}: HistoryModalProps) => {
  return (
    <Modal
      title="历史对话"
      open={isHistoryModalVisible}
      onCancel={handleCloseHistoryModal}
      footer={null}
    >
      {isHistoryModalVisible ? (
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
                      e.stopPropagation();
                      handleDeleteHistory(item);
                    }}
                  >
                    <DeleteIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default memo(HistoryModal);
