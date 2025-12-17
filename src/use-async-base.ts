import type { ComputedRef, Ref } from "vue";
import { watch } from 'vue'
import { normalizeWatchOptions } from "./use-async.utils";
import { FunctionMonitorWithTracker, getFunction, withFunctionMonitor } from "./utils";
import { useStateError, useStateLoading, useStateParameters } from "./shared/state";

export function useAsyncBase<
  Fn extends (...args: any) => any,
  StateFn extends (monitor: FunctionMonitorWithTracker) => any
>(
  fn: Fn, 
  options?: any,
  patchState?: StateFn
): {
  method: Fn,
  loading: Ref<boolean>
  parameters: ComputedRef<Parameters<Fn>>
  parameterFirst: ComputedRef<Parameters<Fn>[0]>
  error: Ref<any>
} & ReturnType<StateFn> {
  const { run, monitor } = withFunctionMonitor(fn)
  const loading = useStateLoading(monitor)
  const { parameters, parameterFirst } = useStateParameters<Fn>(monitor)
  const error = useStateError(monitor)
  const patchedState =  patchState ? patchState(monitor) : {}

  // Wrap run with options.setup
  const method = getFunction(
    options?.setup, [run], run, 
    'Run options.setup failed, fallback to default behavior.'
  )

  const watchConfig = normalizeWatchOptions(method, options)
  if (watchConfig) watch(watchConfig.source, watchConfig.handler, watchConfig.options)

  return {
    method, 
    loading, 
    parameters, 
    parameterFirst, 
    error,
    ...patchedState
  }
}