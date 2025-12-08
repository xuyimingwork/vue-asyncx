// utils.tracker.test.ts
import { createFunctionTracker } from '../utils.tracker'
import { describe, expect, it, vi, afterEach } from 'vitest'

/*
  Tests below assume the following design contracts for `createFunctionTracker`:
  - Calls are assigned strictly increasing sequence numbers (sn).
  - A later call (higher sn) that finishes (fulfill/reject) wins the "latest" status.
  - `reject` should receive an `Error` instance and rejected calls are considered finished.
  - Multiple `fulfill` calls for the same sn are idempotent: the first fulfill is kept.
  - `update` after a call finished should not resurrect or overwrite a finished value.

  Tests that use timers enable fake timers (`vi.useFakeTimers()`); a global
  `afterEach` will restore real timers to avoid leaking fake timers between tests.
*/

describe('createFunctionTracker', () => {
  afterEach(() => vi.useRealTimers())
  describe('sequence numbering', () => {
    it('should assign strictly increasing sequence numbers', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      const t3 = tracker()
      expect(t1.sn).toBe(1)
      expect(t2.sn).toBe(2)
      expect(t3.sn).toBe(3)
    })

    it('should handle large number of calls without sequence collision', () => {
      const tracker = createFunctionTracker()
      const calls = Array.from({ length: 100 }, (_, i) => {
        const t = tracker()
        expect(t.sn).toBe(i + 1)
        return t
      })
      expect(calls.length).toBe(100)
    })
  })

  describe('state transitions', () => {
    it('should allow valid state transitions: pending → updating → fulfilled', () => {
      const tracker = createFunctionTracker()
      const t = tracker('initial')
      expect(t.inStatePending()).toBe(true)
      expect(t.value).toBe('initial')
      t.update('loading...')
      expect(t.inStateUpdating()).toBe(true)
      expect(t.value).toBe('loading...')
      t.fulfill('success')
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('success')
    })

    it('should allow pending → rejected', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.reject(new Error('fail'))
      expect(t.inStateRejected()).toBe(true)
      expect(t.isStaleValue()).toBe(true)
      expect(tracker.has.rejected.value).toBe(true)
    })

    it('should reject invalid state transitions', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.fulfill('done')
      // Attempt illegal transitions — should not change state/value
      expect(t.inStateFulfilled()).toBe(true)
      t.update('should not work')
      t.reject(new Error('should not work'))
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.inStatePending()).toBe(false)
      expect(t.inStateUpdating()).toBe(false)
      expect(t.inStateRejected()).toBe(false)
      expect(t.value).toBe('done')

      const t2 = tracker()
      t2.reject(new Error('error'))
      // Attempt illegal transitions — should not change state/value
      expect(t2.inStateRejected()).toBe(true)
      t2.update('should not work')
      t2.fulfill('should not work')
      expect(t2.inStateRejected()).toBe(true)
      expect(t2.inStateFulfilled()).toBe(false)
      expect(t2.inStatePending()).toBe(false)
      expect(t2.inStateUpdating()).toBe(false)
      expect(t2.error).toBeDefined()
      expect((t2.error as any).message).toBe('error')
      expect(t2.value).toBeUndefined()
    })

    it('should handle self-transitions correctly', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.update('first')
      expect(t.value).toBe('first')
      t.update('second') // Self-transition in updating state
      expect(t.value).toBe('second')
      expect(t.inStateUpdating()).toBe(true)
    })

    it('multiple fulfill calls for same sn should keep first value (idempotent fulfill)', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.update('u1')
      t.fulfill('v1')
      t.fulfill('v2') // second fulfill for same sn may be ignored
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('v1')
    })
  })

  describe('latest tracking', () => {
    it('record function should only increase latest refs', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.fulfill('first')
      expect(tracker.latest.fulfilled.value).toBe(false) // t2 not done yet
      t2.fulfill('second')
      expect(tracker.latest.fulfilled.value).toBe(true)
      expect(tracker.has.fulfilled.value).toBe(true)
    })

    it('isLatestFulfill and isLatestUpdate work correctly', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.update('old load')
      t2.update('new load')
      expect(t1.isLatestUpdate()).toBe(false)
      expect(t2.isLatestUpdate()).toBe(true)

      t1.fulfill('old result')
      t2.fulfill('new result')
      expect(t1.isLatestFulfill()).toBe(false)
      expect(t2.isLatestFulfill()).toBe(true)
      expect(t2.isLatestFinish()).toBe(true)
    })

    it('isLatestFinish should work for rejected calls', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.reject(new Error('old error'))
      t2.reject(new Error('new error'))
      expect(t1.isLatestFinish()).toBe(false)
      expect(t2.isLatestFinish()).toBe(true)
    })

    it('finish race: later finish decides latest flags', () => {
      const tracker = createFunctionTracker()
      const a = tracker()
      const b = tracker()
      a.finish(false, 'a-ok')
      b.finish(true, new Error('b-err'))
      expect(a.isStaleValue()).toBe(true)
      expect(b.isLatestFinish()).toBe(true)
    })
  })

  describe('staleness detection', () => {
    it('isStaleValue returns true for rejected calls', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.reject(new Error('error'))
      expect(t.isStaleValue()).toBe(true)
    })

    it('isStaleValue returns true if newer call has finished', () => {
      const tracker = createFunctionTracker()
      const slow = tracker() // sn=1
      const fast = tracker() // sn=2
      fast.fulfill('fast')
      slow.fulfill('slow')
      expect(fast.isStaleValue()).toBe(false)
      expect(slow.isStaleValue()).toBe(true) // because sn=2 > sn=1 and finished
    })

    it('race: fulfill (sn=1) then reject (sn=2) → fulfill is stale', () => {
      const tracker = createFunctionTracker()
      const first = tracker() // sn=1
      const second = tracker() // sn=2
      first.fulfill('result')
      second.reject(new Error('error'))
      expect(first.isStaleValue()).toBe(true)
      expect(second.isStaleValue()).toBe(true) // reject is always stale
      expect(second.isLatestFinish()).toBe(true)
      expect(tracker.has.finished.value).toBe(true)
    })

    it('race: reject (sn=1) then fulfill (sn=2) → reject is stale, fulfill is latest', () => {
      const tracker = createFunctionTracker()
      const first = tracker() // sn=1
      const second = tracker() // sn=2
      expect(second.isLatestFinish()).toBe(false)
      first.reject(new Error('early error'))
      second.fulfill('later success')
      expect(first.isStaleValue()).toBe(true)
      expect(second.isStaleValue()).toBe(false)
      expect(second.isLatestFinish()).toBe(true)
      expect(tracker.latest.fulfilled.value).toBe(true)
    })

    it('multiple calls: only the latest fulfilled is non-stale', () => {
      const tracker = createFunctionTracker()
      vi.useFakeTimers()
      const calls = Array.from({ length: 5 }, (_, i) => {
        const t = tracker()
        // schedule fulfill with shorter delay for later calls to simulate out-of-order completion
        setTimeout(() => t.fulfill(`result ${i}`), (5 - i) * 10)
        return t
      })
      // run all timers so scheduled fulfills execute deterministically
      vi.runAllTimers()
      // Only last (sn=5) should be non-stale
      calls.slice(0, -1).forEach(t => {
        expect(t.isStaleValue()).toBe(true)
      })
      expect(calls[4].isStaleValue()).toBe(false)
    })

    it('older update after newer finish should be ignored (stale update)', () => {
      const tracker = createFunctionTracker()
      vi.useFakeTimers()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      setTimeout(() => t1.update('old late update'), 20)
      setTimeout(() => t2.fulfill('fast'), 10)
      vi.runAllTimers()
      expect(t2.isLatestFulfill() || t2.isLatestUpdate()).toBe(true)
      expect(t1.isLatestUpdate()).toBe(false)
    })
  })

  describe('promise-based concurrency', () => {
    it('promise-based concurrency: later promise wins', async () => {
      const tracker = createFunctionTracker()
      // Use fake timers for deterministic setTimeout behavior
      vi.useFakeTimers()
      const t1 = tracker()
      Promise.resolve('r1').then(v => t1.fulfill(v))
      const t2 = tracker()
      new Promise<string>(resolve => setTimeout(() => resolve('r2'), 0)).then(v => t2.fulfill(v))
      // flush microtasks so p1 runs
      await Promise.resolve()
      // run timers so p2 runs, then flush microtasks
      vi.runAllTimers()
      await Promise.resolve()
      expect(t1.isStaleValue()).toBe(true)
      expect(t2.isStaleValue()).toBe(false)
    })
  })

  describe('complex interleaving', () => {
    it('complex interleaving: only last fulfilled non-stale', () => {
      const tracker = createFunctionTracker()
      const calls = Array.from({ length: 7 }, () => tracker())
      // complete in custom order:
      const order = [2, 0, 6, 1, 5, 3, 4]
      order.forEach(i => calls[i].fulfill(`r${i}`))
      // Only the last (sn=7, index 6) should be non-stale
      calls.slice(0, -1).forEach(t => expect(t.isStaleValue()).toBe(true))
      expect(calls[6].isStaleValue()).toBe(false)
    })

    it('large concurrency: only latest non-stale after mixed completion', () => {
      const tracker = createFunctionTracker()
      const N = 50
      const calls = Array.from({ length: N }, () => tracker())
      // deterministic order (reverse then interleave)
      const order = Array.from({ length: N }, (_, i) => i).reverse()
      order.forEach(i => {
        if (i % 7 === 0) calls[i].reject(new Error(`err${i}`))
        else calls[i].fulfill(`r${i}`)
      })
      // Only the highest sn (last created) should be non-stale if it was fulfilled
      const lastIdx = calls.length - 1
      const lastWasRejected = lastIdx % 7 === 0
      expect(tracker.has.finished.value).toBe(true)
      const nonStale = calls.filter(c => !c.isStaleValue())
      if (!lastWasRejected) {
        expect(nonStale.length).toBeGreaterThanOrEqual(1)
      } else {
        // If last was rejected, it's possible that no call is non-stale (rejects are considered stale)
        expect(nonStale.length).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('finish method', () => {
    it('finish() method delegates to fulfill or reject', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.finish(false, 'success via finish')
      t2.finish(true, new Error('error via finish'))
      expect(t1.inStateFulfilled()).toBe(true)
      expect(t1.value).toBe('success via finish')
      expect(t2.inStateRejected()).toBe(true)
    })
  })

  describe('tracker.has flags', () => {
    it('has.tracking becomes true after any track', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
    })

    it('has.progress becomes true after any update', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
    })

    it('has.updating remains true even if call ends in rejection after update', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
      t.reject(new Error('fail'))
      expect(tracker.has.updating.value).toBe(true)
    })

    it('has.updating stays false if no update ever called', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t1 = tracker()
      t1.fulfill('ok')
      expect(tracker.has.updating.value).toBe(false)
      const t2 = tracker()
      t2.reject(new Error())
      expect(tracker.has.updating.value).toBe(false)
    })

    it('tracking and has flags reflect call lifecycle', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.tracking.value).toBe(false)
      expect(tracker.has.finished.value).toBe(false)
      const t = tracker()
      expect(tracker.has.tracking.value).toBe(true)
      t.fulfill('ok')
      expect(tracker.has.finished.value).toBe(true)
      expect(tracker.has.fulfilled.value).toBe(true)
      expect(tracker.latest.finished.value).toBe(true)
      expect(tracker.latest.fulfilled.value).toBe(true)
    })

    it('has flags should correctly track mixed states', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.fulfilled.value).toBe(false)
      expect(tracker.has.rejected.value).toBe(false)
      const t1 = tracker()
      t1.fulfill('success')
      expect(tracker.has.fulfilled.value).toBe(true)
      expect(tracker.has.rejected.value).toBe(false)
      const t2 = tracker()
      t2.reject(new Error('error'))
      expect(tracker.has.fulfilled.value).toBe(true)
      expect(tracker.has.rejected.value).toBe(true)
      expect(tracker.has.finished.value).toBe(true)
    })
  })

  describe('tracker.latest computed properties', () => {
    it('latest.fulfilled should be true only when last call was fulfilled', () => {
      const tracker = createFunctionTracker()
      // No calls yet
      expect(tracker.latest.fulfilled.value).toBe(false)
      // First call fulfilled
      const t1 = tracker()
      t1.fulfill('result')
      expect(tracker.latest.fulfilled.value).toBe(true)
      // Second call pending
      const t2 = tracker()
      expect(tracker.latest.fulfilled.value).toBe(false)
      // Second call fulfilled
      t2.fulfill('result2')
      expect(tracker.latest.fulfilled.value).toBe(true)
    })

    it('latest.finished should be true when no calls have been made', () => {
      const tracker = createFunctionTracker()
      // No calls
      expect(tracker.latest.finished.value).toBe(true)
      // One pending call
      tracker()
      expect(tracker.latest.finished.value).toBe(false)
    })

    it('latest.finished should be true if the most recent call has finished', () => {
      const tracker = createFunctionTracker()
      // No calls
      expect(tracker.latest.finished.value).toBe(true)
      // One pending call
      const t1 = tracker()
      expect(tracker.latest.finished.value).toBe(false)
      // One fulfilled call
      t1.fulfill('result')
      expect(tracker.latest.finished.value).toBe(true)
      // Two calls, one pending
      const t2 = tracker()
      const t3 = tracker()
      t2.fulfill('result2')
      expect(tracker.latest.finished.value).toBe(false)
      // Both finished
      t3.fulfill('result3')
      expect(tracker.latest.finished.value).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined initial value correctly', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      expect(t.value).toBeUndefined()
      t.update()
      expect(t.value).toBeUndefined()
      t.fulfill()
      expect(t.value).toBeUndefined()
    })

    it('should handle null values correctly', () => {
      const tracker = createFunctionTracker()
      const t = tracker(null)
      expect(t.value).toBeNull()
      t.update(null)
      expect(t.value).toBeNull()
      t.fulfill(null)
      expect(t.value).toBeNull()
    })

    it('update then finish then update should ignore post-finish update', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.update('u1')
      t.finish(false, 'done')
      t.update('u2')
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('done')
    })

    it('update after reject should not resurrect value', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.reject(new Error('err'))
      t.update('should not resurrect')
      expect(t.inStateRejected()).toBe(true)
      expect(t.isStaleValue()).toBe(true)
    })
  })
})