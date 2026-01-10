import { AddonTypes } from "@/addons/types";
import type { FunctionMonitor } from "@/core/monitor";

export function withAddonFunction(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitor,
  _types: T
}) => ({ method }: { method: T['Method'] }) => {
  __name__: T['Method']
} {
  return (() => {    
    return ({ method }) => ({
      __name__: method,
    })
  }) as any
}