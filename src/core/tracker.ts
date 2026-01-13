/**
 * @fileoverview 调用追踪和竟态处理系统
 * 
 * 该模块实现了异步函数调用的追踪和竟态条件处理。
 * 
 * ## 核心概念
 * 
 * - **Track**：单次调用的追踪对象，包含序号（sn）和状态
 * - **Tracker**：追踪器，管理所有调用的状态
 * - **状态机**：PENDING → FULFILLED/REJECTED
 * 
 * ## 竟态处理原理
 * 
 * 1. 每次调用分配唯一序号（sn）
 * 2. 记录每种状态的最新序号
 * 3. 只有最新调用的状态才会更新到最终结果
 * 4. 通过 isLatest()、hasLater() 等方法判断调用顺序
 * 
 * @module core/tracker
 */

import { max } from "@/utils/base";
import { ComputedRef, Ref, computed, ref } from "vue";

type TrackState = 'pending' | 'fulfilled' | 'rejected'
type TrackQueryState = TrackState | 'finished'

/**
 * 调用追踪对象
 * 
 * @description 表示单次函数调用的追踪信息，包含调用序号、状态和关联数据。
 * 用于处理竟态条件，确保只有最新调用的状态才会更新到最终结果。
 */
export type Track = {
  /** 调用序号，唯一标识每次调用 */
  readonly sn: number

  /** 检查当前是否处于指定状态 */
  is: (state?: TrackQueryState) => boolean
  /* 检测当前是否为最新状态 */
  isLatest: (state?: TrackQueryState) => boolean
  /* 检测之后是否有指定状态的调用 */
  hasLater: (state?: TrackQueryState) => boolean

  /** 标记为成功 */
  fulfill: () => void
  /** 标记为失败 */
  reject: () => void

  /** 存储关联数据（使用 Symbol 作为键） */
  setData: (key: symbol, value?: any) => void
  /** 获取关联数据 */
  getData: <V = any>(key: symbol) => V | undefined
  /** 获取并移除关联数据 */
  takeData: <V = any>(key: symbol) => V | undefined
}

/**
 * 调用追踪器
 * 
 * @description 管理所有函数调用的追踪状态，提供创建追踪对象和查询状态的能力。
 */
export type Tracker = {
  /** 创建新的调用追踪对象 */
  track: () => Track,
  /** 调用状态查询 */
  has: {
    /** 是否已有完成的调用（成功或失败） */
    finished: ComputedRef<boolean>
  }
}

/**
 * 检查是否允许状态转换
 * 
 * @description 根据状态转换表检查从 from 状态转换到 to 状态是否允许。
 * 
 * @param from - 源状态
 * @param to - 目标状态
 * 
 * @returns 如果允许转换返回 true，否则返回 false
 * 
 * @internal 内部实现，不对外暴露
 */
function allowTransition(
  from: TrackState,
  to: TrackState
): boolean {
  if (from === 'fulfilled' || from === 'rejected') return false
  return to !== 'pending'
}

type InnerTracker = {
  sn: () => number
  get: (state: TrackQueryState) => number
  set: (state: Exclude<TrackState, 'pending'>, sn: number) => boolean
}

/**
 * 创建单次调用追踪对象
 * 
 * @description 创建一个新的调用追踪对象，用于追踪单次函数调用的状态。
 * 追踪对象包含调用序号、当前状态和关联数据。
 * 
 * @param tracker - 内部追踪器，用于状态管理
 * 
 * @returns 返回调用追踪对象
 * 
 * @internal 内部实现，不对外暴露
 */
function createTrack(
  tracker: InnerTracker
): Track {
  // 获取调用序号（唯一标识）
  const sn = tracker.sn()
  
  // 当前状态（初始为 PENDING）
  let state: TrackState = 'pending'
  
  // 关联数据存储（使用 Symbol 作为键，避免冲突）
  const data = new Map<symbol, any>()
  
  const self: Track = {
    /** 调用序号（只读） */
    get sn() { return sn },
    
    /**
     * 检查当前是否处于指定状态
     * 
     * @param target - 目标状态
     * 
     * @returns 如果当前状态匹配目标状态返回 true，否则返回 false
     * 
     * @description FINISHED 是特殊状态，表示已完成（无论是成功还是失败）
     */
    is(target) {
      if (target === 'finished') return (state === 'fulfilled' || state === 'rejected')
      return target === state
    },

    isLatest(state) {
      if (!state) return tracker.get('pending') === sn
      return self.is(state) && tracker.get(state) === sn
    },

    /**
     * 检查是否有后续的失败调用
     * 
     * @description 用于判断在当前调用之后是否有失败的调用。
     * 用于数据过期判断：如果后续有失败调用，当前数据可能过期。
     * 
     * @returns 如果有后续失败调用返回 true，否则返回 false
     */
    hasLater(state) {
      return tracker.get(state) > sn
    },
    
    /**
     * 转换到成功完成状态
     * 
     * @description 标记调用成功完成。
     * 如果当前状态不允许转换到 FULFILLED，则忽略。
     */
    fulfill: () => {
      if (!allowTransition(state, 'fulfilled')) return
      state = 'fulfilled'
      tracker.set('fulfilled', sn)
    },
    
    /**
     * 转换到失败状态
     * 
     * @description 标记调用执行失败。
     * 如果当前状态不允许转换到 REJECTED，则忽略。
     */
    reject: () => {
      if (!allowTransition(state, 'rejected')) return
      state = 'rejected'
      tracker.set('rejected', sn)
    },
    
    /**
     * 存储关联数据
     * 
     * @description 使用 Symbol 作为键存储与本次调用关联的数据。
     * 如果 value 为 undefined，则删除该键。
     * 
     * @param key - 数据键（Symbol）
     * @param value - 数据值（如果为 undefined 则删除）
     */
    setData: (key: symbol, value?: any) => {
      if (value === undefined) return data.delete(key)
      data.set(key, value)
    },
    
    /**
     * 获取关联数据
     * 
     * @description 根据 Symbol 键获取关联的数据。
     * 
     * @template V - 数据类型
     * 
     * @param key - 数据键（Symbol）
     * 
     * @returns 返回关联的数据，如果不存在返回 undefined
     */
    getData: <V = any>(key: symbol) => {
      return data.get(key) as V | undefined
    },
    
    /**
     * 获取并移除关联数据
     * 
     * @description 根据 Symbol 键获取关联的数据，并删除该键。
     * 用于一次性使用的数据（如上下文恢复函数）。
     * 
     * @template V - 数据类型
     * 
     * @param key - 数据键（Symbol）
     * 
     * @returns 返回关联的数据，如果不存在返回 undefined
     */
    takeData: <V = any>(key: symbol) => {
      if (!data.has(key)) return undefined
      const value = data.get(key) as V | undefined
      data.delete(key)
      return value
    }
  }
  
  return self
}

/**
 * 创建调用追踪器
 * 
 * @description 创建一个新的调用追踪器实例，用于追踪异步函数调用的生命周期并处理竟态条件。
 * 
 * 追踪器通过序号（sn）管理所有调用，记录每种状态的最新序号。
 * 只有最新调用的状态才会更新到最终结果，从而解决竟态条件问题。
 * 
 * @returns 返回调用追踪器实例
 * 
 * @example
 * ```ts
 * const tracker = createTracker()
 * 
 * const track1 = tracker.track() // sn = 1
 * const track2 = tracker.track() // sn = 2
 * 
 * track1.fulfill() // 标记 track1 成功完成
 * track2.reject()  // 标记 track2 失败
 * 
 * // track2 是最新调用，即使 track1 成功，最终状态也是失败
 * ```
 */
export function createTracker(): Tracker {
  // 记录【最新的】不同状态的序号
  // 使用响应式引用，确保状态变化可以被追踪
  const pending = ref<number>(0)    // 最新的 PENDING 序号
  const fulfilled = ref<number>(0)  // 最新的 FULFILLED 序号
  const rejected = ref<number>(0)   // 最新的 REJECTED 序号
  
  // 计算是否有完成的调用（无论是成功还是失败）
  const finished = computed(() => max(fulfilled.value, rejected.value))
  
  /**
   * 记录状态序号
   * 
   * @description 如果新的序号大于当前序号，则更新并返回 true；否则返回 false。
   * 这确保了只有更新的状态才会被记录。
   * 
   * @param sn - 新的序号
   * @param latest - 当前最新的序号引用
   * 
   * @returns 如果成功记录返回 true，否则返回 false
   */
  const record = (sn: number, latest: Ref<number>): boolean => {
    if (latest.value >= sn) return false
    latest.value = sn
    return true
  }

  return {
    /**
     * 创建单次调用追踪对象
     * 
     * @description 每次调用都会创建一个新的追踪对象，分配唯一的序号。
     * 
     * @returns 返回调用追踪对象
     */
    track: () => createTrack({
      /**
       * 生成新的调用序号
       * 
       * @description 每次调用递增 pending 序号，确保每个调用都有唯一序号。
       */
      sn: () => ++pending.value,
      
      /**
       * 获取指定状态的最新序号
       * 
       * @param state - 状态类型
       * 
       * @returns 返回该状态的最新序号
       */
      get: (state: TrackQueryState) => {
        if (state === 'pending') return pending.value
        if (state === 'fulfilled') return fulfilled.value
        if (state === 'rejected')  return rejected.value
        /* v8 ignore else -- @preserve */
        if (state === 'finished') return max(fulfilled.value, rejected.value)
        /* v8 ignore next -- @preserve */
        return 0
      },
      
      /**
       * 设置指定状态的最新序号
       * 
       * @description 如果新的序号大于当前序号，则更新并返回 true。
       * 
       * @param state - 状态类型
       * @param sn - 新的序号
       * 
       * @returns 如果成功更新返回 true，否则返回 false
       */
      set: (state: Exclude<TrackState, 'pending'>, sn: number) => {
        if (state === 'fulfilled') return record(sn, fulfilled)
        /* v8 ignore else -- @preserve */
        if (state === 'rejected') return record(sn, rejected)
        /* v8 ignore next -- @preserve */
        return false
      }
    }),
    
    /**
     * 调用状态查询
     */
    has: {
      /**
       * 是否已有完成的调用
       * 
       * @description 检查是否至少有一个调用已经完成（无论是成功还是失败）。
       * 用于判断是否有历史调用记录。
       */
      finished: computed(() => finished.value > 0),
    }
  }
}

