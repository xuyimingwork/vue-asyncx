import { describe, test } from 'vitest'
import { createFunctionTracker, Track, Tracker } from '../utils'
import { check } from './utils.tracker.helper'

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
