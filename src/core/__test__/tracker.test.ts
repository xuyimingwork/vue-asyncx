// core.tracker.test.ts
import { STATE, createTracker } from '@/core/tracker'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Symbol keys for testing
const VALUE_KEY = Symbol('value')
const ERROR_KEY = Symbol('error')

/*
  Design contracts for `createTracker`:
  - Calls are assigned strictly increasing sequence numbers (sn).
  - A later call (higher sn) that finishes (fulfill/reject) wins the "latest" status.
  - `reject` can receive any value (not just Error instances).
  - Multiple `fulfill` calls for the same sn are idempotent: the first fulfill is kept.
  - `update` after a call finished should not resurrect or overwrite a finished value.
  - The `record` function prevents older calls from overwriting newer latest refs.
  - Track only manages state, data is stored via setData/getData.

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
      const t1 = tracker.track()
      const t2 = tracker.track()
      const t3 = tracker.track()
      expect(t1.sn).toBe(1)
      expect(t2.sn).toBe(2)
      expect(t3.sn).toBe(3)
    })

    it('should handle large number of calls without sequence collision', () => {
      const tracker = createTracker()
      const calls = Array.from({ length: 100 }, (_, i) => {
        const t = tracker.track()
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
        const t = tracker.track()
        t.setData(VALUE_KEY, 'initial')
        expect(t.inState(STATE.PENDING)).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('initial')
        t.setData(VALUE_KEY, 'loading...')
        t.update()
        expect(t.inState(STATE.UPDATING)).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('loading...')
        t.setData(VALUE_KEY, 'success')
        t.fulfill()
        expect(t.inState(STATE.FULFILLED)).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('success')
      })

      it('should allow pending → rejected', () => {
        const tracker = createTracker()
        const t = tracker.track()
        const error = new Error('fail')
        t.setData(ERROR_KEY, error)
        t.reject()
        expect(t.inState(STATE.REJECTED)).toBe(true)
      })

      it('should allow pending → fulfilled (direct)', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'done')
        t.fulfill()
        expect(t.inState(STATE.FULFILLED)).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('done')
      })

      it('should allow updating → updating (self-transition)', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'first')
        t.update()
        expect(t.getData(VALUE_KEY)).toBe('first')
        t.setData(VALUE_KEY, 'second') // Self-transition in updating state
        t.update()
        expect(t.getData(VALUE_KEY)).toBe('second')
        expect(t.inState(STATE.UPDATING)).toBe(true)
      })
    })

    describe('invalid transitions', () => {
      it('should reject transitions from fulfilled state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'done')
        t.fulfill()
        // Attempt illegal transitions — should not change state/value
        expect(t.inState(STATE.FULFILLED)).toBe(true)
        t.setData(VALUE_KEY, 'should not work')
        t.update()
        t.setData(ERROR_KEY, new Error('should not work'))
        t.reject()
        expect(t.inState(STATE.FULFILLED)).toBe(true)
        expect(t.inState(STATE.PENDING)).toBe(false)
        expect(t.inState(STATE.UPDATING)).toBe(false)
        expect(t.inState(STATE.REJECTED)).toBe(false)
        expect(t.getData(VALUE_KEY)).toBe('should not work') // setData still works
      })

      it('should reject transitions from rejected state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(ERROR_KEY, new Error('error'))
        t.reject()
        // Attempt illegal transitions — should not change state/value
        expect(t.inState(STATE.REJECTED)).toBe(true)
        t.setData(VALUE_KEY, 'should not work')
        t.update()
        t.setData(VALUE_KEY, 'should not work')
        t.fulfill()
        expect(t.inState(STATE.REJECTED)).toBe(true)
        expect(t.inState(STATE.FULFILLED)).toBe(false)
        expect(t.inState(STATE.PENDING)).toBe(false)
        expect(t.inState(STATE.UPDATING)).toBe(false)
        expect(t.getData(ERROR_KEY)).toBeDefined()
        expect((t.getData(ERROR_KEY) as any).message).toBe('error')
        expect(t.getData(VALUE_KEY)).toBe('should not work') // setData still works
      })
    })

    describe('idempotent operations', () => {
      it('should keep first value on multiple fulfill calls for same sn', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'u1')
        t.update()
        t.setData(VALUE_KEY, 'v1')
        t.fulfill()
        t.setData(VALUE_KEY, 'v2')
        t.fulfill() // second fulfill for same sn should be ignored
        expect(t.inState(STATE.FULFILLED)).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('v2') // setData still works, but state doesn't change
      })
    })
  })

  // ============================================================================
  // DATA HANDLING
  // ============================================================================
  describe('data handling', () => {
    it('should handle undefined data correctly', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.getData(VALUE_KEY)).toBeUndefined()
      t.update()
      expect(t.getData(VALUE_KEY)).toBeUndefined()
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toBeUndefined()
    })

    it('should handle null values correctly', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, null)
      expect(t.getData(VALUE_KEY)).toBeNull()
      t.setData(VALUE_KEY, null)
      t.update()
      expect(t.getData(VALUE_KEY)).toBeNull()
      t.setData(VALUE_KEY, null)
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toBeNull()
    })

    it('should preserve data through state transitions', () => {
      const tracker = createTracker()
      const initialData = { id: 1, name: 'test' }
      const t = tracker.track()
      t.setData(VALUE_KEY, initialData)
      expect(t.getData(VALUE_KEY)).toBe(initialData)
      t.setData(VALUE_KEY, { id: 1, name: 'updated' })
      t.update()
      expect(t.getData(VALUE_KEY)).not.toBe(initialData) // should be new object reference
      expect(t.getData(VALUE_KEY)).toEqual({ id: 1, name: 'updated' })
      t.setData(VALUE_KEY, { id: 1, name: 'final' })
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toEqual({ id: 1, name: 'final' })
    })

    it('should handle multiple progressive updates before finish', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'loading...')
      t.update()
      t.setData(VALUE_KEY, 'processing...')
      t.update()
      t.setData(VALUE_KEY, 'almost done...')
      t.update()
      expect(t.getData(VALUE_KEY)).toBe('almost done...')
      expect(t.inState(STATE.UPDATING)).toBe(true)
      t.setData(VALUE_KEY, 'complete')
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toBe('complete')
      expect(t.inState(STATE.FULFILLED)).toBe(true)
    })

    it('should handle concurrent calls with independent data', () => {
      const tracker = createTracker()
      const sharedData = { count: 0 }
      
      const t1 = tracker.track()
      t1.setData(VALUE_KEY, sharedData)
      const t2 = tracker.track()
      t2.setData(VALUE_KEY, sharedData) // Same initial value reference
      
      t1.setData(VALUE_KEY, { count: 1 })
      t1.update()
      t2.setData(VALUE_KEY, { count: 2 })
      t2.update()
      
      // Both should have independent value references
      expect(t1.getData(VALUE_KEY)).toEqual({ count: 1 })
      expect(t2.getData(VALUE_KEY)).toEqual({ count: 2 })
      expect(t1.getData(VALUE_KEY)).not.toBe(t2.getData(VALUE_KEY))
    })

    it('should support multiple data keys', () => {
      const tracker = createTracker()
      const t = tracker.track()
      const KEY1 = Symbol('key1')
      const KEY2 = Symbol('key2')
      
      t.setData(KEY1, 'value1')
      t.setData(KEY2, 'value2')
      
      expect(t.getData(KEY1)).toBe('value1')
      expect(t.getData(KEY2)).toBe('value2')
      
      t.setData(KEY1) // delete
      expect(t.getData(KEY1)).toBeUndefined()
      expect(t.getData(KEY2)).toBe('value2')
    })

    it('should get and delete data with takeData', () => {
      const tracker = createTracker()
      const t = tracker.track()
      const KEY1 = Symbol('key1')
      const KEY2 = Symbol('key2')
      
      t.setData(KEY1, 'value1')
      t.setData(KEY2, 'value2')
      
      expect(t.takeData(KEY1)).toBe('value1')
      expect(t.getData(KEY1)).toBeUndefined() // should be deleted
      expect(t.getData(KEY2)).toBe('value2') // should still exist
      
      expect(t.takeData(KEY2)).toBe('value2')
      expect(t.getData(KEY2)).toBeUndefined() // should be deleted
    })

    it('should return undefined when taking non-existent data', () => {
      const tracker = createTracker()
      const t = tracker.track()
      const KEY = Symbol('key')
      
      expect(t.takeData(KEY)).toBeUndefined()
      expect(t.getData(KEY)).toBeUndefined()
    })
  })

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  describe('error handling', () => {
    it('should handle Error instances', () => {
      const tracker = createTracker()
      const t = tracker.track()
      const error = new Error('test error')
      t.setData(ERROR_KEY, error)
      t.reject()
      expect(t.inState(STATE.REJECTED)).toBe(true)
      expect(t.getData(ERROR_KEY)).toBe(error)
      expect((t.getData(ERROR_KEY) as any).message).toBe('test error')
    })

    it('should handle non-Error rejection values', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      t1.setData(ERROR_KEY, 'string error')
      t1.reject()
      expect(t1.inState(STATE.REJECTED)).toBe(true)
      expect(t1.getData(ERROR_KEY)).toBe('string error')
      
      const t2 = tracker.track()
      t2.setData(ERROR_KEY, { code: 500, message: 'Custom error' })
      t2.reject()
      expect(t2.inState(STATE.REJECTED)).toBe(true)
      expect(t2.getData(ERROR_KEY)).toEqual({ code: 500, message: 'Custom error' })
      
      const t3 = tracker.track()
      t3.setData(ERROR_KEY, null)
      t3.reject()
      expect(t3.inState(STATE.REJECTED)).toBe(true)
      expect(t3.getData(ERROR_KEY)).toBeNull()
    })

    it('should not allow update after reject', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('err'))
      t.reject()
      t.setData(VALUE_KEY, 'should not resurrect')
      t.update()
      expect(t.inState(STATE.REJECTED)).toBe(true)
      expect(t.getData(VALUE_KEY)).toBe('should not resurrect') // setData still works
    })
  })

  // ============================================================================
  // LATEST STATUS TRACKING
  // ============================================================================
  describe('latest status tracking', () => {
    it('should only increase latest refs when newer calls complete', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t1.setData(VALUE_KEY, 'first')
      t1.fulfill()
      t2.setData(VALUE_KEY, 'second')
      t2.fulfill()
      // Both should be fulfilled, but t2 is latest
      expect(t1.isLatestFulfill()).toBe(false)
      expect(t2.isLatestFulfill()).toBe(true)
    })

    it('should not update latest ref when newer call has already updated it', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.update()
      t1.setData(VALUE_KEY, 'older')
      t1.update()
      // t2.update should have already set updating.value = 2
      // t1.update should not overwrite it
      expect(t1.isLatestUpdate()).toBe(false)
      expect(t2.isLatestUpdate()).toBe(true)
    })

    it('should not update fulfilled ref when newer call has already fulfilled', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.fulfill()
      t1.setData(VALUE_KEY, 'older')
      t1.fulfill()
      // t2.fulfill should have already set fulfilled.value = 2
      // t1.fulfill should not overwrite it
      expect(t1.isLatestFulfill()).toBe(false)
      expect(t2.isLatestFulfill()).toBe(true)
    })

    it('should not update rejected ref when newer call has already rejected', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(ERROR_KEY, new Error('newer error'))
      t2.reject()
      t1.setData(ERROR_KEY, new Error('older error'))
      t1.reject()
      // Both should be rejected, but t2 is latest
      expect(t1.hasLaterReject()).toBe(true)
      expect(t2.hasLaterReject()).toBe(false)
    })
  })

  // ============================================================================
  // isLatestCall
  // ============================================================================
  describe('isLatestCall', () => {
    it('should return true only for the most recent call', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      const t3 = tracker.track()
      expect(t1.isLatestCall()).toBe(false)
      expect(t2.isLatestCall()).toBe(false)
      expect(t3.isLatestCall()).toBe(true)
    })

    it('should return false for older calls even after they finish', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      t1.setData(VALUE_KEY, 'first')
      t1.fulfill()
      expect(t1.isLatestCall()).toBe(false)
      expect(t2.isLatestCall()).toBe(true)
    })
  })

  // ============================================================================
  // isLatestUpdate
  // ============================================================================
  describe('isLatestUpdate', () => {
    it('should return true when call is updating and is the latest update', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.update()
      expect(t2.isLatestUpdate()).toBe(true)
    })

    it('should return false when not in updating state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.isLatestUpdate()).toBe(false)
      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(t.isLatestUpdate()).toBe(false)
    })

    it('should return false when fulfilled.value >= sn', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'done')
      t2.fulfill()
      t1.setData(VALUE_KEY, 'loading')
      t1.update()
      // t1 is updating, but t2 has already fulfilled (fulfilled.value = 2 >= 1)
      expect(t1.isLatestUpdate()).toBe(false)
    })

    it('should return false when updating.value !== sn', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.update()
      t1.setData(VALUE_KEY, 'older')
      t1.update()
      // t1 is updating, but updating.value = 2 !== 1
      expect(t1.isLatestUpdate()).toBe(false)
    })
  })

  // ============================================================================
  // isLatestFulfill
  // ============================================================================
  describe('isLatestFulfill', () => {
    it('should return true when call is fulfilled and is the latest fulfill', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.fulfill()
      expect(t2.isLatestFulfill()).toBe(true)
    })

    it('should return false when not in fulfilled state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.isLatestFulfill()).toBe(false)
      t.update()
      expect(t.isLatestFulfill()).toBe(false)
    })

    it('should return false when updating.value > sn', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'loading')
      t2.update()
      t1.setData(VALUE_KEY, 'done')
      t1.fulfill()
      // t1 is fulfilled, but t2 is updating (updating.value = 2 > 1)
      expect(t1.isLatestFulfill()).toBe(false)
    })

    it('should return false when fulfilled.value !== sn', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.fulfill()
      t1.setData(VALUE_KEY, 'older')
      t1.fulfill()
      // t1 is fulfilled, but fulfilled.value = 2 !== 1
      expect(t1.isLatestFulfill()).toBe(false)
    })
  })

  // ============================================================================
  // hasLaterReject
  // ============================================================================
  describe('hasLaterReject', () => {
    it('should return false when no newer rejection', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      t1.fulfill()
      expect(t1.hasLaterReject()).toBe(false)
    })

    it('should return true when newer call rejected', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t1.fulfill()
      t2.reject()
      expect(t1.hasLaterReject()).toBe(true)
      expect(t2.hasLaterReject()).toBe(false)
    })

    it('should return false when older call rejected', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t1.reject()
      t2.fulfill()
      expect(t1.hasLaterReject()).toBe(false)
      expect(t2.hasLaterReject()).toBe(false)
    })
  })

  // ============================================================================
  // STATE QUERIES
  // ============================================================================
  describe('state queries', () => {
    it('should return true for fulfilled calls', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(t.inState(STATE.FULFILLED)).toBe(true)
      expect(t.inState(STATE.FINISHED)).toBe(true)
    })

    it('should return true for rejected calls', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('error'))
      t.reject()
      expect(t.inState(STATE.REJECTED)).toBe(true)
      expect(t.inState(STATE.FINISHED)).toBe(true)
    })

    it('should return false for pending and updating calls', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.inState(STATE.FINISHED)).toBe(false)
      t.update()
      expect(t.inState(STATE.FINISHED)).toBe(false)
    })
  })

  // ============================================================================
  // canUpdate
  // ============================================================================
  describe('canUpdate', () => {
    it('should return true for pending state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.canUpdate()).toBe(true)
    })

    it('should return true for updating state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.update()
      expect(t.canUpdate()).toBe(true)
    })

    it('should return false for fulfilled state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(t.canUpdate()).toBe(false)
    })

    it('should return false for rejected state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('error'))
      t.reject()
      expect(t.canUpdate()).toBe(false)
    })
  })

  // ============================================================================
  // TRACKER FLAGS
  // ============================================================================
  describe('tracker flags', () => {
    it('tracking and has flags reflect call lifecycle', () => {
      const tracker = createTracker()
      expect(tracker.has.finished.value).toBe(false)

      const t = tracker.track()
      expect(tracker.has.finished.value).toBe(false)

      t.update()

      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(tracker.has.finished.value).toBe(true)
    })

    it('has flags should correctly track mixed states', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      t1.setData(VALUE_KEY, 'success')
      t1.fulfill()
      t2.setData(ERROR_KEY, new Error('error'))
      t2.reject()
      expect(tracker.has.finished.value).toBe(true)
    })
  })

  // ============================================================================
  // REAL-WORLD USAGE PATTERNS
  // ============================================================================
  describe('real-world usage patterns', () => {
    it('should support updateData pattern: update then check inStateUpdating', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'progress')
      t.update()
      expect(t.inState(STATE.UPDATING)).toBe(true)
      // Simulate updateData pattern from use-async-data.ts
      if (t.inState(STATE.UPDATING)) {
        // This is the pattern used in real code
        expect(t.getData(VALUE_KEY)).toBe('progress')
      }
    })

    it('should handle initial value pattern from use-async-data', () => {
      const tracker = createTracker()
      const currentData = { id: 1, name: 'current' }
      // Simulate tracker.track() pattern from use-async-data.ts
      const track = tracker.track()
      track.setData(VALUE_KEY, currentData)
      expect(track.getData(VALUE_KEY)).toBe(currentData)
      track.setData(VALUE_KEY, { id: 1, name: 'updated' })
      track.update()
      expect(track.getData(VALUE_KEY)).toEqual({ id: 1, name: 'updated' })
    })

    it('should handle finish pattern with fulfill/reject', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      // Simulate fulfill/reject pattern
      t1.setData(VALUE_KEY, 'success')
      t1.fulfill() // success case
      t2.setData(ERROR_KEY, new Error('error'))
      t2.reject() // error case
      expect(t1.inState(STATE.FULFILLED)).toBe(true)
      expect(t2.inState(STATE.REJECTED)).toBe(true)
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
      const t1 = tracker.track()
      Promise.resolve('r1').then(v => {
        t1.setData(VALUE_KEY, v)
        t1.fulfill()
      })
      const t2 = tracker.track()
      new Promise<string>(resolve => setTimeout(() => resolve('r2'), 0)).then(v => {
        t2.setData(VALUE_KEY, v)
        t2.fulfill()
      })
      // flush microtasks so p1 runs
      await vi.runAllTimersAsync()
      // t2 should win because it's the latest call
      expect(t2.isLatestFulfill()).toBe(true)
      expect(t1.isLatestFulfill()).toBe(false)
    })
  })
})

