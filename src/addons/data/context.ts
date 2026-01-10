/**
 * @fileoverview 异步数据上下文管理
 * 
 * 该模块提供异步数据上下文的全局管理机制。
 * 上下文只在函数执行的同步部分可用，用于在函数执行过程中访问和更新数据。
 * 
 * ## 工作原理
 * 
 * 1. 在函数调用前（before 事件），通过 `prepareAsyncDataContext` 设置上下文
 * 2. 在函数执行期间（同步部分），可以通过 `getAsyncDataContext` 获取上下文
 * 3. 在函数执行后（after 事件），通过恢复函数移除上下文
 * 
 * ## 限制
 * 
 * - 上下文只在函数执行的同步部分可用
 * - 在异步回调中无法获取上下文（会返回 null）
 * - 嵌套调用必须按顺序恢复上下文
 * 
 * @module addons/data/context
 */

import { message } from "@/utils/base"

/**
 * 上下文获取器类型
 * 
 * @description 用于获取上下文对象的函数类型。
 * 
 * @template D - 数据类型
 */
type ContextGetter<D = any> = () => { 
  getData: () => D,
  updateData: (v: D) => void
}

/**
 * 当前上下文获取器
 * 
 * @description 全局变量，存储当前活跃的上下文获取器。
 * 如果当前不在函数执行上下文中，返回 null。
 * 
 * @internal 内部实现，不对外暴露
 */
let currentContextGetter: ContextGetter | (() => null) = () => null

/**
 * 准备异步数据上下文
 * 
 * @description 设置全局上下文，使得 `getAsyncDataContext` 可以获取到上下文。
 * 返回一个恢复函数，用于在函数执行后恢复之前的上下文状态。
 * 
 * 嵌套调用处理：
 * - 支持嵌套调用，但必须按顺序恢复
 * - 如果恢复顺序错误，会抛出错误
 * 
 * @template D - 数据类型
 * 
 * @param context - 上下文对象，包含 getData 和 updateData 方法
 * 
 * @returns 返回上下文恢复函数，调用后会恢复之前的上下文状态
 * 
 * @internal 内部实现，不对外暴露
 * 
 * @example
 * ```ts
 * const context = { getData: () => data.value, updateData: (v) => data.value = v }
 * const restore = prepareAsyncDataContext(context)
 * 
 * // 此时 getAsyncDataContext() 可以获取到 context
 * 
 * restore() // 恢复之前的上下文状态
 * ```
 */
export function prepareAsyncDataContext<D = any>(context: ReturnType<ContextGetter<D>>): () => void {
  // 保存之前的上下文获取器
  const prev = currentContextGetter
  
  // 创建新的上下文获取器
  const getter = () => context
  
  // 设置当前上下文获取器
  currentContextGetter = getter
  
  /**
   * 恢复异步数据上下文
   * 
   * @description 恢复之前的上下文状态。
   * 如果当前上下文不是当前设置的上下文，说明恢复顺序错误，会抛出错误。
   * 
   * @throws {Error} 当嵌套调用恢复顺序错误时抛出错误
   */
  function restoreAsyncDataContext() {
    // 检查恢复顺序：必须是当前上下文才能恢复
    if (getter !== currentContextGetter) {
      throw new Error(message('[Internal] Nested AsyncDataContext must be restored in order.'))
    }
    // 恢复之前的上下文
    currentContextGetter = prev
  }

  return restoreAsyncDataContext
}

/**
 * 获取当前 `useAsyncData` 函数的上下文对象。
 * 
 * 该函数返回当前执行上下文中的异步数据上下文。只有在 `useAsyncData` 函数执行期间（同步部分）才会返回有效的上下文对象，
 * 在其他情况下（如外部调用、异步回调中）会返回 `null`。
 * 
 * 上下文对象包含 `getData` 和 `updateData` 方法，用于在异步函数执行中访问和更新数据（竟态安全）。
 * 
 * @returns 包含 `getData` 和 `updateData` 方法的上下文对象，如果当前不在 `useAsyncData` 执行上下文中则返回 `null`
 * 
 * @example
 * // 正确用法：在 useAsyncData 内部同步调用
 * const { queryData } = useAsyncData((id = 1) => {
 *   const { getData, updateData } = getAsyncDataContext()
 *   // 使用 getData 获取当前数据
 *   const currentData = getData()
 *   // 执行异步操作
 *   const newData = await fetch(`/api/data/${id}`)
 *   // 使用 updateData 更新数据
 *   updateData(newData)
 *   return newData
 * })
 * 
 * @example
 * // 在 useAsyncData 外部调用会返回 null
 * const context = getAsyncDataContext() // context === null
 * 
 * @example
 * // 在异步回调中调用也会返回 null
 * const { queryData } = useAsyncData((id) => {
 *   setTimeout(() => {
 *     const context = getAsyncDataContext() // context === null
 *   }, 1000)
 *   return fetch(`/api/data/${id}`)
 * })
 */
export function getAsyncDataContext(): ReturnType<ContextGetter> | null {
  return currentContextGetter()
}
