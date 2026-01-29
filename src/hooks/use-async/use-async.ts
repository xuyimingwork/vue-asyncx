/**
 * @fileoverview useAsync - 封装异步函数并提供响应式状态
 *
 * 用于封装异步操作（如 API 调用、确认弹窗等），自动提供 loading、error、arguments 等
 * 响应式状态。适用于不需要展示返回数据的场景（如提交、删除、确认等）。
 *
 * @module hooks/use-async
 */

import { withAddonArguments } from "@/addons/arguments"
import { withAddonError } from "@/addons/error"
import { withAddonFunction } from "@/addons/function"
import { withAddonLoading } from "@/addons/loading"
import { withAddonWatch } from "@/addons/watch"
import { toNamedAddons } from "@/core/naming"
import { setupFunctionPipeline } from "@/core/setup-pipeline"
import { parseArguments } from "@/hooks/shared"
import type { UseAsync } from './types'

/**
 * 封装异步函数，提供 loading、error、arguments 等响应式状态。
 *
 * @remarks
 * 调用方式（详见 {@link UseAsync}）：
 * - `useAsync(fn, options?)` - 默认名称 'method'，返回 method、methodLoading 等
 * - `useAsync(name, fn, options?)` - 自定义名称，如 'confirm' 返回 confirm、confirmLoading 等
 *
 * @see UseAsync - 完整 API 文档、示例、配置选项
 */
export const useAsync: UseAsync = (...args) => {
  const { name = 'method', fn, options } = parseArguments(args)
  return setupFunctionPipeline({
    fn,
    options,
    addons: toNamedAddons(name, [
      withAddonLoading(),
      withAddonError(),
      withAddonArguments(),
      withAddonFunction(),
      ...(options?.addons || []),
      withAddonWatch(options)
    ]) as any
  }) as any
}

export { useAsync as useAsyncFunction }

