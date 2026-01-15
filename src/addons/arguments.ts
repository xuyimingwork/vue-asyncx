import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor, Track } from "@/core/monitor";
import { RUN_ARGUMENTS } from "@/core/monitor";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";

/**
 * 定义状态 arguments 管理器
 * 
 * @description 接收 set 和 get 函数，返回 update 函数和 argumentFirst 计算属性
 * 
 * @param options - 配置选项
 * @param options.set - 设置 arguments 状态的函数
 * @param options.get - 获取当前 arguments 状态的函数
 * 
 * @returns 返回包含 update 函数和 argumentFirst 计算属性的对象
 */
export function defineStateArguments({  
  set,
  get
}: { 
  set: (value: Parameters<any> | undefined) => void
  get: () => Parameters<any> | undefined
}): { 
  update: (track: Track) => void
  argumentFirst: ComputedRef<any>
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
      if (track.is('pending')) return set(track.getData(RUN_ARGUMENTS))
      return set(undefined)
    },
    argumentFirst: computed(() => get()?.[0])
  }
}

export function withAddonArguments(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitor,
  _types: T
}) => {
  __name__Arguments: ComputedRef<Parameters<T['Method']>>
  __name__ArgumentFirst: ComputedRef<Parameters<T['Method']>['0']>
} {
  return (({ monitor }) => {
    const _args = ref<Parameters<any>>()
    
    // 使用 defineStateArguments 创建状态管理器
    const { update, argumentFirst } = defineStateArguments({
      set: (value) => { _args.value = value },
      get: () => _args.value
    })

    // 监听 track:data 事件，当 RUN_ARGUMENTS 变化时更新状态
    monitor.on('track:data', ({ track }) => update(track))

    return {
      __name__Arguments: computed(() => _args.value),
      __name__ArgumentFirst: argumentFirst
    }
  }) as any
}







