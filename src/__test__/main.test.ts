import * as main from '@/main'
import { describe, expect, test } from "vitest"

const exposed = {
  useAsync: "function",
  useAsyncData: "function",
  useAsyncFunction: "function",
  
  unFirstArgumentEnhanced: "function",
  getAsyncDataContext: "function",

  withAddonGroup: "function",
}

describe('main', () => {
  test('should exports useAsync, useAsyncData, getAsyncDataContext, unFirstArgumentEnhanced, useAsyncFunction', () => {
    expect(Object.keys(main).length).toBe(Object.keys(exposed).length)
    Object.keys(exposed).forEach(key => expect(typeof main[key] === exposed[key]).toBe(true))
  })
})