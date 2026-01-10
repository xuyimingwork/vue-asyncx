// core.setup-pipeline.test.ts
import type { FunctionMonitor } from '@/core/monitor'
import { setupFunctionPipeline } from '@/core/setup-pipeline'
import type { BaseFunction } from '@/utils/types'
import { describe, expect, it, vi } from 'vitest'

describe('setupFunctionPipeline', () => {
  describe('Basic Functionality', () => {
    it('should return merged states from basic addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        loading: { value: false }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        error: { value: null }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon1, addon2]
      })
      
      expect(result).toEqual({
        loading: { value: false },
        error: { value: null }
      })
      expect(addon1).toHaveBeenCalledTimes(1)
      expect(addon2).toHaveBeenCalledTimes(1)
    })

    it('should handle empty addons array', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const result = setupFunctionPipeline({
        fn,
        addons: []
      })
      
      expect(result).toEqual({})
    })

    it('should pass monitor to addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      let receivedMonitor: FunctionMonitor | undefined
      
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        receivedMonitor = monitor
        return {}
      })
      
      setupFunctionPipeline({
        fn,
        addons: [addon]
      })
      
      expect(receivedMonitor).toBeDefined()
      expect(receivedMonitor?.on).toBeTypeOf('function')
    })

    it('should handle non-function addons gracefully', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state1: { value: 1 }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon1, null, undefined, 'invalid' as any]
      } as any)
      
      expect(result).toEqual({
        state1: { value: 1 }
      })
      expect(addon1).toHaveBeenCalledTimes(1)
    })
  })

  describe('Two-Phase Execution', () => {
    it('should execute basic addons in phase one', () => {
      const fn = vi.fn((x: number) => x * 2)
      const executionOrder: string[] = []
      
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        executionOrder.push('basic-addon')
        return { basicState: { value: 'phase1' } }
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [basicAddon]
      })
      
      expect(executionOrder).toEqual(['basic-addon'])
      expect(result).toEqual({ basicState: { value: 'phase1' } })
    })

    it('should execute advanced addons in phase two', () => {
      const fn = vi.fn((x: number) => x * 2)
      const executionOrder: string[] = []
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        executionOrder.push('advanced-addon-phase1')
        return ({ method }: { method: BaseFunction }) => {
          executionOrder.push('advanced-addon-phase2')
          return { advancedState: { value: 'phase2' } }
        }
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [advancedAddon]
      })
      
      expect(executionOrder).toEqual(['advanced-addon-phase1', 'advanced-addon-phase2'])
      expect(result).toEqual({ advancedState: { value: 'phase2' } })
    })

    it('should execute basic addons before advanced addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      const executionOrder: string[] = []
      
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        executionOrder.push('basic')
        return { basicState: { value: 1 } }
      })
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        executionOrder.push('advanced-phase1')
        return ({ method }: { method: BaseFunction }) => {
          executionOrder.push('advanced-phase2')
          return { advancedState: { value: 2 } }
        }
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [basicAddon, advancedAddon]
      })
      
      expect(executionOrder).toEqual(['basic', 'advanced-phase1', 'advanced-phase2'])
      expect(result).toEqual({
        basicState: { value: 1 },
        advancedState: { value: 2 }
      })
    })

    it('should pass method to advanced addons in phase two', () => {
      const fn = vi.fn((x: number) => x * 2)
      let receivedMethod: BaseFunction | undefined
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => {
          receivedMethod = method
          return { methodState: { value: 'received' } }
        }
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [advancedAddon]
      })
      
      expect(receivedMethod).toBeDefined()
      expect(receivedMethod).toBeTypeOf('function')
      expect(result).toEqual({ methodState: { value: 'received' } })
    })
  })

  describe('State Merging', () => {
    it('should merge states from multiple basic addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state1: { value: 1 },
        state2: { value: 2 }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state3: { value: 3 }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon1, addon2]
      })
      
      expect(result).toEqual({
        state1: { value: 1 },
        state2: { value: 2 },
        state3: { value: 3 }
      })
    })

    it('should merge states from basic and advanced addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        basicState: { value: 'basic' }
      }))
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          advancedState: { value: 'advanced' }
        })
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [basicAddon, advancedAddon]
      })
      
      expect(result).toEqual({
        basicState: { value: 'basic' },
        advancedState: { value: 'advanced' }
      })
    })

    it('should merge states from multiple advanced addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const advancedAddon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          state1: { value: 1 }
        })
      })
      
      const advancedAddon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          state2: { value: 2 }
        })
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [advancedAddon1, advancedAddon2]
      })
      
      expect(result).toEqual({
        state1: { value: 1 },
        state2: { value: 2 }
      })
    })
  })

  describe('Duplicate Key Detection', () => {
    it('should throw error when basic addons have duplicate keys', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        duplicate: { value: 1 }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        duplicate: { value: 2 }
      }))
      
      expect(() => {
        setupFunctionPipeline({
          fn,
          addons: [addon1, addon2]
        } as any)
      }).toThrow(/Addon has duplicate keys: duplicate/)
    })

    it('should throw error when advanced addons have duplicate keys', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const advancedAddon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          duplicate: { value: 1 }
        })
      })
      
      const advancedAddon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          duplicate: { value: 2 }
        })
      })
      
      expect(() => {
        setupFunctionPipeline({
          fn,
          addons: [advancedAddon1, advancedAddon2]
        } as any)
      }).toThrow(/Addon has duplicate keys: duplicate/)
    })

    it('should throw error when basic and advanced addons have duplicate keys', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        duplicate: { value: 1 }
      }))
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          duplicate: { value: 2 }
        })
      })
      
      expect(() => {
        setupFunctionPipeline({
          fn,
          addons: [basicAddon, advancedAddon]
        } as any)
      }).toThrow(/Addon has duplicate keys: duplicate/)
    })

    it('should throw error with all duplicate keys listed', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        key1: { value: 1 },
        key2: { value: 2 }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        key1: { value: 3 },
        key2: { value: 4 }
      }))
      
      expect(() => {
        setupFunctionPipeline({
          fn,
          addons: [addon1, addon2]
        } as any)
      }).toThrow(/Addon has duplicate keys: key1,key2/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle addon returning empty object', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({}))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon]
      })
      
      expect(result).toEqual({})
    })

    it('should handle addon returning null or undefined', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => null)
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => undefined)
      const addon3 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state: { value: 1 }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon1, addon2, addon3]
      })
      
      expect(result).toEqual({ state: { value: 1 } })
    })

    it('should handle addon returning non-object values', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => 'string' as any)
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => 123 as any)
      const addon3 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state: { value: 1 }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [addon1, addon2, addon3]
      })
      
      expect(result).toEqual({ state: { value: 1 } })
    })

    it('should handle only advanced addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          state: { value: 'advanced' }
        })
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [advancedAddon]
      })
      
      expect(result).toEqual({ state: { value: 'advanced' } })
    })

    it('should handle only basic addons', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state: { value: 'basic' }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        addons: [basicAddon]
      })
      
      expect(result).toEqual({ state: { value: 'basic' } })
    })
  })

  describe('Options Parameter', () => {
    it('should pass options to useSetup', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state: { value: 1 }
      }))
      
      const options = { immediate: true, someOption: 'value' }
      
      const result = setupFunctionPipeline({
        fn,
        options,
        addons: [addon]
      })
      
      // Options are passed to useSetup, but we can't directly verify that
      // We just ensure the function doesn't throw
      expect(result).toEqual({ state: { value: 1 } })
    })

    it('should handle undefined options', () => {
      const fn = vi.fn((x: number) => x * 2)
      
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        state: { value: 1 }
      }))
      
      const result = setupFunctionPipeline({
        fn,
        options: undefined,
        addons: [addon]
      })
      
      expect(result).toEqual({ state: { value: 1 } })
    })
  })

  describe('Real-World Usage Patterns', () => {
    it('should support loading and error addons pattern', () => {
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        if (id < 0) throw new Error('Invalid id')
        return { id, name: `User ${id}` }
      })
      
      const loadingAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        const loading = { value: false }
        monitor.on('before', () => { loading.value = true })
        monitor.on('fulfill', () => { loading.value = false })
        monitor.on('reject', () => { loading.value = false })
        return { loading }
      })
      
      const errorAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        const error = { value: null as any }
        monitor.on('before', () => { error.value = null })
        monitor.on('reject', ({ error: err }) => { error.value = err })
        return { error }
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [loadingAddon, errorAddon]
      })
      
      expect(result.loading).toBeDefined()
      expect(result.error).toBeDefined()
      expect(result.loading.value).toBe(false)
      expect(result.error.value).toBeNull()
    })

    it('should support data addon pattern with method access', () => {
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name: `User ${id}` }
      })
      
      const dataAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        const data = { value: null as any }
        monitor.on('fulfill', ({ value }) => {
          data.value = value
        })
        return ({ method }: { method: BaseFunction }) => ({
          data,
          method
        })
      })
      
      const result = setupFunctionPipeline({
        fn,
        addons: [dataAddon]
      })
      
      expect(result.data).toBeDefined()
      expect(result.method).toBeDefined()
      expect(result.method).toBeTypeOf('function')
    })
  })
})

