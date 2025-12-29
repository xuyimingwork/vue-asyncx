import { computed, ComputedRef, Ref, ref } from "vue"
import { max } from "./base";

export type Track = {
  readonly sn: number
  inState: (state: typeof STATE[keyof typeof STATE]) => boolean
  canUpdate: () => boolean
  update: () => void
  fulfill: () => void
  reject: () => void
  isLatestCall: () => boolean
  isLatestUpdate: () => boolean
  isLatestFulfill: () => boolean
  isStaleValue: () => boolean
  setData: (key: symbol, value?: any) => void
  getData: <V = any>(key: symbol) => V | undefined
}

export type Tracker = {
  track: () => Track,
  has: {
    finished: ComputedRef<boolean>
  }
}

export const STATE = {
  PENDING: 0,
  UPDATING: 1,
  FULFILLED: 2,
  REJECTED: 3,
  FINISHED: 4  // 查询专用，不参与状态转换
} as const;

const STATE_TRANSITIONS = {
  [STATE.PENDING]: [STATE.UPDATING, STATE.FULFILLED, STATE.REJECTED],
  [STATE.UPDATING]: [STATE.UPDATING, STATE.FULFILLED, STATE.REJECTED],
  [STATE.FULFILLED]: [],
  [STATE.REJECTED]: [],
}

function allowTransition(
  from: typeof STATE.PENDING | typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED,
  to: typeof STATE.PENDING | typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED
): boolean {
  return STATE_TRANSITIONS[from].indexOf(to as any) > -1
}

type InnerTracker = {
  sn: () => number
  get: (state: typeof STATE.PENDING | typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED | typeof STATE.FINISHED) => number
  set: (state: typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED, sn: number) => boolean
}

/**
 * Create a single call tracker instance.
 * @param tracker Inner tracker for state management
 */
function createTrack(
  tracker: InnerTracker
): Track {
  const sn = tracker.sn()
  let state: typeof STATE.PENDING | typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED = STATE.PENDING
  const data = new Map<symbol, any>()
  
  const self: Track = {
    get sn() { return sn },
    inState: (target: typeof STATE[keyof typeof STATE]) => {
      if (target === STATE.FINISHED) return state === STATE.FULFILLED || state === STATE.REJECTED
      return state === target
    },
    canUpdate: () => allowTransition(state, STATE.UPDATING),
    /** Transition to updating; ignored if not allowed. */
    update: () => {
      if (!allowTransition(state, STATE.UPDATING)) return
      state = STATE.UPDATING
      tracker.set(STATE.UPDATING, sn)
    },
    /** Transition to fulfilled; ignored if not allowed. */
    fulfill: () => {
      if (!allowTransition(state, STATE.FULFILLED)) return
      state = STATE.FULFILLED
      tracker.set(STATE.FULFILLED, sn)
    },
    /** Transition to rejected; ignored if not allowed. */
    reject: () => {
      if (!allowTransition(state, STATE.REJECTED)) return
      state = STATE.REJECTED
      tracker.set(STATE.REJECTED, sn)
    },
    /** Whether this call is the newest invocation. */
    isLatestCall() {
      return tracker.get(STATE.PENDING) === sn
    },
    /** Whether this updating call is the latest update. */
    isLatestUpdate() {
      if (!self.inState(STATE.UPDATING)) return false
      return tracker.get(STATE.FULFILLED) < sn && tracker.get(STATE.UPDATING) === sn
    },
    /** Whether this fulfilled call is the latest fulfillment. */
    isLatestFulfill() {
      if (!self.inState(STATE.FULFILLED)) return false
      return tracker.get(STATE.UPDATING) <= sn && tracker.get(STATE.FULFILLED) === sn
    },
    /** Whether this value is stale due to newer update/finish or rejection. */
    isStaleValue() {
      // 如果调用本省处于拒绝状态，value 一定是不新鲜的
      if (self.inState(STATE.REJECTED)) return true
      // 如果有更新的值或结果，则当前值是不新鲜的
      return tracker.get(STATE.UPDATING) > sn || tracker.get(STATE.FINISHED) > sn
    },
    /** Store data associated with this track using a symbol key. */
    setData: (key: symbol, value?: any) => {
      if (value === undefined) return data.delete(key)
      data.set(key, value)
    },
    /** Get data associated with this track using a symbol key. */
    getData: <V = any>(key: symbol) => {
      return data.get(key) as V | undefined
    }
  }
  
  return self
}

// Track async call lifecycle with ordering to resolve races.
export function createTracker(): Tracker {
  // 记录【最新的】不同状态的序号
  const pending = ref<number>(0)
  const updating = ref<number>(0)
  const fulfilled = ref<number>(0)
  const rejected = ref<number>(0)
  const finished = computed(() => max(fulfilled.value, rejected.value))
  const record = (sn: number, latest: Ref<number>): boolean => {
    if (latest.value >= sn) return false
    latest.value = sn
    return true
  }

  return {
    /**
     * Create a single call tracker.
     */
    track: () => createTrack({
      sn: () => ++pending.value,
      get: (state: typeof STATE.PENDING | typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.FINISHED) => {
        if (state === STATE.PENDING) return pending.value
        if (state === STATE.UPDATING) return updating.value
        if (state === STATE.FULFILLED) return fulfilled.value
        /* v8 ignore else -- @preserve */
        if (state === STATE.FINISHED) return finished.value
        /* v8 ignore next -- @preserve */
        return 0
      },
      set: (state: typeof STATE.UPDATING | typeof STATE.FULFILLED | typeof STATE.REJECTED, sn: number) => {
        if (state === STATE.UPDATING) return record(sn, updating)
        if (state === STATE.FULFILLED) return record(sn, fulfilled)
        /* v8 ignore else -- @preserve */
        if (state === STATE.REJECTED) return record(sn, rejected)
        /* v8 ignore next -- @preserve */
        return false
      }
    }),
    // 过往调用数据
    has: {
      // 有过完成
      finished: computed(() => finished.value > 0),
    }
  }
}


