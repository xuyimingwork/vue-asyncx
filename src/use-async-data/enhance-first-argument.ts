import { message } from "../utils"

const FLAG_FIRST_ARGUMENT_ENHANCED = '__va_fae'

export type FirstArgumentEnhanced<T = any, D = any> = {
  [FLAG_FIRST_ARGUMENT_ENHANCED]: true
  firstArgument?: T, 
  getData: () => D, 
  updateData: (v: D) => void
}

/**
 * @deprecated 已废弃，请使用 getAsyncDataContext 替代
 * 
 * 将增强的第一个参数解构为原始参数和上下文对象。
 * 当 `options.enhanceFirstArgument = true` 时，传递给异步函数的第一个参数会被增强为包含原始参数和上下文方法的对象。
 * 
 * @param arg 增强后的第一个参数
 * @param defaultValue 当原始参数为 undefined 时的默认值
 * @returns 包含原始参数和上下文方法的对象
 * 
 * @example
 * // 使用 unFirstArgumentEnhanced（已废弃）
 * const { queryData } = useAsyncData((id) => {
 *   const { firstArgument, getData, updateData } = unFirstArgumentEnhanced(id, 1)
 *   // 使用 firstArgument, getData, updateData
 *   return fetch(`/api/data/${firstArgument}`)
 * }, { enhanceFirstArgument: true })
 * 
 * @example
 * // 迁移到 getAsyncDataContext
 * const { queryData } = useAsyncData((id = 1) => {
 *   const { getData, updateData } = getAsyncDataContext()
 *   // 使用 id, getData, updateData
 *   return fetch(`/api/data/${id}`)
 * })
 */
export function unFirstArgumentEnhanced<Arg = any, Data = any>(arg: Arg, defaultValue?: Arg): Arg extends undefined 
  ? FirstArgumentEnhanced<Arg, Data> 
  : Required<FirstArgumentEnhanced<Arg, Data>> {
  if (!isFirstArgumentEnhanced(arg)) throw Error(message('Set options.enhanceFirstArgument = true or migrate to getAsyncDataContext().'))
  const enhanced: FirstArgumentEnhanced<Arg, Data> = arg
  /**
   * js 的参数默认值规则：当参数为 undefined 时，使用默认值。
   * 即 hello() 与 hello(undefined) 都会触发默认值赋值规则。
   * 因此，当有配置默认值时，直接判断 enhanced.firstArgument 与 undefined 是否全等即可
   */
  if (arguments.length === 2 && enhanced.firstArgument === undefined) return { ...enhanced, firstArgument: defaultValue } as any
  return enhanced as any
}

function isFirstArgumentEnhanced(v: any): v is FirstArgumentEnhanced {
  return typeof v === 'object' && !!v && (FLAG_FIRST_ARGUMENT_ENHANCED in v)
}

export function normalizeEnhancedArguments(args: any[], context: any = {}) {
  const [_first, ...restArgs] = args
  const first: FirstArgumentEnhanced = {
    [FLAG_FIRST_ARGUMENT_ENHANCED]: true,
    ...(args.length ? { firstArgument: _first } : {}), 
    ...context
  }
  return [first, ...restArgs]
}
