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

const DeleteIcon = memo((props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" {...props}>
      <path d="M7 8.414L3.293 12.121a1 1 0 0 1-1.414-1.414L5.586 7 1.879 3.293a1 1 0 0 1 1.414-1.414L7 5.586l3.707-3.707a1 1 0 1 1 1.414 1.414L8.414 7l3.707 3.707a1 1 0 0 1-1.414 1.414L7 8.414z" />
    </svg>
  );
});

export default DeleteIcon;
