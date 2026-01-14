import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor } from "@/core/monitor";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";

/**
 * 共享 key：供其他 addon 读取 arguments 状态
 */
export const TRACK_ADDON_ARGUMENTS: symbol = Symbol('vue-asyncx:addon:arguments')

/**
 * 私有 key：addon 内部使用
 */
const ARGUMENTS_KEY: symbol = Symbol('arguments')

export function withAddonArguments(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitor,
  _types: T
}) => {
  __name__Arguments: ComputedRef<Parameters<T['Method']>>
  __name__ArgumentFirst: ComputedRef<Parameters<T['Method']>['0']>
} {
  return (({ monitor }) => {
    const _args = ref<Parameters<any>>()
    
    // 内部状态：记录最新的 pending sn
    let latest = 0

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(ARGUMENTS_KEY, TRACK_ADDON_ARGUMENTS)
    })

    monitor.on('before', ({ args, track }) => {
      // 更新最新 pending sn
      latest = track.sn
      const argsValue = args as Parameters<any>
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      track.setData(ARGUMENTS_KEY, argsValue)
      _args.value = argsValue
    })

    monitor.on('fulfill', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ARGUMENTS_KEY, undefined)
      // 如果不是最新的调用（有后续的 pending 调用），则返回
      if (track.sn !== latest) return
      // 这是最新的调用（没有后续的 pending 调用），清空 arguments
      _args.value = undefined
    })

    monitor.on('reject', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ARGUMENTS_KEY, undefined)
      // 如果不是最新的调用（有后续的 pending 调用），则返回
      if (track.sn !== latest) return
      // 这是最新的调用（没有后续的 pending 调用），清空 arguments
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







