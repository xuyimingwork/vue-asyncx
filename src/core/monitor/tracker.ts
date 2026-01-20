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
 * 2. 需要的 addon 自行维护状态，通过比较 sn 来判断调用顺序
 * 
 * @module core/monitor/tracker
 */

import type { InternalTrack, Tracker, TrackState } from "./types"

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
function createInnerTrack({ sn }: {
  sn: number
}): InternalTrack {
  // 当前状态（初始为 PENDING）
  let state: TrackState = 'pending'
  
  // 关联数据存储（使用 Symbol 作为键，避免冲突）
  const data = new Map<symbol, any>()
  
  const self: InternalTrack = {
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
    
    /**
     * 转换到成功完成状态
     * 
     * @description 标记调用成功完成。
     * 如果当前状态不允许转换到 FULFILLED，则忽略。
     */
    fulfill: () => {
      if (!allowTransition(state, 'fulfilled')) return
      state = 'fulfilled'
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
    },
    
    /**
     * 存储关联数据
     * 
     * @description 使用 Symbol 键存储数据。纯存储操作，不触发事件。
     * 
     * @param key - 数据键（Symbol）
     * @param value - 数据值（如果为 undefined 则删除）
     */
    setData: (key: symbol, value?: any) => {
      value === undefined 
        ? data.delete(key) 
        : data.set(key, value)
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
    
  }
  
  return self
}

/**
 * 创建调用追踪器
 * 
 * @description 创建一个新的调用追踪器实例，用于追踪异步函数调用的生命周期并处理竟态条件。
 * 
 * 追踪器通过序号（sn）管理所有调用，为每次调用分配唯一序号。
 * 需要的 addon 可以自行维护状态，通过比较 sn 来判断调用顺序。
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
 * ```
 */
export function createTracker(): Tracker {
  // 当前序号计数器
  let sn = 0

  return {
    /**
     * 创建单次调用追踪对象
     * 
     * @description 每次调用都会创建一个新的追踪对象，分配唯一的序号。
     * 
     * @returns 返回调用追踪对象
     */
    track: () => createInnerTrack({
      /**
       * 生成新的调用序号
       * 
       * @description 每次调用递增序号，确保每个调用都有唯一序号。
       */
      sn: ++sn
    })
  }
}

