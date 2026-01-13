import type { Track } from "@/core/monitor"
import { createEnhanceArgumentsHandler, type FunctionMonitor } from "@/core/monitor"
import type { Ref, ShallowRef } from "vue"
import { computed, ref, shallowRef } from "vue"
import { prepareAsyncDataContext } from "./context"
import { normalizeEnhancedArguments } from "./enhance"

/**
 * 创建响应式数据状态管理器
 * 
 * @description 该函数创建一个响应式的数据状态管理器，用于追踪异步函数的返回值。
 * 
 * 主要功能：
 * - 在函数成功完成时更新数据（仅最新调用）
 * - 支持在函数执行过程中手动更新数据（通过 getAsyncDataContext）
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
  const VALUE_KEY = Symbol('value')      // 存储函数返回值
  const CONTEXT_KEY = Symbol('context')  // 存储上下文对象
  const RESTORE_KEY = Symbol('restore')  // 存储上下文恢复函数

  const { initialData, shallow = false, enhanceFirstArgument = false } = options
  
  // 创建响应式数据引用（根据 shallow 选项选择 ref 或 shallowRef）
  const data = (shallow 
    ? shallowRef<Data>(initialData) 
    : ref<Data>(initialData)) as Ref<Data> | ShallowRef<Data>
  
  // 存储当前数据的追踪对象（用于过期判断）
  const dataTrack = shallowRef<Track>()

  /**
   * 数据更新逻辑
   * 
   * @description 更新数据值，但只接受最新调用的更新。
   * 竟态处理：
   * - 如果是 UPDATING 状态，必须是最新更新才接受
   * - 如果是 FULFILLED 状态，必须是最新成功完成才接受
   * 
   * @param v - 新的数据值
   * @param track - 调用追踪对象
   */
  function update(value: any, track: Track) {
    track.setData(VALUE_KEY, value)
    if (dataTrack.value && dataTrack.value.sn > track.sn) return
    data.value = value
    dataTrack.value = track
  }

  // 监听 fulfill 事件：函数成功完成时更新数据
  monitor.on('fulfill', ({ track, value }) => update(value, track))

  // 监听 init 事件：函数调用初始化时准备上下文
  monitor.on('init', ({ track }) => {
    // 设置初始值（替换 setup interceptor）
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
       * @description 在函数执行过程中手动更新数据。
       * 会自动处理竟态条件，只有最新调用才能更新。
       * 
       * @param v - 新的数据值
       * 
       * @returns 返回更新后的值
       */
      updateData: (value: any) => {
        // 检查是否可以更新（只有 PENDING 或 UPDATING 状态才能更新）
        if (track.is('finished')) return
        update(value, track)
        return value
      }
    })
  })
  
  // 监听 before 事件：函数执行前设置上下文
  monitor.on('before', ({ track }) => {
    // 初始化函数隐式执行上下文
    // 将上下文设置到全局，使得 getAsyncDataContext 可以获取
    track.setData(RESTORE_KEY, prepareAsyncDataContext(track.getData(CONTEXT_KEY)!))
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

  /**
   * 计算数据是否过期
   * 
   * @description 判断当前数据是否可能过期。
   * 
   * 数据过期的场景：
   * 1. 无数据状态，但已有完成的调用（可能是失败）
   * 2. 当前数据的调用最终结果是报错
   * 3. 在当前数据之后有调用发生了报错
   * 
   * 过期判断逻辑：
   * - 如果当前数据对应的调用失败，数据过期
   * - 如果当前数据之后有调用失败，数据过期（因为最新调用失败，当前数据不是最新的）
   * - 无需检查之后调用的 update 和 fulfill 情况，因为上述二者都会更新 dataTrack.value
   */
  const dataExpired = computed(() => {
    // 无数据状态，检查是否有报错信息
    if (!dataTrack.value) return monitor.has.finished.value
    
    // 如果当前数据的调用最终结果是报错，当前数据过期
    // （当前过期数据由调用的 update 产生）
    if (dataTrack.value.is('rejected')) return true
    
    // 否则，当前数据的过期由之后的调用产生
    // 检查在当前调用之后是否有调用发生了报错
    // 无需检查之后调用的 update 和 fulfil 情况，因为上述二者都会更新 dataTrack.value
    return dataTrack.value.hasLater('rejected')
  })

  return {
    data,
    dataExpired
  }
}
