import { useSetup } from "../shared/function";
import { FunctionMonitorWithTracker, withFunctionMonitor } from "../utils";
import { Fn as BaseFunction, IsUnion, MergeTypes, message, ObjectShape } from "../utils/base";

interface AddonTypes<M = any> {
  Method: M
}

type Addon<Method = any, AddonResult = any> = (params: { 
  monitor: FunctionMonitorWithTracker, 
  _types: AddonTypes<Method>
}) => (AddonResult | ((params: { method: Method }) => AddonResult))
type GetAddonBasicResults<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
  ? IsUnion<First> extends false
    ? [First, ...GetAddonBasicResults<Rest>]
    : GetAddonBasicResults<Rest>
  : []
type GetAddonAdvanceResults<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
  ? IsUnion<First> extends true
    ? [Exclude<First, BaseFunction>, ...GetAddonAdvanceResults<Rest>]
    : GetAddonAdvanceResults<Rest>
  : []
type GetAddonResultKeys<R> = R extends BaseFunction 
  ? keyof ObjectShape<ReturnType<R>>
  : keyof ObjectShape<R>
type IdentifyDuplicates<T extends readonly any[], Seen = never> = 
  T extends readonly [infer Head, ...infer Tail]
  ? (GetAddonResultKeys<Head> & Seen) | IdentifyDuplicates<Tail, Seen | GetAddonResultKeys<Head>>
  : never;

function getDuplicateKeys(obj1: object, obj2: object): string[] {
  return Object.keys(obj2).filter(key => key in obj1)
}

export function setupFunctionPipeline<
  Fn extends BaseFunction,
  Options,
  AddonResults extends any[],
>(options: { 
  fn: Fn,
  options?: Options,
  addons:  {
    [K in keyof AddonResults]: Addon<Fn, AddonResults[K]>
  }
} & (
  [IdentifyDuplicates<AddonResults>] extends [never] 
    ? {} 
    : { addons: `Error: Has duplicate keys: ${Extract<IdentifyDuplicates<AddonResults>, string>}` }
)): MergeTypes<[
  ...GetAddonBasicResults<AddonResults>,
  ...GetAddonAdvanceResults<AddonResults>
]> {
  const { fn, addons } = options
  const { run, monitor } = withFunctionMonitor(fn)
  const { states, postAddons } = addons.reduce((acc, addon) => {
    if (typeof addon !== 'function') return acc
    const result = addon({ monitor, _TYPES_: undefined })
    if (typeof result === 'function') {
      acc.postAddons.push(result)
      return acc
    }
    if (typeof result !== 'object' || !result) return acc
    if (!Object.keys(result).length) return acc
    const duplicates = getDuplicateKeys(acc.states, result)
    if (duplicates.length) throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
    acc.states = { ...acc.states, ...result }
    return acc
  }, { states: {}, postAddons: [] })
  const method = useSetup(run, options.options)
  if (!postAddons.length) return states as any
  return postAddons.reduce((acc, addon) => {
    const result = addon({ method })
    if (typeof result !== 'object' || !result) return acc
    if (!Object.keys(result).length) return acc
    const duplicates = getDuplicateKeys(acc, result)
    if (duplicates.length) throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
    return { ...states, ...result }
  }, states)
}

/**
 * @example addon 写法 / setup 用法
 * 
 * function withData(config: { hello: 'world' }): 
 * <T extends AddonTypes>(p: { _types: T }) => () => { f: T['Method'] } {
 *  return
 * }
 * 
 * @example setupFunctionPipeline 不涉及 name 相关的 key 转换部分
 * setupFunctionPipeline 抛出的 key 重复异常由上层处理
 * 或者上层提前封装 addon 后传入 NamedAddon，这样就没有语义问题
 * 
 * const res = setupFunctionPipeline({ 
 *   fn: (params: { t: number }) => 1,
 *   addons: [
 *     ({ monitor }) => ({ method }) => ({ method }),
 *     ({ monitor }) => ({ a: 1 }),
 *     ({ monitor }) => ({ b: true }),
 *     ({ monitor }) => ({ c: 'hello' }),
 *     ({ monitor }) => undefined,
 *     withData({ hello: 'world' })
 *   ]
 * })
 * 
 * 外层的表示实际上完全由类型校验
 * 
 */