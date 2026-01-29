/**
 * @fileoverview useAsyncData - 管理异步数据并提供响应式更新
 *
 * 用于封装异步数据获取（如 API 查询），自动关联数据、查询函数及其状态。
 * 数据为响应式，调用查询函数后自动更新。适用于需要展示异步返回数据的场景。
 *
 * @module hooks/use-async-data
 */

import { upperFirst } from "@/utils/base";
import { useAsync } from "@/hooks/use-async/use-async";
import { withAddonData } from "@/addons/data";
import { toNamedAddons } from "@/core/naming";
import { parseArguments } from "@/hooks/shared";
import type { UseAsyncData } from "./types";

/**
 * 管理异步数据，提供响应式数据、查询函数及关联状态。
 *
 * @remarks
 * 调用方式（详见 {@link UseAsyncData}）：
 * - `useAsyncData(fn, options?)` - 默认名称 'data'，返回 data、queryData、dataExpired 等
 * - `useAsyncData(name, fn, options?)` - 自定义名称，如 'user' 返回 user、queryUser、userExpired 等
 *
 * @see UseAsyncData - 完整 API 文档、示例、配置选项
 */
export const useAsyncData: UseAsyncData = function useAsyncData(...args: any[]): any {
  const { name = 'data', fn, options } = parseArguments(args)
  const queryName = `query${upperFirst(name) }` as const
  return useAsync(queryName, fn, {
    ...options,
    addons: toNamedAddons(name, [
      withAddonData({
        ...options,
        type: 'data'
      }),
      ...(options?.addons || [])
    ])
  })
}


export { unFirstArgumentEnhanced, getAsyncDataContext } from '@/addons/data'

