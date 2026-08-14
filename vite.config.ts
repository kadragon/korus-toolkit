import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        contentScript: 'src/extension/content-script.ts',
        settings: 'src/extension/settings.ts',
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'contentScript' || chunkInfo.name === 'settings'
            ? `${chunkInfo.name === 'contentScript' ? 'content-script' : 'settings'}.js`
            : 'assets/[name].js',
      },
    },
  },
});
