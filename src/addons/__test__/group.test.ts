// addons/group.test.ts
import { withAddonArguments } from '@/addons/arguments'
import { withAddonData } from '@/addons/data'
import { withAddonError } from '@/addons/error'
import { withAddonGroup } from '@/addons/group'
import { withAddonLoading } from '@/addons/loading'
import type { FunctionMonitor } from '@/core/monitor'
import { setupFunctionPipeline } from '@/core/setup-pipeline'
import type { BaseFunction } from '@/utils/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Helper addon to get method without key conflict
function withMethodAddon() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    return ({ method }: { method: BaseFunction }) => ({
      method
    })
  }
}

// Helper function to create test setup
function createTestSetup(fn: BaseFunction, by: (args: any[]) => string | number) {
  return setupFunctionPipeline({
    fn,
    addons: [
      withAddonGroup({ by }),
      withAddonData(),
      withAddonLoading(),
      withAddonError(),
      withAddonArguments(),
      withMethodAddon()
    ]
  })
}

describe('withAddonGroup', () => {
  afterEach(() => vi.useRealTimers())

  describe('Group Creation and Access', () => {
    it('should return default state when accessing non-existent key', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonGroup({ by: () => 'fixed' }), withMethodAddon()]
      })

      const group = result.__name__Group.value
      const nonExistentKey = group['non-existent']
      
      expect(nonExistentKey).toEqual({
        loading: false,
        error: undefined,
        arguments: undefined,
        argumentFirst: undefined,
        data: undefined,
        dataExpired: false
      })
    })

    it('should create group on first call', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any

      // Before call, group should exist but with default state
      const group = result.__name__Group.value
      expect(group['fixed']).toBeDefined()
      expect(group['fixed'].loading).toBe(false)

      // Make a call
      method(1)
      
      // Group should be created and loading should be true
      expect(group['fixed'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(group['fixed'].loading).toBe(false)
    })

    it('should filter symbol keys in Proxy', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonGroup({ by: () => 'fixed' }), withMethodAddon()]
      })

      const group = result.__name__Group.value
      const symbolKey = Symbol('test')
      
      // Accessing with symbol key should return undefined
      expect(group[symbolKey as any]).toBeUndefined()
    })
  })

  describe('State Synchronization (Fixed Key)', () => {
    it('should sync loading state with global state', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any
      const group = result.__name__Group.value

      // Initially both should be false
      expect(result.__name__Loading.value).toBe(false)
      expect(group['fixed'].loading).toBe(false)

      // Start call
      method(1)
      
      // Both should be true
      expect(result.__name__Loading.value).toBe(true)
      expect(group['fixed'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.resolve()

      // Both should be false
      expect(result.__name__Loading.value).toBe(false)
      expect(group['fixed'].loading).toBe(false)
    })

    it('should sync error state with global state', async () => {
      vi.useFakeTimers()
      const error = new Error('Test error')
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw error
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any
      const group = result.__name__Group.value

      const promise = method()
      
      await vi.runAllTimersAsync()
      await expect(promise).rejects.toBe(error)

      // Both should have the same error
      expect(result.__name__Error.value).toBe(error)
      expect(group['fixed'].error).toBe(error)
    })

    it('should sync arguments state with global state', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number, name: string) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name }
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any
      const group = result.__name__Group.value

      method(1, 'test')
      
      // Both should have the same arguments
      expect(result.__name__Arguments.value).toEqual([1, 'test'])
      expect(group['fixed'].arguments).toEqual([1, 'test'])
      expect(result.__name__ArgumentFirst.value).toBe(1)
      expect(group['fixed'].argumentFirst).toBe(1)

      await vi.runAllTimersAsync()
      await Promise.resolve()

      // Both should be undefined after completion
      expect(result.__name__Arguments.value).toBeUndefined()
      expect(group['fixed'].arguments).toBeUndefined()
    })

    it('should sync data state with global state', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any
      const group = result.__name__Group.value

      const promise = method(1)
      
      await vi.runAllTimersAsync()
      await promise

      // Both should have the same data
      expect(result.__name__.value).toEqual({ id: 1, name: 'User 1' })
      expect(group['fixed'].data).toEqual({ id: 1, name: 'User 1' })
    })

    it('should sync dataExpired state with global state', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (id === 2) {
          throw new Error('Failed')
        }
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, () => 'fixed')
      const method = result.method as any
      const group = result.__name__Group.value

      // First call succeeds
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1
      
      expect(result.__name__Expired.value).toBe(false)
      expect(group['fixed'].dataExpired).toBe(false)

      // Second call fails
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow()

      // Both should be expired
      expect(result.__name__Expired.value).toBe(true)
      expect(group['fixed'].dataExpired).toBe(true)
    })
  })

  describe('Multiple Keys', () => {
    it('should maintain independent state for different keys', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value

      // Call with different keys
      const p1 = method(1)
      const p2 = method(2)

      // Both should be loading
      expect(group['1'].loading).toBe(true)
      expect(group['2'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // Both should have their own data
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })
      expect(group['1'].data).not.toEqual(group['2'].data)
    })

    it('should handle multiple keys simultaneously', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { id }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value

      // Make multiple calls with different keys
      method(1)
      method(2)
      method(3)

      // All should be loading
      expect(group['1'].loading).toBe(true)
      expect(group['2'].loading).toBe(true)
      expect(group['3'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.resolve()

      // All should be completed
      expect(group['1'].loading).toBe(false)
      expect(group['2'].loading).toBe(false)
      expect(group['3'].loading).toBe(false)
      expect(group['1'].data).toEqual({ id: 1 })
      expect(group['2'].data).toEqual({ id: 2 })
      expect(group['3'].data).toEqual({ id: 3 })
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined/null keys', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            by: (args) => args[0] ?? 'default' 
          }), 
          withMethodAddon()
        ]
      })

      const group = result.__name__Group.value
      const method = result.method as any

      // Call with undefined
      method(undefined)
      
      // Should use 'default' key
      expect(group['default']).toBeDefined()
      expect(group['default'].loading).toBe(false) // sync function completes immediately
    })

    it('should distinguish between different keys', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (key: string) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { key }
      })

      const result = createTestSetup(fn, (args) => args[0])
      const method = result.method as any
      const group = result.__name__Group.value

      // Call with first key
      const p1 = method('key1')
      await vi.runAllTimersAsync()
      await p1

      // First key should exist and have its data
      expect(group['key1']).toBeDefined()
      expect(group['key1'].data).toEqual({ key: 'key1' })

      // Call with second key (different key)
      const p2 = method('key2')
      await vi.runAllTimersAsync()
      await p2

      // Second key should exist as a separate group
      expect(group['key2']).toBeDefined()
      expect(group['key2'].data).toEqual({ key: 'key2' })
      
      // Verify they are independent by checking they have different references
      expect(group['key1']).not.toBe(group['key2'])
      // First key data should still be there (independent)
      expect(group['key1'].data).toEqual({ key: 'key1' })
    })

    it('should handle empty string key', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            by: () => '' 
          }), 
          withMethodAddon()
        ]
      })

      const group = result.__name__Group.value
      const method = result.method as any

      method()

      expect(group['']).toBeDefined()
      expect(group[''].loading).toBe(false)
    })

    it('should support mixed key types (number and string) for the same group', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number | string) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id }
      })

      const result = createTestSetup(fn, (args) => args[0])
      const method = result.method as any
      const group = result.__name__Group.value

      // First call with string key
      const p1 = method('1')
      await vi.runAllTimersAsync()
      await p1

      // Verify string key works
      expect(group['1']).toBeDefined()
      expect(group['1'].data).toEqual({ id: '1' })

      // Second call with number key - should work with the same group
      // because groups[1] and groups['1'] are the same (object keys are strings)
      // The implementation should handle this by normalizing the key
      const p2 = method(1)
      await vi.runAllTimersAsync()
      await p2

      // Both should point to the same group (since object keys are strings)
      expect(group[1]).toBe(group['1'])
      expect(group[1].data).toEqual({ id: 1 })
      expect(group['1'].data).toEqual({ id: 1 }) // Latest call should update the shared group
    })
  })
})
