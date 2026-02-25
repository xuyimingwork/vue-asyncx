/**
 * E2E 测试：验证 dist/vue-asyncx.js (ESM) 产物
 * 从构建产物导入，确保打包后的库在真实使用场景下正常工作
 */
import * as VueAsyncx from '../dist/vue-asyncx.js'
import { describe, expect, test } from 'vitest'
import { nextTick } from 'vue-demi'

const exposed = {
  useAsync: 'function',
  useAsyncData: 'function',
  useAsyncFunction: 'function',
  unFirstArgumentEnhanced: 'function',
  getAsyncDataContext: 'function',
  withAddonGroup: 'function',
}

describe('dist/vue-asyncx.js (ESM)', () => {
  test('exports all expected APIs', () => {
    expect(Object.keys(VueAsyncx).length).toBe(Object.keys(exposed).length)
    Object.keys(exposed).forEach((key) => {
      expect(typeof (VueAsyncx as any)[key]).toBe(exposed[key as keyof typeof exposed])
    })
  })

  test('useAsync works with sync function', () => {
    const { useAsync } = VueAsyncx
    const fn = (a: number, b: number) => a + b
    const result = useAsync(fn)
    expect(result.method(1, 2)).toBe(3)
    expect(result.methodLoading.value).toBe(false)
  })

  test('useAsync works with async function', async () => {
    const { useAsync } = VueAsyncx
    const fn = async (x: number) => {
      await new Promise((r) => setTimeout(r, 10))
      return x * 2
    }
    const result = useAsync(fn)
    const p = result.method(5)
    expect(result.methodLoading.value).toBe(true)
    const res = await p
    expect(res).toBe(10)
    await nextTick()
    expect(result.methodLoading.value).toBe(false)
  })

  test('useAsyncData basic usage - sync', () => {
    const { useAsyncData } = VueAsyncx
    const { data, queryData } = useAsyncData(() => ({ value: 42 }))
    expect(queryData()).toEqual({ value: 42 })
    expect(data.value).toEqual({ value: 42 })
  })

  test('useAsyncData basic usage - async', async () => {
    const { useAsyncData } = VueAsyncx
    const { data, queryData } = useAsyncData(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return { value: 'ok' }
    })
    const p = queryData()
    await p
    await nextTick()
    expect(data.value).toEqual({ value: 'ok' })
  })

  test('withAddonGroup returns addon function', () => {
    const { withAddonGroup } = VueAsyncx
    expect(typeof withAddonGroup).toBe('function')
    const addon = withAddonGroup({ key: () => 'fixed' })
    expect(typeof addon).toBe('function')
  })
})
