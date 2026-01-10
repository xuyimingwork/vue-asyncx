import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
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
  })
) as any