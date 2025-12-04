import { computed, ref } from "vue"

export type Tracker = ReturnType<typeof createFunctionTracker>
export type Track = ReturnType<Tracker>

const FUNCTION_RUN_STATE = {
  PENDING: 'pending',
  UPDATING: 'updating',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
};

const FUNCTION_RUN_STATE_TRANSITIONS = {
  [FUNCTION_RUN_STATE.PENDING]: [FUNCTION_RUN_STATE.UPDATING, FUNCTION_RUN_STATE.FULFILLED, FUNCTION_RUN_STATE.REJECTED],
  [FUNCTION_RUN_STATE.UPDATING]: [FUNCTION_RUN_STATE.UPDATING, FUNCTION_RUN_STATE.FULFILLED, FUNCTION_RUN_STATE.REJECTED],
  [FUNCTION_RUN_STATE.FULFILLED]: [],
  [FUNCTION_RUN_STATE.REJECTED]: [],
}

export function createFunctionTracker() {
  const pending = ref<number>(0)
  const updating = ref<number>(0)
  const fulfilled = ref<number>(0)
  const rejected = ref<number>(0)
  const finished = computed(() => fulfilled.value > rejected.value ? fulfilled.value : rejected.value)

  function tracker() {
    const sn = ++pending.value
    return {
      progress(): void {
        if (updating.value >= sn) return
        updating.value = sn
      },
      finish(error: boolean = false): void {
        if (finished.value >= sn) return
        const result = error ? rejected : fulfilled
        result.value = sn
      },
      expired(state?: 'progress' | 'result:ok' | 'result'): boolean {
        // 是否有【新调用】覆盖本调用
        if (!state) return pending.value > sn
        // 是否有【新更新/新结果】覆盖本调用更新
        if (state === 'progress') return updating.value > sn || finished.value >= sn
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
