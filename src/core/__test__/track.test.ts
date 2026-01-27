// core.monitor.track.test.ts
import { createTrack } from '@/core/monitor/track'
import { createTracker } from '@/core/monitor/tracker'
import { createInternalFunctionMonitor } from '@/core/monitor/core'
import { RUN_ARGUMENTS, RUN_ERROR, RUN_LOADING, RUN_DATA, RUN_DATA_UPDATED } from '@/core/monitor/constants'
import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('createTrack', () => {
  let monitor: ReturnType<typeof createInternalFunctionMonitor>
  let tracker: ReturnType<typeof createTracker>

  beforeEach(() => {
    monitor = createInternalFunctionMonitor()
    tracker = createTracker()
  })

  describe('read-only key protection', () => {
    it('should prevent setting RUN_ARGUMENTS', () => {
      const { track } = createTrack(monitor, tracker)
      const originalValue = track.getData(RUN_ARGUMENTS)
      
      track.setData(RUN_ARGUMENTS, 'test')
      
      // Should not change the value
      expect(track.getData(RUN_ARGUMENTS)).toBe(originalValue)
    })

    it('should prevent setting RUN_ERROR', () => {
      const { track } = createTrack(monitor, tracker)
      const originalValue = track.getData(RUN_ERROR)
      
      track.setData(RUN_ERROR, 'test error')
      
      // Should not change the value
      expect(track.getData(RUN_ERROR)).toBe(originalValue)
    })

    it('should prevent setting RUN_LOADING', () => {
      const { track } = createTrack(monitor, tracker)
      const originalValue = track.getData(RUN_LOADING)
      
      track.setData(RUN_LOADING, true)
      
      // Should not change the value
      expect(track.getData(RUN_LOADING)).toBe(originalValue)
    })

    it('should prevent setting RUN_DATA_UPDATED', () => {
      const { track } = createTrack(monitor, tracker)
      const originalValue = track.getData(RUN_DATA_UPDATED)
      
      track.setData(RUN_DATA_UPDATED, true)
      
      // Should not change the value
      expect(track.getData(RUN_DATA_UPDATED)).toBe(originalValue)
    })
  })

  describe('RUN_DATA write restrictions', () => {
    it('should allow setting RUN_DATA in pending state', () => {
      const { track } = createTrack(monitor, tracker)
      
      expect(track.is('pending')).toBe(true)
      track.setData(RUN_DATA, 'test data')
      
      expect(track.getData(RUN_DATA)).toBe('test data')
    })

    it('should prevent setting RUN_DATA in fulfilled state', () => {
      const { track, fulfill } = createTrack(monitor, tracker)
      
      fulfill()
      expect(track.is('fulfilled')).toBe(true)
      
      const originalValue = track.getData(RUN_DATA)
      track.setData(RUN_DATA, 'should not work')
      
      // Should not change the value
      expect(track.getData(RUN_DATA)).toBe(originalValue)
    })

    it('should prevent setting RUN_DATA in rejected state', () => {
      const { track, reject } = createTrack(monitor, tracker)
      
      reject()
      expect(track.is('rejected')).toBe(true)
      
      const originalValue = track.getData(RUN_DATA)
      track.setData(RUN_DATA, 'should not work')
      
      // Should not change the value
      expect(track.getData(RUN_DATA)).toBe(originalValue)
    })
  })

  describe('allowed operations', () => {
    it('should allow setting custom keys', () => {
      const { track } = createTrack(monitor, tracker)
      const CUSTOM_KEY = Symbol('custom')
      
      track.setData(CUSTOM_KEY, 'custom value')
      expect(track.getData(CUSTOM_KEY)).toBe('custom value')
    })

    it('should allow setting RUN_DATA in pending state after init', () => {
      const { track, init } = createTrack(monitor, tracker)
      
      init()
      track.setData(RUN_DATA, 'test data')
      
      expect(track.getData(RUN_DATA)).toBe('test data')
    })
  })

  describe('takeData with read-only keys', () => {
    it('should not allow taking RUN_ARGUMENTS', () => {
      const { track, setData } = createTrack(monitor, tracker)
      
      // Set value using internal setData (bypasses permission check)
      setData(RUN_ARGUMENTS, 'test args')
      expect(track.getData(RUN_ARGUMENTS)).toBe('test args')
      
      // takeData should not be able to delete it
      const value = track.takeData(RUN_ARGUMENTS)
      expect(value).toBe('test args')
      // But the value should still be there because takeData uses setDataForTrack which checks permissions
      expect(track.getData(RUN_ARGUMENTS)).toBe('test args')
    })

    it('should not allow taking RUN_ERROR', () => {
      const { track, setData } = createTrack(monitor, tracker)
      
      setData(RUN_ERROR, 'test error')
      expect(track.getData(RUN_ERROR)).toBe('test error')
      
      const value = track.takeData(RUN_ERROR)
      expect(value).toBe('test error')
      expect(track.getData(RUN_ERROR)).toBe('test error')
    })

    it('should not allow taking RUN_LOADING', () => {
      const { track, setData } = createTrack(monitor, tracker)
      
      setData(RUN_LOADING, true)
      expect(track.getData(RUN_LOADING)).toBe(true)
      
      const value = track.takeData(RUN_LOADING)
      expect(value).toBe(true)
      expect(track.getData(RUN_LOADING)).toBe(true)
    })

    it('should not allow taking RUN_DATA_UPDATED', () => {
      const { track, setData } = createTrack(monitor, tracker)
      
      setData(RUN_DATA_UPDATED, true)
      expect(track.getData(RUN_DATA_UPDATED)).toBe(true)
      
      const value = track.takeData(RUN_DATA_UPDATED)
      expect(value).toBe(true)
      expect(track.getData(RUN_DATA_UPDATED)).toBe(true)
    })
  })

  describe('takeData with RUN_DATA restrictions', () => {
    it('should not allow taking RUN_DATA in fulfilled state', () => {
      const { track, setData, fulfill } = createTrack(monitor, tracker)
      
      setData(RUN_DATA, 'test data')
      fulfill()
      
      const value = track.takeData(RUN_DATA)
      expect(value).toBe('test data')
      // Value should still be there because takeData uses setDataForTrack which checks permissions
      expect(track.getData(RUN_DATA)).toBe('test data')
    })

    it('should not allow taking RUN_DATA in rejected state', () => {
      const { track, setData, reject } = createTrack(monitor, tracker)
      
      setData(RUN_DATA, 'test data')
      reject()
      
      const value = track.takeData(RUN_DATA)
      expect(value).toBe('test data')
      expect(track.getData(RUN_DATA)).toBe('test data')
    })
  })
})
