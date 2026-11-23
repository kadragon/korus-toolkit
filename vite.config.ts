import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const entry = mode === 'content' ? 'content-script' :
    mode === 'training-main' || mode === 'training-attachment' ? mode : 'settings';
  const contentScript = entry !== 'settings';

  return {
    plugins: [
      contentScript && {
        name: 'classic-content-script',
        generateBundle(_options, bundle) {
          const chunk = bundle[`${entry}.js`];
          if (!chunk || chunk.type !== 'chunk' || !/^\(function\s*\(/u.test(chunk.code)) {
            this.error(`${entry} must be a scoped classic script`);
          }
          new Script(chunk.code, { filename: chunk.fileName });
        },
      },
      mode === 'training-attachment' && {
        name: 'pdfjs-license',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'pdfjs-LICENSE.txt',
            source: readFileSync('node_modules/pdfjs-dist/LICENSE'),
          });
        },
      },
    ],
    build: {
      emptyOutDir: mode === 'content',
      modulePreload: contentScript ? false : undefined,
      rollupOptions: {
        input: `src/extension/${entry}.ts`,
        // PDF.js uses import.meta in its Node and optional rendering paths.
        transform: mode === 'training-attachment' ? { define: { 'import.meta': '{}' } } : undefined,
        output: {
          codeSplitting: contentScript ? false : undefined,
          format: contentScript ? 'iife' : undefined,
          entryFileNames: `${entry}.js`,
        },
      },
    },
  };
});
