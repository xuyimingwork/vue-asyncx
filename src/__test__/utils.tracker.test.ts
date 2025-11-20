import { describe, expect, test } from 'vitest'
import { createFunctionTracker, Track, Tracker } from '../utils'

function check(t: Track, expired: { call: boolean | undefined, progress: boolean | undefined, result: boolean | undefined, ok: boolean | undefined }) {
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

function init(count: number): Track[] & { tracker: Tracker }  {
  const tracker = createFunctionTracker()
  const tracks: Track[] = []
  for(let i = 0; i < count; i++) {
    const track = tracker()  
    tracks.push(track)
    const prev = tracks.slice(0, tracks.length - 1)
    // 新调用发生后，所有之前的调用全部过期
    if (prev.length) prev.every(track => check(track, { call: true, progress: false, result: false, ok: false }))
    check(track, { call: false, progress: false, result: false, ok: false })
  }
  return Object.assign(tracks, { tracker })
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
 * 接收一串操作，每次操作后对 track 进行逐个检测，查看该操作后各 track 状态是否正确
 * 
 * @param operations 
 * @param tracks 
 * @param tracker 
 */
function operate(operations: Operation[], tracks: Track[] = [], tracker: Tracker = createFunctionTracker()) {
  operations.forEach(operation => {
    if (operation.type === 'init') {
      const track = tracker()
      check(track, { call: false, progress: false, result: false, ok: false })
      tracks.push(track)
      const prev = tracks.slice(0, tracks.length - 1)
      if (prev.length) prev.every(track => check(track, { call: true, progress: undefined, result: undefined, ok: undefined }))
      return
    }
    if (operation.type === 'progress') {
      const track = tracks[operation.index]
      check(track, { call: !!tracks[operation.index + 1], progress: undefined, result: undefined, ok: undefined })
      track.expired('result')
    }
  })
}

describe('createFunctionTracker', () => {
  test('1 tracker', () => {
    const [t1] = init(1)

    t1.finish()
    check(t1, { call: false, progress: true, result: false, ok: false })
  })

  test('1 tracker - progress', () => {
    const [t1] = init(1)

    t1.progress()
    check(t1, { call: false, progress: false, result: false, ok: false })

    t1.finish()
    check(t1, { call: false, progress: true, result: false, ok: false })
  })

  test('1 tracker - error', () => {
    const [t1] = init(1)

    t1.finish(true)
    check(t1, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 12', () => {
    const [t1, t2] = init(2)

    t1.finish()
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 12 progress 12', () => {
    const [t1, t2] = init(2)

    t1.progress()
    check(t1, { call: true, progress: false, result: false, ok: false })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.progress()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: false, result: false, ok: false })

    t1.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 12 error 12', () => {
    const [t1, t2] = init(2)

    t1.finish(true)
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.finish(true)
    // ok data come from previous call, as long as no later update/ok, ok keep false
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 12 error 1', () => {
    const [t1, t2] = init(2)

    t1.finish(true)
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 12 error 2', () => {
    const [t1, t2] = init(2)

    t1.finish()
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: false, progress: false, result: false, ok: false })
    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 21', () => {
    const [t1, t2] = init(2)

    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
    t1.finish()    
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 21 error 21', () => {
    const [t1, t2] = init(2)

    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
    t1.finish(true)    
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 21 error 2', () => {
    const [t1, t2] = init(2)

    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
    t1.finish()    
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('2 trackers - 21 error 1', () => {
    const [t1, t2] = init(2)

    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
    t1.finish(true)    
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 123', () => {
    const [t1, t2, t3] = init(3)

    t1.finish()
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: true, progress: false, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t3.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: true })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 123 error 123', () => {
    const [t1, t2, t3] = init(3)

    t1.finish(true)
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: true, progress: false, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: true, progress: true, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t3.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: true, progress: true, result: true, ok: false })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 123 error 12', () => {
    const [t1, t2, t3] = init(3)

    t1.finish(true)
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: true, progress: false, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: true, progress: true, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t3.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: true })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 123 error 13', () => {
    const [t1, t2, t3] = init(3)

    t1.finish(true)
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: true, progress: false, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t3.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: false })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 123 error 23', () => {
    const [t1, t2, t3] = init(3)

    t1.finish()
    check(t1, { call: true, progress: true, result: false, ok: false })
    check(t2, { call: true, progress: false, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t2.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: true, progress: true, result: false, ok: false })
    check(t3, { call: false, progress: false, result: false, ok: false })
    t3.finish(true)
    check(t1, { call: true, progress: true, result: true, ok: false })
    check(t2, { call: true, progress: true, result: true, ok: false })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })

  test('3 trackers - 312', () => {
    const [t1, t2, t3] = init(3)

    t3.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: true })
    check(t3, { call: false, progress: true, result: false, ok: false })
    t1.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: true })
    check(t3, { call: false, progress: true, result: false, ok: false })
    t2.finish()
    check(t1, { call: true, progress: true, result: true, ok: true })
    check(t2, { call: true, progress: true, result: true, ok: true })
    check(t3, { call: false, progress: true, result: false, ok: false })
  })
})
