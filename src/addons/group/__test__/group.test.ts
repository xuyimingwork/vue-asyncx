// addons/group/__test__/group.test.ts
import { getAsyncDataContext } from '@/addons/data'
import { withAddonGroup } from '@/addons/group'
import { useAsyncData } from '@/hooks/use-async-data/use-async-data'
import { useAsync } from '@/hooks/use-async/use-async'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('withAddonGroup', () => {
  afterEach(() => vi.useRealTimers())

  describe('with useAsync', () => {
    describe('Group Creation and Access', () => {
      it('should create group on first call', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { confirm, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        expect(confirmGroup.value['fixed']).toBeUndefined()

        confirm(1)

        expect(confirmGroup.value['fixed'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(confirmGroup.value['fixed'].loading).toBe(false)
      })

      it('should return undefined for non-existent keys', () => {
        const fn = vi.fn(() => ({ id: 1 }))

        const { confirm, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const symbolKey = Symbol('test')
        expect(confirmGroup.value[symbolKey as any]).toBeUndefined()
      })
    })

    describe('State Synchronization (Fixed Key)', () => {
      it('should sync loading state with global state', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { confirm, confirmLoading, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        expect(confirmLoading.value).toBe(false)
        expect(confirmGroup.value['fixed']).toBeUndefined()

        confirm(1)

        expect(confirmLoading.value).toBe(true)
        expect(confirmGroup.value['fixed'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(confirmLoading.value).toBe(false)
        expect(confirmGroup.value['fixed'].loading).toBe(false)
      })

      it('should sync error state with global state', async () => {
        vi.useFakeTimers()
        const error = new Error('Test error')
        const fn = vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          throw error
        })

        const { confirm, confirmError, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const promise = confirm()

        await vi.runAllTimersAsync()
        await expect(promise).rejects.toBe(error)

        expect(confirmError.value).toBe(error)
        expect(confirmGroup.value['fixed'].error).toBe(error)
      })

      it('should sync arguments state with global state', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number, name: string) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name }
        })

        const { confirm, confirmArguments, confirmArgumentFirst, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        confirm(1, 'test')

        expect(confirmArguments.value).toEqual([1, 'test'])
        expect(confirmGroup.value['fixed'].arguments).toEqual([1, 'test'])
        expect(confirmArgumentFirst.value).toBe(1)
        expect(confirmGroup.value['fixed'].argumentFirst).toBe(1)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(confirmArguments.value).toBeUndefined()
        expect(confirmGroup.value['fixed'].arguments).toBeUndefined()
      })
    })

    describe('Multiple Keys', () => {
      it('should maintain independent state for different keys', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { confirm, confirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = confirm(1)
        const p2 = confirm(2)

        expect(confirmGroup.value['1'].loading).toBe(true)
        expect(confirmGroup.value['2'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(confirmGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })
        expect(confirmGroup.value['2'].data).toEqual({ id: 2, name: 'User 2' })
        expect(confirmGroup.value['1'].data).not.toEqual(confirmGroup.value['2'].data)
      })
    })

    describe('clearConfirmGroup', () => {
      it('should clear specific key', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { confirm, confirmGroup, clearConfirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = confirm(1)
        const p2 = confirm(2)
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(confirmGroup.value['1']).toBeDefined()
        expect(confirmGroup.value['2']).toBeDefined()

        clearConfirmGroup('1')

        expect(confirmGroup.value['1']).toBeUndefined()
        expect(confirmGroup.value['2']).toBeDefined()
      })

      it('should clear all groups when called without argument', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { confirm, confirmGroup, clearConfirmGroup } = useAsync('confirm', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = confirm(1)
        const p2 = confirm(2)
        const p3 = confirm(3)
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2, p3])

        expect(confirmGroup.value['1']).toBeDefined()
        expect(confirmGroup.value['2']).toBeDefined()
        expect(confirmGroup.value['3']).toBeDefined()

        clearConfirmGroup()

        expect(confirmGroup.value['1']).toBeUndefined()
        expect(confirmGroup.value['2']).toBeUndefined()
        expect(confirmGroup.value['3']).toBeUndefined()
      })
    })
  })

  describe('with useAsyncData', () => {
    describe('Group Creation and Access', () => {
      it('should create group on first call', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        expect(userGroup.value['fixed']).toBeUndefined()

        queryUser(1)

        expect(userGroup.value['fixed'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(userGroup.value['fixed'].loading).toBe(false)
      })
    })

    describe('State Synchronization (Fixed Key)', () => {
      it('should sync loading state with global state', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { queryUser, queryUserLoading, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        expect(queryUserLoading.value).toBe(false)
        expect(userGroup.value['fixed']).toBeUndefined()

        queryUser(1)

        expect(queryUserLoading.value).toBe(true)
        expect(userGroup.value['fixed'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(queryUserLoading.value).toBe(false)
        expect(userGroup.value['fixed'].loading).toBe(false)
      })

      it('should sync error state with global state', async () => {
        vi.useFakeTimers()
        const error = new Error('Test error')
        const fn = vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          throw error
        })

        const { queryUser, queryUserError, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const promise = queryUser()

        await vi.runAllTimersAsync()
        await expect(promise).rejects.toBe(error)

        expect(queryUserError.value).toBe(error)
        expect(userGroup.value['fixed'].error).toBe(error)
      })

      it('should sync data state with global state', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { queryUser, user, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const promise = queryUser(1)

        await vi.runAllTimersAsync()
        await promise

        expect(user.value).toEqual({ id: 1, name: 'User 1' })
        expect(userGroup.value['fixed'].data).toEqual({ id: 1, name: 'User 1' })
      })

      it('should sync dataExpired state with global state', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          if (id === 2) throw new Error('Failed')
          return { id, name: `User ${id}` }
        })

        const { queryUser, userExpired, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const p1 = queryUser(1)
        await vi.runAllTimersAsync()
        await p1

        expect(userExpired.value).toBe(false)
        expect(userGroup.value['fixed'].dataExpired).toBe(false)

        const p2 = queryUser(2)
        await vi.runAllTimersAsync()
        await expect(p2).rejects.toThrow()

        expect(userExpired.value).toBe(true)
        expect(userGroup.value['fixed'].dataExpired).toBe(true)
      })
    })

    describe('Multiple Keys', () => {
      it('should maintain independent state for different keys', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = queryUser(1)
        const p2 = queryUser(2)

        expect(userGroup.value['1'].loading).toBe(true)
        expect(userGroup.value['2'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(userGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })
        expect(userGroup.value['2'].data).toEqual({ id: 2, name: 'User 2' })
        expect(userGroup.value['1'].data).not.toEqual(userGroup.value['2'].data)
      })

      it('should handle multiple keys simultaneously', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return { id }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        queryUser(1)
        queryUser(2)
        queryUser(3)

        expect(userGroup.value['1'].loading).toBe(true)
        expect(userGroup.value['2'].loading).toBe(true)
        expect(userGroup.value['3'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await Promise.resolve()

        expect(userGroup.value['1'].loading).toBe(false)
        expect(userGroup.value['2'].loading).toBe(false)
        expect(userGroup.value['3'].loading).toBe(false)
        expect(userGroup.value['1'].data).toEqual({ id: 1 })
        expect(userGroup.value['2'].data).toEqual({ id: 2 })
        expect(userGroup.value['3'].data).toEqual({ id: 3 })
      })
    })

    describe('Edge Cases', () => {
      it('should handle undefined/null keys', () => {
        const fn = vi.fn(() => ({ id: 1 }))

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => args[0] ?? 'default' })]
        })

        // @ts-ignore
        queryUser(undefined)

        expect(userGroup.value['default']).toBeDefined()
        expect(userGroup.value['default'].loading).toBe(false)
      })

      it('should handle empty string key', () => {
        const fn = vi.fn(() => ({ id: 1 }))

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => '' })]
        })

        queryUser()

        expect(userGroup.value['']).toBeDefined()
        expect(userGroup.value[''].loading).toBe(false)
      })

      it('should sync group when updateData is called via getAsyncDataContext during execution', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          const { updateData } = getAsyncDataContext()!
          await new Promise(resolve => setTimeout(resolve, 30))
          updateData({ id, name: `User ${id} (partial)` })
          await new Promise(resolve => setTimeout(resolve, 30))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        const promise = queryUser(1)

        await vi.advanceTimersByTimeAsync(30)
        await Promise.resolve()

        expect(userGroup.value['fixed'].data).toEqual({ id: 1, name: 'User 1 (partial)' })

        await vi.runAllTimersAsync()
        await promise

        expect(userGroup.value['fixed'].data).toEqual({ id: 1, name: 'User 1' })
      })
    })

    describe('clearUserGroup', () => {
      it('should clear specific key', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup, clearUserGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = queryUser(1)
        const p2 = queryUser(2)
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['2']).toBeDefined()

        clearUserGroup('1')

        expect(userGroup.value['1']).toBeUndefined()
        expect(userGroup.value['2']).toBeDefined()
      })

      it('should clear all groups when called without argument', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup, clearUserGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = queryUser(1)
        const p2 = queryUser(2)
        const p3 = queryUser(3)
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2, p3])

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['2']).toBeDefined()
        expect(userGroup.value['3']).toBeDefined()

        clearUserGroup()

        expect(userGroup.value['1']).toBeUndefined()
        expect(userGroup.value['2']).toBeUndefined()
        expect(userGroup.value['3']).toBeUndefined()
      })

      it('should allow recreating group after clearing', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup, clearUserGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = queryUser(1)
        await vi.runAllTimersAsync()
        await p1

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })

        clearUserGroup('1')
        expect(userGroup.value['1']).toBeUndefined()

        const p2 = queryUser(1)
        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['1'].loading).toBe(true)

        await vi.runAllTimersAsync()
        await p2

        expect(userGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })
      })

      it('should handle clearing non-existent key', () => {
        const fn = vi.fn(() => ({ id: 1 }))

        const { clearUserGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: () => 'fixed' })]
        })

        expect(() => clearUserGroup('non-existent')).not.toThrow()
      })

      it('should clear group while request is pending', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number) => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup, clearUserGroup } = useAsyncData('user', fn, {
          addons: [withAddonGroup({ key: (args) => String(args[0]) })]
        })

        const p1 = queryUser(1)

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['1'].loading).toBe(true)

        clearUserGroup('1')

        expect(userGroup.value['1']).toBeUndefined()

        await vi.runAllTimersAsync()
        await p1

        expect(userGroup.value['1']).toBeUndefined()
      })
    })

    describe('Scope Logic', () => {
      it('should keep groups with same scope', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number, scope: string) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [
            withAddonGroup({
              key: (args) => String(args[0]),
              scope: (args) => String(args[1])
            })
          ]
        })

        const p1 = queryUser(1, 'scope1')
        const p2 = queryUser(2, 'scope1')
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['2']).toBeDefined()
        expect(userGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })
        expect(userGroup.value['2'].data).toEqual({ id: 2, name: 'User 2' })
      })

      it('should clear groups from different scope when switching scope', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number, scope: string) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [
            withAddonGroup({
              key: (args) => String(args[0]),
              scope: (args) => String(args[1])
            })
          ]
        })

        const p1 = queryUser(1, 'scope1')
        const p2 = queryUser(2, 'scope1')
        await vi.runAllTimersAsync()
        await Promise.all([p1, p2])

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['2']).toBeDefined()

        const p3 = queryUser(3, 'scope2')
        await vi.runAllTimersAsync()
        await p3

        expect(userGroup.value['1']).toBeUndefined()
        expect(userGroup.value['2']).toBeUndefined()
        expect(userGroup.value['3']).toBeDefined()
        expect(userGroup.value['3'].data).toEqual({ id: 3, name: 'User 3' })
      })

      it('should immediately clear groups when scope changes', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async (id: number, scope: string) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id, name: `User ${id}` }
        })

        const { queryUser, userGroup } = useAsyncData('user', fn, {
          addons: [
            withAddonGroup({
              key: (args) => String(args[0]),
              scope: (args) => String(args[1])
            })
          ]
        })

        const p1 = queryUser(1, 'scope1')
        await vi.advanceTimersByTimeAsync(10)
        await p1

        expect(userGroup.value['1']).toBeDefined()
        expect(userGroup.value['1'].data).toEqual({ id: 1, name: 'User 1' })

        const p2 = queryUser(2, 'scope2')

        await Promise.resolve()
        expect(userGroup.value['1']).toBeUndefined()
        expect(userGroup.value['2']).toBeDefined()

        await vi.advanceTimersByTimeAsync(10)
        await p2

        expect(userGroup.value['1']).toBeUndefined()
        expect(userGroup.value['2']).toBeDefined()
        expect(userGroup.value['2'].data).toEqual({ id: 2, name: 'User 2' })
      })
    })
  })
})
