import { computed, Ref, ref } from "vue"
import { max } from "./utils.base";

export type Tracker = ReturnType<typeof createFunctionTracker>
export type Track = ReturnType<Tracker>

const FUNCTION_RUN_STATE = {
  PENDING: 'pending',
  UPDATING: 'updating',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
} as const;

const FUNCTION_RUN_STATE_TRANSITIONS = {
  [FUNCTION_RUN_STATE.PENDING]: [FUNCTION_RUN_STATE.UPDATING, FUNCTION_RUN_STATE.FULFILLED, FUNCTION_RUN_STATE.REJECTED],
  [FUNCTION_RUN_STATE.UPDATING]: [FUNCTION_RUN_STATE.UPDATING, FUNCTION_RUN_STATE.FULFILLED, FUNCTION_RUN_STATE.REJECTED],
  [FUNCTION_RUN_STATE.FULFILLED]: [],
  [FUNCTION_RUN_STATE.REJECTED]: [],
}

type State = typeof FUNCTION_RUN_STATE[keyof typeof FUNCTION_RUN_STATE]

function allowTransition(from: State, to: State): boolean {
  return FUNCTION_RUN_STATE_TRANSITIONS[from].indexOf(to as any) > -1
}

export function createFunctionTracker() {
  // 记录【最新的】不同状态的序号
  const pending = ref<number>(0)
  const updating = ref<number>(0)
  const fulfilled = ref<number>(0)
  const rejected = ref<number>(0)
  const finished = computed(() => max(fulfilled.value, rejected.value))
  const record = (sn: number, latest: Ref<number>) => latest.value < sn ? latest.value = sn : latest.value
  function tracker(v?: any) {
    const sn = ++pending.value
    let state: State = FUNCTION_RUN_STATE.PENDING
    let value = v
    let error = undefined
    const inState = (target: State) => state === target
    const allowToState = (target: State) => allowTransition(state, target)
    const self = {
      get value() { return value },
      inStatePending: () => inState(FUNCTION_RUN_STATE.PENDING),
      inStateUpdating: () => inState(FUNCTION_RUN_STATE.UPDATING),
      inStateFulfilled: () => inState(FUNCTION_RUN_STATE.FULFILLED),
      inStateRejected: () => inState(FUNCTION_RUN_STATE.REJECTED),
      inStateFinished: () => self.inStateFulfilled() || self.inStateRejected(),
      allowToStateUpdating: () => allowToState(FUNCTION_RUN_STATE.UPDATING),
      allowToStateFulfilled: () => allowToState(FUNCTION_RUN_STATE.FULFILLED),
      allowToStateRejected: () => allowToState(FUNCTION_RUN_STATE.REJECTED),
      update: (v?: any) => {
        if (!self.allowToStateUpdating()) return
        state = FUNCTION_RUN_STATE.UPDATING
        value = v
        record(sn, updating)
      },
      fulfill: (v?: any) => {
        if (!self.allowToStateFulfilled()) return
        state = FUNCTION_RUN_STATE.FULFILLED
        value = v
        record(sn, fulfilled)
      },
      reject: (e?: any) => {
        if (!self.allowToStateRejected()) return
        state = FUNCTION_RUN_STATE.REJECTED
        error = e
        record(sn, rejected)
      },
      finish(error: boolean = false, v?: any): void {
        self[error ? 'reject' : 'fulfill'](v)
      },
      isLatestCall() {
        return pending.value === sn
      },
      isLatestUpdate() {
        if (!self.inStateUpdating()) return false
        return fulfilled.value < sn && updating.value === sn
      },
      isLatestFulfill() {
        if (!self.inStateFulfilled()) return false
        return updating.value <= sn && fulfilled.value === sn
      },
      isLatestFinish() {
        if (!self.inStateFinished()) return false
        return updating.value <= sn && finished.value === sn
      },
      isStaleValue() {
        // 如果调用处于拒绝状态，value 一定是不新鲜的
        if (self.inStateRejected()) return true
        // 如果有更新的值或结果，则当前值是不新鲜的
        return updating.value > sn || finished.value > sn
      },
      debug() {
        return {
          sn,
          state,
          value,
          error,
          is: {
            latestCall: self.isLatestCall(),
            latestFulfill: self.isLatestFulfill(),
            latestUpdate: self.isLatestUpdate(),
            staleValue: self.isStaleValue(),
          },
          latest: {
            pending: pending.value,
            updating: updating.value,
            fulfilled: fulfilled.value,
            rejected: rejected.value,
            finished: finished.value,
          }
        }
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
