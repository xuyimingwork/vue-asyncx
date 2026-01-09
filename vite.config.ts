import { defineConfig } from "vite";
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es6',
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
    exclude: ['demo', 'docs']
  })],
}) as any