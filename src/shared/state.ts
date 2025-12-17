import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { FunctionMonitorWithTracker } from '../utils/monitor'
import type { Track } from '../utils/tracker'
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
  const { initialData, shallow = false, enhanceFirstArgument = false } = options || {}
  const data = (shallow 
    ? shallowRef<Data>(initialData) 
    : ref<Data>(initialData)) as Ref<Data> | ShallowRef<Data>
  const dataTrack = shallowRef<Track>()

  // 数据更新逻辑
  function update(v: any, track: Track) {
    if (track.inStateUpdating() && !track.isLatestUpdate()) return
    if (track.inStateFulfilled() && !track.isLatestFulfill()) return
    data.value = v as Data
    dataTrack.value = track
  }

  // Handle data updates via monitor events
  monitor.on('fulfill', ({ track, value }) => {
    update(value, track)
  })

  // Context management
  function getContext(track: Track) {
    return {
      getData: () => track.value,
      updateData: (v: any) => {
        if (!track.allowToStateUpdating()) return
        track.update(v)
        update(v, track)
        return v
      }
    }
  }

  // Store context and restore functions per call using WeakMaps keyed by track
  const contexts = new WeakMap<Track, ReturnType<typeof getContext>>()
  const restoreFunctions = new WeakMap<Track, () => void>()

  // Prepare context on before event
  monitor.on('before', ({ track }) => {
    const context = getContext(track)
    const restoreAsyncDataContext = prepareAsyncDataContext(context)
    contexts.set(track, context)
    restoreFunctions.set(track, restoreAsyncDataContext)
  })

  // Restore context on after event (right after function call, before finish)
  monitor.on('after', ({ track }) => {
    const restore = restoreFunctions.get(track)
    if (restore) {
      restore()
      restoreFunctions.delete(track)
      contexts.delete(track)
    }
  })

  // Use monitor's setup interceptor to initialize track with data.value
  monitor.use('setup', () => data.value)

  // Set up enhance-arguments interceptor to use prepared context for argument enhancement
  // since enhance-arguments happened after ’before‘ event, always with context
  if (enhanceFirstArgument) monitor.use('enhance-arguments', ({ args, track }) => normalizeEnhancedArguments(args, contexts.get(track)!))

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

