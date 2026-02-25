import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * E2E 测试配置：针对 dist 产物的验证
 * 与单元测试分离，需先执行 build 再运行
 */
export default defineConfig({
  test: {
    name: 'e2e',
    setupFiles: [fileURLToPath(new URL('./e2e/setup.ts', import.meta.url))],
    environment: 'jsdom',
    include: ['e2e/**/*.test.ts'],
    exclude: ['src/**', 'node_modules/**'],
    root: fileURLToPath(new URL('.', import.meta.url)),
    // 不启用 typecheck，e2e 从 dist 导入，类型可能不完整
    typecheck: { enabled: false },
  },
}) as any
