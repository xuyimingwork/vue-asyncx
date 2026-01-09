import { useWatch } from "../shared/function"
import { AddonTypes } from "./types"

export function withAddonWatch(options?: any): <T extends AddonTypes>(params: { 
  _types: T
}) => ({ method }: { method: T['Method'] }) => void {
  return (() => {
    return ({ method }) => {
      useWatch(method, options)
    }
  }) as any
}