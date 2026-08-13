import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/extension/content-script.ts',
      output: {
        entryFileNames: 'content-script.js',
      },
    },
  },
});
