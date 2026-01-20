/**
 * @fileoverview Track 创建和权限管理
 * 
 * @module core/monitor/track
 */

import { RUN_ARGUMENTS, RUN_DATA, RUN_DATA_UPDATED, RUN_ERROR, RUN_LOADING } from "./constants"
import type { InternalFunctionMonitor, Track, Tracker } from "./types"

/**
 * 权限检查函数：判断 key 是否为只读
 * 
 * @param key - 要检查的 key
 * @returns 如果是只读 key 返回 true，否则返回 false
 */
export function isReadOnly(key: symbol): boolean {
  // RUN_ARGUMENTS、RUN_ERROR、RUN_LOADING、RUN_DATA_UPDATED 是只读的（monitor 专用）
  if (key === RUN_ARGUMENTS) return true
  if (key === RUN_ERROR) return true
  if (key === RUN_LOADING) return true
  if (key === RUN_DATA_UPDATED) return true
  
  // 其他 key（包括 RUN_DATA 和 addon 自定义 key）都可以写入
  return false
}

/**
 * 创建 track 相关对象
 * 
 * @description 封装 track 创建逻辑，返回 fulfill、reject、activate、setData 和受控的 track 对象
 * 
 * @param monitor - 内部函数监控器
 * @param tracker - 调用追踪器
 * @returns 返回包含 fulfill、reject、activate、setData 和 track 的对象
 */
export function createTrack(monitor: InternalFunctionMonitor, tracker: Tracker): {
  fulfill: () => void
  reject: () => void
  setData: (key: symbol, value?: any) => void
  track: Track
  init: () => void,
  inactivate: () => void
} {
  // 解构出原始 setData 和其余属性
  const { setData: _setData, fulfill, reject, ...rawTrack } = tracker.track()

  // 标志位：是否已激活（init 后）
  let inited = false
  let activated = false

  // Monitor 内部的 setData 函数（统一处理写入逻辑和事件触发）
  function setData(key: symbol, value?: any): void {
    // 调用原始 setData 完成数据写入
    _setData(key, value)    
    if (key === RUN_DATA && inited) _setData(RUN_DATA_UPDATED, true)
    
    // 未激活时不处理事件
    if (!activated) return
    monitor.emit('track:updated', { track })
  }

  // 创建受控的 track 对象（暴露给 addon）
  // 先定义 setDataForTrack 函数，供 takeData 调用
  const setDataForTrack = (key: symbol, value?: any): void => {
    // 先判断是否为只读 key
    if (isReadOnly(key)) return
    
    // RUN_DATA 只能在 pending 状态下写入
    if (key === RUN_DATA && !rawTrack.is('pending')) return
    
    // 通过权限检查后，调用 monitor 内部的 setData
    setData(key, value)
  }

  const track: Track = {
    ...rawTrack,
    setData: setDataForTrack,
    takeData: <V = any>(key: symbol): V | undefined => {
      // monitor 实现 takeData：获取并删除数据
      const value = rawTrack.getData<V>(key)
      // 调用 setDataForTrack 完成删除（会经过权限检查）
      setDataForTrack(key, undefined)
      return value
    }
  }

  return {
    fulfill: fulfill,
    reject: reject,
    setData: setData,
    track: track,
    init: () => {
      inited = true
      activated = true
    },
    inactivate: () => activated = false,
  }
}
