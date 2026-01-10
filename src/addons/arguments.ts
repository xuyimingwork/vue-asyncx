import { AddonTypes } from "@/addons/types";
import type { FunctionMonitorWithTracker } from "@/core/monitor";
import { BaseFunction } from "@/utils/types";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";

/**
 * Creates reactive parameter state that tracks function arguments.
 * Returns parameters during execution, undefined when complete (if latest call).
 */
export function useStateParameters<Fn extends BaseFunction>(
  monitor: FunctionMonitorWithTracker
): {
  parameters: ComputedRef<Parameters<Fn> | undefined>
  parameterFirst: ComputedRef<Parameters<Fn>['0'] | undefined>
} {
  const _args = ref<Parameters<Fn>>()

  monitor.on('before', ({ args }) => {
    _args.value = args as Parameters<Fn>
  })

  monitor.on('fulfill', ({ track }) => {
    if (!track.isLatestCall()) return
    _args.value = undefined
  })

  monitor.on('reject', ({ track }) => {
    if (!track.isLatestCall()) return
    _args.value = undefined
  })

  return {
    parameters: computed(() => _args.value),
    parameterFirst: computed(() => _args.value?.[0]),
  }
}

export function withAddonArguments(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitorWithTracker,
  _types: T
}) => {
  __name__Arguments: ComputedRef<Parameters<T['Method']>>
  __name__ArgumentFirst: ComputedRef<Parameters<T['Method']>['0']>
} {
  return (({ monitor }) => {
    const { parameters, parameterFirst } = useStateParameters(monitor)
    return {
      __name__Arguments: parameters,
      __name__ArgumentFirst: parameterFirst
    }
  }) as any
}







