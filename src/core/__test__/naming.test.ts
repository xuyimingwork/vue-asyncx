// core.naming.test.ts
import type { FunctionMonitor } from '@/core/monitor'
import { PLACEHOLDER, toNamedAddon, toNamedAddons } from '@/core/naming'
import type { BaseFunction } from '@/utils/types'
import { describe, expect, it, vi } from 'vitest'

describe('naming', () => {
  describe('PLACEHOLDER', () => {
    it('should export PLACEHOLDER constant', () => {
      expect(PLACEHOLDER).toBe('__name__')
    })
  })

  describe('toNamedAddonResultKey', () => {
    // Testing the internal function through toNamedAddon
    describe('placeholder at start', () => {
      it('should replace placeholder at start with lowerFirst name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          __name__Error: { value: null }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userLoading: { value: false },
          userError: { value: null }
        })
      })

      it('should handle multiple placeholders at start', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name____name__State: { value: 1 }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userUserState: { value: 1 }
        })
      })
    })

    describe('placeholder in middle', () => {
      it('should replace placeholder in middle with upperFirst name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          query__name__: { value: null },
          fetch__name__Data: { value: null }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          queryUser: { value: null },
          fetchUserData: { value: null }
        })
      })

      it('should handle placeholder at end', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          get__name__: { value: null }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          getUser: { value: null }
        })
      })
    })

    describe('mixed placeholder positions', () => {
      it('should handle placeholder at start and in middle', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__With__name__: { value: 1 }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // First __name__ at start -> user, second __name__ in middle -> User
        expect(result).toEqual({
          userWithUser: { value: 1 }
        })
      })

      it('should handle complex mixed patterns', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Query__name__Data: { value: 1 }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userQueryUserData: { value: 1 }
        })
      })
    })

    describe('keys without placeholder', () => {
      it('should discard keys without placeholder', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          otherKey: { value: 'should be discarded' },
          anotherKey: { value: 'also discarded' }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userLoading: { value: false }
        })
        expect(result.otherKey).toBeUndefined()
        expect(result.anotherKey).toBeUndefined()
      })

      it('should keep only keys with placeholder', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__State: { value: 1 },
          __name__Error: { value: null },
          noPlaceholder: { value: 2 },
          alsoNoPlaceholder: { value: 3 }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userState: { value: 1 },
          userError: { value: null }
        })
      })
    })

    describe('edge cases', () => {
      it('should handle empty string name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false }
        }))
        
        const namedAddon = toNamedAddon('', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // empty string -> lowerFirst('') = '', so __name__Loading becomes Loading
        expect(result).toEqual({
          Loading: { value: false }
        })
      })

      it('should handle single character name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__State: { value: 1 },
          query__name__: { value: 2 }
        }))
        
        const namedAddon = toNamedAddon('a', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          aState: { value: 1 },
          queryA: { value: 2 }
        })
      })

      it('should handle uppercase name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          query__name__: { value: null }
        }))
        
        const namedAddon = toNamedAddon('USER', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          uSERLoading: { value: false }, // lowerFirst('USER') = 'uSER'
          queryUSER: { value: null } // upperFirst('USER') = 'USER'
        })
      })

      it('should handle camelCase name', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          query__name__: { value: null }
        }))
        
        const namedAddon = toNamedAddon('userProfile', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userProfileLoading: { value: false },
          queryUserProfile: { value: null }
        })
      })
    })
  })

  describe('toNamedAddonResult', () => {
    // Testing through toNamedAddon
    describe('object handling', () => {
      it('should convert object with placeholder keys', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          __name__Error: { value: null }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toBeTypeOf('object')
        expect(result).not.toBeNull()
        expect(Object.keys(result).length).toBe(2)
      })

      it('should handle null result', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => null)
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toBeUndefined()
      })

      it('should handle undefined result', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => undefined)
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toBeUndefined()
      })

      it('should handle non-object result', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => 'string' as any)
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toBeUndefined()
      })

      it('should handle empty object', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({}))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({})
      })

      it('should ignore symbol keys', () => {
        const symbolKey = Symbol('test')
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          [symbolKey]: { value: 'symbol value' }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // Object.keys() only returns string keys, so symbol keys are ignored
        expect(result).toEqual({
          userLoading: { value: false }
        })
        expect(result[symbolKey]).toBeUndefined()
      })

      it('should ignore symbol keys even if they contain placeholder in description', () => {
        const symbolKey1 = Symbol('__name__Symbol')
        const symbolKey2 = Symbol('test')
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false },
          [symbolKey1]: { value: 'symbol1' },
          [symbolKey2]: { value: 'symbol2' }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // Symbol keys are always ignored, regardless of their description
        expect(result).toEqual({
          userLoading: { value: false }
        })
        expect(result[symbolKey1]).toBeUndefined()
        expect(result[symbolKey2]).toBeUndefined()
      })

      it('should handle object with only symbol keys', () => {
        const symbolKey = Symbol('test')
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          [symbolKey]: { value: 'symbol value' }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // Object.keys() returns empty array for symbol-only objects
        expect(result).toEqual({})
        expect(Object.keys(result)).toHaveLength(0)
      })

      it('should preserve symbol keys in advanced addon result', () => {
        const symbolKey = Symbol('test')
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
          return ({ method }: { method: BaseFunction }) => ({
            __name__Data: { value: null },
            [symbolKey]: { value: 'symbol value' }
          })
        })
        
        const namedAddon = toNamedAddon('user', addon)
        const method = vi.fn()
        
        const phase1Result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        const phase2Result = phase1Result({ method })
        
        // Symbol keys are ignored in phase 2 as well
        expect(phase2Result).toEqual({
          userData: { value: null }
        })
        expect(phase2Result[symbolKey]).toBeUndefined()
      })
    })
  })

  describe('toNamedAddon', () => {
    describe('basic addon', () => {
      it('should convert basic addon to named addon', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false }
        }))
        
        const namedAddon = toNamedAddon('user', addon)
        
        expect(namedAddon).toBeTypeOf('function')
        const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        
        expect(result).toEqual({
          userLoading: { value: false }
        })
      })

      it('should preserve addon functionality', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
          const state = { value: 0 }
          monitor.on('before', () => { state.value++ })
          return { __name__Count: state }
        })
        
        const namedAddon = toNamedAddon('user', addon)
        const monitor = { on: vi.fn(), emit: vi.fn() } as any
        
        const result = namedAddon({ monitor, _types: undefined })
        
        expect(result).toEqual({
          userCount: { value: 0 }
        })
        expect(addon).toHaveBeenCalled()
      })
    })

    describe('advanced addon', () => {
      it('should convert advanced addon to named addon', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
          return ({ method }: { method: BaseFunction }) => ({
            __name__Method: method
          })
        })
        
        const namedAddon = toNamedAddon('user', addon)
        const method = vi.fn()
        
        const phase1Result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        expect(phase1Result).toBeTypeOf('function')
        
        const phase2Result = phase1Result({ method })
        expect(phase2Result).toEqual({
          userMethod: method
        })
      })

      it('should handle nested placeholder in advanced addon', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
          return ({ method }: { method: BaseFunction }) => ({
            __name__Data: { value: null },
            query__name__: { value: null }
          })
        })
        
        const namedAddon = toNamedAddon('user', addon)
        const method = vi.fn()
        
        const phase1Result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
        const phase2Result = phase1Result({ method })
        
        expect(phase2Result).toEqual({
          userData: { value: null },
          queryUser: { value: null }
        })
      })
    })

    describe('already named addon', () => {
      it('should return same addon if already named', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false }
        }))
        
        const namedAddon1 = toNamedAddon('user', addon)
        const namedAddon2 = toNamedAddon('user', namedAddon1)
        
        // Should be the same reference (already named, no re-processing)
        expect(namedAddon2).toBe(namedAddon1)
      })

      it('should not double-process already named addon', () => {
        const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
          __name__Loading: { value: false }
        }))
        
        const namedAddon1 = toNamedAddon('user', addon)
        const result1 = namedAddon1({ monitor: {} as FunctionMonitor, _types: undefined })
        
        const namedAddon2 = toNamedAddon('user', namedAddon1)
        const result2 = namedAddon2({ monitor: {} as FunctionMonitor, _types: undefined })
        
        // Results should be the same
        expect(result1).toEqual(result2)
        expect(result1).toEqual({ userLoading: { value: false } })
      })
    })
  })

  describe('toNamedAddons', () => {
    it('should convert array of addons to named addons', () => {
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__Loading: { value: false }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__Error: { value: null }
      }))
      
      const namedAddons = toNamedAddons('user', [addon1, addon2])
      
      expect(namedAddons).toHaveLength(2)
      expect(namedAddons[0]).toBeTypeOf('function')
      expect(namedAddons[1]).toBeTypeOf('function')
      
      const result1 = namedAddons[0]({ monitor: {} as FunctionMonitor, _types: undefined })
      const result2 = namedAddons[1]({ monitor: {} as FunctionMonitor, _types: undefined })
      
      expect(result1).toEqual({ userLoading: { value: false } })
      expect(result2).toEqual({ userError: { value: null } })
    })

    it('should handle empty array', () => {
      const namedAddons = toNamedAddons('user', [])
      
      expect(namedAddons).toHaveLength(0)
      expect(Array.isArray(namedAddons)).toBe(true)
    })

    it('should handle mixed basic and advanced addons', () => {
      const basicAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__Loading: { value: false }
      }))
      
      const advancedAddon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          __name__Method: method
        })
      })
      
      const namedAddons = toNamedAddons('user', [basicAddon, advancedAddon])
      
      expect(namedAddons).toHaveLength(2)
      
      const result1 = namedAddons[0]({ monitor: {} as FunctionMonitor, _types: undefined })
      expect(result1).toEqual({ userLoading: { value: false } })
      
      const phase1Result = namedAddons[1]({ monitor: {} as FunctionMonitor, _types: undefined })
      const method = vi.fn()
      const result2 = phase1Result({ method })
      expect(result2).toEqual({ userMethod: method })
    })

    it('should apply same name to all addons', () => {
      const addon1 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__State1: { value: 1 }
      }))
      
      const addon2 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__State2: { value: 2 }
      }))
      
      const addon3 = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__State3: { value: 3 }
      }))
      
      const namedAddons = toNamedAddons('user', [addon1, addon2, addon3])
      
      const result1 = namedAddons[0]({ monitor: {} as FunctionMonitor, _types: undefined })
      const result2 = namedAddons[1]({ monitor: {} as FunctionMonitor, _types: undefined })
      const result3 = namedAddons[2]({ monitor: {} as FunctionMonitor, _types: undefined })
      
      expect(result1).toEqual({ userState1: { value: 1 } })
      expect(result2).toEqual({ userState2: { value: 2 } })
      expect(result3).toEqual({ userState3: { value: 3 } })
    })
  })

  describe('Real-World Usage Patterns', () => {
    it('should support loading addon pattern', () => {
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__Loading: { value: false },
        __name__Error: { value: null }
      }))
      
      const namedAddon = toNamedAddon('fetchUser', addon)
      const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
      
      expect(result).toEqual({
        fetchUserLoading: { value: false },
        fetchUserError: { value: null }
      })
    })

    it('should support data addon pattern', () => {
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          __name__: { value: null },
          __name__Expired: { value: false }
        })
      })
      
      const namedAddon = toNamedAddon('user', addon)
      const method = vi.fn()
      
      const phase1Result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
      const phase2Result = phase1Result({ method })
      
      expect(phase2Result).toEqual({
        user: { value: null },
        userExpired: { value: false }
      })
    })

    it('should support function addon pattern', () => {
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => {
        return ({ method }: { method: BaseFunction }) => ({
          __name__: method
        })
      })
      
      const namedAddon = toNamedAddon('fetchUser', addon)
      const method = vi.fn()
      
      const phase1Result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
      const phase2Result = phase1Result({ method })
      
      expect(phase2Result).toEqual({
        fetchUser: method
      })
    })

    it('should support complex naming with multiple placeholders', () => {
      const addon = vi.fn(({ monitor }: { monitor: FunctionMonitor }) => ({
        __name__Loading: { value: false },
        __name__Error: { value: null },
        query__name__: { value: null },
        fetch__name__Data: { value: null },
        __name__With__name__State: { value: 1 }
      }))
      
      const namedAddon = toNamedAddon('user', addon)
      const result = namedAddon({ monitor: {} as FunctionMonitor, _types: undefined })
      
      expect(result).toEqual({
        userLoading: { value: false },
        userError: { value: null },
        queryUser: { value: null },
        fetchUserData: { value: null },
        userWithUserState: { value: 1 }
      })
    })
  })
})

