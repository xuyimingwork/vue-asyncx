import { Ref } from "vue"
import { FunctionMonitorWithTracker } from "../utils"
import { useStateLoading } from "../shared/state"

export function withAddonLoading(): (params: { 
  monitor: FunctionMonitorWithTracker
}) => {
  __name__Loading: Ref<boolean>
} {
  return (({ monitor }) => {
    return {
      __name__Loading: useStateLoading(monitor),
    }
  }) as any
}