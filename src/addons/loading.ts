import type { FunctionMonitor } from "@/core/monitor"
import { Ref, ref } from "vue"

/**
 * 共享 key：供其他 addon 读取 loading 状态
 */
export const TRACK_ADDON_LOADING: symbol = Symbol('vue-asyncx:addon:loading')

/**
 * 私有 key：addon 内部使用
 */
const LOADING_KEY: symbol = Symbol('loading')

export function withAddonLoading(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Loading: Ref<boolean>
} {
  return (({ monitor }: { monitor: FunctionMonitor }) => {
    const loading = ref(false)

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(LOADING_KEY, TRACK_ADDON_LOADING)
    })

    monitor.on('before', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      track.setData(LOADING_KEY, true)
      loading.value = true
    })

    monitor.on('fulfill', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(LOADING_KEY, false)
      if (!track.isLatest()) return
      // 只有最新调用才更新最终状态
      loading.value = false
    })

    monitor.on('reject', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(LOADING_KEY, false)
      if (!track.isLatest()) return
      // 只有最新调用才更新最终状态
      loading.value = false
    })

    return {
      __name__Loading: loading,
    }
  }) as any
}