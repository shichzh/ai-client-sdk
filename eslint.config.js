import globals from 'globals';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  {
    ignores: ['node_modules/', 'dist/', 'coverage/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {react, 'react-hooks': reactHooks},
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
    ],
    /**
     * TODO: 目前 eslint-plugin-react 在配置 version: 'detect' 时，会报错
     * 先固定版本号
     */
    settings: {
      react: {
        version: '19.2.7',
      },
    },
  },
]);
