// addons/group/__test__/group.test.ts
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
function createTestSetup(fn: BaseFunction, key: (args: any[]) => string | number) {
  return setupFunctionPipeline({
    fn,
    addons: [
      withAddonGroup({ key }),
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
      expect(group['fixed']).toBeUndefined()

      // Make a call
      method(1)
      
      // Group should be created and loading should be true
      expect(group['fixed'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(group['fixed'].loading).toBe(false)
    })

    it('should return undefined for symbol keys', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonGroup({ key: () => 'fixed' }), withMethodAddon()]
      })

      const group = result.__name__Group.value
      const symbolKey = Symbol('test')
      
      // Accessing with symbol key should return undefined (normal object behavior)
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
      expect(group['fixed']).toBeUndefined()

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
            key: (args) => args[0] ?? 'default' 
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
            key: () => '' 
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

  describe('clear__name__Group', () => {
    it('should clear specific key', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value
      const clearGroup = result.clear__name__Group

      // Create groups for multiple keys
      const p1 = method(1)
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // Both groups should exist
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })

      // Clear specific key
      clearGroup('1')

      // Key '1' should be cleared, but '2' should still exist
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeDefined()
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })
    })

    it('should clear all groups when called without argument', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const clearGroup = result.clear__name__Group

      // Create groups for multiple keys
      const p1 = method(1)
      const p2 = method(2)
      const p3 = method(3)
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2, p3])

      // All groups should exist
      const group = result.__name__Group.value
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()
      expect(group['3']).toBeDefined()

      // Clear all groups
      clearGroup()

      // All groups should be cleared (check computed value again)
      const groupAfterClear = result.__name__Group.value
      expect(groupAfterClear['1']).toBeUndefined()
      expect(groupAfterClear['2']).toBeUndefined()
      expect(groupAfterClear['3']).toBeUndefined()
    })

    it('should allow recreating group after clearing', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value
      const clearGroup = result.clear__name__Group

      // Create and complete a call
      const p1 = method(1)
      await vi.runAllTimersAsync()
      await p1

      expect(group['1']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })

      // Clear the group
      clearGroup('1')
      expect(group['1']).toBeUndefined()

      // Call again - should recreate the group
      const p2 = method(1)
      expect(group['1']).toBeDefined()
      expect(group['1'].loading).toBe(true)

      await vi.runAllTimersAsync()
      await p2

      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
    })

    it('should handle clearing non-existent key', () => {
      const fn = vi.fn(() => ({ id: 1 }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [withAddonGroup({ key: () => 'fixed' }), withMethodAddon()]
      })

      const clearGroup = result.clear__name__Group

      // Clear non-existent key should not throw
      expect(() => clearGroup('non-existent')).not.toThrow()
    })

    it('should clear group while request is pending', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value
      const clearGroup = result.clear__name__Group

      // Start a request
      const p1 = method(1)
      
      // Group should be created and loading
      expect(group['1']).toBeDefined()
      expect(group['1'].loading).toBe(true)

      // Clear the group while request is still pending
      clearGroup('1')

      // Group should be cleared immediately
      expect(group['1']).toBeUndefined()

      // Wait for the request to complete
      await vi.runAllTimersAsync()
      await p1

      // Group should still be undefined (not recreated by the completed request)
      expect(group['1']).toBeUndefined()
    })

    it('should clear all groups while requests are pending', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const clearGroup = result.clear__name__Group

      // Start multiple requests
      const p1 = method(1)
      const p2 = method(2)
      const p3 = method(3)

      // All groups should be created and loading
      let group = result.__name__Group.value
      expect(group['1']).toBeDefined()
      expect(group['1'].loading).toBe(true)
      expect(group['2']).toBeDefined()
      expect(group['2'].loading).toBe(true)
      expect(group['3']).toBeDefined()
      expect(group['3'].loading).toBe(true)

      // Clear all groups while requests are still pending
      clearGroup()

      // All groups should be cleared immediately
      group = result.__name__Group.value
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeUndefined()
      expect(group['3']).toBeUndefined()

      // Wait for all requests to complete
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2, p3])

      // Groups should still be undefined (not recreated by completed requests)
      group = result.__name__Group.value
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeUndefined()
      expect(group['3']).toBeUndefined()
    })

    it('should allow new requests after clearing pending requests', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value
      const clearGroup = result.clear__name__Group

      // Start a request
      const p1 = method(1)
      expect(group['1']?.loading).toBe(true)

      // Clear while pending
      clearGroup('1')
      expect(group['1']).toBeUndefined()

      // Wait for the old request to complete (should not recreate group)
      await vi.runAllTimersAsync()
      await p1
      expect(group['1']).toBeUndefined()

      // Start a new request with the same key
      const p2 = method(1)
      expect(group['1']).toBeDefined()
      expect(group['1'].loading).toBe(true)

      // Wait for new request to complete
      await vi.runAllTimersAsync()
      await p2

      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
    })
  })

  describe('Scope Logic', () => {
    it('should keep groups with same scope', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any
      const group = result.__name__Group.value

      // Create groups with same scope
      const p1 = method(1, 'scope1')
      const p2 = method(2, 'scope1')
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // Both groups should exist (same scope)
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })
    })

    it('should clear groups from different scope when switching scope', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any
      const group = result.__name__Group.value

      // Create groups with scope1
      const p1 = method(1, 'scope1')
      const p2 = method(2, 'scope1')
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // Both groups should exist
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()

      // Switch to scope2 - should trigger auto-clear after debounce
      const p3 = method(3, 'scope2')
      await vi.runAllTimersAsync()
      await p3

      // Wait for debounce (100ms)
      await vi.advanceTimersByTimeAsync(150)
      await Promise.resolve()

      // Groups from scope1 should be cleared, scope2 group should exist
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeUndefined()
      expect(group['3']).toBeDefined()
      expect(group['3'].data).toEqual({ id: 3, name: 'User 3' })
    })

    it('should handle debounce for scope auto-clear', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any

      // Create group with scope1
      const p1 = method(1, 'scope1')
      // Only advance enough time for the function to complete (10ms), not debounce
      await vi.advanceTimersByTimeAsync(10)
      await p1

      let group = result.__name__Group.value
      expect(group['1']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })

      // Switch to scope2 - this triggers clearAuto with debounce (100ms)
      // The clearAuto is debounced, so it won't execute immediately
      const p2 = method(2, 'scope2')
      
      // Immediately check (before async completes) - group['1'] should still exist
      group = result.__name__Group.value
      expect(group['1']).toBeDefined()
      
      // Only advance enough time for the function to complete (10ms), not debounce (100ms)
      await vi.advanceTimersByTimeAsync(10)
      await p2

      // After async operations complete, check again before debounce timeout
      // The debounce should not have executed yet (needs 100ms total from when clearAuto was called)
      group = result.__name__Group.value
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()

      // Advance time but not enough to trigger debounce (50ms < 100ms)
      await vi.advanceTimersByTimeAsync(50)
      await Promise.resolve()
      
      group = result.__name__Group.value
      expect(group['1']).toBeDefined()

      // After debounce timeout (additional 50ms to reach 100ms total), scope1 group should be cleared
      await vi.advanceTimersByTimeAsync(50)
      await Promise.resolve()

      group = result.__name__Group.value
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeDefined()
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })
    })

    it('should handle multiple scope switches', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any
      const group = result.__name__Group.value

      // scope1 -> scope2 -> scope3
      const p1 = method(1, 'scope1')
      await vi.runAllTimersAsync()
      await p1

      const p2 = method(2, 'scope2')
      await vi.runAllTimersAsync()
      await p2

      // Wait for debounce to clear scope1
      await vi.advanceTimersByTimeAsync(150)
      await Promise.resolve()

      expect(group['1']).toBeUndefined() // scope1 cleared
      expect(group['2']).toBeDefined()   // scope2 exists

      const p3 = method(3, 'scope3')
      await vi.runAllTimersAsync()
      await p3

      // Wait for debounce to clear scope2
      await vi.advanceTimersByTimeAsync(150)
      await Promise.resolve()

      expect(group['1']).toBeUndefined() // scope1 cleared
      expect(group['2']).toBeUndefined()   // scope2 cleared
      expect(group['3']).toBeDefined()     // scope3 exists
    })

    it('should work without scope option', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = createTestSetup(fn, (args) => args[0] as string)
      const method = result.method as any
      const group = result.__name__Group.value

      // Create multiple groups without scope
      const p1 = method(1)
      const p2 = method(2)
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      // All groups should exist (no auto-clear without scope)
      expect(group['1']).toBeDefined()
      expect(group['2']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
      expect(group['2'].data).toEqual({ id: 2, name: 'User 2' })
    })

    it('should handle same key with different scopes', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any
      const group = result.__name__Group.value

      // Same key '1' with scope1
      const p1 = method(1, 'scope1')
      await vi.runAllTimersAsync()
      await p1

      expect(group['1']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })

      // Switch to scope2 with same key
      // Since key is the same, it uses the same group object, but scope is updated
      const p2 = method(1, 'scope2')
      await vi.runAllTimersAsync()
      await p2

      // Wait for debounce to potentially clear other scopes
      await vi.advanceTimersByTimeAsync(150)
      await Promise.resolve()

      // Since key is the same ('1'), the group object remains, but scope is now scope2
      // The group data should be from the latest call (scope2)
      expect(group['1']).toBeDefined()
      expect(group['1'].data).toEqual({ id: 1, name: 'User 1' })
    })

    it('should respect custom clearAutoDelay', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string,
            clearAutoDelay: 200 // Custom delay
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any

      // Create group with scope1
      const p1 = method(1, 'scope1')
      await vi.advanceTimersByTimeAsync(10)
      await p1

      let group = result.__name__Group.value
      expect(group['1']).toBeDefined()

      // Switch to scope2
      const p2 = method(2, 'scope2')
      await vi.advanceTimersByTimeAsync(10)
      await p2

      // Before custom debounce timeout (200ms), scope1 group should still exist
      await vi.advanceTimersByTimeAsync(150)
      await Promise.resolve()
      
      group = result.__name__Group.value
      expect(group['1']).toBeDefined()

      // After custom debounce timeout (200ms), scope1 group should be cleared
      await vi.advanceTimersByTimeAsync(60)
      await Promise.resolve()

      group = result.__name__Group.value
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeDefined()
    })

    it('should use default clearAutoDelay when not specified', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [
          withAddonGroup({ 
            key: (args) => args[0] as string,
            scope: (args) => args[1] as string
            // clearAutoDelay not specified, should use default 100ms
          }),
          withAddonData(),
          withAddonLoading(),
          withAddonError(),
          withAddonArguments(),
          withMethodAddon()
        ]
      })

      const method = result.method as any

      // Create group with scope1
      const p1 = method(1, 'scope1')
      await vi.advanceTimersByTimeAsync(10)
      await p1

      let group = result.__name__Group.value
      expect(group['1']).toBeDefined()

      // Switch to scope2
      const p2 = method(2, 'scope2')
      await vi.advanceTimersByTimeAsync(10)
      await p2

      // Before default debounce timeout (100ms), scope1 group should still exist
      await vi.advanceTimersByTimeAsync(50)
      await Promise.resolve()
      
      group = result.__name__Group.value
      expect(group['1']).toBeDefined()

      // After default debounce timeout (100ms), scope1 group should be cleared
      await vi.advanceTimersByTimeAsync(60)
      await Promise.resolve()

      group = result.__name__Group.value
      expect(group['1']).toBeUndefined()
      expect(group['2']).toBeDefined()
    })
  })
})
