/**
 * @fileoverview 函数监控系统
 * 
 * 该模块提供函数执行生命周期的事件监控能力。
 * 主要功能包括：
 * - 事件发布订阅机制（init、before、after、fulfill、reject）
 * - 与 Tracker 集成，提供调用追踪能力
 * 
 * 事件执行顺序：init → before → after → fulfill/reject
 * 
 * @internal enhance-arguments 是内部 API，仅用于兼容功能，不对外暴露
 * 
 * @module core/monitor
 * 
 * @/core/tracker 导入的是 InternalTrack，
 * 要限制外部 addon 对 track 状态的更改。
 */

import { createEventBus } from "@/core/eventbus"
import { Track as TrackFull, Tracker, createTracker } from "@/core/tracker"
import { BaseFunction } from "@/utils/types"

export type Track = Pick<TrackFull, 
  'sn' | 
  'is' |
  'getData' | 'setData' | 'takeData' |
  'shareData'
  // 注意：不包含 'on' 和 'off' 方法
>

/**
 * 核心状态公共 key：供其他 addon 读取状态
 */
export const RUN_ARGUMENTS: symbol = Symbol('vue-asyncx:run:arguments')
export const RUN_ERROR: symbol = Symbol('vue-asyncx:run:error')
export const RUN_LOADING: symbol = Symbol('vue-asyncx:run:loading')
export const RUN_DATA: symbol = Symbol('vue-asyncx:run:data')
export const RUN_DATA_UPDATED: symbol = Symbol('vue-asyncx:run:data-updated')

/**
 * 核心状态私有 key：monitor 内部使用
 */
const RUN_ARGUMENTS_KEY: symbol = Symbol('vue-asyncx:run:arguments:key')
const RUN_ERROR_KEY: symbol = Symbol('vue-asyncx:run:error:key')
const RUN_LOADING_KEY: symbol = Symbol('vue-asyncx:run:loading:key')
const RUN_DATA_KEY: symbol = Symbol('vue-asyncx:run:data:key')
const RUN_DATA_UPDATED_KEY: symbol = Symbol('vue-asyncx:run:data-updated:key')

/**
 * 导出 RUN_DATA_KEY：允许 withAddonData 直接设值
 */
export { RUN_DATA_KEY }

/**
 * 函数监控器事件映射
 * 
 * @description 定义了所有可监听的事件类型及其数据结构。
 */
type FunctionMonitorEventMap = {
  /** 函数调用初始化事件，用于准备上下文 */
  'init': { args: any[], track: Track }
  /** 函数执行前事件，用于观察逻辑。注：enhance-arguments 发生在 before 后 */
  'before': { args: any[], track: Track }
  /** 函数执行后事件（同步部分完成） */
  'after': { track: Track }
  /** 函数成功完成事件 */
  'fulfill': { track: Track, value: any }
  /** 函数执行失败事件 */
  'reject': { track: Track, error: any }
  /** track 数据变化事件，当 track 的 setData 触发 data 事件时转发 */
  'track:data': { track: Track, key: symbol, value: any }
}

/**
 * 事件处理函数类型
 * 
 * @template T - 事件类型
 */
type EventHandler<T extends keyof FunctionMonitorEventMap> = (
  event: FunctionMonitorEventMap[T]
) => void

/**
 * 基础函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件发布订阅机制。
 * 支持监听 init、before、after、fulfill、reject 等事件。
 */
interface InternalFunctionMonitor {
  /**
   * @deprecated 该 API 仅用于内部兼容功能（如已废弃的 enhanceFirstArgument），外部调用无效
   * @internal 该 API 仅用于内部兼容功能（如已废弃的 enhanceFirstArgument），外部调用无效
   * 
   * 设置参数增强拦截器
   * 
   * @description 这是一个特殊的拦截器机制，用于在函数执行前转换参数。
   * 执行顺序：init → before → enhance-arguments → after → fulfill/reject
   * 覆盖逻辑：只能设置一个拦截器，后设置的会覆盖先设置的
   * 
   * @param event - 事件类型，固定为 'enhance-arguments'
   * @param handler - 拦截器函数，接收参数和 track，返回转换后的参数数组或 void
   */
  use(event: 'enhance-arguments', handler: (data: { args: any[], track: Track }) => any[] | void): void
  
  /**
   * 获取参数增强拦截器
   * 
   * @internal 该 API 仅用于内部兼容功能，不对外暴露。
   * 
   * @param event - 事件类型，固定为 'enhance-arguments'
   * 
   * @returns 返回当前设置的拦截器函数，如果未设置则返回 undefined
   */
  get(event: 'enhance-arguments'): ((data: { args: any[], track: Track }) => any[] | void) | undefined
  
  /**
   * 注册事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 移除事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 要移除的事件处理函数
   */
  off<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 触发事件
   * 
   * @param event - 事件类型
   * @param data - 事件数据
   */
  emit(event: 'init', data: FunctionMonitorEventMap['init']): void
  emit(event: 'before', data: FunctionMonitorEventMap['before']): void
  emit(event: 'fulfill', data: FunctionMonitorEventMap['fulfill']): void
  emit(event: 'reject', data: FunctionMonitorEventMap['reject']): void
  emit(event: 'after', data: FunctionMonitorEventMap['after']): void
  emit(event: 'track:data', data: FunctionMonitorEventMap['track:data']): void
}

/**
 * 函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件监控能力。
 */
export type FunctionMonitor = Pick<InternalFunctionMonitor, 'on' | 'off' | 'use'>

/**
 * 创建基础函数监控器
 * 
 * @description 创建一个新的事件监控器实例，支持事件发布订阅机制。
 * 使用 EventBus 管理事件处理器，支持多个监听器。
 * 
 * @returns 返回基础函数监控器实例
 * 
 * @internal 内部实现，不对外暴露
 */
function createInternalFunctionMonitor(): InternalFunctionMonitor {
  // 使用 EventBus 管理事件处理器
  const bus = createEventBus<FunctionMonitorEventMap>()
  
  // 参数增强拦截器（特殊机制，只允许一个）
  let enhanceArgumentsInterceptor: ((data: { args: any[], track: Track }) => any[] | void) | undefined

  const monitor: InternalFunctionMonitor = {
    use(event: 'enhance-arguments', handler: any): void {
      if (event === 'enhance-arguments' && handler?.[ENHANCE_ARGUMENTS_HANDLER]) return enhanceArgumentsInterceptor = handler
    },
    get(event: 'enhance-arguments'): any {
      /* v8 ignore else -- @preserve enhance-arguments 是唯一情况 */
      if (event === 'enhance-arguments') return enhanceArgumentsInterceptor
    },
    on: bus.on,
    off: bus.off,
    emit: bus.emit
  }

  return monitor
}

function createFunctionMonitor(monitor: InternalFunctionMonitor, tracker: Tracker): FunctionMonitor {
  const { on, off, use } = monitor
  return {
    on, off, use
  }
}

/**
 * 运行拦截器
 * 
 * @description 安全地运行拦截器函数，如果拦截器不存在或返回 undefined，则使用 fallback。
 * 
 * @param interceptor - 拦截器函数（可选）
 * @param fallback - 回退值
 * 
 * @returns 返回拦截器的结果，如果拦截器不存在或返回 undefined，则返回 fallback
 * 
 * @internal 内部实现，不对外暴露
 */
function runInterceptor(interceptor?: () => any, fallback?: any) {
  if (typeof interceptor !== 'function') return fallback
  const result = interceptor()
  if (result === undefined) return fallback
  return result
}

/**
 * 为函数添加监控能力
 * 
 * @description 包装函数，为其添加生命周期事件监控能力。
 * 函数执行时会触发相应的事件，插件可以监听这些事件来扩展功能。
 * 
 * 事件触发顺序：
 * 1. init：函数调用初始化
 * 2. before：函数执行前
 * 3. after：函数执行后（同步部分完成）
 * 4. fulfill/reject：函数成功完成或失败
 * 
 * @internal enhance-arguments 是内部实现细节，用于兼容功能，在 before 之后、函数执行之前触发
 * 
 * @template Fn - 函数类型
 * 
 * @param fn - 要包装的函数
 * 
 * @returns 返回包装后的函数和监控器
 * @returns {Fn} run - 包装后的函数，具有监控能力
 * @returns {FunctionMonitor} monitor - 函数监控器，用于监听事件
 * 
 * @example
 * ```ts
 * const { run, monitor } = withFunctionMonitor(fetchUser)
 * 
 * monitor.on('before', ({ args }) => {
 *   console.log('Calling with:', args)
 * })
 * 
 * monitor.on('fulfill', ({ value }) => {
 *   console.log('Success:', value)
 * })
 * 
 * run('user123') // 触发事件
 * ```
 */
export function withFunctionMonitor<Fn extends BaseFunction>(
  fn: Fn
): {
  run: Fn
  monitor: FunctionMonitor
} {
  // 创建调用追踪器
  const tracker = createTracker()
  
  // 创建函数监控器
  const monitor = createInternalFunctionMonitor()

  // 包装函数，添加事件监控
  const run = ((...args: Parameters<Fn>): ReturnType<Fn> => {
    // 创建调用追踪对象
    // 将 on/off 解构出来，track 对象不包含这些方法（符合 Track 类型定义）
    const { fulfill, reject, on, off, ...track } = tracker.track()

    // 触发 init 事件：用于初始化/准备逻辑
    // 注意：此时 monitor 还未注册 track 的监听，所以 init 阶段的 setData 不会触发 track:data 事件
    monitor.emit('init', { args, track })

    // 建立所有映射（私有 key → 公共 key）
    track.shareData(RUN_ARGUMENTS_KEY, RUN_ARGUMENTS)
    track.shareData(RUN_ERROR_KEY, RUN_ERROR)
    track.shareData(RUN_LOADING_KEY, RUN_LOADING)
    track.shareData(RUN_DATA_KEY, RUN_DATA)
    track.shareData(RUN_DATA_UPDATED_KEY, RUN_DATA_UPDATED)

    // 在 init 之后注册监听，开始转发 track 的 data 事件
    on('data', ({ key, value }) => {
      // RUN_DATA_UPDATED 不会触发事件，只是起单纯记录作用
      if (key === RUN_DATA_UPDATED) return
      if (key === RUN_DATA) track.setData(RUN_DATA_UPDATED_KEY, true)
      monitor.emit('track:data', { track, key, value })
    })

    // 在 emit('before') 之前设置状态
    track.setData(RUN_ARGUMENTS_KEY, args)
    track.setData(RUN_LOADING_KEY, true)

    // 触发 before 事件：用于执行前观察逻辑（此时状态已设置好，addon 可以读取）
    monitor.emit('before', { args, track })

    // 调用参数增强拦截器转换参数（对插件透明）
    const transformedArgs: Parameters<Fn> = runInterceptor(
      monitor.get('enhance-arguments') && (() => {
        const result = monitor.get('enhance-arguments')({ args, track })
        // 如果返回数组，使用转换后的参数；否则使用原参数
        return Array.isArray(result) ? result : undefined
      }),
      args
    )

    try {
      // 执行原函数
      const result = fn(...transformedArgs)
      
      // 触发 after 事件：函数调用后，完成前
      monitor.emit('after', { track })
      
      // 处理异步结果
      if (result instanceof Promise) {
        result.then(
          (value) => {
            // 标记为成功完成（先更新 track 状态）
            fulfill()
            // 在 emit('fulfill') 之前设置状态（此时 track 状态已更新为 fulfilled）
            track.setData(RUN_LOADING_KEY, false)
            track.setData(RUN_DATA_KEY, value)
            track.setData(RUN_ARGUMENTS_KEY, undefined)
            // 触发 fulfill 事件
            monitor.emit('fulfill', { track, value })
          },
          (error) => {
            // 标记为失败（先更新 track 状态）
            reject()
            // 在 emit('reject') 之前设置状态（此时 track 状态已更新为 rejected）
            track.setData(RUN_LOADING_KEY, false)
            track.setData(RUN_ERROR_KEY, error)
            track.setData(RUN_ARGUMENTS_KEY, undefined)
            // 触发 reject 事件
            monitor.emit('reject', { track, error })
          }
        )
      } else {
        // 同步函数直接标记为成功（先更新 track 状态）
        fulfill()
        // 在 emit('fulfill') 之前设置状态（此时 track 状态已更新为 fulfilled）
        track.setData(RUN_LOADING_KEY, false)
        track.setData(RUN_DATA_KEY, result)
        track.setData(RUN_ARGUMENTS_KEY, undefined)
        monitor.emit('fulfill', { track, value: result })
      }
      
      return result
    } catch (e) {
      // 同步函数抛出异常
      // 触发 after 事件（在 catch 块中，reject 之前）
      monitor.emit('after', { track })
      // 标记为失败（先更新 track 状态）
      reject()
      // 在 emit('reject') 之前设置状态（此时 track 状态已更新为 rejected）
      track.setData(RUN_LOADING_KEY, false)
      track.setData(RUN_ERROR_KEY, e)
      track.setData(RUN_ARGUMENTS_KEY, undefined)
      // 触发 reject 事件
      monitor.emit('reject', { track, error: e })
      throw e
    }
  }) as Fn

  return { run, monitor: createFunctionMonitor(monitor, tracker) }
}

const ENHANCE_ARGUMENTS_HANDLER: symbol = Symbol('EnhanceArgumentsHandler')
export function createEnhanceArgumentsHandler<H extends BaseFunction>(handler: H): H & { [ENHANCE_ARGUMENTS_HANDLER]: true } {
  handler[ENHANCE_ARGUMENTS_HANDLER] = true
  return handler as H & { [ENHANCE_ARGUMENTS_HANDLER]: true }
}