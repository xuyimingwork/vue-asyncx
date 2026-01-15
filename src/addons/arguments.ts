import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor, Track } from "@/core/monitor";
import { RUN_ARGUMENTS } from "@/core/monitor";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";
import { createLatestHandler } from "./utils/latest-handler";

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
  const update = createLatestHandler((track, isLatest) => {
    if (!isLatest) return
    if (track.is('pending')) return set(track.getData(RUN_ARGUMENTS))
    return set(undefined)
  })

  return {
    update,
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







