import { AddonTypes } from "@/addons/types";
import type { FunctionMonitorWithTracker } from "@/core/monitor";

export function withAddonFunction(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitorWithTracker,
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