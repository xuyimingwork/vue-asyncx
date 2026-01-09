import { computed, ref, shallowRef } from "vue"
import type { Ref, ShallowRef } from "vue"
import type { FunctionMonitorWithTracker } from "@/core/monitor"
import type { Track } from "@/core/tracker"
import { STATE } from "@/core/tracker"
import { prepareAsyncDataContext } from "./context"
import { normalizeEnhancedArguments } from "./enhance"

/**
 * Creates reactive data state that tracks function return values.
 * Updates on fulfill (if latest), tracks rejections for expired state.
 * Supports manual updates via context and handles context setup/cleanup.
 */
export function useStateData<Data = any>(
  monitor: FunctionMonitorWithTracker,
  options?: {
    initialData?: Data
    shallow?: boolean
    /**
     * @deprecated 已废弃，请使用 getAsyncDataContext
     */
    enhanceFirstArgument?: boolean
  }
): {
  data: Ref<Data> | ShallowRef<Data>
  dataExpired: Ref<boolean>
} {
  const VALUE_KEY = Symbol('value')
  const CONTEXT_KEY = Symbol('context')
  const RESTORE_KEY = Symbol('restore')

  const { initialData, shallow = false, enhanceFirstArgument = false } = options || {}
  const data = (shallow 
    ? shallowRef<Data>(initialData) 
    : ref<Data>(initialData)) as Ref<Data> | ShallowRef<Data>
  const dataTrack = shallowRef<Track>()

  // 数据更新逻辑
  function update(v: any, track: Track) {
    if (track.inState(STATE.UPDATING) && !track.isLatestUpdate()) return
    if (track.inState(STATE.FULFILLED) && !track.isLatestFulfill()) return
    data.value = v as Data
    dataTrack.value = track
  }

  // Handle data updates via monitor events
  monitor.on('fulfill', ({ track, value }) => {
    track.setData(VALUE_KEY, value)
    update(value, track)
  })

  // Prepare context on init event (initialization/preparation phase)
  monitor.on('init', ({ track }) => {
    // Set initial value (replaces setup interceptor)
    track.setData(VALUE_KEY, data.value)
    track.setData(CONTEXT_KEY, {
      getData: () => track.getData(VALUE_KEY),
      updateData: (v: any) => {
        if (!track.canUpdate()) return
        track.update()
        track.setData(VALUE_KEY, v)
        update(v, track)
        return v
      }
    })
  })
  
  monitor.on('before', ({ track }) => {
    // init fn implicit execution context
    track.setData(RESTORE_KEY, prepareAsyncDataContext(track.getData(CONTEXT_KEY)!))
  })

  // Restore context on after event (right after function call, before finish)
  monitor.on('after', ({ track }) => {
    track.takeData(RESTORE_KEY)()
  })

  // Set up enhance-arguments interceptor to use prepared context for argument enhancement
  // since enhance-arguments happened after 'init' event, always with context
  if (enhanceFirstArgument) {
    monitor.use('enhance-arguments', ({ args, track }) => {
      // context can be deleted after use since it's only needed here
      return normalizeEnhancedArguments(args, track.takeData(CONTEXT_KEY)!)
    })
  }

  // Compute dataExpired based on dataTrack and monitor state
  const dataExpired = computed(() => {
    // 无数据状态，检查是否有报错信息
    if (!dataTrack.value) return monitor.has.finished.value
    // 如果当前数据的调用最终结果是报错，当前数据过期（当前过期数据由调用的 update 产生）
    if (dataTrack.value.inState(STATE.REJECTED)) return true
    // 否则，当前数据的过期由之后的调用产生
    // 检查在当前调用之后是否有调用发生了报错
    // 无需检查之后调用的 update 和 fulfil 情况，因为上述二者都会更新 dataTrack.value
    return dataTrack.value.hasLaterReject()
  })

  return {
    data,
    dataExpired
  }
}
