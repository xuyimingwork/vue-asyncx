import { ComputedRef } from "vue";
import { FunctionMonitorWithTracker } from "../utils";
import { useStateParameters } from "../shared/state";
import { AddonTypes } from "./types";

export function withAddonArguments(): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitorWithTracker,
  _types: T
}) => {
  __name__Arguments: ComputedRef<Parameters<T['Method']>>
  __name__ArgumentFirst: ComputedRef<Parameters<T['Method']>['0']>
} {
  return (({ monitor }) => {
    const { parameters, parameterFirst } = useStateParameters(monitor)
    return {
      __name__Arguments: parameters,
      __name__ArgumentFirst: parameterFirst
    }
  }) as any
}







