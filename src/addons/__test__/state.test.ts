// addons.state.test.ts
import { withFunctionMonitor } from '../../core/monitor'
import { useStateLoading } from '../loading'
import { useStateParameters } from '../arguments'
import { useStateError } from '../error'
import { useStateData } from '../data'
import { describe, expect, it, vi, afterEach } from 'vitest'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useStateXxx', () => {
  afterEach(() => vi.useRealTimers())

  describe('useStateLoading', () => {
    it('should return reactive loading state', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = useStateLoading(monitor)

      expect(loading.value).toBe(false)
      run()
      expect(loading.value).toBe(false) // Sync function completes immediately
    })

    it('should set loading to true when async function is called', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async () => {
        await wait(100)
        return 1
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = useStateLoading(monitor)

      expect(loading.value).toBe(false)
      const promise = run()
      expect(loading.value).toBe(true)

      await vi.runAllTimersAsync()
      await promise
      expect(loading.value).toBe(false)
    })

    it('should only update loading for latest call', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await wait(id === 1 ? 200 : 50)
        return id
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = useStateLoading(monitor)

      run(1) // Slow call
      run(2) // Fast call
      expect(loading.value).toBe(true)

      await vi.advanceTimersByTimeAsync(50) // Fast call completes
      expect(loading.value).toBe(false) // Latest call completed

      await vi.runAllTimersAsync()
      expect(loading.value).toBe(false) // Still false
    })

    it('should set loading to false on error', () => {
      const error = new Error('test')
      const fn = vi.fn(() => {
        throw error
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = useStateLoading(monitor)

      expect(() => run()).toThrow()
      expect(loading.value).toBe(false)
    })
  })

  describe('useStateParameters', () => {
    it('should return reactive parameters state', () => {
      const fn = vi.fn((a: number, b: number) => a + b)
      const { run, monitor } = withFunctionMonitor(fn)
      const { parameters, parameterFirst } = useStateParameters(monitor)

      expect(parameters.value).toBeUndefined()
      expect(parameterFirst.value).toBeUndefined()

      run(1, 2)
      // Sync function completes immediately, so parameters are cleared
      expect(parameters.value).toBeUndefined()
    })

    it('should track parameters during async execution', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (a: number, b: number) => {
        await wait(100)
        return a + b
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const { parameters, parameterFirst } = useStateParameters(monitor)

      const promise = run(1, 2)
      expect(parameters.value).toEqual([1, 2])
      expect(parameterFirst.value).toBe(1)

      await vi.runAllTimersAsync()
      await promise
      expect(parameters.value).toBeUndefined()
      expect(parameterFirst.value).toBeUndefined()
    })

    it('should only update parameters for latest call', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await wait(id === 1 ? 200 : 50)
        return id
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const { parameters } = useStateParameters(monitor)

      run(1) // Slow call
      expect(parameters.value).toEqual([1])

      run(2) // Fast call - should update immediately
      expect(parameters.value).toEqual([2])

      await vi.advanceTimersByTimeAsync(50) // Fast call completes
      expect(parameters.value).toBeUndefined() // Cleared after latest call completes

      await vi.runAllTimersAsync()
      expect(parameters.value).toBeUndefined() // Still undefined
    })

    it('should handle functions with no arguments', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const { parameters } = useStateParameters(monitor)

      run()
      expect(parameters.value).toBeUndefined() // Sync completes immediately
    })
  })

  describe('useStateError', () => {
    it('should return reactive error state', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      expect(error.value).toBeUndefined()
      run()
      expect(error.value).toBeUndefined()
    })

    it('should set error on sync error', () => {
      const testError = new Error('sync error')
      const fn = vi.fn(() => {
        throw testError
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      expect(() => run()).toThrow()
      expect(error.value).toBe(testError)
    })

    it('should set error on async error', async () => {
      vi.useFakeTimers()
      const testError = new Error('async error')
      const fn = vi.fn(async () => {
        await wait(100)
        throw testError
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      const promise = run()
      expect(error.value).toBeUndefined() // Cleared on before

      await vi.runAllTimersAsync()
      await expect(promise).rejects.toBe(testError)
      expect(error.value).toBe(testError)
    })

    it('should clear error on new call', async () => {
      vi.useFakeTimers()
      const error1 = new Error('error1')
      const error2 = new Error('error2')
      const fn = vi.fn(async (id: number) => {
        await wait(50)
        throw id === 1 ? error1 : error2
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      const p1 = run(1)
      await vi.runAllTimersAsync()
      await expect(p1).rejects.toBe(error1)
      expect(error.value).toBe(error1)

      const p2 = run(2)
      expect(error.value).toBeUndefined() // Cleared on new call

      await vi.runAllTimersAsync()
      await expect(p2).rejects.toBe(error2)
      expect(error.value).toBe(error2)
    })

    it('should only update error for latest call', async () => {
      vi.useFakeTimers()
      const error1 = new Error('error1')
      const error2 = new Error('error2')
      const fn = vi.fn(async (id: number) => {
        await wait(id === 1 ? 200 : 50)
        throw id === 1 ? error1 : error2
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      const p1 = run(1) // Slow call
      const p2 = run(2) // Fast call
      expect(error.value).toBeUndefined() // Cleared on new call

      await vi.advanceTimersByTimeAsync(50) // Fast call completes
      await expect(p2).rejects.toBe(error2)
      expect(error.value).toBe(error2) // Latest call's error

      await vi.runAllTimersAsync()
      await expect(p1).rejects.toBe(error1)
      expect(error.value).toBe(error2) // Still latest call's error (not error1)
    })

    it('should handle non-Error rejections', () => {
      const testError = 'string error'
      const fn = vi.fn(() => {
        throw testError
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const error = useStateError(monitor)

      expect(() => run()).toThrow()
      expect(error.value).toBe(testError)
    })
  })

  describe('Integration', () => {
    it('should work together for complete state management', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await wait(100)
        if (id === 0) throw new Error('error')
        return id
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = useStateLoading(monitor)
      const { parameters, parameterFirst } = useStateParameters(monitor)
      const error = useStateError(monitor)

      // Successful call
      const p1 = run(1)
      expect(loading.value).toBe(true)
      expect(parameters.value).toEqual([1])
      expect(parameterFirst.value).toBe(1)
      expect(error.value).toBeUndefined()

      await vi.runAllTimersAsync()
      await p1
      expect(loading.value).toBe(false)
      expect(parameters.value).toBeUndefined()
      expect(error.value).toBeUndefined()

      // Error call
      const p2 = run(0)
      expect(loading.value).toBe(true)
      expect(parameters.value).toEqual([0])
      expect(error.value).toBeUndefined() // Cleared on new call

      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow()
      expect(loading.value).toBe(false)
      expect(parameters.value).toBeUndefined()
      expect(error.value).toBeDefined()
    })
  })

  describe('useStateData', () => {
    it('should work with undefined options', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const { data, dataExpired } = useStateData(monitor)
      
      expect(data.value).toBeUndefined()
      expect(dataExpired.value).toBe(false)
      
      run()
      expect(data.value).toBe(1)
      expect(dataExpired.value).toBe(false)
    })

    it('should work with initialData', () => {
      const fn = vi.fn(() => 2)
      const { run, monitor } = withFunctionMonitor(fn)
      const { data, dataExpired } = useStateData(monitor, { initialData: 0 })
      
      expect(data.value).toBe(0)
      expect(dataExpired.value).toBe(false)
      
      run()
      expect(data.value).toBe(2)
      expect(dataExpired.value).toBe(false)
    })

    it('should work with enhanceFirstArgument enabled', () => {
      const fn = vi.fn((arg: any) => {
        // When enhanceFirstArgument is true, first arg should be enhanced
        expect(arg).toHaveProperty('__va_fae')
        expect(arg).toHaveProperty('getData')
        expect(arg).toHaveProperty('updateData')
        expect(arg.firstArgument).toBe(42)
        return 1
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const { data } = useStateData(monitor, { enhanceFirstArgument: true })
      
      // This should trigger the enhance-arguments interceptor
      const result = run(42)
      expect(result).toBe(1)
      expect(data.value).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should track data updates and expired state', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await wait(100)
        return id
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const { data, dataExpired } = useStateData(monitor, { initialData: 0 })
      
      expect(data.value).toBe(0)
      expect(dataExpired.value).toBe(false)
      
      const p1 = run(1)
      await vi.runAllTimersAsync()
      await p1
      
      expect(data.value).toBe(1)
      expect(dataExpired.value).toBe(false)
      
      const p2 = run(2)
      await vi.runAllTimersAsync()
      await p2
      
      expect(data.value).toBe(2)
      expect(dataExpired.value).toBe(false)
    })
  })
})

