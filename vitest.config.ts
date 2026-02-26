import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig((env) => mergeConfig(
  viteConfig(env),
  {
    test: {
      setupFiles: [fileURLToPath(new URL('./src/__test__/setup.ts', import.meta.url))],
      typecheck: {
        enabled: true,
        include: ['src/**']
      },
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./src', import.meta.url)),
      coverage: { 
        provider: 'v8', 
        exclude: ['__test__/**']
      }
    }
  }
)) as any