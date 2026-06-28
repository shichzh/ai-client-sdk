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

const LoadingIcon = memo((props: SVGProps<SVGSVGElement>) => {
  return (
    <span className="loading-spinner">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 1024 1024"
        fill="none"
        stroke="currentColor"
        strokeWidth="80"
        {...props}
      >
        <circle cx="512" cy="512" r="400" strokeDasharray="2506" strokeDashoffset="627" />
      </svg>
    </span>
  );
});

export default LoadingIcon;
