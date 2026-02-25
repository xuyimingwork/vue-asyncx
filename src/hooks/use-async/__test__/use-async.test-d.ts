import { describe, expectTypeOf, test } from 'vitest'
import { useAsync } from '@/hooks/use-async/use-async'
import { ComputedRef, Ref } from 'vue-demi'

describe('useAsync type', () => {
  test('should be function', () => {
    expectTypeOf(useAsync).toBeFunction()
  })
  test('should return type ok when missing name', () => {
    const fn = () => ''
    type ResultWithoutName<Fn> = {
      method: Fn,
      methodLoading: Ref<boolean>,
      methodArguments: ComputedRef<[]>, 
      methodArgumentFirst: ComputedRef<undefined>, 
      methodError: Ref<any>
    }
    expectTypeOf(useAsync(fn)).toEqualTypeOf<ResultWithoutName<typeof fn>>()
    expectTypeOf(useAsync('', fn)).toEqualTypeOf<ResultWithoutName<typeof fn>>()
    const fnAsync = () => Promise.resolve('')
    expectTypeOf(useAsync(fnAsync)).toEqualTypeOf<ResultWithoutName<typeof fnAsync>>()
    expectTypeOf(useAsync('', fnAsync)).toEqualTypeOf<ResultWithoutName<typeof fnAsync>>()
  })
  test('should return type ok with name', () => {
    const fn = () => ''
    type ResultWithName<Fn> = {
      one: Fn,
      oneLoading: Ref<boolean>,
      oneArguments: ComputedRef<[]>, 
      oneArgumentFirst: ComputedRef<undefined>, 
      oneError: Ref<any>
    }
    expectTypeOf(useAsync('one', fn)).toEqualTypeOf<ResultWithName<typeof fn>>()
    const fnAsync = () => Promise.resolve('')
    expectTypeOf(useAsync('one', fnAsync)).toEqualTypeOf<ResultWithName<typeof fnAsync>>()
  })
})

