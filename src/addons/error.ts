import type { FunctionMonitor, Track } from "@/core/monitor"
import { RUN_ERROR } from "@/core/monitor"
import type { Ref } from "vue-demi"
import { ref } from "vue-demi"
import { createLatestHandler } from "./utils/latest-handler"

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
  const update = createLatestHandler((track, isLatest) => {
    if (!isLatest) return
    if (track.is('pending')) return set(undefined)
    if (track.is('rejected')) return set(track.getData(RUN_ERROR))
  })

  return { update }
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

    // 监听 track:updated 事件，当 RUN_ERROR 变化时更新状态
    monitor.on('track:updated', ({ track }) => update(track))

    return {
      __name__Error: error,
    }
  }) as any
}