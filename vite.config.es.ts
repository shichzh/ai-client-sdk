import {defineConfig} from 'vite';

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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('unified') || id.includes('remark') || id.includes('rehype')) {
              return 'vendor-markdown';
            }
            if (id.includes('ajv')) {
              return 'vendor-ajv';
            }
            if (id.includes('chrono-node')) {
              return 'vendor-chrono-node';
            }
          }
        },
      },
    },
  },
  server: {
    open: '/examples/development.html',
  },
});
