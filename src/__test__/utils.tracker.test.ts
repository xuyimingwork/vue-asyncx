// utils.tracker.test.ts
import { createTracker } from '../utils/tracker'
import { describe, expect, it, vi, afterEach } from 'vitest'

/*
  Design contracts for `createTracker`:
  - Calls are assigned strictly increasing sequence numbers (sn).
  - A later call (higher sn) that finishes (fulfill/reject) wins the "latest" status.
  - `reject` can receive any value (not just Error instances).
  - Multiple `fulfill` calls for the same sn are idempotent: the first fulfill is kept.
  - `update` after a call finished should not resurrect or overwrite a finished value.
  - The `record` function prevents older calls from overwriting newer latest refs.

  Tests that use timers enable fake timers (`vi.useFakeTimers()`); a global
  `afterEach` will restore real timers to avoid leaking fake timers between tests.
*/

describe('createTracker', () => {
  afterEach(() => vi.useRealTimers())

  // ============================================================================
  // SEQUENCE NUMBERING
  // ============================================================================
  describe('sequence numbering', () => {
    it('should assign strictly increasing sequence numbers', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      const t3 = tracker()
      expect(t1.sn).toBe(1)
      expect(t2.sn).toBe(2)
      expect(t3.sn).toBe(3)
    })

    it('should handle large number of calls without sequence collision', () => {
      const tracker = createTracker()
      const calls = Array.from({ length: 100 }, (_, i) => {
        const t = tracker()
        expect(t.sn).toBe(i + 1)
        return t
      })
      expect(calls.length).toBe(100)
    })
  })

  // ============================================================================
  // STATE TRANSITIONS
  // ============================================================================
  describe('state transitions', () => {
    describe('valid transitions', () => {
      it('should allow pending → updating → fulfilled', () => {
        const tracker = createTracker()
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
        const tracker = createTracker()
        const t = tracker()
        t.reject(new Error('fail'))
        expect(t.inStateRejected()).toBe(true)
        expect(t.isStaleValue()).toBe(true)
        expect(tracker.has.rejected.value).toBe(true)
      })

      it('should allow pending → fulfilled (direct)', () => {
        const tracker = createTracker()
        const t = tracker()
        t.fulfill('done')
        expect(t.inStateFulfilled()).toBe(true)
        expect(t.value).toBe('done')
      })

      it('should allow updating → updating (self-transition)', () => {
        const tracker = createTracker()
        const t = tracker()
        t.update('first')
        expect(t.value).toBe('first')
        t.update('second') // Self-transition in updating state
        expect(t.value).toBe('second')
        expect(t.inStateUpdating()).toBe(true)
      })
    })

    describe('invalid transitions', () => {
      it('should reject transitions from fulfilled state', () => {
        const tracker = createTracker()
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
      })

      it('should reject transitions from rejected state', () => {
        const tracker = createTracker()
        const t = tracker()
        t.reject(new Error('error'))
        // Attempt illegal transitions — should not change state/value
        expect(t.inStateRejected()).toBe(true)
        t.update('should not work')
        t.fulfill('should not work')
        expect(t.inStateRejected()).toBe(true)
        expect(t.inStateFulfilled()).toBe(false)
        expect(t.inStatePending()).toBe(false)
        expect(t.inStateUpdating()).toBe(false)
        expect(t.error).toBeDefined()
        expect((t.error as any).message).toBe('error')
        expect(t.value).toBeUndefined()
      })
    })

    describe('idempotent operations', () => {
      it('should keep first value on multiple fulfill calls for same sn', () => {
        const tracker = createTracker()
        const t = tracker()
        t.update('u1')
        t.fulfill('v1')
        t.fulfill('v2') // second fulfill for same sn should be ignored
        expect(t.inStateFulfilled()).toBe(true)
        expect(t.value).toBe('v1')
      })
    })
  })

  // ============================================================================
  // VALUE HANDLING
  // ============================================================================
  describe('value handling', () => {
    it('should handle undefined initial value correctly', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.value).toBeUndefined()
      t.update()
      expect(t.value).toBeUndefined()
      t.fulfill()
      expect(t.value).toBeUndefined()
    })

    it('should handle null values correctly', () => {
      const tracker = createTracker()
      const t = tracker(null)
      expect(t.value).toBeNull()
      t.update(null)
      expect(t.value).toBeNull()
      t.fulfill(null)
      expect(t.value).toBeNull()
    })

    it('should preserve initial value through state transitions', () => {
      const tracker = createTracker()
      const initialData = { id: 1, name: 'test' }
      const t = tracker(initialData)
      expect(t.value).toBe(initialData)
      t.update({ id: 1, name: 'updated' })
      expect(t.value).not.toBe(initialData) // should be new object reference
      expect(t.value).toEqual({ id: 1, name: 'updated' })
      t.fulfill({ id: 1, name: 'final' })
      expect(t.value).toEqual({ id: 1, name: 'final' })
    })

    it('should handle multiple progressive updates before finish', () => {
      const tracker = createTracker()
      const t = tracker()
      t.update('loading...')
      t.update('processing...')
      t.update('almost done...')
      expect(t.value).toBe('almost done...')
      expect(t.inStateUpdating()).toBe(true)
      t.fulfill('complete')
      expect(t.value).toBe('complete')
      expect(t.inStateFulfilled()).toBe(true)
    })

    it('should handle concurrent calls with shared initial value pattern', () => {
      const tracker = createTracker()
      const sharedData = { count: 0 }
      
      const t1 = tracker(sharedData)
      const t2 = tracker(sharedData) // Same initial value reference
      
      t1.update({ count: 1 })
      t2.update({ count: 2 })
      
      // Both should have independent value references
      expect(t1.value).toEqual({ count: 1 })
      expect(t2.value).toEqual({ count: 2 })
      expect(t1.value).not.toBe(t2.value)
    })
  })

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  describe('error handling', () => {
    it('should handle Error instances', () => {
      const tracker = createTracker()
      const t = tracker()
      const error = new Error('test error')
      t.reject(error)
      expect(t.inStateRejected()).toBe(true)
      expect(t.error).toBe(error)
      expect((t.error as any).message).toBe('test error')
    })

    it('should handle non-Error rejection values', () => {
      const tracker = createTracker()
      const t1 = tracker()
      t1.reject('string error')
      expect(t1.inStateRejected()).toBe(true)
      expect(t1.error).toBe('string error')
      
      const t2 = tracker()
      t2.reject({ code: 500, message: 'Custom error' })
      expect(t2.inStateRejected()).toBe(true)
      expect(t2.error).toEqual({ code: 500, message: 'Custom error' })
      
      const t3 = tracker()
      t3.reject(null)
      expect(t3.inStateRejected()).toBe(true)
      expect(t3.error).toBeNull()
    })

    it('should not allow update after reject', () => {
      const tracker = createTracker()
      const t = tracker()
      t.reject(new Error('err'))
      t.update('should not resurrect')
      expect(t.inStateRejected()).toBe(true)
      expect(t.isStaleValue()).toBe(true)
      expect(t.value).toBeUndefined()
    })
  })

  // ============================================================================
  // LATEST REF TRACKING (record function behavior)
  // ============================================================================
  describe('latest ref tracking', () => {
    it('should only increase latest refs when newer calls complete', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.fulfill('first')
      expect(tracker.latest.fulfilled.value).toBe(false) // t2 not done yet
      t2.fulfill('second')
      expect(tracker.latest.fulfilled.value).toBe(true)
      expect(tracker.has.fulfilled.value).toBe(true)
    })

    it('should not update latest ref when newer call has already updated it', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      // t2 updates first, setting updating.value to 2
      t2.update('newer')
      expect(tracker.has.updating.value).toBe(true)
      // t1 updates later, but should not overwrite updating.value since 2 >= 1
      t1.update('older')
      // updating.value should still be 2 (from t2)
      expect(t2.isLatestUpdate()).toBe(true)
      expect(t1.isLatestUpdate()).toBe(false)
    })

    it('should not update fulfilled ref when newer call has already fulfilled', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.fulfill('newer')
      expect(tracker.latest.fulfilled.value).toBe(true)
      t1.fulfill('older')
      // t2 should still be the latest fulfill
      expect(t2.isLatestFulfill()).toBe(true)
      expect(t1.isLatestFulfill()).toBe(false)
    })

    it('should not update rejected ref when newer call has already rejected', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.reject(new Error('newer error'))
      t1.reject(new Error('older error'))
      // Both should be rejected, but t2 is latest
      expect(t1.isStaleValue()).toBe(true)
      expect(t2.isStaleValue()).toBe(true)
      expect(t2.isLatestFinish()).toBe(true)
      expect(t1.isLatestFinish()).toBe(false)
    })
  })

  // ============================================================================
  // isLatest* METHODS
  // ============================================================================
  describe('isLatestCall', () => {
    it('should return true only for the most recent call', () => {
      const tracker = createTracker()
      const t1 = tracker()
      expect(t1.isLatestCall()).toBe(true)
      const t2 = tracker()
      expect(t1.isLatestCall()).toBe(false)
      expect(t2.isLatestCall()).toBe(true)
      const t3 = tracker()
      expect(t1.isLatestCall()).toBe(false)
      expect(t2.isLatestCall()).toBe(false)
      expect(t3.isLatestCall()).toBe(true)
    })

    it('should return false for older calls even after they finish', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.fulfill('first')
      expect(t1.isLatestCall()).toBe(false)
      expect(t2.isLatestCall()).toBe(true)
    })
  })

  describe('isLatestUpdate', () => {
    it('should return true when call is updating and is the latest update', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.update('old load')
      t2.update('new load')
      expect(t1.isLatestUpdate()).toBe(false)
      expect(t2.isLatestUpdate()).toBe(true)
    })

    it('should return false when not in updating state', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.isLatestUpdate()).toBe(false) // pending state
      t.fulfill('done')
      expect(t.isLatestUpdate()).toBe(false) // fulfilled state
      const t2 = tracker()
      t2.reject(new Error('error'))
      expect(t2.isLatestUpdate()).toBe(false) // rejected state
    })

    it('should return false when fulfilled.value >= sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.fulfill('newer')
      t1.update('older')
      // t1 is updating but t2 already fulfilled, so t1 is not latest update
      expect(t1.isLatestUpdate()).toBe(false)
    })

    it('should return false when updating.value !== sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.update('newer')
      t1.update('older')
      // t1 is updating but updating.value is 2, not 1
      expect(t1.isLatestUpdate()).toBe(false)
      expect(t2.isLatestUpdate()).toBe(true)
    })
  })

  describe('isLatestFulfill', () => {
    it('should return true when call is fulfilled and is the latest fulfill', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.fulfill('old result')
      t2.fulfill('new result')
      expect(t1.isLatestFulfill()).toBe(false)
      expect(t2.isLatestFulfill()).toBe(true)
    })

    it('should return false when not in fulfilled state', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.isLatestFulfill()).toBe(false) // pending state
      t.update('loading')
      expect(t.isLatestFulfill()).toBe(false) // updating state
      const t2 = tracker()
      t2.reject(new Error('error'))
      expect(t2.isLatestFulfill()).toBe(false) // rejected state
    })

    it('should return false when updating.value > sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.update('newer')
      t1.fulfill('older')
      // t1 is fulfilled but t2 has updated, so t1 is not latest fulfill
      expect(t1.isLatestFulfill()).toBe(false)
    })

    it('should return false when fulfilled.value !== sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.fulfill('newer')
      t1.fulfill('older')
      // t1 is fulfilled but fulfilled.value is 2, not 1
      expect(t1.isLatestFulfill()).toBe(false)
      expect(t2.isLatestFulfill()).toBe(true)
    })
  })

  describe('isLatestFinish', () => {
    it('should return true when call is finished and is the latest finish', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.fulfill('old result')
      t2.fulfill('new result')
      expect(t1.isLatestFinish()).toBe(false)
      expect(t2.isLatestFinish()).toBe(true)
    })

    it('should work for rejected calls', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      t1.reject(new Error('old error'))
      t2.reject(new Error('new error'))
      expect(t1.isLatestFinish()).toBe(false)
      expect(t2.isLatestFinish()).toBe(true)
    })

    it('should return false when not in finished state', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.isLatestFinish()).toBe(false) // pending state
      t.update('loading')
      expect(t.isLatestFinish()).toBe(false) // updating state
    })

    it('should return false when updating.value > sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.update('newer')
      t1.fulfill('older')
      // t1 is finished but t2 has updated, so t1 is not latest finish
      expect(t1.isLatestFinish()).toBe(false)
    })

    it('should return false when finished.value !== sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.reject(new Error('newer error'))
      t1.reject(new Error('older error'))
      // t1 is finished but finished.value is 2, not 1
      expect(t1.isLatestFinish()).toBe(false)
      expect(t2.isLatestFinish()).toBe(true)
    })
  })

  // ============================================================================
  // STALENESS DETECTION
  // ============================================================================
  describe('staleness detection', () => {
    it('should return true for rejected calls', () => {
      const tracker = createTracker()
      const t = tracker()
      t.reject(new Error('error'))
      expect(t.isStaleValue()).toBe(true)
    })

    it('should return true if newer call has finished', () => {
      const tracker = createTracker()
      const slow = tracker() // sn=1
      const fast = tracker() // sn=2
      fast.fulfill('fast')
      slow.fulfill('slow')
      expect(fast.isStaleValue()).toBe(false)
      expect(slow.isStaleValue()).toBe(true) // because sn=2 > sn=1 and finished
    })

    it('should return true when newer call finished even if updating', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t1.update('loading')
      t2.fulfill('done') // finished.value = 2
      // t1 is updating but finished.value (2) > sn (1)
      expect(t1.isStaleValue()).toBe(true)
    })

    it('should return true when updating.value > sn', () => {
      const tracker = createTracker()
      const t1 = tracker() // sn=1
      const t2 = tracker() // sn=2
      t2.update('newer')
      // updating.value (2) > sn (1)
      expect(t1.isStaleValue()).toBe(true)
    })

    describe('race conditions', () => {
      it('fulfill (sn=1) then reject (sn=2) → fulfill is stale', () => {
        const tracker = createTracker()
        const first = tracker() // sn=1
        const second = tracker() // sn=2
        first.fulfill('result')
        second.reject(new Error('error'))
        expect(first.isStaleValue()).toBe(true)
        expect(second.isStaleValue()).toBe(true) // reject is always stale
        expect(second.isLatestFinish()).toBe(true)
        expect(tracker.has.finished.value).toBe(true)
      })

      it('reject (sn=1) then fulfill (sn=2) → reject is stale, fulfill is latest', () => {
        const tracker = createTracker()
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

      it('finish race: later finish decides latest flags', () => {
        const tracker = createTracker()
        const a = tracker()
        const b = tracker()
        a.finish(false, 'a-ok')
        b.finish(true, new Error('b-err'))
        expect(a.isStaleValue()).toBe(true)
        expect(b.isLatestFinish()).toBe(true)
      })
    })

    describe('multiple concurrent calls', () => {
      it('only the latest fulfilled is non-stale', () => {
        const tracker = createTracker()
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

      it('complex interleaving: only last fulfilled non-stale', () => {
        const tracker = createTracker()
        const calls = Array.from({ length: 7 }, () => tracker())
        // complete in custom order:
        const order = [2, 0, 6, 1, 5, 3, 4]
        order.forEach(i => calls[i].fulfill(`r${i}`))
        // Only the last (sn=7, index 6) should be non-stale
        calls.slice(0, -1).forEach(t => expect(t.isStaleValue()).toBe(true))
        expect(calls[6].isStaleValue()).toBe(false)
      })

      it('large concurrency: only latest fulfilled non-stale when last call fulfilled', () => {
        const tracker = createTracker()
        const N = 50
        const calls = Array.from({ length: N }, () => tracker())
        // deterministic order (reverse then interleave)
        const order = Array.from({ length: N }, (_, i) => i).reverse()
        order.forEach(i => {
          if (i % 7 === 0) calls[i].reject(new Error(`err${i}`))
          else calls[i].fulfill(`r${i}`)
        })
        const lastIdx = calls.length - 1
        const lastWasRejected = lastIdx % 7 === 0
        expect(tracker.has.finished.value).toBe(true)
        const nonStale = calls.filter(c => !c.isStaleValue())
        
        if (lastWasRejected) {
          // If last was rejected, all calls are stale (rejects are always stale)
          expect(nonStale.length).toBe(0)
        } else {
          // Only the last fulfilled call should be non-stale
          expect(nonStale.length).toBe(1)
          expect(nonStale[0]).toBe(calls[lastIdx])
        }
      })

      it('older update after newer finish should be ignored (stale update)', () => {
        const tracker = createTracker()
        vi.useFakeTimers()
        const t1 = tracker() // sn=1
        const t2 = tracker() // sn=2
        setTimeout(() => t1.update('old late update'), 20)
        setTimeout(() => t2.fulfill('fast'), 10)
        vi.runAllTimers()
        expect(t2.isLatestFulfill()).toBe(true)
        expect(t2.isLatestUpdate()).toBe(false)
        expect(t1.isLatestUpdate()).toBe(false)
      })
    })
  })

  // ============================================================================
  // FINISH METHOD
  // ============================================================================
  describe('finish method', () => {
    it('should delegate to fulfill when error is false', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish(false, 'success via finish')
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('success via finish')
    })

    it('should delegate to reject when error is true', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish(true, new Error('error via finish'))
      expect(t.inStateRejected()).toBe(true)
      expect(t.error).toBeDefined()
    })

    it('should handle default error parameter (false)', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish() // default error=false, should fulfill
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBeUndefined()
    })

    it('should handle finish with error=true', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish(true, new Error('error'))
      expect(t.inStateRejected()).toBe(true)
      expect(t.error).toBeDefined()
    })

    it('should ignore subsequent finish calls after first terminal state', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish(false, 'first')
      t.finish(true, new Error('second'))
      expect(t.inStateFulfilled()).toBe(true)
      expect(t.value).toBe('first')
    })

    it('should ignore subsequent finish calls when first was a rejection', () => {
      const tracker = createTracker()
      const t = tracker()
      t.finish(true, new Error('first'))
      t.finish(false, 'second')
      expect(t.inStateRejected()).toBe(true)
      expect((t.error as any)?.message).toBe('first')
    })
  })

  // ============================================================================
  // STATE CHECK METHODS
  // ============================================================================
  describe('inStateFinished', () => {
    it('should return true for fulfilled calls', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.inStateFinished()).toBe(false)
      t.fulfill('done')
      expect(t.inStateFinished()).toBe(true)
    })

    it('should return true for rejected calls', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.inStateFinished()).toBe(false)
      t.reject(new Error('error'))
      expect(t.inStateFinished()).toBe(true)
    })

    it('should return false for pending and updating calls', () => {
      const tracker = createTracker()
      const t1 = tracker()
      expect(t1.inStateFinished()).toBe(false)
      const t2 = tracker()
      t2.update('loading')
      expect(t2.inStateFinished()).toBe(false)
    })
  })

  describe('allowToState methods', () => {
    it('allowToStateUpdating should return correct values', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.allowToStateUpdating()).toBe(true)
      t.update('loading')
      expect(t.allowToStateUpdating()).toBe(true) // updating -> updating allowed
      t.fulfill('done')
      expect(t.allowToStateUpdating()).toBe(false)
    })

    it('allowToStateFulfilled should return correct values', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.allowToStateFulfilled()).toBe(true)
      t.update('loading')
      expect(t.allowToStateFulfilled()).toBe(true)
      t.fulfill('done')
      expect(t.allowToStateFulfilled()).toBe(false)
      const t2 = tracker()
      t2.reject(new Error('error'))
      expect(t2.allowToStateFulfilled()).toBe(false)
    })

    it('allowToStateRejected should return correct values', () => {
      const tracker = createTracker()
      const t = tracker()
      expect(t.allowToStateRejected()).toBe(true)
      t.update('loading')
      expect(t.allowToStateRejected()).toBe(true)
      t.reject(new Error('error'))
      expect(t.allowToStateRejected()).toBe(false)
      const t2 = tracker()
      t2.fulfill('done')
      expect(t2.allowToStateRejected()).toBe(false)
    })
  })

  // ============================================================================
  // TRACKER.HAS FLAGS
  // ============================================================================
  describe('tracker.has flags', () => {
    it('has.tracking becomes true after any track', () => {
      const tracker = createTracker()
      expect(tracker.has.tracking.value).toBe(false)
      tracker() // Just creating a track should make tracking true
      expect(tracker.has.tracking.value).toBe(true)
    })

    it('has.updating becomes true after any update', () => {
      const tracker = createTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
    })

    it('has.updating remains true even if call ends in rejection after update', () => {
      const tracker = createTracker()
      const t = tracker()
      t.update('loading')
      expect(tracker.has.updating.value).toBe(true)
      t.reject(new Error('fail'))
      expect(tracker.has.updating.value).toBe(true)
    })

    it('has.updating stays false if no update ever called', () => {
      const tracker = createTracker()
      expect(tracker.has.updating.value).toBe(false)
      const t1 = tracker()
      t1.fulfill('ok')
      expect(tracker.has.updating.value).toBe(false)
      const t2 = tracker()
      t2.reject(new Error())
      expect(tracker.has.updating.value).toBe(false)
    })

    it('tracking and has flags reflect call lifecycle', () => {
      const tracker = createTracker()
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
      const tracker = createTracker()
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

  // ============================================================================
  // TRACKER.LATEST COMPUTED PROPERTIES
  // ============================================================================
  describe('tracker.latest computed properties', () => {
    it('latest.fulfilled should be true only when last call was fulfilled', () => {
      const tracker = createTracker()
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
      const tracker = createTracker()
      // No calls
      expect(tracker.latest.finished.value).toBe(true)
      // One pending call
      tracker()
      expect(tracker.latest.finished.value).toBe(false)
    })

    it('latest.finished should be true if the most recent call has finished', () => {
      const tracker = createTracker()
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

  // ============================================================================
  // REAL-WORLD USAGE PATTERNS
  // ============================================================================
  describe('real-world usage patterns', () => {
    it('should support updateData pattern: update then check inStateUpdating', () => {
      const tracker = createTracker()
      const t = tracker()
      t.update('progress')
      expect(t.inStateUpdating()).toBe(true)
      // Simulate updateData pattern from use-async-data.ts:101
      if (t.inStateUpdating()) {
        // This is the pattern used in real code
        expect(t.value).toBe('progress')
      }
    })

    it('should handle initial value pattern from use-async-data', () => {
      const tracker = createTracker()
      const currentData = { id: 1, name: 'current' }
      // Simulate tracker(data.value) pattern from use-async-data.ts:127
      const track = tracker(currentData)
      expect(track.value).toBe(currentData)
      track.update({ id: 1, name: 'updated' })
      expect(track.value).toEqual({ id: 1, name: 'updated' })
    })

    it('should handle finish pattern with scene parameter', () => {
      const tracker = createTracker()
      const t1 = tracker()
      const t2 = tracker()
      // Simulate finish(scene === 'error', v) pattern from use-async-data.ts:91
      t1.finish(false, 'success') // scene === 'normal'
      t2.finish(true, new Error('error')) // scene === 'error'
      expect(t1.inStateFulfilled()).toBe(true)
      expect(t2.inStateRejected()).toBe(true)
    })
  })

  // ============================================================================
  // PROMISE-BASED CONCURRENCY
  // ============================================================================
  describe('promise-based concurrency', () => {
    it('later promise wins', async () => {
      const tracker = createTracker()
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
})
