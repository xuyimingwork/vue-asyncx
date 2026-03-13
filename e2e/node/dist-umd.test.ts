/**
 * E2E 测试：验证 dist/vue-asyncx.umd.cjs (UMD) 产物
 * 通过 require 加载，模拟 CommonJS 环境
 */
import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const VueAsyncx = require('../../dist/vue-asyncx.umd.cjs')

describe('dist/vue-asyncx.umd.cjs (UMD)', () => {
  test('can be required and exports APIs', () => {
    expect(VueAsyncx).toBeDefined()
    expect(typeof VueAsyncx.useAsync).toBe('function')
    expect(typeof VueAsyncx.useAsyncData).toBe('function')
    expect(typeof VueAsyncx.withAddonGroup).toBe('function')
  })

  test('useAsync works when used from UMD bundle', () => {
    const { useAsync } = VueAsyncx
    const fn = (a: number, b: number) => a + b
    const result = useAsync(fn)
    expect(result.method(2, 3)).toBe(5)
  })
})
