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
  function tracker() {
    const sn = ++pending.value
    let state: State = FUNCTION_RUN_STATE.PENDING
    let value = undefined
    let error = undefined
    const self = {
      allow: (target: State) => allowTransition(state, target),
      update: (v?: any) => {
        if (!self.allow(FUNCTION_RUN_STATE.UPDATING)) return
        state = FUNCTION_RUN_STATE.UPDATING
        value = v
        record(sn, updating)
      },
      fulfill: (v?: any) => {
        if (!self.allow(FUNCTION_RUN_STATE.FULFILLED)) return
        state = FUNCTION_RUN_STATE.FULFILLED
        value = v
        record(sn, fulfilled)
      },
      reject: (e?: any) => {
        if (!self.allow(FUNCTION_RUN_STATE.REJECTED)) return
        state = FUNCTION_RUN_STATE.REJECTED
        error = e
        record(sn, rejected)
      },
    }
    return {
      /**
       * @deprecated
       */
      progress: self.update,
      /**
       * @deprecated
       * @param error 
       */
      finish(error: boolean = false): void {
        self[error ? 'reject' : 'fulfill']()
      },
      // 当前的 sn 的 state 数据是否过期
      expired(state?: 'progress' | 'result:ok' | 'result'): boolean {
        // 是否有【新调用】覆盖本调用
        if (!state) return pending.value > sn
        // 是否有【新更新/新结果】覆盖本调用更新
        if (state === 'progress') return !self.allow(FUNCTION_RUN_STATE.UPDATING) || updating.value > sn || fulfilled.value >= sn
        // 是否有【新更新/新好结果】调用覆盖本调用好结果
        if (state === 'result:ok') return updating.value > sn || fulfilled.value > sn
        return updating.value > sn || finished.value > sn
      }
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
