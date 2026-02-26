import { resolve } from 'path';
import { defineConfig } from "vite";
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  return {
    publicDir: false as const,
    resolve: {
      alias: [
        ...(mode === 'vue2' ? [
          { find: 'vue', replacement: 'vue2' },
          { find: '@/compat/compat', replacement: resolve(__dirname, 'src/compat/compat.vue2') },
        ] : []),
        { find: '@', replacement: resolve(__dirname, 'src') },
      ]
    },
    build: {
      target: 'es2018',
      lib: {
        entry: resolve(__dirname, 'src/main.ts'),
        name: 'VueAsyncx',
        fileName: 'vue-asyncx',
      },
      rolldownOptions: {
        external: ['vue'],
        output: {
          globals: {
            vue: "Vue"
          }
        }
      },
    },
    plugins: [dts({ 
      rollupTypes: true,
      exclude: ['demo', 'docs', 'public', 'e2e', 'vitest.e2e.config.ts', '**/__test__/**'],
      aliasesExclude: ['vue']
    })],
  }
}) as any