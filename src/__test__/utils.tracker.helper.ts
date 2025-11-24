import { expect } from "vitest"
import { createFunctionTracker, Track, Tracker } from "../utils"

export function check(t: Track, expired: { call: boolean | undefined, progress: boolean | undefined, result: boolean | undefined, ok: boolean | undefined }) {
  const MAP = { 
    call: undefined, 
    progress: 'progress',
    result: 'result',
    ok: 'result:ok'
  } as const
  // result:ok 过期，result 一定过期
  if (t.expired('result:ok')) expect(t.expired('result')).toBe(true)
  // result 过期，progress 一定过期
  if (t.expired('result')) expect(t.expired('progress')).toBe(true)
  Object.keys(expired).forEach((key) => {
    const state = MAP[key as keyof typeof expired]
    const result = expired[key as keyof typeof expired]
    // 明确忽略该项检测
    if (typeof result !== 'boolean') return
    expect(t.expired(state)).toBe(result)
  })
}

type Operation = { 
  type: 'init' 
} | {
  type: 'progress',
  index: number
} | {
  type: 'finish',
  index: number,
  error?: boolean
}

/**
 * 接收一串操作，每次操作后对 tracks 进行逐个检测。
 * 查看该操作后各 tracks 状态是否正确，仅检查能保证的状态，对不能保证的状态使用 undefined
 * 
 * @param operations 
 * @param tracks 
 * @param tracker 
 */
export function operate(operations: Operation[], tracks: Track[] = [], tracker: Tracker = createFunctionTracker()) {
  const TypeOperateMap = {
    init: operateInit,
    progress: operateProgress,
    finish: operateFinish
  } as const
  operations.forEach(operation => {
    const typeOperate = TypeOperateMap[operation.type]
    typeOperate(operation as any, tracks, tracker)
  })
}

function operateInit(_operation: Extract<Operation, { type: 'init' }>, tracks: Track[], tracker: Tracker) {
  const track = tracker()  
  const index = tracks.push(track) - 1
  check(track, { call: false, progress: false, result: false, ok: false })
  tracks.forEach((track, i) => {
    if (i !== index) return check(track, { call: true, progress: undefined, result: undefined, ok: undefined })
  })
}

function operateProgress(operation: Extract<Operation, { type: 'progress' }>, tracks: Track[], _tracker: Tracker) {
  const index = operation.index
  const track = tracks[index]
  if (!track) return
  track.progress()
  const isLastTrack = index === (tracks.length - 1)
  check(track, { 
    call: !isLastTrack, 
    progress: undefined,
    result: undefined,
    ok: undefined,
  })
  tracks.forEach((t, i) => {
    if (i < index) return check(t, { 
      call: true, 
      progress: true,
      result: true,
      ok: undefined,
    })
    if (i > index) return check(t, { 
      call: i !== (tracks.length - 1),
      progress: undefined,
      result: undefined,
      ok: undefined,
    })
  })
}

function operateFinish(operation: Extract<Operation, { type: 'finish' }>, tracks: Track[], _tracker: Tracker) {
  const index = operation.index
  const track = tracks[index]
  if (!track) return
  track.finish(!!operation.error)
  check(track, { 
    call: index !== (tracks.length - 1), 
    progress: undefined, // need recheck
    result: undefined, // need recheck
    ok: undefined, // need recheck
  })
  tracks.forEach((t, i) => {
    if (i < index) return check(t, { 
      call: true, 
      progress: true,
      result: true, // need recheck
      ok: true, // need recheck
    })
    if (i > index) return check(t, { 
      call: i !== (tracks.length - 1),
      progress: undefined, // need recheck
      result: undefined, // need recheck
      ok: undefined, // need recheck
    })
  })
}