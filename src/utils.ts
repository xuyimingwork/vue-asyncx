import { computed, ref } from "vue"

export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S

export function upperFirst(string: string): string {
  if (!string) return ''

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing
}

export type Tracker = ReturnType<typeof createFunctionTracker>
export type Track = ReturnType<Tracker>

export function createFunctionTracker() {
  const data = ref({
    // 发起的调用
    track: 0,
    // 更新的调用
    progress: 0,
    // 完成的调用，包含报错情况
    finished: 0,
    // 完成（正常）的调用，不含报错情况
    ok: 0
  })

  function tracker() {
    const current = data.value
    const sn = ++current.track
    return {
      progress(): void {
        if (current.progress >= sn) return
        current.progress = sn
      },
      finish(error: boolean = false): void {
        if (current.finished >= sn) return
        current.finished = sn
        if (!error) current.ok = sn
      },
      expired(state?: 'progress' | 'result:ok' | 'result'): boolean {
        // 是否有【新调用】覆盖本调用
        if (!state) return current.track > sn
        // 是否有【新更新/新结果】覆盖本调用更新
        if (state === 'progress') return current.progress > sn || current.finished >= sn
        // 是否有【新更新/新好结果】调用覆盖本调用好结果
        if (state === 'result:ok') return current.progress > sn || current.ok > sn
        return current.progress > sn || current.finished > sn
      }
    }
  }

  // 正在追踪
  tracker.tracking = computed(() => data.value.track > 0)
  // 最近一次调用数据
  tracker.latest = {
    // 已完成
    finished: computed(() => data.value.track === data.value.finished),
    // 已成功
    ok: computed(() => data.value.track === data.value.ok),
  }
  // 过往调用数据
  tracker.has = {
    // 存在完成
    finished: computed(() => data.value.finished > 0),
    // 存在成功
    ok: computed(() => data.value.ok > 0),
    // 存在更新
    progress: computed(() => data.value.progress > 0)
  }
  
  
  return tracker
}
