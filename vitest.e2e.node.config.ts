import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * E2E 测试配置：针对 dist 产物的验证（jsdom 环境，从 dist 导入 ESM/UMD）
 * 与单元测试分离，需先执行 build 再运行
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: '~', replacement: resolve(__dirname, './') },
    ]
  },
  test: {
    name: 'e2e:node',
    setupFiles: [fileURLToPath(new URL('./e2e/node/setup.ts', import.meta.url))],
    environment: 'jsdom',
    include: ['e2e/node/**/*.test.ts'],
    root: fileURLToPath(new URL('.', import.meta.url)),
    typecheck: { enabled: false },
  },
}) as any
