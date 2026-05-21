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

const HistoryIcon = memo((props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path d="M512 938.667c235.648 0 426.667-191.019 426.667-426.667S747.648 85.333 512 85.333 85.333 276.352 85.333 512 276.352 938.667 512 938.667z m0 85.333C229.248 1024 0 794.752 0 512S229.248 0 512 0s512 229.248 512 512-229.248 512-512 512z m42.667-486.87V298.54C554.667 275.328 535.552 256 512 256c-23.723 0-42.667 19.03-42.667 42.539v256.256a41.984 41.984 0 0 0 12.203 29.866L602.795 705.92a42.368 42.368 0 0 0 60.032-0.299 42.667 42.667 0 0 0 0.298-60.032L554.667 537.131z" />
    </svg>
  );
});

export default HistoryIcon;
