// utils.tracker.test.ts
import { createFunctionTracker } from '../utils.tracker'
import { describe, expect, it } from 'vitest'

describe('createFunctionTracker', () => {
  describe('sequence numbering', () => {
    it('should assign strictly increasing sequence numbers', () => {
      const tracker = createFunctionTracker()
      const t1 = tracker()
      const t2 = tracker()
      const t3 = tracker()
      expect(t1.debug().sn).toBe(1)
      expect(t2.debug().sn).toBe(2)
      expect(t3.debug().sn).toBe(3)
    })

    it('should handle large number of calls without sequence collision', () => {
      const tracker = createFunctionTracker()
      const calls = Array.from({ length: 100 }, (_, i) => {
        const t = tracker()
        expect(t.debug().sn).toBe(i + 1)
        return t
      })
      expect(calls.length).toBe(100)
      expect(tracker.has.tracking.value).toBe(true)
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
      // Attempt illegal transitions
      t.update('should not work')
      t.reject('should not work')
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('done')

      const t2 = tracker()
      t2.reject('error')
      // Attempt illegal transitions
      t2.update('should not work')
      t2.fulfill('should not work')
      expect(t2.inStateRejected()).toBe(true)
      expect(t2.debug().error).toBe('error')
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
      t1.reject('old error')
      t2.reject('new error')
      expect(t1.isLatestFinish()).toBe(false)
      expect(t2.isLatestFinish()).toBe(true)
    })
  })

  describe('staleness detection', () => {
    it('isStaleValue returns true for rejected calls', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.reject('error')
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
      second.reject('error')
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
      first.reject('early error')
      second.fulfill('later success')
      expect(first.isStaleValue()).toBe(true)
      expect(second.isStaleValue()).toBe(false)
      expect(second.isLatestFinish()).toBe(true)
      expect(tracker.latest.fulfilled.value).toBe(true)
    })

    it('multiple calls: only the latest fulfilled is non-stale', () => {
      const tracker = createFunctionTracker()
      const calls = Array.from({ length: 5 }, (_, i) => {
        const t = tracker() // Simulate out-of-order completion
        setTimeout(() => t.fulfill(`result ${i}`), (5 - i) * 10)
        return t
      })
      // Wait for all to complete (simulate)
      // In real test, we'd mock time; here we just check logic via sn
      calls.forEach((t, i) => {
        // Manually fulfill in reverse order to mimic race
        calls[4 - i].fulfill(`result ${4 - i}`)
      })
      // Only last (sn=5) should be non-stale
      calls.slice(0, -1).forEach(t => {
        expect(t.isStaleValue()).toBe(true)
      })
      expect(calls[4].isStaleValue()).toBe(false)
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

  describe('debug introspection', () => {
    it('debug() returns full introspection object', () => {
      const tracker = createFunctionTracker()
      const t = tracker('start')
      t.update('progress')
      const dbg = t.debug()
      expect(dbg.sn).toBe(1)
      expect(dbg.state).toBe('updating')
      expect(dbg.value).toBe('progress')
      expect(dbg.error).toBeUndefined()
      expect(dbg.is.latestCall).toBe(true)
      expect(dbg.is.latestUpdate).toBe(true)
      expect(dbg.is.staleValue).toBe(false)
      expect(dbg.latest.pending).toBe(1)
      expect(dbg.latest.updating).toBe(1)
      expect(dbg.latest.fulfilled).toBe(0)
      expect(dbg.latest.rejected).toBe(0)
    })

    it('debug() should include correct finished value', () => {
      const tracker = createFunctionTracker()
      const t = tracker()
      t.fulfill('done')
      const dbg = t.debug()
      expect(dbg.latest.finished).toBe(1)
    })
  })

  describe('tracker.has flags', () => {
    it('has.progress becomes true after any update', () => {
      const tracker = createFunctionTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
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
      t2.reject('error')
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

    it('latest.finished should be true only when all calls have finished', () => {
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
  })
})