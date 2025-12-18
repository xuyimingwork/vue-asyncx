import { parseArguments, useWatch } from "../shared/function"
import type { UseAsyncOptions, UseAsyncResult } from './types'
import { BoostCreator, StateCreator, useCore } from "../shared/core"
import { useStateError, useStateLoading, useStateParameters } from "../shared/state"
import type { Ref, ComputedRef } from "vue"
import { StringDefaultWhenEmpty } from "../utils"

export function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, 'method'>
export function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, Name>
export function useAsync(...args: any[]): any {
  const { name = 'method', fn, options } = parseArguments(args)
  return _useAsync({ name, fn, options })
}
export { useAsync as useAsyncFunction }

export function _useAsync<
  Name extends string,
  Fn extends (...args: any) => any, 
  const StateCreators extends readonly StateCreator[] = [],
  const BoostCreators extends readonly BoostCreator<Fn>[] = []
>({ 
  name, fn, options,
  stateCreators = [] as unknown as StateCreators,
  boostCreators = [] as unknown as BoostCreators,
}: { 
  name: Name, fn: Fn, options?: any,
  stateCreators?: StateCreators, 
  boostCreators?: BoostCreators
}) {
  type _Name = StringDefaultWhenEmpty<Name, 'method'>
  return useCore({ 
    fn, 
    options,
    stateCreators: [
      ({ monitor }): {
        [K in `${_Name}Loading`]: Ref<boolean>
      } => ({
        [`${name}Loading`]: useStateLoading(monitor)
      } as any),
      ({ monitor }): {
        [K in `${_Name}Error`]: Ref<boolean>
      } => ({
        [`${name}Error`]: useStateError(monitor)
      } as any),
      ({ monitor }): {
        [K in `${_Name}Arguments`]: ComputedRef<Parameters<Fn>>
      } & {
        [K in `${_Name}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
      } => {
        const { parameters, parameterFirst } = useStateParameters<Fn>(monitor)
        return {
          [`${name}Arguments`]: parameters,
          [`${name}ArgumentFirst`]: parameterFirst,
        } as any
      },
      ...stateCreators,
    ] as const,
    boostCreators: [
      ({ method }): {
        [K in _Name]: Fn
      } => ({
        [name]: method
      } as any),
      ...boostCreators,
      ({ method }) => {
        useWatch(method, options)
      }
    ] as const
  })
}