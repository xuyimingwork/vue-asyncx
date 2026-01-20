/**
 * @fileoverview 参数增强相关功能
 * 
 * @module core/monitor/enhance-arguments
 */

import type { BaseFunction } from "@/utils/types"
import type { InternalFunctionMonitor, Track } from "./types"

/**
 * 参数增强处理器标识符
 * 
 * @internal 内部使用，用于标识增强参数处理器
 */
export const ENHANCE_ARGUMENTS_HANDLER: symbol = Symbol('EnhanceArgumentsHandler')

/**
 * 创建增强参数处理器
 * 
 * @description 为处理器函数添加标识符，用于识别增强参数处理器。
 * 
 * @template H - 函数类型
 * 
 * @param handler - 处理器函数
 * 
 * @returns 返回添加了标识符的处理器函数
 */
export function createEnhanceArgumentsHandler<H extends BaseFunction>(handler: H): H & { [ENHANCE_ARGUMENTS_HANDLER]: true } {
  handler[ENHANCE_ARGUMENTS_HANDLER] = true
  return handler as H & { [ENHANCE_ARGUMENTS_HANDLER]: true }
}

/**
 * 获取并执行增强参数处理器
 * 
 * @description 从内部监控器中获取增强参数处理器，并执行它来转换参数。
 * 如果处理器不存在或返回 undefined，则返回原始参数。
 * 
 * @param monitor - 内部函数监控器
 * @param args - 原始参数数组
 * @param track - 追踪对象
 * 
 * @returns 返回转换后的参数数组，如果处理器不存在或返回 undefined，则返回原始参数
 * 
 * @internal 内部实现，供 withFunctionMonitor 使用
 */
export function getEnhanceArguments(monitor: InternalFunctionMonitor, args: any[], track: Track): any[] {
  const handler = monitor.get('enhance-arguments')
  if (!handler) return args
  
  const result = handler({ args, track })
  // 如果返回数组，使用转换后的参数；否则使用原参数
  return Array.isArray(result) ? result : args
}
