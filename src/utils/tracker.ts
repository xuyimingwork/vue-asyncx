import { computed, ComputedRef, Ref, ref } from "vue"
import { max } from "./base";

export type Track<T = any> = {
  readonly sn: number
  readonly value: T
  readonly error: any
  inStatePending: () => boolean
  inStateUpdating: () => boolean
  inStateFulfilled: () => boolean
  inStateRejected: () => boolean
  inStateFinished: () => boolean
  allowToStateUpdating: () => boolean
  allowToStateFulfilled: () => boolean
  allowToStateRejected: () => boolean
  update: (v?: T) => void
  fulfill: (v?: T) => void
  reject: (e?: any) => void
  finish: (error?: boolean, v?: T) => void
  isLatestCall: () => boolean
  isLatestUpdate: () => boolean
  isLatestFulfill: () => boolean
  isLatestFinish: () => boolean
  isStaleValue: () => boolean
  setData: (key: symbol, value?: any) => void
  getData: <V = any>(key: symbol) => V | undefined
}

export type Tracker<T = any> = {
  track: (v?: T) => Track<T>
  latest: {
    finished: ComputedRef<boolean>
    fulfilled: ComputedRef<boolean>
  }
  has: {
    tracking: ComputedRef<boolean>
    updating: ComputedRef<boolean>
    fulfilled: ComputedRef<boolean>
    rejected: ComputedRef<boolean>
    finished: ComputedRef<boolean>
  }
}

const STATE = {
  PENDING: 0,
  UPDATING: 1,
  FULFILLED: 2,
  REJECTED: 3
} as const;

const STATE_TRANSITIONS = {
  [STATE.PENDING]: [STATE.UPDATING, STATE.FULFILLED, STATE.REJECTED],
  [STATE.UPDATING]: [STATE.UPDATING, STATE.FULFILLED, STATE.REJECTED],
  [STATE.FULFILLED]: [],
  [STATE.REJECTED]: [],
}

type State = typeof STATE[keyof typeof STATE]

function allowTransition(from: State, to: State): boolean {
  return STATE_TRANSITIONS[from].indexOf(to as any) > -1
}

type InnerTracker = {
  sn: () => number
  get: (state: 'pending' | 'updating' | 'fulfilled' | 'finished') => number
  set: (state: 'updating' | 'fulfilled' | 'rejected', sn: number) => boolean
}

/**
 * Create a single call tracker instance.
 * @param tracker Inner tracker for state management
 * @param initialValue Initial value to seed the track
 */
function createTrack<T = any>(
  tracker: InnerTracker,
  initialValue: T | undefined
): Track<T> {
  const sn = tracker.sn()
  let state: State = STATE.PENDING
  let value = initialValue
  let error = undefined
  const data = new Map<symbol, any>()
  
  const inState = (target: State) => state === target
  const allowToState = (target: State) => allowTransition(state, target)
  
  const self: Track<T> = {
    get sn() { return sn },
    get value() { return value },
    get error() { return error }, 
    inStatePending: () => inState(STATE.PENDING),
    inStateUpdating: () => inState(STATE.UPDATING),
    inStateFulfilled: () => inState(STATE.FULFILLED),
    inStateRejected: () => inState(STATE.REJECTED),
    inStateFinished: () => self.inStateFulfilled() || self.inStateRejected(),
    allowToStateUpdating: () => allowToState(STATE.UPDATING),
    allowToStateFulfilled: () => allowToState(STATE.FULFILLED),
    allowToStateRejected: () => allowToState(STATE.REJECTED),
    /** Transition to updating; ignored if not allowed. */
    update: (v?: T) => {
      if (!self.allowToStateUpdating()) return
      state = STATE.UPDATING
      value = v
      tracker.set('updating', sn)
    },
    /** Transition to fulfilled; ignored if not allowed. */
    fulfill: (v?: T) => {
      if (!self.allowToStateFulfilled()) return
      state = STATE.FULFILLED
      value = v
      tracker.set('fulfilled', sn)
    },
    /** Transition to rejected; ignored if not allowed. */
    reject: (e?: any) => {
      if (!self.allowToStateRejected()) return
      state = STATE.REJECTED
      error = e
      tracker.set('rejected', sn)
    },
    /** Convenience terminal transition (error=true → reject, else fulfill). */
    finish(error: boolean = false, v?: T): void {
      if (error) {
        self.reject(v)
        return
      }
      self.fulfill(v)
    },
    /** Whether this call is the newest invocation. */
    isLatestCall() {
      return tracker.get('pending') === sn
    },
    /** Whether this updating call is the latest update. */
    isLatestUpdate() {
      if (!self.inStateUpdating()) return false
      return tracker.get('fulfilled') < sn && tracker.get('updating') === sn
    },
    /** Whether this fulfilled call is the latest fulfillment. */
    isLatestFulfill() {
      if (!self.inStateFulfilled()) return false
      return tracker.get('updating') <= sn && tracker.get('fulfilled') === sn
    },
    /** Whether this finished call (fulfilled/rejected) is the latest finish. */
    isLatestFinish() {
      if (!self.inStateFinished()) return false
      return tracker.get('updating') <= sn && tracker.get('finished') === sn
    },
    /** Whether this value is stale due to newer update/finish or rejection. */
    isStaleValue() {
      // 如果调用处于拒绝状态，value 一定是不新鲜的
      if (self.inStateRejected()) return true
      // 如果有更新的值或结果，则当前值是不新鲜的
      return tracker.get('updating') > sn || tracker.get('finished') > sn
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
export function createTracker<T = any>(): Tracker<T> {
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
     * Create a single call tracker. `v` can seed the initial value.
     */
    track: (v?: T) => createTrack({
      sn: () => ++pending.value,
      get: (state: 'pending' | 'updating' | 'fulfilled' | 'finished') => {
        if (state === 'pending') return pending.value
        if (state === 'updating') return updating.value
        if (state === 'fulfilled') return fulfilled.value
        /* v8 ignore else -- @preserve */
        if (state === 'finished') return finished.value
        /* v8 ignore next -- @preserve */
        return 0
      },
      set: (state: 'updating' | 'fulfilled' | 'rejected', sn: number) => {
        if (state === 'updating') return record(sn, updating)
        if (state === 'fulfilled') return record(sn, fulfilled)
        /* v8 ignore else -- @preserve */
        if (state === 'rejected') return record(sn, rejected)
        /* v8 ignore next -- @preserve */
        return false
      }
    }, v),
    // 最近一次调用数据
    latest: {
      // 已完成
      finished: computed(() => pending.value === finished.value),
      // 已成功
      fulfilled: computed(() => pending.value === fulfilled.value && pending.value > 0),
    },
    // 过往调用数据
    has: {
      // 存在追踪
      tracking: computed(() => pending.value > 0),
      // 存在更新
      updating: computed(() => updating.value > 0),
      // 存在成功
      fulfilled: computed(() => fulfilled.value > 0),
      // 存在失败
      rejected: computed(() => rejected.value > 0),
      // 存在完成
      finished: computed(() => finished.value > 0),
    }
  }
}


