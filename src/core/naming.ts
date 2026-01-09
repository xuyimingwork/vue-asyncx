import { upperFirst } from "../utils/base";
import { lowerFirst } from "../utils/base";
import { BaseFunction, CamelReplaceKeys } from "../utils/types";

export const PLACEHOLDER = '__name__'

type NamedAddon<Name extends string, Addon extends BaseFunction> = (...args: Parameters<Addon>) => ReturnType<Addon> extends BaseFunction 
  ? (...args: Parameters<ReturnType<Addon>>) => CamelReplaceKeys<ReturnType<ReturnType<Addon>>, Name>
  : CamelReplaceKeys<ReturnType<Addon>, Name>

export function toNamedAddons<
  Name extends string, 
  const Addons extends BaseFunction[]
>(name: Name, addons: Addons): {
  [K in keyof Addons]: NamedAddon<Name, Addons[K]>
} {
  return addons.map(item => toNamedAddon(name, item)) as any
}

/**
 * 
 * @private 内部使用，不对外
 * 
 * @param name 
 * @param addon 
 * @returns 
 */
export function toNamedAddon<
  Name extends string, 
  Addon extends BaseFunction
>(name: Name, addon: Addon): NamedAddon<Name, Addon> {
  return ((...args) => {
    const result = addon(...args)
    if (typeof result === 'function') return (...args) => {
      return toNamedAddonResult(name, result(...args))
    }
    return toNamedAddonResult(name, result)
  }) as any
}

function toNamedAddonResult(name: string, result: any): any {
  if (typeof result !== 'object' || !result) return
  return Object.keys(result).reduce((acc, key) => {
    const namedKey = toNamedAddonResultKey(name, key)
    if (!namedKey) return acc
    acc[namedKey] = result[key]
    return acc
  }, {})
}

function toNamedAddonResultKey(name: string, key: string): string | undefined {
  if (typeof key !== 'string') return
  if (!key.includes(PLACEHOLDER)) return
  const raw = key.startsWith(PLACEHOLDER) 
    ? key.replace(PLACEHOLDER, lowerFirst(name))
    : key 
  return raw.replace(new RegExp(PLACEHOLDER, 'g'), upperFirst(name))
}

