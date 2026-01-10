/**
 * @fileoverview Hooks 共享工具函数
 * 
 * 该模块提供 Hooks 层共享的工具函数，主要用于参数解析。
 * 
 * @module hooks/shared
 */

import { message } from "@/utils/base"
import { BaseFunction } from "@/utils/types"

/**
 * 解析 Hook 参数
 * 
 * @description 解析 `useAsync` 和 `useAsyncData` 的参数。
 * 支持两种调用方式：
 * 1. `hook(fn, options?)`：不指定名称，使用默认名称
 * 2. `hook(name, fn, options?)`：指定名称
 * 
 * @param args - 参数数组
 * 
 * @returns 返回解析后的参数对象
 * @returns {string | undefined} name - 名称（如果提供）
 * @returns {BaseFunction} fn - 函数
 * @returns {any} options - 配置选项
 * 
 * @throws {TypeError} 当参数数量不足时抛出错误
 * @throws {TypeError} 当 name 不是字符串时抛出错误
 * @throws {TypeError} 当 fn 不是函数时抛出错误
 * 
 * @example
 * ```ts
 * // 方式 1：不指定名称
 * parseArguments([fetchUser, { immediate: true }])
 * // { name: undefined, fn: fetchUser, options: { immediate: true } }
 * 
 * // 方式 2：指定名称
 * parseArguments(['user', fetchUser, { immediate: true }])
 * // { name: 'user', fn: fetchUser, options: { immediate: true } }
 * ```
 */
export function parseArguments(args: any[]): { name?: string, fn: BaseFunction, options: any } {
  // 检查参数数量
  if (!Array.isArray(args) || !args.length) {
    throw TypeError(message('Expected at least 1 argument, but got 0.'))
  }
  
  // 判断调用方式：如果第一个参数是函数，则是不指定名称的方式
  const { name, fn, options } = typeof args[0] === 'function'
    ? { fn: args[0], options: args[1] }
    : { name: args[0] || undefined, fn: args[1], options: args[2] }
  
  // 验证 name 类型（如果提供）
  if (name && typeof name !== 'string') {
    throw TypeError(message(`Expected "name" to be a string, but received ${typeof name}.`))
  }
  
  // 验证 fn 类型
  if (typeof fn !== 'function') {
    throw TypeError(message(`Expected "fn" to be a function, but received ${typeof fn}.`))
  }
  
  return { name, fn, options }
}
