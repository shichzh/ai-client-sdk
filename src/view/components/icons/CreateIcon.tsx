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

import type {SVGProps} from 'react';

const CreateIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      {...props}
    >
      <path d="M597.333 128v85.333H170.667v571.094l75.221-59.094h607.445V426.667h85.334V768A42.667 42.667 0 0 1 896 810.667H275.413L85.333 960V170.667A42.667 42.667 0 0 1 128 128h469.333zm213.334 0V0H896v128h128v85.333H896v128h-85.333v-128h-128V128h128z" />
    </svg>
  );
};

export default CreateIcon;
