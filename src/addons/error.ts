import type { FunctionMonitor } from "@/core/monitor"
import type { Ref } from "vue"
import { ref } from "vue"

/**
 * 共享 key：供其他 addon 读取 error 状态
 */
export const TRACK_ADDON_ERROR: symbol = Symbol('vue-asyncx:addon:error')

/**
 * 私有 key：addon 内部使用
 */
const ERROR_KEY: symbol = Symbol('error')

export function withAddonError(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Error: Ref<any>
} {
  return (({ monitor }) => {
    const error = ref()
    
    // 内部状态：记录最新的 pending sn
    let latest = 0

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(ERROR_KEY, TRACK_ADDON_ERROR)
    })

    monitor.on('before', ({ track }) => {
      // 更新最新 pending sn
      latest = track.sn
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ERROR）
      track.setData(ERROR_KEY, undefined)
      // 清除 error（新调用开始时清除错误状态）
      error.value = undefined
    })

    monitor.on('reject', ({ track, error: err }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ERROR）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ERROR_KEY, err)
      // 如果不是最新的调用（有后续的 pending 调用），则返回
      if (track.sn !== latest) return
      // 这是最新的调用（没有后续的 pending 调用），更新 error
      error.value = err
    })

    return {
      __name__Error: error,
    }
  }) as any
}