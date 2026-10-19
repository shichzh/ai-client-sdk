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

import {Component, type ErrorInfo, type ReactNode} from 'react';
import type {Reject} from '../../types';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * 渲染异常时的通知回调，用于让 mount 的 onReady Promise 落地为 reject，
   * 避免组件树崩溃后宿主侧 await 相关的调用永久挂起
   */
  onError: Reject;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * 渲染错误兜底：错误边界必须位于 Chat.Provider 之上，
 * 因为 reducer 异常发生在渲染 Chat.Provider 自身的过程中，边界内的子组件捕获不到
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {hasError: false};

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ai-client-sdk] 组件渲染异常：', error, errorInfo.componentStack);
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-fallback" role="alert">
          <p className="error-fallback-title">组件渲染异常</p>
          <p className="error-fallback-desc">请刷新页面重试；若问题持续出现，请反馈给开发者。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
