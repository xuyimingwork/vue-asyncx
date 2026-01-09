import { message } from "../../utils/base"

type ContextGetter<D = any> = () => { 
  getData: () => D,
  updateData: (v: D) => void
}

let currentContextGetter: ContextGetter | (() => null) = () => null

export function prepareAsyncDataContext<D = any>(context: ReturnType<ContextGetter<D>>): () => void {
  const prev = currentContextGetter
  const getter = () => context
  currentContextGetter = getter
  function restoreAsyncDataContext() {
    if (getter !== currentContextGetter) throw new Error(message('[Internal] Nested AsyncDataContext must be restored in order.'))
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
