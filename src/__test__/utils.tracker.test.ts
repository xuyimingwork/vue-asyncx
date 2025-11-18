import { describe, expect, test } from 'vitest'
import { createFunctionTracker } from '../utils'

describe('createFunctionTracker', () => {
  test('normal tracker', () => {
    const tracker = createFunctionTracker()

    const t1 = tracker()
    // initially not expired
    expect(t1.expired()).toBe(false)
    expect(t1.expired('progress')).toBe(false)
    expect(t1.expired('result')).toBe(false)

    // mark progress for t1, should still not be expired
    t1.progress()
    expect(t1.expired()).toBe(false)
    expect(t1.expired('progress')).toBe(false)
    expect(t1.expired('result')).toBe(false)

    // mark finish for t1, progress should be expired
    t1.finish()
    expect(t1.expired()).toBe(false)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(false)
  })

  test('2 trackers, later progress & finish first', () => {
    const tracker = createFunctionTracker()

    const t1 = tracker()
    expect(t1.expired()).toBe(false)
    const t2 = tracker()

    // initially not expired
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(false)
    expect(t1.expired('result')).toBe(false)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(false)
    expect(t2.expired('result')).toBe(false)

    // mark progress for t2, t1 should be expired, t2 should not
    t2.progress()
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(true)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(false)
    expect(t2.expired('result')).toBe(false)

    // mark finish for t2, progress should be expired
    t2.finish()
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(true)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(true)
    expect(t2.expired('result')).toBe(false)
  })

  test('2 trackers, random order', () => {
    const tracker = createFunctionTracker()

    const t1 = tracker()
    const t2 = tracker()

    // initially not expired
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(false)
    expect(t1.expired('result')).toBe(false)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(false)
    expect(t2.expired('result')).toBe(false)

    // mark progress for t2, t1 should be expired, t2 should not
    t2.progress()
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(true)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(false)
    expect(t2.expired('result')).toBe(false)

    // mark finish for t1, same with above
    t1.finish()
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(true)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(false)
    expect(t2.expired('result')).toBe(false)

    // mark finish for t2, progress should be expired
    t2.finish()
    expect(t1.expired()).toBe(true)
    expect(t1.expired('progress')).toBe(true)
    expect(t1.expired('result')).toBe(true)
    expect(t2.expired()).toBe(false)
    expect(t2.expired('progress')).toBe(true)
    expect(t2.expired('result')).toBe(false)
  })

})
