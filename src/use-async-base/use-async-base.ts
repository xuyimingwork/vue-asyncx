import type { ComputedRef, Ref } from "vue";
import { FunctionMonitorWithTracker, withFunctionMonitor } from "../utils";
import { useStateError, useStateLoading, useStateParameters } from "../shared/state";
import { useSetup, useWatch } from "../shared/function";

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

  // state
  const loading = useStateLoading(monitor)
  const { parameters, parameterFirst } = useStateParameters<Fn>(monitor)
  const error = useStateError(monitor)
  const patchedState =  patchState ? patchState(monitor) : {}

  // setup: function transform/trigger
  const method = useSetup(run, options)

  // trigger
  useWatch(method, options)

  return {
    method, 
    loading, 
    error,
    parameters, 
    parameterFirst, 
    ...patchedState
  }
}