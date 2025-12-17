import { parseArguments } from "./shared/arguments"
import type { UseAsyncOptions, UseAsyncResult } from './use-async.types'
import { useAsyncBase } from "./use-async-base"

export function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, 'method'>
export function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, Name>
export function useAsync(...args: any[]): any {
  const { name = 'method', fn, options } = parseArguments(args)
  const { method, loading, parameters, parameterFirst, error } = useAsyncBase(fn, options)
  return {
    [name]: method,
    [`${name}Loading`]: loading,
    [`${name}Arguments`]: parameters,
    [`${name}ArgumentFirst`]: parameterFirst,
    [`${name}Error`]: error,
  }
}

export { useAsync as useAsyncFunction }