import { parseArguments, useWatch } from "../shared/function"
import type { UseAsyncOptions, UseAsyncResult } from './types'
import { CorePlugin, useCore } from "../shared/core"
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
  const CorePlugins extends readonly CorePlugin<Fn>[],
>({ 
  name, fn, options,
  plugins = [] as unknown as CorePlugins,
}: { 
  name: Name, fn: Fn, options?: any,
  plugins?: CorePlugins
}) {
  type _Name = StringDefaultWhenEmpty<Name, 'method'>
  return useCore({ 
    fn, 
    options,
    plugins: [
      { 
        state({ monitor }): {
          [K in `${_Name}Loading`]: Ref<boolean>
        } & {
          [K in `${_Name}Error`]: Ref<boolean>
        } & {
          [K in `${_Name}Arguments`]: ComputedRef<Parameters<Fn>>
        } & {
          [K in `${_Name}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
        } {
          const { parameters, parameterFirst } = useStateParameters<Fn>(monitor)
          return {
            [`${name}Loading`]: useStateLoading(monitor),
            [`${name}Error`]: useStateError(monitor),
            [`${name}Arguments`]: parameters,
            [`${name}ArgumentFirst`]: parameterFirst,
          } as any
        },
        boost({ method }): {
          [K in _Name]: Fn
        } {
          return {
            [name]: method
          } as any
        }
      },
      ...plugins,
      {
        boost({ method }) {
          useWatch(method, options)
        }
      }
    ] as const,
  })
}