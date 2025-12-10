import { describe, expectTypeOf, test } from 'vitest'
import { useAsyncData } from '../use-async-data'
import { ComputedRef, Ref } from 'vue'

describe('useAsyncData type', () => {
  test('should be function', () => {
    expectTypeOf(useAsyncData).toBeFunction()
  })
  test('should return type ok when missing name', () => {
    const fn = () => ''
    type ResultWithoutName<Fn extends (...args: any) => any> = {
      queryData: Fn,
      queryDataLoading: Ref<boolean>,
      queryDataArguments: ComputedRef<[]>, 
      queryDataArgumentFirst: ComputedRef<undefined>, 
      queryDataError: Ref<any>
      data: Ref<Awaited<ReturnType<Fn>>>
      dataExpired: Ref<boolean>
    }
    expectTypeOf(useAsyncData(fn)).toEqualTypeOf<ResultWithoutName<typeof fn>>()
    expectTypeOf(useAsyncData('', fn)).toEqualTypeOf<ResultWithoutName<typeof fn>>()
    const fnAsync = () => Promise.resolve('')
    expectTypeOf(useAsyncData(fnAsync)).toEqualTypeOf<ResultWithoutName<typeof fnAsync>>()
    expectTypeOf(useAsyncData('', fnAsync)).toEqualTypeOf<ResultWithoutName<typeof fnAsync>>()
  })
  test('should return type ok with name', () => {
    const fn = () => ''
    type ResultWithName<Fn extends (...args: any) => any> = {
      queryOne: Fn,
      queryOneLoading: Ref<boolean>,
      queryOneArguments: ComputedRef<[]>, 
      queryOneArgumentFirst: ComputedRef<undefined>, 
      queryOneError: Ref<any>
      one: Ref<Awaited<ReturnType<Fn>>>
      oneExpired: Ref<boolean>
    }
    expectTypeOf(useAsyncData('one', fn)).toEqualTypeOf<ResultWithName<typeof fn>>()
    const fnAsync = () => Promise.resolve('')
    expectTypeOf(useAsyncData('one', fnAsync)).toEqualTypeOf<ResultWithName<typeof fnAsync>>()
  })
})
