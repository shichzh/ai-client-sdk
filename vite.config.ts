import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'AIClientSDK',
      fileName: 'ai-client-sdk',
    },
  },
  server: {
    open: '/examples/development-stream.html',
  },
});
