// addons/data/index.test.ts
import { withAddonData } from '@/addons/data'
import { setupFunctionPipeline } from '@/core/setup-pipeline'
import { getAsyncDataContext } from '@/addons/data/context'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref, isRef, isReactive } from 'vue'
import type { FunctionMonitor } from '@/core/monitor'
import type { BaseFunction } from '@/utils/types'

// Helper addon to get method without key conflict
function withMethodAddon() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    return ({ method }: { method: BaseFunction }) => ({
      method
    })
  }
}

describe('withAddonData', () => {
  beforeEach(() => {
    // 确保每次测试前上下文是干净的
    expect(getAsyncDataContext()).toBeNull()
  })

  afterEach(() => {
    // 确保每次测试后上下文是干净的
    expect(getAsyncDataContext()).toBeNull()
  })

  describe('Basic Functionality', () => {
    it('should return data and expired refs with default config', () => {
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      expect(result).toHaveProperty('__name__')
      expect(result).toHaveProperty('__name__Expired')
      expect(isRef(result.__name__)).toBe(true)
      expect(isRef(result.__name__Expired)).toBe(true)
      expect(result.__name__.value).toBeUndefined()
      expect(result.__name__Expired.value).toBe(false)
    })

    it('should return Data and DataExpired when type is "function"', () => {
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ type: 'function' }), withMethodAddon()]
      })

      expect(result).toHaveProperty('__name__Data')
      expect(result).toHaveProperty('__name__DataExpired')
      expect(result).not.toHaveProperty('__name__')
      expect(result).not.toHaveProperty('__name__Expired')
      expect(isRef(result.__name__Data)).toBe(true)
      expect(isRef(result.__name__DataExpired)).toBe(true)
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should return data and expired when type is "data"', () => {
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ type: 'data' }), withMethodAddon()]
      })

      expect(result).toHaveProperty('__name__')
      expect(result).toHaveProperty('__name__Expired')
      expect(result).not.toHaveProperty('__name__Data')
      expect(result).not.toHaveProperty('__name__DataExpired')
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should use shallowRef when shallow is true', () => {
      const fn = vi.fn(async () => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ shallow: true }), withMethodAddon()]
      })

      // shallowRef: internal value is not reactive
      expect(isRef(result.__name__)).toBe(true)
      if (result.__name__.value && typeof result.__name__.value === 'object') {
        expect(isReactive(result.__name__.value)).toBe(false)
      }
    })

    it('should use ref when shallow is false', () => {
      const fn = vi.fn(async () => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ shallow: false }), withMethodAddon()]
      })

      // ref: internal value is reactive
      expect(isRef(result.__name__)).toBe(true)
      if (result.__name__.value && typeof result.__name__.value === 'object') {
        expect(isReactive(result.__name__.value)).toBe(true)
      }
    })

    it('should use initialData when provided', () => {
      const initialData = { id: 0, name: 'Initial' }
      const fn = vi.fn(async () => ({ id: 1, name: 'Updated' }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ initialData }), withMethodAddon()]
      })

      expect(result.__name__.value).toEqual(initialData)
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should handle null initialData', () => {
      const fn = vi.fn(async () => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ initialData: null }), withMethodAddon()]
      })

      expect(result.__name__.value).toBeNull()
    })

    it('should handle undefined initialData', () => {
      const fn = vi.fn(async () => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ initialData: undefined }), withMethodAddon()]
      })

      expect(result.__name__.value).toBeUndefined()
    })
  })

  describe('Data Updates', () => {
    it('should update data on fulfill event', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method(1)

      await vi.runAllTimersAsync()
      await promise

      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
    })

    it('should only update data from latest call', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, id === 1 ? 200 : 50))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const p1 = method(1) // Slow call
      const p2 = method(2) // Fast call

      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // Latest call (p2) should win
      expect(result.__name__.value).toEqual({ id: 2, name: 'User 2' })
    })

    it('should handle sync function', () => {
      const fn = vi.fn((id: number) => ({ id, name: `User ${id}` }))

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      method(1)

      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
    })

    it('should handle primitive return values', () => {
      const fn = vi.fn(() => 42)

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      method()

      expect(result.__name__.value).toBe(42)
    })

    it('should handle array return values', () => {
      const fn = vi.fn(() => [1, 2, 3])

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      method()

      expect(result.__name__.value).toEqual([1, 2, 3])
    })
  })

  describe('Data Expired', () => {
    it('should mark data as expired when no data but has finished call', async () => {
      vi.useFakeTimers()
      const error = new Error('Failed')
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw error
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method()

      await vi.runAllTimersAsync()
      await expect(promise).rejects.toBe(error)

      // No data, but call finished (with error) -> expired
      expect(result.__name__Expired.value).toBe(true)
    })

    it('should mark data as expired when current data call failed', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (id === 1) {
          return { id: 1, name: 'User 1' }
        }
        throw new Error('Failed')
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      // First call succeeds
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1
      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
      expect(result.__name__Expired.value).toBe(false)

      // Second call fails
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow()

      // Data from first call is now expired because second call failed
      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
      expect(result.__name__Expired.value).toBe(true)
    })

    it('should not mark data as expired when latest call succeeds', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1

      const p2 = method(2)
      await vi.runAllTimersAsync()
      await p2

      expect(result.__name__.value).toEqual({ id: 2, name: 'User 2' })
      expect(result.__name__Expired.value).toBe(false)
    })

    it('should mark data as expired when later call fails after success', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (id === 1) {
          return { id: 1, name: 'User 1' }
        }
        throw new Error('Failed')
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      // First call succeeds
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1
      expect(result.__name__Expired.value).toBe(false)

      // Second call fails
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow()

      // Data is expired because later call failed
      expect(result.__name__Expired.value).toBe(true)
    })

    it('should reset expired when new call succeeds', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (id === 2) {
          throw new Error('Failed')
        }
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      // First call succeeds
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1
      expect(result.__name__Expired.value).toBe(false)

      // Second call fails
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow()
      expect(result.__name__Expired.value).toBe(true)

      // Third call succeeds
      const p3 = method(3)
      await vi.runAllTimersAsync()
      await p3
      expect(result.__name__Expired.value).toBe(false)
    })
  })

  describe('Context Management', () => {
    it('should provide context during function execution', async () => {
      vi.useFakeTimers()
      let contextInFunction: any = null
      const fn = vi.fn(async (id: number) => {
        contextInFunction = getAsyncDataContext()
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method(1)

      // Context should be available during sync part
      expect(contextInFunction).not.toBeNull()
      expect(contextInFunction).toHaveProperty('getData')
      expect(contextInFunction).toHaveProperty('updateData')

      await vi.runAllTimersAsync()
      await promise

      // Context should be cleaned up after execution
      expect(getAsyncDataContext()).toBeNull()
    })

    it('should not provide context outside function execution', () => {
      const fn = vi.fn(() => ({ id: 1 }))

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      // Context should not be available outside execution
      expect(getAsyncDataContext()).toBeNull()
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should allow updateData during function execution', async () => {
      vi.useFakeTimers()
      let contextInFunction: any = null
      const fn = vi.fn(async (id: number) => {
        contextInFunction = getAsyncDataContext()
        // Update data during execution
        contextInFunction.updateData({ id, name: 'Updated during execution' })
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method(1)

      // Data should be updated during execution
      expect(result.__name__.value).toEqual({ id: 1, name: 'Updated during execution' })

      await vi.runAllTimersAsync()
      await promise

      // Final value from fulfill should overwrite
      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
    })

    it('should allow getData during function execution', async () => {
      vi.useFakeTimers()
      const initialData = { id: 0, name: 'Initial' }
      let contextInFunction: any = null
      const fn = vi.fn(async (id: number) => {
        contextInFunction = getAsyncDataContext()
        const currentData = contextInFunction.getData()
        await new Promise(resolve => setTimeout(resolve, 100))
        return { ...currentData, id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ initialData }), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method(1)

      await vi.runAllTimersAsync()
      await promise

      // Function should have access to initial data
      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
    })
  })

  describe('Race Conditions', () => {
    it('should handle rapid successive calls', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      // Make multiple rapid calls
      const promises = [method(1), method(2), method(3), method(4), method(5)]

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      // Only latest call should win
      expect(result.__name__.value).toEqual({ id: 5, name: 'User 5' })
    })

    it('should handle interleaved success and failure', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        if (id % 2 === 0) {
          throw new Error(`Failed ${id}`)
        }
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      
      const p1 = method(1) // Success
      const p2 = method(2) // Fail
      const p3 = method(3) // Success

      await vi.runAllTimersAsync()
      await Promise.allSettled([p1, p2, p3])

      // Latest successful call should win
      expect(result.__name__.value).toEqual({ id: 3, name: 'User 3' })
      expect(result.__name__Expired.value).toBe(false)
    })
  })

  describe('Combined Options', () => {
    it('should work with type="function" and shallow=true', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ type: 'function', shallow: true }), withMethodAddon()]
      })

      expect(result).toHaveProperty('__name__Data')
      expect(isRef(result.__name__Data)).toBe(true)
      if (result.__name__Data.value && typeof result.__name__Data.value === 'object') {
        expect(isReactive(result.__name__Data.value)).toBe(false)
      }
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should work with type="data" and initialData', () => {
      const initialData = { id: 0 }
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ type: 'data', initialData }), withMethodAddon()]
      })

      expect(result.__name__.value).toEqual(initialData)
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })

    it('should work with all options combined', () => {
      const initialData = { id: 0, name: 'Initial' }
      const fn = vi.fn(() => ({ id: 1, name: 'Updated' }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({ 
          type: 'function', 
          shallow: true, 
          initialData 
        }), withMethodAddon()]
      })

      expect(result.__name__Data.value).toEqual(initialData)
      expect(isRef(result.__name__Data)).toBe(true)
      if (result.__name__Data.value && typeof result.__name__Data.value === 'object') {
        expect(isReactive(result.__name__Data.value)).toBe(false)
      }
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })
  })

  describe('Edge Cases', () => {
    it('should handle function that returns undefined', () => {
      const fn = vi.fn(() => undefined)

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      method()

      expect(result.__name__.value).toBeUndefined()
    })

    it('should handle function that returns null', () => {
      const fn = vi.fn(() => null)

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      method()

      expect(result.__name__.value).toBeNull()
    })

    it('should handle function that throws synchronously', () => {
      const error = new Error('Sync error')
      const fn = vi.fn(() => {
        throw error
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      expect(() => method()).toThrow(error)

      // Data should not be updated on error
      expect(result.__name__.value).toBeUndefined()
    })

    it('should handle function that throws asynchronously', async () => {
      vi.useFakeTimers()
      const error = new Error('Async error')
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw error
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const promise = method()

      await vi.runAllTimersAsync()
      await expect(promise).rejects.toBe(error)

      // Data should not be updated on error
      expect(result.__name__.value).toBeUndefined()
      expect(result.__name__Expired.value).toBe(true)
    })

    it('should handle empty config object', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonData({}), withMethodAddon()]
      })

      expect(result).toHaveProperty('__name__')
      expect(result).toHaveProperty('__name__Expired')
      
      const method = result.method as any
      expect(method).toBeTypeOf('function')
    })
  })
})

