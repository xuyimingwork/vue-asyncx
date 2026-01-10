/**
 * @fileoverview 插件管道系统
 * 
 * 该模块负责组织和执行插件（Addon），合并插件返回的状态。
 * 支持两阶段执行机制：基础插件在 setup 前执行，高级插件在 setup 后执行。
 * 
 * @module core/setup-pipeline
 */

import { message } from "@/utils/base";
import { withFunctionMonitor } from "./monitor";
import { SetupFunctionPipeline } from "./types";
import { useSetup } from "./use-setup";

/**
 * 设置函数管道
 * 
 * @description 该函数创建一个函数执行管道，支持插件化扩展。
 * 管道会按顺序执行所有插件，合并插件返回的状态。
 * 
 * 执行流程：
 * 1. 创建函数监控器和追踪器
 * 2. 阶段一：执行所有插件，收集基础状态和高级插件
 * 3. 执行 useSetup 包装函数
 * 4. 阶段二：执行高级插件（需要访问最终 method 的插件）
 * 5. 合并所有状态并返回
 * 
 * @param options - 配置对象
 * @param options.fn - 执行函数
 * @param options.options - 可选的配置参数，传递给 useSetup
 * @param options.addons - 插件数组
 * 
 * @returns 返回合并后的插件状态
 * 
 * @throws {Error} 当插件返回重复键时抛出错误
 * 
 * @example
 * ```ts
 * const result = setupFunctionPipeline({
 *   fn: fetchUser,
 *   options: { immediate: true },
 *   addons: [withAddonLoading(), withAddonError()]
 * })
 * 
 * // result 包含 { userLoading, userError }
 * ```
 */
export const setupFunctionPipeline: SetupFunctionPipeline = (options) => {
  const { fn, addons } = options
  
  // 创建函数监控器和追踪器
  const { run, monitor } = withFunctionMonitor(fn)
  
  // 阶段一：执行所有插件，收集基础状态和高级插件
  const { states, postAddons } = addons.reduce((acc, addon) => {
    if (typeof addon !== 'function') return acc
    
    // 执行插件，传入 monitor 和类型占位符
    const result = addon({ monitor, _types: undefined })
    
    // 如果插件返回函数，说明是高级插件，需要在阶段二执行
    if (typeof result === 'function') {
      acc.postAddons.push(result)
      return acc
    }
    
    // 基础插件直接返回对象，立即合并状态
    acc.states = mergeAddonResults(acc.states, result)
    return acc
  }, { states: {}, postAddons: [] })
  
  // 执行 useSetup 包装函数，生成最终的 method
  const method = useSetup(run, options.options)
  
  // 如果没有高级插件，直接返回基础状态
  if (!postAddons.length) return states as any
  
  // 阶段二：执行高级插件，传入最终的 method
  return postAddons.reduce((acc, addon) => {
    const result = addon({ method })
    return mergeAddonResults(acc, result)
  }, states)
}

/**
 * 合并插件返回的结果
 * 
 * @description 将多个插件返回的状态对象合并为一个对象。
 * 如果存在重复的键，会抛出错误以防止状态冲突。
 * 
 * @param base - 基础对象，已合并的状态
 * @param patch - 要合并的对象，新插件的返回状态
 * 
 * @returns 合并后的对象
 * 
 * @throws {Error} 当存在重复键时抛出错误，错误信息包含所有重复的键名
 * 
 * @internal 内部实现，不对外暴露
 */
function mergeAddonResults(base: any, patch: any): any {
  // 如果 patch 不是对象或为空，直接返回 base
  if (typeof patch !== 'object' || !patch) return base
  
  // 如果 patch 没有键，直接返回 base
  if (!Object.keys(patch).length) return base
  
  // 检测重复键，如果存在则抛出错误
  const duplicates = getDuplicateKeys(base, patch)
  if (duplicates.length) throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
  
  // 合并对象，patch 的键会覆盖 base 的同名键
  return { ...base, ...patch }
}

/**
 * 获取两个对象中重复的键
 * 
 * @description 检查 obj2 中的键是否在 obj1 中存在，返回所有重复的键。
 * 
 * @param obj1 - 第一个对象
 * @param obj2 - 第二个对象
 * 
 * @returns 返回重复的键名数组
 * 
 * @internal 内部实现，不对外暴露
 */
function getDuplicateKeys(obj1: object, obj2: object): string[] {
  return Object.keys(obj2).filter(key => key in obj1)
}

