// core.tracker.test.ts
import { createTracker } from '@/core/tracker'
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
      it('should allow pending → rejected', () => {
        const tracker = createTracker()
        const t = tracker.track()
        const error = new Error('fail')
        t.setData(ERROR_KEY, error)
        t.reject()
        expect(t.is('rejected')).toBe(true)
      })

      it('should allow pending → fulfilled (direct)', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'done')
        t.fulfill()
        expect(t.is('fulfilled')).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('done')
      })
    })

    describe('invalid transitions', () => {
      it('should reject transitions from fulfilled state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'done')
        t.fulfill()
        // Attempt illegal transitions — should not change state/value
        expect(t.is('fulfilled')).toBe(true)
        t.setData(VALUE_KEY, 'should not work')
        t.setData(ERROR_KEY, new Error('should not work'))
        t.reject()
        expect(t.is('fulfilled')).toBe(true)
        expect(t.is('pending')).toBe(false)
        expect(t.is('rejected')).toBe(false)
        expect(t.getData(VALUE_KEY)).toBe('should not work') // setData still works
      })

      it('should reject transitions from rejected state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(ERROR_KEY, new Error('error'))
        t.reject()
        // Attempt illegal transitions — should not change state/value
        expect(t.is('rejected')).toBe(true)
        t.setData(VALUE_KEY, 'should not work')
        t.fulfill()
        expect(t.is('rejected')).toBe(true)
        expect(t.is('fulfilled')).toBe(false)
        expect(t.is('pending')).toBe(false)
        expect(t.getData(ERROR_KEY)).toBeDefined()
        expect((t.getData(ERROR_KEY) as any).message).toBe('error')
        expect(t.getData(VALUE_KEY)).toBe('should not work') // setData still works
      })
    })

    describe('idempotent operations', () => {
      it('should ignore multiple fulfill calls for same sn', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(VALUE_KEY, 'v1')
        t.fulfill()
        t.setData(VALUE_KEY, 'v2')
        t.fulfill() // second fulfill for same sn should be ignored
        expect(t.is('fulfilled')).toBe(true)
        expect(t.getData(VALUE_KEY)).toBe('v2') // setData still works, but state doesn't change
      })

      it('should ignore multiple reject calls for same sn', () => {
        const tracker = createTracker()
        const t = tracker.track()
        t.setData(ERROR_KEY, 'error1')
        t.reject()
        t.setData(ERROR_KEY, 'error2')
        t.reject() // second reject for same sn should be ignored
        expect(t.is('rejected')).toBe(true)
        expect(t.getData(ERROR_KEY)).toBe('error2') // setData still works, but state doesn't change
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
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toBeUndefined()
    })

    it('should handle null values correctly', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, null)
      expect(t.getData(VALUE_KEY)).toBeNull()
      t.setData(VALUE_KEY, null)
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toBeNull()
    })

    it('should handle deleting data with undefined value', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'value')
      expect(t.getData(VALUE_KEY)).toBe('value')
      t.setData(VALUE_KEY) // delete by passing undefined
      expect(t.getData(VALUE_KEY)).toBeUndefined()
    })

    it('should preserve data through state transitions', () => {
      const tracker = createTracker()
      const initialData = { id: 1, name: 'test' }
      const t = tracker.track()
      t.setData(VALUE_KEY, initialData)
      expect(t.getData(VALUE_KEY)).toBe(initialData)
      t.setData(VALUE_KEY, { id: 1, name: 'updated' })
      expect(t.getData(VALUE_KEY)).not.toBe(initialData) // should be new object reference
      expect(t.getData(VALUE_KEY)).toEqual({ id: 1, name: 'updated' })
      t.setData(VALUE_KEY, { id: 1, name: 'final' })
      t.fulfill()
      expect(t.getData(VALUE_KEY)).toEqual({ id: 1, name: 'final' })
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
      expect(t.is('rejected')).toBe(true)
      expect(t.getData(ERROR_KEY)).toBe(error)
      expect((t.getData(ERROR_KEY) as any).message).toBe('test error')
    })

    it('should handle non-Error rejection values', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      t1.setData(ERROR_KEY, 'string error')
      t1.reject()
      expect(t1.is('rejected')).toBe(true)
      expect(t1.getData(ERROR_KEY)).toBe('string error')
      
      const t2 = tracker.track()
      t2.setData(ERROR_KEY, { code: 500, message: 'Custom error' })
      t2.reject()
      expect(t2.is('rejected')).toBe(true)
      expect(t2.getData(ERROR_KEY)).toEqual({ code: 500, message: 'Custom error' })
      
      const t3 = tracker.track()
      t3.setData(ERROR_KEY, null)
      t3.reject()
      expect(t3.is('rejected')).toBe(true)
      expect(t3.getData(ERROR_KEY)).toBeNull()
    })

    it('should not allow fulfill after reject', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('err'))
      t.reject()
      t.setData(VALUE_KEY, 'should not resurrect')
      t.fulfill()
      expect(t.is('rejected')).toBe(true)
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
      expect(t1.isLatest('fulfilled')).toBe(false)
      expect(t2.isLatest('fulfilled')).toBe(true)
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
      expect(t1.isLatest('fulfilled')).toBe(false)
      expect(t2.isLatest('fulfilled')).toBe(true)
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
      expect(t1.hasLater('rejected')).toBe(true)
      expect(t2.hasLater('rejected')).toBe(false)
    })
  })

  // ============================================================================
  // isLatest
  // ============================================================================
  describe('isLatest', () => {
    it('should return true only for the most recent pending call', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      const t3 = tracker.track()
      expect(t1.isLatest()).toBe(false)
      expect(t2.isLatest()).toBe(false)
      expect(t3.isLatest()).toBe(true)
    })

    it('should return false for older calls even after they finish', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      t1.setData(VALUE_KEY, 'first')
      t1.fulfill()
      expect(t1.isLatest()).toBe(false)
      expect(t2.isLatest()).toBe(true)
    })

    it('should work with explicit pending state', () => {
      const tracker = createTracker()
      const t1 = tracker.track()
      const t2 = tracker.track()
      expect(t1.isLatest('pending')).toBe(false)
      expect(t2.isLatest('pending')).toBe(true)
    })
  })

  // ============================================================================
  // isLatest with state
  // ============================================================================
  describe('isLatest with state', () => {
    describe('isLatest(fulfilled)', () => {
      it('should return true when call is fulfilled and is the latest fulfill', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t2.setData(VALUE_KEY, 'newer')
        t2.fulfill()
        expect(t2.isLatest('fulfilled')).toBe(true)
        expect(t1.isLatest('fulfilled')).toBe(false)
      })

      it('should return false when not in fulfilled state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        expect(t.isLatest('fulfilled')).toBe(false)
        t.reject()
        expect(t.isLatest('fulfilled')).toBe(false)
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
        expect(t1.isLatest('fulfilled')).toBe(false)
        expect(t2.isLatest('fulfilled')).toBe(true)
      })
    })

    describe('isLatest(rejected)', () => {
      it('should return true when call is rejected and is the latest reject', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t2.setData(ERROR_KEY, 'newer error')
        t2.reject()
        expect(t2.isLatest('rejected')).toBe(true)
        expect(t1.isLatest('rejected')).toBe(false)
      })

      it('should return false when not in rejected state', () => {
        const tracker = createTracker()
        const t = tracker.track()
        expect(t.isLatest('rejected')).toBe(false)
        t.fulfill()
        expect(t.isLatest('rejected')).toBe(false)
      })

      it('should return false when rejected.value !== sn', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t2.setData(ERROR_KEY, 'newer error')
        t2.reject()
        t1.setData(ERROR_KEY, 'older error')
        t1.reject()
        expect(t1.isLatest('rejected')).toBe(false)
        expect(t2.isLatest('rejected')).toBe(true)
      })
    })
  })

  // ============================================================================
  // hasLater
  // ============================================================================
  describe('hasLater', () => {
    describe('hasLater(rejected)', () => {
      it('should return false when no newer rejection', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        t1.fulfill()
        expect(t1.hasLater('rejected')).toBe(false)
      })

      it('should return true when newer call rejected', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.fulfill()
        t2.reject()
        expect(t1.hasLater('rejected')).toBe(true)
        expect(t2.hasLater('rejected')).toBe(false)
      })

      it('should return false when older call rejected', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.reject()
        t2.fulfill()
        expect(t1.hasLater('rejected')).toBe(false)
        expect(t2.hasLater('rejected')).toBe(false)
      })
    })

    describe('hasLater(fulfilled)', () => {
      it('should return true when newer call fulfilled', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.reject()
        t2.fulfill()
        expect(t1.hasLater('fulfilled')).toBe(true)
        expect(t2.hasLater('fulfilled')).toBe(false)
      })

      it('should return false when no newer fulfillment', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.fulfill()
        t2.reject()
        expect(t1.hasLater('fulfilled')).toBe(false)
        expect(t2.hasLater('fulfilled')).toBe(false)
      })
    })

    describe('hasLater(pending)', () => {
      it('should return true when newer call exists', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        expect(t1.hasLater('pending')).toBe(true)
        expect(t2.hasLater('pending')).toBe(false)
      })

      it('should return false when no newer call', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        expect(t1.hasLater('pending')).toBe(false)
      })
    })

    describe('hasLater(finished)', () => {
      it('should return true when newer call has finished (fulfilled)', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.reject()
        t2.fulfill()
        // finished = max(fulfilled=2, rejected=1) = 2 > 1
        expect(t1.hasLater('finished')).toBe(true)
        expect(t2.hasLater('finished')).toBe(false)
      })

      it('should return true when newer call has finished (rejected)', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        t1.fulfill()
        t2.reject()
        // finished = max(fulfilled=1, rejected=2) = 2 > 1
        expect(t1.hasLater('finished')).toBe(true)
        expect(t2.hasLater('finished')).toBe(false)
      })

      it('should return true when newer call has finished (both fulfilled and rejected)', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        const t2 = tracker.track() // sn=2
        const t3 = tracker.track() // sn=3
        t1.fulfill()
        t2.reject()
        t3.fulfill()
        // finished = max(fulfilled=3, rejected=2) = 3 > 1
        expect(t1.hasLater('finished')).toBe(true)
        expect(t2.hasLater('finished')).toBe(true)
        expect(t3.hasLater('finished')).toBe(false)
      })

      it('should return false when no newer call has finished', () => {
        const tracker = createTracker()
        const t1 = tracker.track() // sn=1
        expect(t1.hasLater('finished')).toBe(false)
      })
    })
  })

  // ============================================================================
  // STATE QUERIES
  // ============================================================================
  describe('state queries', () => {
    it('should return true for pending state', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.is('pending')).toBe(true)
      expect(t.is('fulfilled')).toBe(false)
      expect(t.is('rejected')).toBe(false)
      expect(t.is('finished')).toBe(false)
    })

    it('should return true for fulfilled calls', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(t.is('fulfilled')).toBe(true)
      expect(t.is('finished')).toBe(true)
      expect(t.is('pending')).toBe(false)
      expect(t.is('rejected')).toBe(false)
    })

    it('should return true for rejected calls', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('error'))
      t.reject()
      expect(t.is('rejected')).toBe(true)
      expect(t.is('finished')).toBe(true)
      expect(t.is('pending')).toBe(false)
      expect(t.is('fulfilled')).toBe(false)
    })

    it('should return false for finished when pending', () => {
      const tracker = createTracker()
      const t = tracker.track()
      expect(t.is('finished')).toBe(false)
    })
  })

  // ============================================================================
  // TRACKER FLAGS
  // ============================================================================
  describe('tracker flags', () => {
    it('should return false when no calls have finished', () => {
      const tracker = createTracker()
      expect(tracker.has.finished.value).toBe(false)

      const t = tracker.track()
      expect(tracker.has.finished.value).toBe(false)
    })

    it('should return true when any call has fulfilled', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(VALUE_KEY, 'done')
      t.fulfill()
      expect(tracker.has.finished.value).toBe(true)
    })

    it('should return true when any call has rejected', () => {
      const tracker = createTracker()
      const t = tracker.track()
      t.setData(ERROR_KEY, new Error('error'))
      t.reject()
      expect(tracker.has.finished.value).toBe(true)
    })

    it('should return true when calls have mixed states', () => {
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
  // RACE CONDITION HANDLING
  // ============================================================================
  describe('race condition handling', () => {
    it('should handle later promise wins scenario', async () => {
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
      expect(t2.isLatest('fulfilled')).toBe(true)
      expect(t1.isLatest('fulfilled')).toBe(false)
    })

    it('should prevent older fulfilled call from overwriting newer one', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(VALUE_KEY, 'newer')
      t2.fulfill()
      t1.setData(VALUE_KEY, 'older')
      t1.fulfill()
      // t2 should remain latest
      expect(t1.isLatest('fulfilled')).toBe(false)
      expect(t2.isLatest('fulfilled')).toBe(true)
    })

    it('should prevent older rejected call from overwriting newer one', () => {
      const tracker = createTracker()
      const t1 = tracker.track() // sn=1
      const t2 = tracker.track() // sn=2
      t2.setData(ERROR_KEY, 'newer error')
      t2.reject()
      t1.setData(ERROR_KEY, 'older error')
      t1.reject()
      // t2 should remain latest
      expect(t1.isLatest('rejected')).toBe(false)
      expect(t2.isLatest('rejected')).toBe(true)
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
      expect(t2.isLatest('fulfilled')).toBe(true)
      expect(t1.isLatest('fulfilled')).toBe(false)
    })
  })
})

