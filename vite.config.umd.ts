import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/umd',
    lib: {
      entry: './src/index.ts',
      name: 'AIClientSDK',
      fileName: 'ai-client-sdk',
      formats: ['umd'],
    },
  },
  server: {
    open: '/examples/development.html',
  },
});
