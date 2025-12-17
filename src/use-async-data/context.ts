import { message } from "../utils"

type ContextGetter<D = any> = () => { 
  getData: () => D,
  updateData: (v: D) => void
}

let currentContextGetter: ContextGetter = () => {
  throw new Error(message('getAsyncDataContext must be called synchronously within useAsyncData function.'))
}

export function prepareAsyncDataContext<D = any>(context: ReturnType<ContextGetter<D>>) {
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
 * 该函数必须在 `useAsyncData` 函数内部**同步**调用，否则会抛出错误。
 * 上下文对象包含 `getData` 和 `updateData` 方法，用于在异步函数执行中访问和更新数据（竟态安全）。
 * 
 * @returns 包含 `getData` 和 `updateData` 方法的上下文对象
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
 * // 错误用法：在 useAsyncData 外部调用
 * const { getData, updateData } = getAsyncDataContext() // 会抛出错误
 * 
 * @example
 * // 错误用法：在异步回调中调用
 * const { queryData } = useAsyncData((id) => {
 *   setTimeout(() => {
 *     const { getData, updateData } = getAsyncDataContext() // 会抛出错误
 *   }, 1000)
 *   return fetch(`/api/data/${id}`)
 * })
 */
export function getAsyncDataContext() {
  return currentContextGetter()
}