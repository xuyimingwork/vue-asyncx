import { watch } from "vue"
import type { WatchCallback, WatchOptions, WatchSource } from "vue"
import { getFunction } from "@/utils/base"
import { AddonTypes } from "@/addons/types"
import { BaseFunction } from "@/utils/types"

function normalizeWatchOptions<Fn extends BaseFunction>(
  method: Fn,
  options?: {
    watch?: WatchSource | WatchSource[]
    watchOptions?: WatchOptions & {
      handlerCreator?: (fn: Fn) => WatchCallback
    }
    immediate?: boolean
  }
): { 
  handler: WatchCallback; 
  source: WatchSource | WatchSource[]; 
  options: WatchOptions } | null {
  if (!options) return null
  
  const { handlerCreator, ...watchOptions } = Object.assign(
    {},
    'immediate' in options ? { immediate: options.immediate } : {},
    options.watchOptions ?? {}
  )
  
  const watchSource = options.watch ?? (() => {})
  const handler = getFunction(
    handlerCreator,
    [method],
    () => method(),
    'Run options.watchOptions.handlerCreator failed, fallback to default behavior.'
  )
  
  return {
    handler, 
    source: watchSource, 
    options: watchOptions 
  }
}

function useWatch(fn: BaseFunction, options?: any): void {
  const watchConfig = normalizeWatchOptions(fn, options)
  if (!watchConfig) return
  watch(watchConfig.source, watchConfig.handler, watchConfig.options)
}

export function withAddonWatch(options?: any): <T extends AddonTypes>(params: { 
  _types: T
}) => ({ method }: { method: T['Method'] }) => void {
  return (() => {
    return ({ method }) => {
      useWatch(method, options)
    }
  }) as any
}