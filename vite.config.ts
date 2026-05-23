import {defineConfig} from 'vite';
import {manualChunks} from './vite.config.shared';

export default defineConfig({
  build: {
    outDir: 'dist/es',
    lib: {
      entry: './src/index.ts',
      name: 'AIClientSDK',
      fileName: 'ai-client-sdk',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    open: '/examples/development-stream.html',
  },
});
