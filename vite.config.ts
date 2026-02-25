import { resolve } from 'path';
import { defineConfig } from "vite";
import dts from 'vite-plugin-dts';

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
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
    exclude: ['demo', 'docs', 'public', 'e2e', 'vitest.e2e.config.ts'],
    
  })],
}) as any