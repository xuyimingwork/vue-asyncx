/**
 * @fileoverview 函数监控系统主入口
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

import type { BaseFunction } from "@/utils/types"
import { RUN_ARGUMENTS, RUN_DATA, RUN_ERROR, RUN_LOADING } from "./constants"
import { createInternalFunctionMonitor } from "./core"
import { getEnhanceArguments } from "./enhance-arguments"
import { createTrack } from "./track"
import { createTracker } from "./tracker"
import type { FunctionMonitor } from "./types"

// 重新导出公共 API
export { RUN_ARGUMENTS, RUN_DATA, RUN_DATA_UPDATED, RUN_ERROR, RUN_LOADING } from "./constants"
export { createEnhanceArgumentsHandler } from "./enhance-arguments"
export type { EventHandler, FunctionMonitor, FunctionMonitorEventMap, Track } from "./types"

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
    // 创建 track 相关对象
    const { fulfill, reject, inactivate, init, setData, track } = createTrack(monitor, tracker)

    /**
     * 完成函数执行（fulfill 或 reject）
     * 
     * @description 统一处理 fulfill/reject 时的状态设置和事件触发
     * 
     * @param type - 完成类型：'fulfill' 表示成功，'reject' 表示失败
     * @param value - 成功时的返回值
     * @param error - 失败时的错误信息
     */
    function finish(type: 'fulfill' | 'reject', value?: any, error?: any): void {
      inactivate()
      ;type === 'fulfill' ? fulfill() : reject()
      setData(RUN_LOADING, false)
      setData(RUN_ARGUMENTS, undefined)
      ;type === 'fulfill' ? setData(RUN_DATA, value) : setData(RUN_ERROR, error)
      monitor.emit('track:updated', { track })
      ;type === 'fulfill' 
        ? monitor.emit('fulfill', { track, value })
        : monitor.emit('reject', { track, error })
    }

    // 触发 init 事件：用于初始化/准备逻辑
    setData(RUN_ARGUMENTS, args)
    setData(RUN_LOADING, true)
    monitor.emit('init', { args, track })
    init()
    monitor.emit('track:updated', { track })
    monitor.emit('before', { args, track })

    // 调用参数增强拦截器转换参数（对插件透明）
    const transformedArgs: Parameters<Fn> = getEnhanceArguments(monitor, args, track) as Parameters<Fn>

    try {
      // 执行原函数
      const result = fn(...transformedArgs)
      
      // 触发 after 事件：函数调用后，完成前
      monitor.emit('after', { track })
      
      // 处理异步结果
      if (result instanceof Promise) {
        result.then(
          (value) => finish('fulfill', value),
          (error) => finish('reject', undefined, error)
        )
      } else {
        // 同步函数直接标记为成功
        finish('fulfill', result)
      }
      
      return result
    } catch (e) {
      // 同步函数抛出异常
      // 触发 after 事件（在 catch 块中，reject 之前）
      monitor.emit('after', { track })
      // 标记为失败
      finish('reject', undefined, e)
      throw e
    }
  }) as Fn

  return { 
    run, 
    monitor: {
      on: monitor.on,
      off: monitor.off,
      use: monitor.use
    } as FunctionMonitor
  }
}
