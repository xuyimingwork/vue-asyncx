import { Ref } from "vue"
import { FunctionMonitorWithTracker } from "../utils"
import { useStateError } from "../shared/state"

export function withAddonError(): (params: { 
  monitor: FunctionMonitorWithTracker
}) => {
  __name__Error: Ref<any>
} {
  return (({ monitor }) => {
    return {
      __name__Error: useStateError(monitor),
    }
  }) as any
}