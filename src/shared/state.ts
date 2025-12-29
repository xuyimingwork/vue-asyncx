import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { FunctionMonitorWithTracker } from '../utils/monitor'
import type { Track } from '../utils/tracker'
import { STATE } from '../utils/tracker'
import { prepareAsyncDataContext } from '../use-async-data/context'
import { normalizeEnhancedArguments } from '../use-async-data/enhance-first-argument'

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

/**
 * Creates reactive parameter state that tracks function arguments.
 * Returns parameters during execution, undefined when complete (if latest call).
 */
export function useStateParameters<Fn extends (...args: any) => any>(
  monitor: FunctionMonitorWithTracker
): {
  parameters: ComputedRef<Parameters<Fn> | undefined>
  parameterFirst: ComputedRef<Parameters<Fn>['0'] | undefined>
} {
  const _args = ref<Parameters<Fn>>()

  monitor.on('before', ({ args }) => {
    _args.value = args as Parameters<Fn>
  })

  monitor.on('fulfill', ({ track }) => {
    if (!track.isLatestCall()) return
    _args.value = undefined
  })

  monitor.on('reject', ({ track }) => {
    if (!track.isLatestCall()) return
    _args.value = undefined
  })

  return {
    parameters: computed(() => _args.value),
    parameterFirst: computed(() => _args.value?.[0]),
  }
}

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

  // Prepare context on before event
  monitor.on('before', ({ track }) => {
    // Set initial value (replaces setup interceptor)
    track.setData(VALUE_KEY, data.value)
    
    track.setData(CONTEXT_KEY, {
      getData: () => track.getData(VALUE_KEY),
      updateData: (v: any) => {
        if (!track.canUpdate()) return
        track.setData(VALUE_KEY, v)
        track.update()
        update(v, track)
        return v
      }
    })
    const restore = prepareAsyncDataContext(track.getData(CONTEXT_KEY)!)
    track.setData(RESTORE_KEY, restore)
  })

  // Restore context on after event (right after function call, before finish)
  monitor.on('after', ({ track }) => {
    const restore = track.getData(RESTORE_KEY)
    restore()
    track.setData(RESTORE_KEY)
  })
  // Set up enhance-arguments interceptor to use prepared context for argument enhancement
  // since enhance-arguments happened after 'before' event, always with context
  if (enhanceFirstArgument) {
    monitor.use('enhance-arguments', ({ args, track }) => {
      const enhancedArguments = normalizeEnhancedArguments(args, track.getData(CONTEXT_KEY)!)
      // context can be deleted after use since it's only needed here
      track.setData(CONTEXT_KEY)
      return enhancedArguments
    })
  }

  // Compute dataExpired based on dataTrack and monitor state
  const dataExpired = computed(() => {
    if (!dataTrack.value) return monitor.has.finished.value
    return dataTrack.value.isStaleValue()
  })

  return {
    data,
    dataExpired
  }
}

