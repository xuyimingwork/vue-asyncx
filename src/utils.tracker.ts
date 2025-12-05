import { computed, Ref, ref } from "vue"

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

function max(...args: number[]): number {
  if (!args.length) return
  return args.reduce((max, v) => v > max ? v : max, args?.[0])
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
      isLatestCall() {
        return pending.value === sn
      },
      isLatestUpdate() {
        if (!self.inStateUpdating()) return false
        return updating.value <= sn && fulfilled.value < sn
      },
      isLatestFulfill() {
        if (!self.inStateFulfilled()) return false
        return updating.value <= sn && fulfilled.value <= sn
      },
      isStaleValue() {
        // 如果调用处于拒绝状态，value 一定是不新鲜的
        if (self.inStateRejected()) return true
        return updating.value > sn || finished.value > sn
      },
      debug() {
        return {
          sn,
          state,
          value,
          error,
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
    return {
      /**
       * @deprecated
       */
      progress: self.update,
      /**
       * TODO: 调整顺序
       * @param error 
       */
      finish(error: boolean = false, v?: any): void {
        self[error ? 'reject' : 'fulfill'](v)
      },
      /**
       * @deprecated
       * 当前的 sn 的 state 数据是否过期
       * @param state 
       * @returns 
       */
      expired(state?: 'progress' | 'result:ok' | 'result'): boolean {
        // 是否有【新调用】覆盖本调用
        if (!state) return pending.value > sn
        // 是否有【新更新/新结果】覆盖本调用更新
        // if (state === 'progress') return !self.allow(FUNCTION_RUN_STATE.UPDATING) || updating.value > sn || fulfilled.value >= sn
        if (state === 'progress') return !self.isLatestUpdate()
        // 是否有【新更新/新好结果】调用覆盖本调用好结果
        // if (state === 'result:ok') return updating.value > sn || fulfilled.value > sn
        if (state === 'result:ok') return !self.isLatestFulfill()
        return updating.value > sn || finished.value > sn
      },
      update: self.update,
      fulfill: self.fulfill,
      reject: self.reject,
      get value() { return value },
      get error() { return error },
      isLatestCall: self.isLatestCall,
      isLatestUpdate: self.isLatestUpdate,
      isLatestFulfill: self.isLatestFulfill,
      isStaleValue: self.isStaleValue,
      inStatePending: self.inStatePending,
      inStateUpdating: self.inStateUpdating,
      inStateFulfilled: self.inStateFulfilled,
      inStateRejected: self.inStateRejected,
      inStateFinished: self.inStateFinished,
      debug: self.debug
    }
  }

  // 正在追踪
  tracker.tracking = computed(() => pending.value > 0)
  // 最近一次调用数据
  tracker.latest = {
    // 已完成
    finished: computed(() => pending.value === finished.value),
    // 已成功
    ok: computed(() => pending.value === fulfilled.value),
  }
  // 过往调用数据
  tracker.has = {
    // 存在完成
    finished: computed(() => finished.value > 0),
    // 存在成功
    ok: computed(() => fulfilled.value > 0),
    // 存在更新
    progress: computed(() => updating.value > 0)
  }
  
  
  return tracker
}
