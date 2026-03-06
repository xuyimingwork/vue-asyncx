import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Browser 测试配置：使用 Playwright 在真实浏览器中验证 CDN 加载的 UMD 产物
 * 加载 e2e/vue2|vue3/index.cdn.html，需先执行 build 再运行
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
