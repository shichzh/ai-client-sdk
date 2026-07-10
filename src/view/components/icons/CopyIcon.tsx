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

import {memo, type SVGProps} from 'react';

const CopyIcon = memo((props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      {...props}
    >
      <path d="M298.667 256V128a42.667 42.667 0 0 1 42.666-42.667h512A42.667 42.667 0 0 1 896 128v597.333A42.667 42.667 0 0 1 853.333 768h-128v128c0 23.552-19.2 42.667-42.965 42.667H170.965A42.71 42.71 0 0 1 128 896l.128-597.333c0-23.552 19.2-42.667 42.923-42.667h127.616zm-85.248 85.333-.086 512H640v-512H213.419zM384 256h341.333v426.667h85.334v-512H384V256z" />
    </svg>
  );
});

CopyIcon.displayName = 'CopyIcon';

export default CopyIcon;
