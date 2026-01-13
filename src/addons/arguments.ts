import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor } from "@/core/monitor";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";

export function withAddonArguments(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitor,
  _types: T
}) => {
  __name__Arguments: ComputedRef<Parameters<T['Method']>>
  __name__ArgumentFirst: ComputedRef<Parameters<T['Method']>['0']>
} {
  return (({ monitor }) => {
    const _args = ref<Parameters<any>>()

    monitor.on('before', ({ args }) => {
      _args.value = args as Parameters<any>
    })

    monitor.on('fulfill', ({ track }) => {
      if (!track.isLatest()) return
      _args.value = undefined
    })

    monitor.on('reject', ({ track }) => {
      if (!track.isLatest()) return
      _args.value = undefined
    })

    const parameters = computed(() => _args.value)
    const parameterFirst = computed(() => _args.value?.[0])

    return {
      __name__Arguments: parameters,
      __name__ArgumentFirst: parameterFirst
    }
  }) as any
}







