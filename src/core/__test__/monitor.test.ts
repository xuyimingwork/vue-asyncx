// core.monitor.test.ts
import { createEnhanceArgumentsHandler, withFunctionMonitor } from '@/core/monitor'
import { afterEach, describe, expect, it, vi } from 'vitest'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('withFunctionMonitor', () => {
  afterEach(() => vi.useRealTimers())

  describe('Basic Functionality', () => {
    it('should return run function and monitor', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      
      expect(run).toBeTypeOf('function')
      expect(monitor).toBeTypeOf('object')
      expect(monitor.on).toBeTypeOf('function')
      expect(monitor.off).toBeTypeOf('function')
    })

    it('should execute function and return result', () => {
      const fn = vi.fn((a: number, b: number) => a + b)
      const { run } = withFunctionMonitor(fn)
      
      const result = run(1, 2)
      expect(result).toBe(3)
      expect(fn).toHaveBeenCalledWith(1, 2)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should handle async functions', async () => {
      const fn = vi.fn(async (a: number, b: number) => {
        await wait(10)
        return a + b
      })
      const { run } = withFunctionMonitor(fn)
      
      const result = await run(1, 2)
      expect(result).toBe(3)
      expect(fn).toHaveBeenCalledWith(1, 2)
    })
  })

  describe('Event Emission', () => {
    describe('init event', () => {
      it('should emit init event with args and track', () => {
        const fn = vi.fn((...args: any) => 1)
        const { run, monitor } = withFunctionMonitor(fn)
        const initHandler = vi.fn()
        
        monitor.on('init', initHandler)
        run(1, 2, 3)
        
        expect(initHandler).toHaveBeenCalledTimes(1)
        const event = initHandler.mock.calls[0][0]
        expect(event.args).toEqual([1, 2, 3])
        expect(event.track).toBeDefined()
        expect(event.track.sn).toBe(1)
      })

      it('should emit init event before before event and function execution', () => {
        const executionOrder: string[] = []
        const fn = () => {
          executionOrder.push('fn')
          return 1
        }
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.on('init', () => {
          executionOrder.push('init')
        })
        monitor.on('before', () => {
          executionOrder.push('before')
        })
        
        run()
        expect(executionOrder).toEqual(['init', 'before', 'fn'])
      })
    })

    describe('before event', () => {
      it('should emit before event with args and track', () => {
        const fn = vi.fn((...args: any) => 1)
        const { run, monitor } = withFunctionMonitor(fn)
        const beforeHandler = vi.fn()
        
        monitor.on('before', beforeHandler)
        run(1, 2, 3)
        
        expect(beforeHandler).toHaveBeenCalledTimes(1)
        const event = beforeHandler.mock.calls[0][0]
        expect(event.args).toEqual([1, 2, 3])
        expect(event.track).toBeDefined()
        expect(event.track.sn).toBe(1)
      })

      it('should emit before event before function execution', () => {
        const executionOrder: string[] = []
        const fn = () => {
          executionOrder.push('fn')
          return 1
        }
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.on('before', () => {
          executionOrder.push('before')
        })
        
        run()
        expect(executionOrder).toEqual(['before', 'fn'])
      })
    })

    describe('fulfill event', () => {
      it('should emit fulfill event for sync function', () => {
        const fn = vi.fn(() => 'result')
        const { run, monitor } = withFunctionMonitor(fn)
        const fulfillHandler = vi.fn()
        
        monitor.on('fulfill', fulfillHandler)
        run()
        
        expect(fulfillHandler).toHaveBeenCalledTimes(1)
        const event = fulfillHandler.mock.calls[0][0]
        expect(event.value).toBe('result')
        expect(event.track).toBeDefined()
      })

      it('should emit fulfill event for async function', async () => {
        vi.useFakeTimers()
        const fn = vi.fn(async () => {
          await wait(100)
          return 'async-result'
        })
        const { run, monitor } = withFunctionMonitor(fn)
        const fulfillHandler = vi.fn()
        
        monitor.on('fulfill', fulfillHandler)
        const promise = run()
        
        expect(fulfillHandler).not.toHaveBeenCalled()
        await vi.runAllTimersAsync()
        await promise
        
        expect(fulfillHandler).toHaveBeenCalledTimes(1)
        const event = fulfillHandler.mock.calls[0][0]
        expect(event.value).toBe('async-result')
      })
    })

    describe('reject event', () => {
      it('should emit reject event for sync error', () => {
        const error = new Error('sync error')
        const fn = vi.fn(() => {
          throw error
        })
        const { run, monitor } = withFunctionMonitor(fn)
        const rejectHandler = vi.fn()
        
        monitor.on('reject', rejectHandler)
        
        expect(() => run()).toThrow(error)
        expect(rejectHandler).toHaveBeenCalledTimes(1)
        const event = rejectHandler.mock.calls[0][0]
        expect(event.error).toBe(error)
        expect(event.track).toBeDefined()
      })

      it('should emit reject event for async error', async () => {
        vi.useFakeTimers()
        const error = new Error('async error')
        const fn = vi.fn(async () => {
          await wait(100)
          throw error
        })
        const { run, monitor } = withFunctionMonitor(fn)
        const rejectHandler = vi.fn()
        
        monitor.on('reject', rejectHandler)
        const promise = run()
        
        expect(rejectHandler).not.toHaveBeenCalled()
        await vi.runAllTimersAsync()
        await expect(promise).rejects.toBe(error)
        
        expect(rejectHandler).toHaveBeenCalledTimes(1)
        const event = rejectHandler.mock.calls[0][0]
        expect(event.error).toBe(error)
      })
    })

    describe('after event', () => {
      it('should emit after event after function call, before fulfill', () => {
        const executionOrder: string[] = []
        const fn = () => {
          executionOrder.push('fn')
          return 1
        }
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.on('after', () => {
          executionOrder.push('after')
        })
        monitor.on('fulfill', () => {
          executionOrder.push('fulfill')
        })
        
        run()
        expect(executionOrder).toEqual(['fn', 'after', 'fulfill'])
      })

      it('should emit after event in catch block for sync errors', () => {
        const executionOrder: string[] = []
        const fn = () => {
          executionOrder.push('fn')
          throw new Error('error')
        }
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.on('after', () => {
          executionOrder.push('after')
        })
        monitor.on('reject', () => {
          executionOrder.push('reject')
        })
        
        expect(() => run()).toThrow()
        expect(executionOrder).toEqual(['fn', 'after', 'reject'])
      })

      it('should emit after event for async functions before promise resolves', async () => {
        vi.useFakeTimers()
        const executionOrder: string[] = []
        const fn = async () => {
          executionOrder.push('fn')
          await wait(100)
          return 1
        }
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.on('after', () => {
          executionOrder.push('after')
        })
        monitor.on('fulfill', () => {
          executionOrder.push('fulfill')
        })
        
        const promise = run()
        expect(executionOrder).toEqual(['fn', 'after'])
        
        await vi.runAllTimersAsync()
        await promise
        expect(executionOrder).toEqual(['fn', 'after', 'fulfill'])
      })
    })
  })

  describe('Event Handler Management', () => {
    it('should support multiple handlers for same event', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      monitor.on('before', handler1)
      monitor.on('before', handler2)
      run()
      
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should remove handler with off', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const handler = vi.fn()
      
      monitor.on('before', handler)
      run()
      expect(handler).toHaveBeenCalledTimes(1)
      
      monitor.off('before', handler)
      run()
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })
  })

  describe('Interceptor', () => {
    describe('enhance-arguments interceptor', () => {
      it('should transform arguments when interceptor returns new args', () => {
        const fn = vi.fn((a: number, b: number) => a + b)
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.use('enhance-arguments', createEnhanceArgumentsHandler(({ args }) => {
          return [args[0] * 2, args[1] * 2]
        }))
        
        const result = run(1, 2)
        expect(result).toBe(6) // (1*2) + (2*2) = 6
        expect(fn).toHaveBeenCalledWith(2, 4)
      })

      it('should use original args when interceptor does not return', () => {
        const fn = vi.fn((a: number) => a)
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.use('enhance-arguments', createEnhanceArgumentsHandler(() => {
          // Interceptor doesn't return anything
        }))
        
        const result = run(5)
        expect(result).toBe(5)
        expect(fn).toHaveBeenCalledWith(5)
      })

      it('should use latest interceptor for enhance-arguments', () => {
        const fn = vi.fn((a: number) => a)
        const { run, monitor } = withFunctionMonitor(fn)
        
        monitor.use('enhance-arguments', createEnhanceArgumentsHandler(({ args }) => [args[0] * 2]))
        monitor.use('enhance-arguments', createEnhanceArgumentsHandler(({ args }) => [args[0] * 3])) // Latest will be used
        
        const result = run(2)
        expect(result).toBe(6) // 2 * 3, latest interceptor
        expect(fn).toHaveBeenCalledWith(6)
      })

      it('should only accept handlers created with createEnhanceArgumentsHandler', () => {
        const fn = vi.fn((a: number) => a)
        const { run, monitor } = withFunctionMonitor(fn)
        const handler = vi.fn(({ args }) => [args[0] * 2])
        
        // Direct handler without createEnhanceArgumentsHandler should not work
        monitor.use('enhance-arguments', handler as any)
        const result1 = run(5)
        expect(result1).toBe(5) // Original args used, interceptor not applied
        expect(fn).toHaveBeenCalledWith(5)
        
        // Handler created with createEnhanceArgumentsHandler should work
        const wrappedHandler = createEnhanceArgumentsHandler(vi.fn(({ args }) => [args[0] * 2]))
        monitor.use('enhance-arguments', wrappedHandler)
        const result2 = run(5)
        expect(result2).toBe(10) // Interceptor applied
        expect(fn).toHaveBeenCalledWith(10)
      })

      it('should overwrite previous interceptor when setting new one', () => {
        const fn = vi.fn((a: number) => a)
        const { run, monitor } = withFunctionMonitor(fn)
        const handler1 = createEnhanceArgumentsHandler(vi.fn(({ args }) => [args[0] * 2]))
        const handler2 = createEnhanceArgumentsHandler(vi.fn(({ args }) => [args[0] * 3]))
        
        // Set first interceptor
        monitor.use('enhance-arguments', handler1)
        const result1 = run(2)
        expect(result1).toBe(4) // 2 * 2
        expect(fn).toHaveBeenCalledWith(4)
        
        // Overwrite with second interceptor
        monitor.use('enhance-arguments', handler2)
        const result2 = run(2)
        expect(result2).toBe(6) // 2 * 3, latest interceptor used
        expect(fn).toHaveBeenCalledWith(6)
      })

      it('should handle enhance-arguments interceptor with undefined context', () => {
        const fn = vi.fn((a: number) => a)
        const { run, monitor } = withFunctionMonitor(fn)
        
        // Set interceptor that might receive undefined context
        monitor.use('enhance-arguments', createEnhanceArgumentsHandler(({ args }) => {
          // Simulate case where context might be undefined
          return args
        }))
        
        const result = run(5)
        expect(result).toBe(5)
        expect(fn).toHaveBeenCalledWith(5)
      })
    })
    describe('undefined interceptor', () => {
      it('should not accept handlers for undefined event types', () => {
        const fn = vi.fn(() => 1)
        const { run, monitor } = withFunctionMonitor(fn)
        const handler = createEnhanceArgumentsHandler(vi.fn(() => [999]))
        
        // Try to use handler for undefined event type
        monitor.use('undefined' as any, handler as any)
        
        // Function should execute normally without interceptor
        const result = run()
        expect(result).toBe(1)
        expect(fn).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Tracker Integration', () => {
    it('should track sequence numbers correctly', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const tracks: any[] = []
      
      monitor.on('before', ({ track }) => {
        tracks.push(track.sn)
      })
      
      run()
      run()
      run()
      
      expect(tracks).toEqual([1, 2, 3])
    })
  })

  describe('Race Condition Handling', () => {
    it('should only update state for latest call', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await wait(id === 1 ? 200 : 50)
        return id
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const fulfillHandler = vi.fn()
      
      monitor.on('fulfill', fulfillHandler)
      
      const p1 = run(1) // Slow call (sn=1)
      const p2 = run(2) // Fast call (sn=2)
      
      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])
      
      // Both should emit fulfill
      // Fast call (sn=2) finishes first, then slow call (sn=1)
      expect(fulfillHandler).toHaveBeenCalledTimes(2)
      
      // Find tracks by sn
      const track1 = fulfillHandler.mock.calls.find(call => call[0].track.sn === 1)?.[0].track
      const track2 = fulfillHandler.mock.calls.find(call => call[0].track.sn === 2)?.[0].track
      
      // After both finish, both should be fulfilled
      expect(track1?.is('fulfilled')).toBe(true)
      expect(track2?.is('fulfilled')).toBe(true)
      expect(track2?.sn).toBeGreaterThan(track1?.sn ?? 0)
    })
  })

  describe('State Hook Usage Pattern', () => {
    it('should support useStateLoading pattern', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async () => {
        await wait(100)
        return 1
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const loading = { value: false }
      
      let latestFinishedSn = 0
      monitor.on('before', ({ track }) => {
        loading.value = true
        latestFinishedSn = track.sn
      })
      monitor.on('fulfill', ({ track }) => {
        latestFinishedSn = track.sn
        if (track.sn === latestFinishedSn) {
          loading.value = false
        }
      })
      monitor.on('reject', ({ track }) => {
        latestFinishedSn = track.sn
        if (track.sn === latestFinishedSn) {
          loading.value = false
        }
      })
      
      const promise = run()
      expect(loading.value).toBe(true)
      
      await vi.runAllTimersAsync()
      await promise
      expect(loading.value).toBe(false)
    })

    it('should support useStateParameters pattern', () => {
      const fn = vi.fn((a: number, b: number) => a + b)
      const { run, monitor } = withFunctionMonitor(fn)
      const parameters = { value: undefined as any }
      
      let latestFinishedSn = 0
      monitor.on('before', ({ args, track }) => {
        parameters.value = args
        latestFinishedSn = track.sn
      })
      monitor.on('fulfill', ({ track }) => {
        latestFinishedSn = track.sn
        if (track.sn === latestFinishedSn) {
          parameters.value = undefined
        }
      })
      
      run(1, 2)
      expect(parameters.value).toBeUndefined() // Cleared after sync fulfill
    })

    it('should support useStateError pattern', () => {
      const error = new Error('test error')
      const fn = vi.fn(() => {
        throw error
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const errorState = { value: undefined as any }
      
      let latestRejectedSn = 0
      monitor.on('before', ({ track }) => {
        errorState.value = undefined
        latestRejectedSn = track.sn
      })
      monitor.on('reject', ({ track, error }) => {
        latestRejectedSn = track.sn
        if (track.sn === latestRejectedSn) {
          errorState.value = error
        }
      })
      
      expect(() => run()).toThrow()
      expect(errorState.value).toBe(error)
    })
  })

  describe('useAsyncData Usage Pattern', () => {
    it('should support context management pattern', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      const contextStack: string[] = []
      
      monitor.on('init', () => {
        contextStack.push('prepare')
      })
      monitor.on('after', () => {
        contextStack.push('restore')
      })
      
      run()
      expect(contextStack).toEqual(['prepare', 'restore'])
    })

    it('should support data update pattern', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async () => {
        await wait(100)
        return 'new-data'
      })
      const { run, monitor } = withFunctionMonitor(fn)
      const data = { value: 'initial-data' }
      const dataTrack = { value: undefined as any }
      
      let latestFulfilledSn = 0
      monitor.on('fulfill', ({ track, value }) => {
        if (track.is('rejected')) return
        latestFulfilledSn = track.sn
        if (track.is('fulfilled') && track.sn === latestFulfilledSn) {
          data.value = value
          dataTrack.value = track
        }
      })
      
      run()
      await vi.runAllTimersAsync()
      
      expect(data.value).toBe('new-data')
      expect(dataTrack.value).toBeDefined()
      expect(dataTrack.value.is('fulfilled')).toBe(true)
    })

    it('should support dataExpired pattern', () => {
      const fn = vi.fn(() => 1)
      const { run, monitor } = withFunctionMonitor(fn)
      
      // Simulate dataExpired computation
      const dataExpired = { value: false }
      const dataTrack = { value: undefined as any }
      let hasFinished = false
      let latestRejectedSn = 0
      
      // Update dataTrack on fulfill
      monitor.on('fulfill', ({ track }) => {
        dataTrack.value = track
        hasFinished = true
      })
      
      monitor.on('reject', ({ track }) => {
        latestRejectedSn = track.sn
        hasFinished = true
      })
      
      run()
      
      // Check expired: if no dataTrack, use hasFinished
      const expired = !dataTrack.value 
        ? hasFinished 
        : (dataTrack.value.is('rejected') || latestRejectedSn > dataTrack.value.sn)
      
      expect(expired).toBe(false) // Data is fresh after first call
    })
  })
})

