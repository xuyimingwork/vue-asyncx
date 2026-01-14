import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor, Track } from "@/core/monitor";
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
      if (track.is('pending')) return set(track.getData(ARGUMENTS_KEY))
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

    // 在 init 事件中建立映射
    monitor.on('init', ({ track }) => {
      track.shareData(ARGUMENTS_KEY, TRACK_ADDON_ARGUMENTS)
    })

    monitor.on('before', ({ args, track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      track.setData(ARGUMENTS_KEY, args as Parameters<any>)
      update(track)
    })

    monitor.on('fulfill', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ARGUMENTS_KEY, undefined)
      update(track)
    })

    monitor.on('reject', ({ track }) => {
      // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_ARGUMENTS）
      // 设置当前调用的状态，不管是否最新调用都需要设置
      track.setData(ARGUMENTS_KEY, undefined)
      update(track)
    })

    return {
      __name__Arguments: computed(() => _args.value),
      __name__ArgumentFirst: argumentFirst
    }
  }) as any
}







