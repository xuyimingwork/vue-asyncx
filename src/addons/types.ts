import type { FunctionMonitorWithTracker } from "../core/monitor"
import type { BaseFunction, IsUnion, MergeTypes, ObjectShape, ObjectShapeList } from "../utils/types"

export interface AddonTypes<M extends BaseFunction = any> {
  Method: M
}

/**
 * 插件（Addon）定义类型。
 * 
 * @description
 * 插件允许在核心流程执行的不同阶段注入逻辑和状态。它支持两种形式：
 * 1. **基础插件**：返回对象，仅参与 setup 前的 fn 监听过程
 * 2. **高级插件**：返回函数，参与 setup **前&后**流程，获取 setup 后的 method
 * 
 * @template Method - 管道包装的核心函数类型。
 * @template AddonResult - 插件的结果（对象/函数）。
 * 
 * @param params - 注入的上下文对象。
 * @param params.monitor - 监控与追踪工具，用于观测函数执行。
 * @param params._types - 辅助类型占位符，用于在插件内部保留 Method 的类型上下文。
 * 
 * @example
 * // 1. 基础插件：仅参与 setup 前的监听
 * function withAddonLoading(): (params: { 
 *   monitor: FunctionMonitorWithTracker
 * }) => { loading: Ref<boolean> } {
 *   return
 * }
 * // 2. 高级插件：需要访问最终生成的方法
 * function withAddonData<Config extends { 
 *   type?: 'function' | 'data'
 *   shallow?: boolean,
 *   initialData?: any
 * }>(config?: Config): 
 * <T extends AddonTypes>(p: { _types: T }) => () => Config['type'] extends 'function' 
 *   ? { 
 *     __name__Data: Config['shallow'] extends true 
 *       ? ShallowRef<Awaited<ReturnType<T['Method']>>> 
 *       : Ref<Awaited<ReturnType<T['Method']>>> 
 *     __name__DataExpired: Ref<boolean>
 *   }
 *   : {
 *     __name__: Config['shallow'] extends true 
 *       ? ShallowRef<Awaited<ReturnType<T['Method']>>> 
 *       : Ref<Awaited<ReturnType<T['Method']>>> 
 *     __name__Expired: Ref<boolean>
 *   } {
 *  return
 * }
 */
export type Addon<Method extends BaseFunction = any, AddonResult = any> = (params: { 
  monitor: FunctionMonitorWithTracker, 
  _types: AddonTypes<Method>
}) => (AddonResult | ((params: { method: Method }) => AddonResult))

export type Addons<
  Fn extends BaseFunction,
  AddonResults extends any[],
> = {
  [K in keyof AddonResults]: Addon<Fn, AddonResults[K]>
}

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

export type MergeAddonResults<AddonResults extends any[]> = MergeTypes<ObjectShapeList<[
  ...GetAddonBasicResults<AddonResults>,
  ...GetAddonAdvanceResults<AddonResults>
]>>

/**
 * 获取插件结果的键名。
 * 
 * @description 
 * 自动识别插件类型：
 * - 若基础插件返回对象，则提取该对象的键。
 * - 若高级插件返回函数，则提取该函数返回对象的键。
 * 
 * @example
 * // 情况 1: 插件返回对象
 * type R1 = { count: number; name: string };
 * type Keys1 = GetAddonResultKeys<R1>; // 'count' | 'name'
 * // 情况 2: 插件返回函数
 * type R2 = () => { theme: string; active: boolean };
 * type Keys2 = GetAddonResultKeys<R2>; // 'theme' | 'active'
 */
type GetAddonResultKeys<R> = R extends BaseFunction 
  ? keyof ObjectShape<ReturnType<R>>
  : keyof ObjectShape<R>

/**
 * 获取插件结果列表中重复的键。
 * 
 * @description
 * 检查所有插件结果的键名，如果多个插件定义了同名的键，
 * 这些键将被提取并返回，以便在编译期进行冲突警告。
 * 
 * @example
 * // 场景：三个插件返回的结果类型
 * type AddonResultA = { id: string; user: any };
 * type AddonResultB = { theme: string };
 * type AddonResultC = () => { id: number; config: any };
 * // 检测冲突，Result 为 'id'，因为 AddonResultA 和 AddonResultC 都包含了 'id' 键
 * type Result = GetAddonResultsDuplicateKeys<[AddonResultA, AddonResultB, AddonResultC]>; 
 * 
 * @returns 返回重复的键名联合类型；若所有键均唯一，则返回 never。
 */
export type GetAddonResultsDuplicateKeys<T extends readonly any[], Seen = never> = 
  T extends readonly [infer Head, ...infer Tail]
  ? (GetAddonResultKeys<Head> & Seen) | GetAddonResultsDuplicateKeys<Tail, Seen | GetAddonResultKeys<Head>>
  : never;