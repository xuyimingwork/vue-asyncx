/**
 * @fileoverview 命名转换系统
 * 
 * 该模块负责将插件返回的属性名中的 `__name__` 占位符替换为实际名称。
 * 
 * ## 转换规则
 * 
 * - `__name__` 在开头：替换为小驼峰（如 `__name__Loading` → `userLoading`）
 * - `__name__` 在中间：替换为大驼峰（如 `query__name__` → `queryUser`）
 * - 不包含 `__name__` 的属性：默认丢弃（可通过配置保留）
 * 
 * ## 设计目的
 * 
 * - 统一命名风格
 * - 建立变量之间的关联关系
 * - 支持类型推导
 * 
 * @module core/naming
 */

import { lowerFirst, upperFirst } from "@/utils/base";
import { BaseFunction, CamelReplaceKeys } from "@/utils/types";

/**
 * 名称占位符
 * 
 * @description 插件返回的属性名中使用此占位符，会被替换为实际名称。
 * 
 * @example
 * ```ts
 * // 插件返回
 * { __name__Loading: ref(false) }
 * 
 * // 使用名称 'user' 转换后
 * { userLoading: ref(false) }
 * ```
 */
export const PLACEHOLDER = '__name__'

/**
 * RAW_ADDON 符号
 * 
 * @description 用于标记已命名的 addon，避免重复处理。
 * 该属性不暴露，不会受其他 rawAddon 影响。
 * 
 * @internal 内部使用，不对外暴露
 */
const RAW_ADDON: symbol = Symbol('RawAddon');

/**
 * 已命名的 Addon 接口
 * 
 * @description 表示已经应用了命名转换的 Addon。
 * 
 * @template Name - 名称类型
 * @template Addon - Addon 类型
 */
interface NamedAddon<Name extends string, Addon extends BaseFunction> {
  (...args: Parameters<Addon>): ReturnType<Addon> extends BaseFunction 
    ? (...args: Parameters<ReturnType<Addon>>) => CamelReplaceKeys<ReturnType<ReturnType<Addon>>, Name>
    : CamelReplaceKeys<ReturnType<Addon>, Name>,
  [RAW_ADDON]: boolean
}

/**
 * 批量转换 Addon 为命名 Addon
 * 
 * @description 将多个 Addon 批量转换为命名 Addon，应用名称转换。
 * 
 * @template Name - 名称类型
 * @template Addons - Addon 数组类型
 * 
 * @param name - 名称，用于替换占位符
 * @param addons - Addon 数组
 * 
 * @returns 返回已命名的 Addon 数组
 * 
 * @example
 * ```ts
 * const namedAddons = toNamedAddons('user', [
 *   withAddonLoading(),
 *   withAddonError()
 * ])
 * 
 * // namedAddons 中的 addon 返回的属性名会包含 'user'
 * ```
 */
export function toNamedAddons<
  Name extends string, 
  const Addons extends BaseFunction[]
>(name: Name, addons: Addons): {
  [K in keyof Addons]: NamedAddon<Name, Addons[K]>
} {
  return addons.map(item => toNamedAddon(name, item)) as any
}

/**
 * 将 Addon 转换为命名 Addon
 * 
 * @description 将 addon 返回的属性全部转化为名称标记后的属性。
 * 
 * 转换规则：
 * - 如果返回属性无名称标记，该返回属性将被舍弃
 * - 如果 addon 已是 namedAddon，不处理直接返回
 * - 支持基础 Addon（返回对象）和高级 Addon（返回函数）
 * 
 * @template Name - 名称类型
 * @template Addon - Addon 类型
 * 
 * @param name - 名称，用于替换占位符
 * @param addon - 要转换的 Addon
 * 
 * @returns 返回已命名的 Addon
 * 
 * @internal 内部使用，不对外暴露
 * 
 * @example
 * ```ts
 * const addon = withAddonLoading()
 * const namedAddon = toNamedAddon('user', addon)
 * 
 * // namedAddon 返回 { userLoading: ... } 而不是 { __name__Loading: ... }
 * ```
 */
export function toNamedAddon<
  Name extends string, 
  Addon extends BaseFunction
>(name: Name, addon: Addon): NamedAddon<Name, Addon> {
  // 如果 addon 已经是 namedAddon，直接返回
  if (addon[RAW_ADDON]) return addon as any
  
  // 创建包装函数，应用命名转换
  const namedAddon = ((...args) => {
    const result = addon(...args)
    
    // 如果返回函数（高级 Addon），需要再次包装
    if (typeof result === 'function') {
      return (...args) => {
        return toNamedAddonResult(name, result(...args))
      }
    }
    
    // 基础 Addon 直接转换结果
    return toNamedAddonResult(name, result)
  }) as any
  
  // 标记为已命名，避免重复处理
  namedAddon[RAW_ADDON] = addon
  return namedAddon
}

/**
 * 转换 Addon 返回结果为命名结果
 * 
 * @description 将对象中的属性名从占位符格式转换为实际名称格式。
 * 只保留包含占位符的属性，其他属性会被丢弃。
 * 
 * @param name - 名称，用于替换占位符
 * @param result - Addon 返回的结果对象
 * 
 * @returns 返回转换后的对象，如果 result 不是对象则返回 undefined
 * 
 * @internal 内部实现，不对外暴露
 */
function toNamedAddonResult(name: string, result: any): any {
  // 如果 result 不是对象，直接返回
  if (typeof result !== 'object' || !result) return
  
  // 遍历所有键，转换包含占位符的键
  return Object.keys(result).reduce((acc, key) => {
    const namedKey = toNamedAddonResultKey(name, key)
    // 如果转换后的键为空（不包含占位符），则丢弃
    if (!namedKey) return acc
    acc[namedKey] = result[key]
    return acc
  }, {})
}

/**
 * 转换单个属性名为命名属性名
 * 
 * @description 将属性名中的 `__name__` 占位符替换为实际名称。
 * 
 * 转换规则：
 * - 如果 key 以 `__name__` 开头：替换为小驼峰（如 `__name__Loading` → `userLoading`）
 * - 如果 key 包含 `__name__`（不在开头）：替换为大驼峰（如 `query__name__` → `queryUser`）
 * - 如果 key 不包含 `__name__`：返回 undefined（表示丢弃）
 * 
 * @param name - 名称，用于替换占位符
 * @param key - 原始属性名
 * 
 * @returns 返回转换后的属性名，如果不包含占位符则返回 undefined
 * 
 * @internal 内部实现，不对外暴露
 * 
 * @example
 * ```ts
 * toNamedAddonResultKey('user', '__name__Loading') // 'userLoading'
 * toNamedAddonResultKey('user', 'query__name__')    // 'queryUser'
 * toNamedAddonResultKey('user', 'otherKey')         // undefined
 * ```
 */
function toNamedAddonResultKey(name: string, key: string): string | undefined {
  // 如果 key 不是字符串，返回 undefined
  /* v8 ignore if -- @preserve 上层通过 Object.keys 调用，不产生 string 实际不会引发问题 */
  if (typeof key !== 'string') return
  
  // 如果 key 不包含占位符，返回 undefined（表示丢弃）
  if (!key.includes(PLACEHOLDER)) return
  
  // 如果 key 以占位符开头，替换为小驼峰
  const raw = key.startsWith(PLACEHOLDER) 
    ? key.replace(PLACEHOLDER, lowerFirst(name))
    : key 
  
  // 替换所有剩余的占位符为大驼峰
  return raw.replace(new RegExp(PLACEHOLDER, 'g'), upperFirst(name))
}

