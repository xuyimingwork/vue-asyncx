import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * E2E 测试配置：针对 dist 产物的验证
 * 与单元测试分离，需先执行 build 再运行
 */
export default defineConfig(({ mode }) => {
  const IN_VUE2 = mode === 'vue2'

  return {
    test: {
      name: 'browser',
      include: ['e2e/**/*.browser.{test,spec}.ts'],
      browser: {
        provider: playwright(),
        enabled: true,
        headless: true,
        screenshotFailures: false,
        testerHtmlPath: IN_VUE2 
          ? './e2e/vue2/index.cdn.html'
          : './e2e/vue3/index.cdn.html',
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
  }
}) as any
