import type { Track } from "@/core/monitor"

/**
 * 创建只处理最新调用的处理器
 * 
 * @description 该函数创建一个处理器，只处理最新调用（sn 最大）的更新。
 * 用于处理竟态条件，确保只有最新调用的状态才会更新。
 * 
 * @param handler - 处理函数，接收 track 和 isLatest 参数
 * @param handler.track - 当前追踪对象
 * @param handler.isLatest - 是否为最新调用
 * 
 * @returns 返回一个 update 函数，用于更新状态
 * 
 * @example
 * ```ts
 * const update = createLatestHandler((track, isLatest) => {
 *   if (!isLatest) return
 *   if (track.is('pending')) setLoading(true)
 *   else setLoading(false)
 * })
 * ```
 */
export function createLatestHandler<T = void>(
  handler: (track: Track, isLatest: boolean) => T
): (track: Track) => T | void {
  let latest = 0
  
  return (track: Track) => {
    if (track.sn > latest) latest = track.sn
    const isLatest = track.sn === latest
    return handler(track, isLatest)
  }
}
