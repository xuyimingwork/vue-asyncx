import { WatchCallback, WatchOptions, WatchSource } from "vue";
import { UseAsyncOptions } from "./types";
import { getFunction } from "../utils";

export function normalizeWatchOptions<Fn extends (...args: any) => any>(
  method: Fn,
  options?: UseAsyncOptions<Fn>
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