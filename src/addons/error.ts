import { ref } from "vue"
import type { Ref } from "vue"
import type { FunctionMonitorWithTracker } from "@/core/monitor"

/**
 * Creates a reactive error state that tracks function errors.
 * Clears on new call, sets error on rejection (if latest call).
 */
export function useStateError(monitor: FunctionMonitorWithTracker): Ref<any> {
  const error = ref()

  monitor.on('before', () => {
    error.value = undefined
  })

  monitor.on('reject', ({ track, error: err }) => {
    if (!track.isLatestCall()) return
    error.value = err
  })

  return error
}

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