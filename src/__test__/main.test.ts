import { describe, expect, test } from "vitest"
import { unFirstArgumentEnhanced, useAsync, useAsyncData, useAsyncFunction } from '../main'

describe('main', () => {
  test('导出', () => {
    expect(typeof useAsync === 'function').toBe(true)
    expect(typeof useAsyncData === 'function').toBe(true)
    expect(typeof useAsyncFunction === 'function').toBe(true)
    expect(typeof unFirstArgumentEnhanced === 'function').toBe(true)
    expect(useAsyncFunction === useAsync).toBe(true)
  })
})