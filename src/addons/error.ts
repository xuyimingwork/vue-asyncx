import type { FunctionMonitor } from "@/core/monitor"
import type { Ref } from "vue"
import { ref } from "vue"

export function withAddonError(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Error: Ref<any>
} {
  return (({ monitor }) => {
    const error = ref()

    monitor.on('before', () => {
      error.value = undefined
    })

    monitor.on('reject', ({ track, error: err }) => {
      if (!track.isLatestCall()) return
      error.value = err
    })

    return {
      __name__Error: error,
    }
  }) as any
}