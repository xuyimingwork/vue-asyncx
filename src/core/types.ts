import { Addons, GetAddonResultsDuplicateKeys, MergeAddonResults } from "../addons/types"
import { BaseFunction } from "../utils/types"

/**
 * 核心接口，用于组织和执行带有插件（Addons）的函数。
 * 
 * @description
 * Addon 支持两阶段扩展机制：
 * 1. **预执行阶段**：插件直接返回对象，用于初始化状态。
 * 2. **后执行阶段**：插件返回一个函数，该函数在 `useSetup` 执行后触发，可访问最终的方法实例。
 * 
 * @template Fn - 核心业务逻辑函数的类型。
 * @template Options - 传递给 `useSetup` 的配置项类型。
 * @template AddonResults - 插件返回结果的元组类型，用于最终的类型推导与合并。
 * 
 * @param options - 配置对象。
 * @param options.fn - 执行函数。
 * @param options.options - 可选的配置参数。
 * @param options.addons - 插件数组。
 * 
 * @description **内部实现逻辑** \
 * 使用 AddonResults 泛型而不是 Addons 泛型的原因是：
 * - ts 函数的泛型是由函数接收的实参推导的
 * - addons 接收了 fn
 * - pipeline 本身也接收了 fn
 * 
 * Fn 有两处实参来源，导致 ts 无法推导出 Fn 的类型。\
 * 因此，此处实际的逻辑是：先推导 fn 的类型并赋值给 Fn，然后将确定的 Fn 类型传入 Addons。 \
 */
export interface SetupFunctionPipeline {
  <
    Fn extends BaseFunction,
    Options,
    AddonResults extends any[],
  >(options: { 
    fn: Fn,
    options?: Options,
    addons: Addons<Fn, AddonResults> 
  } & (
    [GetAddonResultsDuplicateKeys<AddonResults>] extends [never] 
      ? {} 
      : { addons: `Error: Duplicate key [${GetAddonResultsDuplicateKeys<AddonResults>}]` }
  )): MergeAddonResults<AddonResults>
}

