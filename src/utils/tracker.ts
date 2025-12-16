import { computed, Ref, ref } from "vue"
import { max } from "./base";

export type Tracker = ReturnType<typeof createTracker>
export type Track = ReturnType<Tracker>

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

// Track async call lifecycle with ordering to resolve races.
export function createTracker() {
  // 记录【最新的】不同状态的序号
  const pending = ref<number>(0)
  const updating = ref<number>(0)
  const fulfilled = ref<number>(0)
  const rejected = ref<number>(0)
  const finished = computed(() => max(fulfilled.value, rejected.value))
  const record = (sn: number, latest: Ref<number>): void => {
    if (latest.value >= sn) return
    latest.value = sn
  }
  /**
   * Create a single call tracker. `v` can seed the initial value.
   */
  function tracker(v?: any) {
    const sn = ++pending.value
    let state: State = STATE.PENDING
    let value = v
    let error = undefined
    const inState = (target: State) => state === target
    const allowToState = (target: State) => allowTransition(state, target)
    const self = {
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
      update: (v?: any) => {
        if (!self.allowToStateUpdating()) return
        state = STATE.UPDATING
        value = v
        record(sn, updating)
      },
      /** Transition to fulfilled; ignored if not allowed. */
      fulfill: (v?: any) => {
        if (!self.allowToStateFulfilled()) return
        state = STATE.FULFILLED
        value = v
        record(sn, fulfilled)
      },
      /** Transition to rejected; ignored if not allowed. */
      reject: (e?: any) => {
        if (!self.allowToStateRejected()) return
        state = STATE.REJECTED
        error = e
        record(sn, rejected)
      },
      /** Convenience terminal transition (error=true → reject, else fulfill). */
      finish(error: boolean = false, v?: any): void {
        if (error) {
          self.reject(v)
          return
        }
        self.fulfill(v)
      },
      /** Whether this call is the newest invocation. */
      isLatestCall() {
        return pending.value === sn
      },
      /** Whether this updating call is the latest update. */
      isLatestUpdate() {
        if (!self.inStateUpdating()) return false
        return fulfilled.value < sn && updating.value === sn
      },
      /** Whether this fulfilled call is the latest fulfillment. */
      isLatestFulfill() {
        if (!self.inStateFulfilled()) return false
        return updating.value <= sn && fulfilled.value === sn
      },
      /** Whether this finished call (fulfilled/rejected) is the latest finish. */
      isLatestFinish() {
        if (!self.inStateFinished()) return false
        return updating.value <= sn && finished.value === sn
      },
      /** Whether this value is stale due to newer update/finish or rejection. */
      isStaleValue() {
        // 如果调用处于拒绝状态，value 一定是不新鲜的
        if (self.inStateRejected()) return true
        // 如果有更新的值或结果，则当前值是不新鲜的
        return updating.value > sn || finished.value > sn
      }
    }
    return self
  }

  // 最近一次调用数据
  tracker.latest = {
    // 已完成
    finished: computed(() => pending.value === finished.value),
    // 已成功
    fulfilled: computed(() => pending.value === fulfilled.value && pending.value > 0),
  }
  // 过往调用数据
  tracker.has = {
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

  return tracker
}


