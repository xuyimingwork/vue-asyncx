import { RUN_ARGUMENTS, RUN_DATA, RUN_DATA_UPDATED, RUN_ERROR, RUN_INITED, RUN_LOADING } from "@/core/monitor/constants"
import { InternalTrack, Track } from "@/core/monitor/types"

export function toPublicTrack(track: InternalTrack, {
  onDataChange
}: { onDataChange: () => void }): Track {
  function setData(key: symbol, value?: any): void {
    if (isTrackDataReadOnly(key, track)) return
    track.setData(key, value)
    if (key === RUN_DATA && track.getData(RUN_INITED)) track.setData(RUN_DATA_UPDATED, true)
    onDataChange()
  }
  function takeData(key: symbol): any {
    const v = track.getData(key)
    setData(key, undefined)
    return v
  }
  return {
    sn: track.sn,
    is: track.is,
    getData: track.getData,
    setData,
    takeData
  }
}

function isTrackDataReadOnly(key: symbol, track: InternalTrack): boolean {
  /**
   * 一部分 KEY 需要暴露，但在 withFunctionMonitor 外部是只读的
   * RUN_ARGUMENTS、RUN_ERROR、RUN_LOADING、RUN_DATA_UPDATED
   * RUN_DATA 在非 pending 状态只读（仅允许 updateData 在函数执行期间写入）
   */
  if (key === RUN_ARGUMENTS) return true
  if (key === RUN_LOADING) return true

  if (key === RUN_DATA_UPDATED) return true
  if (key === RUN_DATA && !track.is('pending')) return true
  if (key === RUN_ERROR) return true
  
  // 其他 KEY 允许外部写入
  return false
}