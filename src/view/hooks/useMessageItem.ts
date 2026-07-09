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

import {useState, useEffect, useRef, type MouseEvent} from 'react';
import {parseMarkdown} from '../../utils/markdown';
import type {Message} from '../../utils/types';

export const useMessageItem = (message: Message) => {
  const [isCopied, setIsCopied] = useState(false);
  const [parsedContent, setParsedContent] = useState('');
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message.content) {
      parseMarkdown(message.content)
        .then(setParsedContent)
        .catch((err: unknown) => {
          console.error('Failed to parse markdown:', err);
        });
    } else {
      setParsedContent('');
    }
  }, [message.content]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    const text = message.content;
    navigator.clipboard
      .writeText(text)
      .catch((err: unknown) => {
        console.error('Failed to copy text: ', err);
      })
      .finally(() => {
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }
        setIsCopied(true);
        copiedTimerRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 1500);
      });
  };

  return {
    isCopied,
    parsedContent,
    handleCopy,
  };
};
