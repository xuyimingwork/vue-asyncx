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

import { toPublicTrack } from "@/core/monitor/public-track"
import { createTrackedFunction } from "@/core/monitor/tracked-function"
import type { BaseFunction } from "@/utils/types"
import { RUN_ARGUMENTS, RUN_DATA, RUN_DATA_UPDATED, RUN_ERROR, RUN_INITED, RUN_LOADING } from "./constants"
import { createInternalFunctionMonitor } from "./core"
import { getEnhanceArguments } from "./enhance-arguments"
import { createTracker } from "./tracker"
import type { FunctionMonitor } from "./types"

// 重新导出公共 API
export { RUN_ARGUMENTS, RUN_DATA, RUN_DATA_UPDATED, RUN_ERROR, RUN_LOADING } from "./constants"
export { createEnhanceArgumentsHandler } from "./enhance-arguments"
export type { EventHandler, FunctionMonitor, FunctionMonitorEventMap, Track } from "./types"

const RUN_TRACK = Symbol('vue-asyncx:run:track')

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

  const run = createTrackedFunction(fn, {
    tracker,
    before({ track, args }) {
      track.setData(RUN_TRACK, toPublicTrack(track, {
        onDataChange() {
          monitor.emit('track:updated', { track: track.getData(RUN_TRACK) })
        }
      }))
      track.setData(RUN_ARGUMENTS, args)
      track.setData(RUN_LOADING, true)
      monitor.emit('init', { args, track: track.getData(RUN_TRACK) })
      track.setData(RUN_INITED, true)
      monitor.emit('track:updated', { track: track.getData(RUN_TRACK) })
      monitor.emit('before', { args, track: track.getData(RUN_TRACK) })
      return getEnhanceArguments(monitor, args, track.getData(RUN_TRACK))
    },
    after({ track }) {
      monitor.emit('after', { track: track.getData(RUN_TRACK) })
    },
    fulfill({ track, value }) {
      track.fulfill()
      track.setData(RUN_LOADING, false)
      track.setData(RUN_ARGUMENTS, undefined)
      track.setData(RUN_DATA, value)
      track.setData(RUN_DATA_UPDATED, true)
      monitor.emit('fulfill', { track: track.getData(RUN_TRACK), value })
      monitor.emit('track:updated', { track: track.getData(RUN_TRACK) })
    },
    reject({ track, error }) {
      track.reject()
      track.setData(RUN_LOADING, false)
      track.setData(RUN_ARGUMENTS, undefined)
      track.setData(RUN_ERROR, error)
      monitor.emit('reject', { track: track.getData(RUN_TRACK), error })
      monitor.emit('track:updated', { track: track.getData(RUN_TRACK) })
    }
  })

  return { 
    run: run as any, 
    monitor: {
      on: monitor.on,
      off: monitor.off,
      use: monitor.use
    } as FunctionMonitor
  }
}