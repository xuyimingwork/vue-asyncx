import { Ref, ref } from "vue"
import type { FunctionMonitorWithTracker } from "@/core/monitor"

/**
 * Creates a reactive loading state that tracks function execution.
 * Sets to true when function is called, false when it completes (if latest call).
 */
export function useStateLoading(monitor: FunctionMonitorWithTracker): Ref<boolean> {
  const loading = ref(false)

  monitor.on('before', () => {
    loading.value = true
  })

  monitor.on('fulfill', ({ track }) => {
    if (!track.isLatestCall()) return
    loading.value = false
  })

  monitor.on('reject', ({ track }) => {
    if (!track.isLatestCall()) return
    loading.value = false
  })

  return loading
}

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