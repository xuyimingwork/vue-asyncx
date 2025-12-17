import { watch } from "vue"
import { getFunction, withFunctionMonitor } from "./utils"
import { parseArguments } from "./shared/arguments"
import type { UseAsyncOptions, UseAsyncResult } from './use-async.types'
import { normalizeWatchOptions } from "./use-async.utils"
import { useStateLoading, useStateParameters, useStateError } from "./shared/state"

export function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, 'method'>
export function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, Name>
export function useAsync(...args: any[]): any {
  const { name, fn, options } = parseArguments(args, { name: 'method' })

  const { run, monitor } = withFunctionMonitor(fn)

  const loading = useStateLoading(monitor)
  const { parameters, parameterFirst } = useStateParameters(monitor)
  const error = useStateError(monitor)

  // Wrap run with options.setup
  const method = getFunction(
    options?.setup, [run], run, 
    'Run options.setup failed, fallback to default behavior.'
  )

  const watchConfig = normalizeWatchOptions(method, options)
  if (watchConfig) watch(watchConfig.source, watchConfig.handler, watchConfig.options)

  return {
    [name]: method,
    [`${name}Loading`]: loading,
    [`${name}Arguments`]: parameters,
    [`${name}ArgumentFirst`]: parameterFirst,
    [`${name}Error`]: error,
  }
}

export { useAsync as useAsyncFunction }