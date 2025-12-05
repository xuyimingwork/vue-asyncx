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
    return {
      /**
       * @deprecated
       */
      progress: self.update,
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
        if (!state) return !self.isLatestCall()

        // progress：
        // - 如果当前处于 updating，则根据 isLatestUpdate 判断是否被更晚的 update/finish 覆盖
        // - 如果当前处于 pending（尚未 update），则不认为 progress 过期
        // - 否则（已 finished），progress 被视为过期
        if (state === 'progress') {
          // 如果存在比当前 sn 的更新或成功，则 progress 被视为过期
          // 注意：后续的 rejected finish 不应使之前的 progress 失效
          if (self.inStateUpdating()) return !self.isLatestUpdate()
          if (updating.value > sn || fulfilled.value > sn) return true
          if (self.inStatePending()) return false
          return true
        }

        // result:ok：
        // - 当前为 fulfilled 时，根据 isLatestFulfill 判断是否被更晚成功覆盖
        // - 否则只有当存在比当前 sn 的 fulfilled 或 updating（新的成功或更新）时，才认为 ok 被覆盖
        //   注意：后续的 rejected finish 不应该使之前的 ok 失效
        if (state === 'result:ok') {
          if (self.inStateFulfilled()) return !self.isLatestFulfill()
          return fulfilled.value > sn || updating.value > sn
        }

        // result：
        // - 如果当前已 finished（fulfilled/rejected），根据 isLatestFinish 判断是否被更晚的完成覆盖
        // - 否则（未 finished），只要存在比当前 sn 更晚的 update/finish，就认为 result 已过期
        if (self.inStateFinished()) return !self.isLatestFinish()
        return updating.value > sn || finished.value > sn
      },
      update: self.update,
      fulfill: self.fulfill,
      reject: self.reject,
      get value() { return value },
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
