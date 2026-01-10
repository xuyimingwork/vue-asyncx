import { describe, expect, test } from "vitest"
import { getAsyncDataContext, unFirstArgumentEnhanced, useAsync, useAsyncData, useAsyncFunction } from '@/main'

describe('main', () => {
  test('should exports useAsync, useAsyncData, getAsyncDataContext, unFirstArgumentEnhanced, useAsyncFunction', () => {
    expect(typeof useAsync === 'function').toBe(true)
    expect(typeof useAsyncData === 'function').toBe(true)
    expect(typeof getAsyncDataContext === 'function').toBe(true)
    expect(typeof unFirstArgumentEnhanced === 'function').toBe(true)
    expect(typeof useAsyncFunction === 'function').toBe(true)
  })
})