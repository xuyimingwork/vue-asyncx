import type { Ref, ShallowRef } from "vue"
import type { FunctionMonitorWithTracker } from "../../core/monitor"
import { AddonTypes } from "../types"
import { useStateData } from "./state"

export function withAddonData<Config extends { 
  type?: 'function' | 'data'
  shallow?: boolean,
  initialData?: any
}>(config?: Config): 
<T extends AddonTypes>(p: { _types: T }) => () => Config['type'] extends 'function' 
  ? { 
    __name__Data: Config['shallow'] extends true 
      ? ShallowRef<Awaited<ReturnType<T['Method']>>> 
      : Ref<Awaited<ReturnType<T['Method']>>> 
    __name__DataExpired: Ref<boolean>
  }
  : {
    __name__: Config['shallow'] extends true 
      ? ShallowRef<Awaited<ReturnType<T['Method']>>> 
      : Ref<Awaited<ReturnType<T['Method']>>> 
    __name__Expired: Ref<boolean>
  } {
  const { type, ...options } = config
  return (({ monitor }) => {
    const {
      data, dataExpired
    } = useStateData(monitor, options)
    if (type === 'function') return {
      __name__Data: data,
      __name__DataExpired: dataExpired
    }
    return {
      __name__: data,
      __name__Expired: dataExpired
    }
  }) as any
}

// Re-export for convenience
export { useStateData } from "./state"
export { getAsyncDataContext, prepareAsyncDataContext } from "./context"
export { unFirstArgumentEnhanced, normalizeEnhancedArguments, type FirstArgumentEnhanced } from "./enhance"
