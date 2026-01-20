/**
 * @fileoverview 内部监控器实现
 * 
 * @module core/monitor/core
 */

import { createEventBus } from "@/core/eventbus"
import type { InternalFunctionMonitor, Track, FunctionMonitorEventMap } from "./types"
import { ENHANCE_ARGUMENTS_HANDLER } from "./enhance-arguments"

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
export function createInternalFunctionMonitor(): InternalFunctionMonitor {
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
