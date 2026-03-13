import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig((env) => {
  const IN_VUE2 = env.mode === 'vue2'
  return mergeConfig(
    viteConfig(env),
    {
      test: {
        name: 'unit',
        root: fileURLToPath(new URL('./src', import.meta.url)),
        setupFiles: [fileURLToPath(new URL('./src/__test__/setup.ts', import.meta.url))],
        typecheck: {
          /**
           * 由于源码没有使用 vue-demi，导致 vue-asyncx 的映射类型不对。
           * 单元测试不测试 vue 2.7 版类型，留到 e2e 时处理
           */
          enabled: !IN_VUE2,
          ignoreSourceErrors: true
        },
        environment: 'jsdom',
        coverage: {
          provider: 'v8',
          exclude: ['__test__/**'],
          reportsDirectory: fileURLToPath(new URL(env.mode === 'vue2' ? './coverage/vue2' : './coverage/vue3', import.meta.url)),
          reporter: ['json', 'lcov', 'html', 'text'],
        },
      }
    }
  )
}) as any