import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const contentBuild = mode === 'content';

  return {
    build: {
      emptyOutDir: contentBuild,
      rollupOptions: {
        input: contentBuild ? 'src/extension/content-script.ts' : 'src/extension/settings.ts',
        output: {
          codeSplitting: contentBuild ? false : undefined,
          entryFileNames: contentBuild ? 'content-script.js' : 'settings.js',
        },
      },
    },
  };
});
