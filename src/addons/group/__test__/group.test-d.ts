import { describe, expectTypeOf, test } from 'vitest'
import { useAsync } from '@/hooks/use-async/use-async'
import { useAsyncData } from '@/hooks/use-async-data/use-async-data'
import { withAddonGroup, type GroupType } from '@/addons/group'
import type { ComputedRef } from 'vue-demi'

describe('withAddonGroup type', () => {
  test('withAddonGroup should be function', () => {
    expectTypeOf(withAddonGroup).toBeFunction()
  })

  describe('useAsync + withAddonGroup', () => {
    test('should add confirmGroup and clearConfirmGroup to useAsync result', () => {
      const confirmApi = (id: string) => Promise.resolve({ success: true })
      const result = useAsync('confirm', confirmApi, {
        addons: [withAddonGroup({ key: (args) => args[0] })]
      })

      expectTypeOf(result).toHaveProperty('confirm')
      expectTypeOf(result).toHaveProperty('confirmGroup')
      expectTypeOf(result).toHaveProperty('clearConfirmGroup')

      expectTypeOf(result.confirm).toEqualTypeOf<typeof confirmApi>()
      expectTypeOf(result.clearConfirmGroup).toEqualTypeOf<(key?: string | number) => void>()
    })

    test('confirmGroup should be ComputedRef of Record with GroupType values', () => {
      const confirmApi = (id: string) => Promise.resolve({ success: true })
      const result = useAsync('confirm', confirmApi, {
        addons: [withAddonGroup({ key: (args) => args[0] })]
      })

      type ExpectedGroup = GroupType<typeof confirmApi>
      expectTypeOf(result.confirmGroup).toEqualTypeOf<ComputedRef<Record<string | number, ExpectedGroup>>>()
    })

    test('GroupType should have loading, error, arguments, argumentFirst, data, dataExpired', () => {
      const fn = (id: number) => Promise.resolve({ id, name: 'User' })
      type G = GroupType<typeof fn>

      expectTypeOf<G>().toHaveProperty('loading')
      expectTypeOf<G['loading']>().toEqualTypeOf<boolean>()
      expectTypeOf<G>().toHaveProperty('error')
      expectTypeOf<G>().toHaveProperty('arguments')
      expectTypeOf<G['arguments']>().toEqualTypeOf<[number] | undefined>()
      expectTypeOf<G>().toHaveProperty('argumentFirst')
      expectTypeOf<G['argumentFirst']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<G>().toHaveProperty('data')
      expectTypeOf<G['data']>().toEqualTypeOf<{ id: number; name: string } | undefined>()
      expectTypeOf<G>().toHaveProperty('dataExpired')
      expectTypeOf<G['dataExpired']>().toEqualTypeOf<boolean>()
    })
  })

  describe('useAsyncData + withAddonGroup', () => {
    test('should add userGroup and clearUserGroup to useAsyncData result', () => {
      const getUserApi = (id: string) => Promise.resolve({ id, name: 'Mike' })
      const result = useAsyncData('user', getUserApi, {
        addons: [withAddonGroup({ key: (args) => args[0] })]
      })

      expectTypeOf(result).toHaveProperty('queryUser')
      expectTypeOf(result).toHaveProperty('user')
      expectTypeOf(result).toHaveProperty('userGroup')
      expectTypeOf(result).toHaveProperty('clearUserGroup')

      expectTypeOf(result.queryUser).toEqualTypeOf<typeof getUserApi>()
      expectTypeOf(result.clearUserGroup).toEqualTypeOf<(key?: string | number) => void>()
    })

    test('userGroup should be ComputedRef of Record with GroupType values', () => {
      const getUserApi = (id: string) => Promise.resolve({ id, name: 'Mike' })
      const result = useAsyncData('user', getUserApi, {
        addons: [withAddonGroup({ key: (args) => args[0] })]
      })

      type ExpectedGroup = GroupType<typeof getUserApi>
      expectTypeOf(result.userGroup).toEqualTypeOf<ComputedRef<Record<string | number, ExpectedGroup>>>()
    })

    test('should work with default name when useAsyncData has no name', () => {
      const fn = () => Promise.resolve('data')
      const result = useAsyncData(fn, {
        addons: [withAddonGroup({ key: () => 'fixed' })]
      })

      expectTypeOf(result).toHaveProperty('queryData')
      expectTypeOf(result).toHaveProperty('dataGroup')
      expectTypeOf(result).toHaveProperty('clearDataGroup')
    })
  })
})
