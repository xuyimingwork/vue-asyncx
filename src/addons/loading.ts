import type { FunctionMonitor, Track } from "@/core/monitor"
import { Ref, ref } from "vue"

/**
 * 共享 key：供其他 addon 读取 loading 状态
 */
export const TRACK_ADDON_LOADING: symbol = Symbol('vue-asyncx:addon:loading')

/**
 * 私有 key：addon 内部使用
 */
const LOADING_KEY: symbol = Symbol('loading')

/**
 * 定义状态 loading 管理器
 * 
 * @description 接收 get/set 函数，返回 update 函数用于更新外部的 loading 状态
 * 
 * @param options - 配置选项
 * @param options.get - 获取当前 loading 状态的函数
 * @param options.set - 设置 loading 状态的函数
 * 
 * @returns 返回包含 update 函数的对象
 */
export function defineStateLoading({  
  set 
}: { 
  set: (value: boolean) => void 
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
      if (track.is('pending')) return set(true)
      return set(false)
    }
  }
}

export function withAddonLoading(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Loading: Ref<boolean>
} {
  return (({ monitor }: { monitor: FunctionMonitor }) => {
    const loading = ref(false)
    
    // 使用 defineStateLoading 创建状态管理器
    const { update } = defineStateLoading({
      set: (value) => { loading.value = value }
    })

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(LOADING_KEY, TRACK_ADDON_LOADING)
    })

    monitor.on('before', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      track.setData(LOADING_KEY, true)
      update(track)
    })

    monitor.on('fulfill', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(LOADING_KEY, false)
      update(track)
    })

    monitor.on('reject', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_LOADING）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(LOADING_KEY, false)
      update(track)
    })

    return {
      __name__Loading: loading,
    }
  }) as any
}