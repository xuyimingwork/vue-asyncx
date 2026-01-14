import type { Track } from "@/core/monitor"
import { createEnhanceArgumentsHandler, type FunctionMonitor } from "@/core/monitor"
import type { ComputedRef, Ref, ShallowRef } from "vue"
import { computed, ref, shallowRef } from "vue"
import { prepareAsyncDataContext } from "./context"
import { normalizeEnhancedArguments } from "./enhance"

/**
 * 共享 key：供其他 addon 读取 data 状态
 */
export const TRACK_ADDON_DATA: symbol = Symbol('vue-asyncx:addon:data')

/**
 * 私有 key：addon 内部使用
 */
const VALUE_KEY = Symbol('value')

/**
 * 定义状态 data 管理器
 * 
 * @description 接收 set/get 函数，返回 update 函数和 dataExpired 计算属性
 * 
 * @param options - 配置选项
 * @param options.set - 设置 data 状态的函数
 * @param options.get - 获取当前 data 状态的函数
 * 
 * @returns 返回包含 update 函数和 dataExpired 计算属性的对象
 */
export function defineStateData({  
  set
}: { 
  set: (value: any) => void
}): { 
  update: (track: Track) => void
  dataExpired: ComputedRef<boolean>
} {
  // 内部状态：记录最新的 pending sn 和 rejected sn（用于过期判断）
  const latest = ref({ pending: 0, rejected: 0 })
  
  // 存储当前数据的追踪对象（用于过期判断）
  const dataTrack = shallowRef<Track>()

  return {
    update(track: Track) {
      // 如果 track.sn > latest.pending，更新 latest.pending
      if (track.sn > latest.value.pending) latest.value.pending = track.sn

      // 记录报错情况，用于 dataExpired 计算
      if (track.is('rejected')) {
        // rejected 状态：更新 latest.rejected
        if (track.sn <= latest.value.rejected) return
        latest.value.rejected = track.sn
        return
      }
      
      // 更新数据场景
      if (dataTrack.value && dataTrack.value.sn > track.sn) return
      set(track.getData(VALUE_KEY))
      dataTrack.value = track
      return
    },
    dataExpired: computed(() => {
      // 无数据状态，检查是否有完成的调用（可能是失败）
      if (!dataTrack.value) return latest.value.rejected > 0
      
      // 如果当前数据的调用最终结果是报错，当前数据过期
      if (dataTrack.value.is('rejected')) return true
      
      // 检查在当前调用之后是否有调用发生了报错
      return latest.value.rejected > dataTrack.value.sn
    })
  }
}

/**
 * 创建响应式数据状态管理器
 * 
 * @description 该函数创建一个响应式的数据状态管理器，用于追踪异步函数的返回值。
 * 
 * 主要功能：
 * - 在函数成功完成时更新数据（仅最新调用）
 * - 支持在函数执行过程中手动更新数据（通过 getAsyncDataContext）
 *   - 这允许在异步函数执行过程中多次更新数据，实现"updating"效果
 *   - 但这是数据 addon 的内部实现，不依赖 tracker 的 updating 状态
 * - 自动处理竟态条件，确保只有最新调用的数据才会更新
 * - 追踪数据过期状态（当最新调用失败但之前调用成功时）
 * - 处理上下文设置和清理
 * 
 * @template Data - 数据类型
 * 
 * @param monitor - 函数监控器，用于监听函数执行事件
 * @param options - 配置选项
 * @param options.initialData - 初始数据值，默认为 undefined
 * @param options.shallow - 是否使用 shallowRef，默认为 false
 * @param options.enhanceFirstArgument - 是否将上下文增强到第一个参数（已废弃，请使用 getAsyncDataContext）
 * 
 * @returns 返回数据状态和过期标识
 * @returns {Ref<Data> | ShallowRef<Data>} data - 响应式数据引用
 * @returns {Ref<boolean>} dataExpired - 数据是否过期的标识
 * 
 * @internal 该函数仅供内部使用，不对外暴露
 * 
 * @example
 * ```ts
 * const { data, dataExpired } = useStateData(monitor, {
 *   initialData: null,
 *   shallow: false
 * })
 * 
 * // 监听数据变化
 * watch(data, (newValue) => {
 *   console.log('Data updated:', newValue)
 * })
 * 
 * // 检查数据是否过期
 * watch(dataExpired, (expired) => {
 *   if (expired) {
 *     console.warn('Data may be outdated')
 *   }
 * })
 * ```
 */
export function useStateData<Data = any>(
  monitor: FunctionMonitor,
  options: {
    initialData?: Data
    shallow?: boolean
    /**
     * @deprecated 已废弃，请使用 getAsyncDataContext
     */
    enhanceFirstArgument?: boolean
  }
): {
  data: Ref<Data> | ShallowRef<Data>
  dataExpired: Ref<boolean>
} {
  // 使用 Symbol 作为数据键，避免冲突
  const CONTEXT_KEY = Symbol('context')  // 存储上下文对象
  const RESTORE_KEY = Symbol('restore')  // 存储上下文恢复函数

  const { initialData, shallow = false, enhanceFirstArgument = false } = options
  
  // 创建响应式数据引用（根据 shallow 选项选择 ref 或 shallowRef）
  const data = (shallow 
    ? shallowRef<Data>(initialData) 
    : ref<Data>(initialData)) as Ref<Data> | ShallowRef<Data>
  
  // 使用 defineStateData 创建状态管理器
  const { update, dataExpired } = defineStateData({
    set: (value) => { data.value = value }
  })

  // 监听 init 事件：函数调用初始化时准备上下文
  monitor.on('init', ({ track }) => {
    // 建立映射：将私有 key 映射到共享 key
    track.shareData(VALUE_KEY, TRACK_ADDON_DATA)

    // 设置初始值到 VALUE_KEY（初始值应该属于 track 的原生属性）
    track.setData(VALUE_KEY, data.value)
    
    // 创建上下文对象，提供 getData 和 updateData 方法
    // 该上下文可以通过 getAsyncDataContext 获取，用于在函数执行过程中访问和更新数据
    track.setData(CONTEXT_KEY, {
      /**
       * 获取当前数据
       * 
       * @description 从追踪对象中获取存储的数据值。
       */
      getData: () => track.getData(VALUE_KEY),
      
      /**
       * 手动更新数据
       * 
       * @description 在函数执行过程中手动更新数据（在函数完成前）。
       * 会自动处理竟态条件，只有最新调用才能更新。
       * 
       * @param value - 新的数据值
       * 
       * @returns 返回更新后的值
       */
      updateData: (value: any) => {
        // 只有在函数未完成时才能更新（finished 表示已 fulfill 或 reject）
        if (track.is('finished')) return
        // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_DATA）
        track.setData(VALUE_KEY, value)
        // 调用 update 函数处理竟态条件并更新数据
        update(track)
        return value
      }
    })
  })
  
  // 监听 before 事件：函数执行前设置上下文和初始值
  monitor.on('before', ({ track }) => {
    // 初始化函数隐式执行上下文
    // 将上下文设置到全局，使得 getAsyncDataContext 可以获取
    track.setData(RESTORE_KEY, prepareAsyncDataContext(track.getData(CONTEXT_KEY)!))
  })

  // 监听 fulfill 事件：函数成功完成时更新数据
  monitor.on('fulfill', ({ track, value }) => {
    // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_DATA）
    track.setData(VALUE_KEY, value)
    update(track)
  })

  // 监听 reject 事件：函数失败时更新状态
  monitor.on('reject', ({ track }) => {
    update(track)
  })

  // 监听 after 事件：函数执行后恢复上下文
  monitor.on('after', ({ track }) => {
    // 恢复上下文（移除全局上下文）
    track.takeData(RESTORE_KEY)()
  })

  // 设置参数增强拦截器（已废弃的功能，仅用于兼容）
  // @internal enhance-arguments 是内部 API，仅用于兼容已废弃的 enhanceFirstArgument 功能
  // enhance-arguments 事件在 'init' 事件之后触发，此时上下文已准备好
  if (enhanceFirstArgument) {
    monitor.use('enhance-arguments', createEnhanceArgumentsHandler(({ args, track }) => {
      // 上下文使用后可以删除，因为只需要在这里使用
      return normalizeEnhancedArguments(args, track.takeData(CONTEXT_KEY)!)
    }))
  }

  return {
    data,
    dataExpired
  }
}
