import type { FunctionMonitor, Track } from "@/core/monitor"
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

/**
 * 定义状态 error 管理器
 * 
 * @description 接收 set 函数，返回 update 函数用于更新外部的 error 状态
 * 
 * @param options - 配置选项
 * @param options.set - 设置 error 状态的函数
 * 
 * @returns 返回包含 update 函数的对象
 */
export function defineStateError({  
  set
}: { 
  set: (value: any) => void
}): { 
  update: (track: Track) => void 
} {
  // 内部状态：记录最新的 pending sn
  let latest = 0

  return {
    update(track: Track) {
      // 如果 track.sn > latest，更新 latest
      if (track.sn > latest) latest = track.sn
      // 如果 track.sn !== latest，说明不是最新的调用，直接返回
      if (track.sn !== latest) return
      // 现在 track.sn === latest，根据 track 的状态调用 set
      if (track.is('pending')) return set(undefined)
      if (track.is('rejected')) return set(track.getData(ERROR_KEY))
    }
  }
}

export function withAddonError(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Error: Ref<any>
} {
  return (({ monitor }) => {
    const error = ref()
    
    // 使用 defineStateError 创建状态管理器
    const { update } = defineStateError({
      set: (value) => { error.value = value }
    })

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(ERROR_KEY, TRACK_ADDON_ERROR)
    })

    monitor.on('before', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ERROR）
      track.setData(ERROR_KEY, undefined)
      update(track)
    })

    monitor.on('reject', ({ track, error: err }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ERROR）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ERROR_KEY, err)
      update(track)
    })

    return {
      __name__Error: error,
    }
  }) as any
}