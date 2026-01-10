import type { FunctionMonitor } from "@/core/monitor"
import { Ref, ref } from "vue"

export function withAddonLoading(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Loading: Ref<boolean>
} {
  return (({ monitor }) => {
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

    return {
      __name__Loading: loading,
    }
  }) as any
}