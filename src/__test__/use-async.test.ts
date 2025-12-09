import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useAsync, useAsyncFunction } from '../use-async'
import { debounce } from 'es-toolkit'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useAsync', () => {
  afterEach(() => vi.useRealTimers())
  describe('Basic Functionality', () => {
    describe('Argument Validation', () => {
      test('should throw TypeError when no arguments are passed', () => {
        // @ts-expect-error
        expect(() => useAsync()).toThrow(TypeError)
        // @ts-expect-error
        expect(() => useAsync()).toThrow('Expected at least 1 argument, but got 0.')
      })

      test('should throw TypeError when name is not a string', () => {
        // @ts-expect-error
        expect(() => useAsync()).toThrow(TypeError)
        // @ts-expect-error
        expect(() => useAsync(1, () => {})).toThrow('Expected "name" to be a string, but received number.')
      })

      test('should throw TypeError when fn is not a function', () => {
        // @ts-expect-error
        expect(() => useAsync()).toThrow(TypeError)
        // @ts-expect-error
        expect(() => useAsync('method', 1)).toThrow('Expected "fn" to be a function, but received number.')
      })
    })

    describe('Naming Functionality', () => {
      function expectResultStructure(result: any, name: string = 'method') {
        expect(result).toBeTypeOf('object')
        expect(Object.keys(result).length).toBe(5)
        expect(result).toHaveProperty(`${name}`)
        expect(result).toHaveProperty(`${name}Loading`)
        expect(result).toHaveProperty(`${name}Arguments`)
        expect(result).toHaveProperty(`${name}ArgumentFirst`)
        expect(result).toHaveProperty(`${name}Error`)
      }

      test('should use default method name when no name is provided', () => {
        expectResultStructure(useAsync(() => 1))
        expectResultStructure(useAsync('', () => 1))
      })

      test('When a custom name is provided to useAsync, it should use the custom method names', () => {
        expectResultStructure(useAsync('getOne', () => 1), 'getOne')
      })
    })

    describe('Function Wrapping', () => {
      test('should wrap sync function as it is', () => {
        const spy = vi.fn((a: number, b: number) => a + b)
        const result = useAsync(spy)
        expect(result.method).toBeTypeOf('function')
        expect(result.method(1, 2)).toBe(3)     
        expect(spy).toBeCalledWith(1, 2)
        expect(spy).toBeCalledTimes(1)
      })

      test('should wrap async function as it is', async () => {
        const spy = vi.fn(async (a: number, b: number) => a + b)
        const result = useAsync(spy)
        expect(result.method).toBeTypeOf('function')
        await expect(result.method(1, 2)).resolves.toBe(3)
        expect(spy).toBeCalledWith(1, 2)
        expect(spy).toBeCalledTimes(1)
      })

      test('should handle functions with many arguments', () => {
        const spy = vi.fn((a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e)
        const { method } = useAsync(spy)
        expect(method(1, 2, 3, 4, 5)).toBe(15)
        expect(spy).toBeCalledWith(1, 2, 3, 4, 5)
      })

      test('should handle functions with special type arguments', () => {
        const spy = vi.fn((a: null, b: undefined, c: object, d: any[]) => ({ a, b, c, d }))
        const obj = { key: 'value' }
        const arr = [1, 2, 3]
        const { method } = useAsync(spy)
        expect(method(null, undefined, obj, arr)).toEqual({ a: null, b: undefined, c: obj, d: arr })
        expect(spy).toBeCalledWith(null, undefined, obj, arr)
      })
    })

    test('useAsyncFunction should be the same as useAsync', () => {
      expect(useAsyncFunction).toBe(useAsync)
    })
  })

  describe('Execution Control', () => {
    describe('Immediate Execution', () => {
      test('should execute the function immediately when immediate option is true', () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        expect(fnSpy).not.toBeCalled()
        useAsync(temp.fn, { immediate: true })
        expect(fnSpy).toBeCalledTimes(1)
      })

      test('should not execute the function immediately when immediate option is false', () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        expect(fnSpy).not.toBeCalled()
        useAsync(temp.fn, { immediate: false })
        expect(fnSpy).toBeCalledTimes(0)
      })
    })

    describe('Watch Functionality', () => {
      test('should execute function when watched value changes', async () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        const source = ref(1)
        useAsync(temp.fn, { watch: source, immediate: true })
        expect(fnSpy).toBeCalledTimes(1)
        source.value++
        await new Promise(r => setTimeout(r));
        expect(fnSpy).toBeCalledTimes(2)
      })

      test('should execute function when multiple watched values change', async () => {
        const a = ref(1), b = ref(2)
        const spy = vi.fn(() => 1)
        useAsync(spy, { watch: [a, b] as any, immediate: true })
        expect(spy).toHaveBeenCalledTimes(1)
        a.value = 3
        await nextTick()
        expect(spy).toHaveBeenCalledTimes(2)
        b.value = 4
        await nextTick()
        expect(spy).toHaveBeenCalledTimes(3)
      })

      test('should support watching reactive object with deep option', async () => {
        const obj = ref({ count: 0 })
        const spy = vi.fn()
        useAsync(spy, { watch: obj, watchOptions: { deep: true, immediate: true } })
        expect(spy).toHaveBeenCalledTimes(1)
        obj.value.count++
        await nextTick()
        expect(spy).toHaveBeenCalledTimes(2)
      })

      test('should not double-execute when immediate: true and watch provided', () => {
        const source = ref(1)
        const spy = vi.fn()
        useAsync(spy, { watch: source, immediate: true })
        expect(spy).toHaveBeenCalledTimes(1) // not 2!
      })

      test('should execute function immediately when watchOptions.immediate is true', async () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        expect(fnSpy).not.toBeCalled()
        const source = ref(1)
        useAsync(temp.fn, { watch: source, watchOptions: { immediate: true } })
        expect(fnSpy).toBeCalledTimes(1)
        source.value++
        await new Promise(r => setTimeout(r));
        expect(fnSpy).toBeCalledTimes(2)
      })

      test('should not execute function immediately when watchOptions.immediate is false', () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        const source = ref(1)
        useAsync(temp.fn, { watch: source, watchOptions: { immediate: false } })
        expect(fnSpy).not.toBeCalled()
      })

      test('should use watchOptions.immediate when both watchOptions.immediate and immediate options are provided', () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        useAsync(temp.fn, { watchOptions: { immediate: false }, immediate: true })
        expect(fnSpy).toBeCalledTimes(0)

        useAsync(temp.fn, { watchOptions: { immediate: true }, immediate: false })
        expect(fnSpy).toBeCalledTimes(1)
      })

      test('should use custom handler when handlerCreator is provided', async () => {
        const temp = { 
          fn: () => 1,
          handler: (source: number, fn: () => number) => {
            if (!source) return false
            return fn()
          },
          handlerCreator(fn) {
            return (source: number) => temp.handler(source, fn)
          },
        }
        const fnSpy = vi.spyOn(temp, 'fn')
        const handlerSpy = vi.spyOn(temp, 'handler')
        const handlerCreatorSpy = vi.spyOn(temp, 'handlerCreator')
        expect(fnSpy).not.toBeCalled()
        expect(handlerSpy).not.toBeCalled()
        expect(handlerCreatorSpy).not.toBeCalled()
        const source = ref(0)
        useAsync(temp.fn, { 
          watch: source,
          watchOptions: { 
            handlerCreator: temp.handlerCreator
          }, immediate: true 
        })
        expect(handlerCreatorSpy).toBeCalledTimes(1)
        expect(handlerSpy).toBeCalledTimes(1)
        expect(fnSpy).toBeCalledTimes(0)
        source.value++
        await new Promise(r => setTimeout(r));
        expect(handlerCreatorSpy).toBeCalledTimes(1)
        expect(handlerSpy).toBeCalledTimes(2)
        expect(fnSpy).toBeCalledTimes(1)
      })

      test('should use default handler when handlerCreator throws an error', async () => {
        const temp = { 
          fn: () => 1,
          handler: (source: number, fn: () => number) => {
            if (!source) return false
            return fn()
          },
          handlerCreator(fn) {
            throw Error()
          },
        }
        const fnSpy = vi.spyOn(temp, 'fn')
        const handlerSpy = vi.spyOn(temp, 'handler')
        const handlerCreatorSpy = vi.spyOn(temp, 'handlerCreator')
        useAsync(temp.fn, { watchOptions: { 
          handlerCreator: temp.handlerCreator
        }, immediate: true })
        expect(handlerCreatorSpy).toBeCalledTimes(1)
        expect(handlerCreatorSpy).toThrowError()
        expect(handlerSpy).toBeCalledTimes(0)
        expect(fnSpy).toBeCalledTimes(1)
      })

      test('should use default handler when handlerCreator returns invalid value', async () => {
        const temp = { fn: () => 1, handler: () => false }
        const fnSpy = vi.spyOn(temp, 'fn')
        useAsync(temp.fn, { watchOptions: { 
          handlerCreator(fn) {
            return '' as any
          }
        }, immediate: true })
        expect(fnSpy).toBeCalledTimes(1)
      })

      test('should handle watchOptions as null', () => {
        const spy = vi.fn(() => 1)
        const source = ref(1)
        useAsync(spy, { watch: source, watchOptions: null as any })
        expect(spy).toBeCalledTimes(0) // 默认immediate为false
      })

      test('should handle watch as undefined', () => {
        const spy = vi.fn(() => 1)
        useAsync(spy, { watch: undefined, immediate: true })
        expect(spy).toBeCalledTimes(1)
      })
    })  

    describe('Setup Functionality', () => {
      test('should use setup return in result method when it is a function', async () => {
        const ref = { 
          fn: async () => {
            await wait(100)
          },
          setupReturn: () => { throw Error() },
          setup: (fn) => {
            ref.setupReturn = debounce(fn, 50) as any
            return ref.setupReturn
          },
        }
        const { method } = useAsync(ref.fn, { 
          setup: ref.setup,
        })
        expect(method).toBe(ref.setupReturn)
      })

      test('should use setup return in watch handler when it is a function', async () => {
        const ref = { 
          fn: async () => {
            await wait(100)
          },
          setupReturn: () => { throw Error() },
          setup: (fn) => {
            ref.setupReturn = debounce(fn, 50) as any
            return ref.setupReturn
          },
        }
        useAsync(ref.fn, { 
          setup: ref.setup,
          watchOptions: { 
            handlerCreator(fn) {
              expect(fn).toBe(ref.setupReturn)
              return () => fn()
            },
            immediate: true 
          },
        })
      })

      test('should use original function when setup throws an error', async () => {
        vi.useFakeTimers()
        const ref = { 
          fn: async () => {
            await wait(100)
          } 
        }
        const spy = vi.spyOn(ref, 'fn')
        const { method, methodLoading } = useAsync(ref.fn, { 
          setup() {
            throw Error()
          }
        })
        method()
        method()
        method()
        expect(spy).toBeCalledTimes(3)
        expect(methodLoading.value).toBeTruthy()
        await vi.runAllTimersAsync()
        expect(methodLoading.value).toBeFalsy()
      })

      test('should use original function when setup not return a function', async () => {
        vi.useFakeTimers()
        const ref = { 
          fn: async () => {
            await wait(100)
          } 
        }
        const spy = vi.spyOn(ref, 'fn')
        const { method, methodLoading } = useAsync(ref.fn, { 
          setup(fn) {
            // not work
            debounce(fn, 50)
          }
        })
        method()
        method()
        method()
        expect(spy).toBeCalledTimes(3)
        expect(methodLoading.value).toBeTruthy()
        await vi.runAllTimersAsync()
        expect(methodLoading.value).toBeFalsy()
      })

      test('should fall back to original function if setup returns non-function', () => {
        const fn = vi.fn(() => 'result')
        const { method } = useAsync(fn, {
          setup: () => 'not a function' as any
        })
        expect(method()).toBe('result')
        expect(fn).toBeCalledTimes(1)
      })

      test('should be able to modify function behavior', () => {
        const spy = vi.fn((a: number, b: number) => a + b)
        const { method } = useAsync(spy, {
          setup: (fn) => {
            return (a: number, b: number) => fn(a * 2, b * 2)
          }
        })
        
        expect(method(1, 2)).toBe(6) // 1*2 + 2*2 = 6
        expect(spy).toBeCalledWith(2, 4)
        expect(spy).toBeCalledTimes(1)
      })

      test('should be able to add caching behavior', () => {
        const cache = new Map<string, number>()
        const spy = vi.fn((a: number, b: number) => a + b)
        const { method } = useAsync(spy, {
          setup: (fn) => {
            return (a: number, b: number) => {
              const key = `${a}-${b}`
              if (cache.has(key)) {
                return cache.get(key)! // 使用缓存值
              }
              const result = fn(a, b)
              cache.set(key, result)
              return result
            }
          }
        })
        
        // 第一次调用，应该执行原函数
        expect(method(1, 2)).toBe(3)
        expect(spy).toBeCalledTimes(1)
        
        // 第二次调用相同参数，应该使用缓存
        expect(method(1, 2)).toBe(3)
        expect(spy).toBeCalledTimes(1) // 调用次数不变
        
        // 调用不同参数，应该执行原函数
        expect(method(2, 3)).toBe(5)
        expect(spy).toBeCalledTimes(2)
      })
    })
  })

  describe('State Management', () => {
    describe('Loading State', () => {
      test('should reflect loading state when async function is executed', async () => {
        vi.useFakeTimers()
        const { method, methodLoading } = useAsync(() => new Promise((resolve) => setTimeout(resolve, 100)))
        expect(methodLoading.value).toBe(false)
        method()
        expect(methodLoading.value).toBe(true)
        await vi.runAllTimersAsync()
        expect(methodLoading.value).toBe(false)
      })

      test('should be false when sync function is executed', async () => {
        const { method, methodLoading } = useAsync(() => 1)
        expect(methodLoading.value).toBe(false)
        method()
        expect(methodLoading.value).toBe(false)
      })
    })  
    describe('Arguments/ArgumentFirst State', () => {
      test('should reflect arguments/argumentFirst state during async function execution', async () => {
        vi.useFakeTimers()
        const { doAsyncMethod, doAsyncMethodArguments, doAsyncMethodArgumentFirst } = useAsync('doAsyncMethod', function (a: number, b: number) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(a + b), 100)
          })
        })
        expect(doAsyncMethodArguments.value).toBeUndefined()
        expect(doAsyncMethodArgumentFirst.value).toBeUndefined()
        doAsyncMethod(1, 1)
        expect(doAsyncMethodArguments.value).toMatchObject([1, 1])
        expect(doAsyncMethodArgumentFirst.value).toBe(1)
        await vi.runAllTimersAsync()
        expect(doAsyncMethodArguments.value).toBeUndefined()
        expect(doAsyncMethodArgumentFirst.value).toBeUndefined()
      })

      test('should reflect arguments/argumentFirst state during sync function execution', async () => {
        const { doSyncMethod, doSyncMethodArguments, doSyncMethodArgumentFirst } = useAsync('doSyncMethod', function (a: number, b: number) {
          return a + b
        })
        expect(doSyncMethodArguments.value).toBeUndefined()
        expect(doSyncMethodArgumentFirst.value).toBeUndefined()
        doSyncMethod(1, 1)
        expect(doSyncMethodArguments.value).toBeUndefined()
        expect(doSyncMethodArgumentFirst.value).toBeUndefined()
      })
    })
    describe('Error State', () => {
      test('should store error when async function throws an error', async () => {
        const error = Error()
        const { one, oneLoading, oneError } = useAsync('one', async () => {
          throw error
        })

        await expect(() => one()).rejects.toThrow(error)
        expect(oneLoading.value).toBe(false)
        expect(oneError.value).toBe(error)
      })

      test('should capture non-Error rejections (e.g., string)', async () => {
        const error = 'Oops!'
        const { one, oneError } = useAsync('one', async () => {
          throw error
        })
        await expect(one()).rejects.toBe(error)
        expect(oneError.value).toBe(error)
      })

      test('should store error when sync function throws an error', async () => {
        const error = Error()
        const { one, oneLoading, oneError } = useAsync('one', () => {
          throw error
        })

        expect(() => one()).toThrow(error)
        expect(oneLoading.value).toBe(false)
        expect(oneError.value).toBe(error)
      })

      test('should clear error when a new call is made', async () => {
        const error = Error()
        const { one, oneLoading, oneError } = useAsync('one', async () => {
          throw error
        })
        await expect(() => one()).rejects.toThrow(error)
        expect(oneLoading.value).toBe(false)
        expect(oneError.value).toBe(error)
        one()
        expect(oneLoading.value).toBe(true)
        // clear error as long as new call is made
        expect(oneError.value).toBeUndefined()
        await Promise.resolve()
        expect(oneLoading.value).toBe(false)
        expect(oneError.value).toBe(error)
      })
    })
  })

  describe('Concurrency Control', () => {
    test('loading state should reflect the latest call when multiple async methods are called in order', async () => {
      vi.useFakeTimers()
      const { one, oneLoading } = useAsync('one', async (ms: number) => {
        await wait(ms)
        return ms
      })
      expect(oneLoading.value).toBe(false)
      one(100)
      one(200)
      expect(oneLoading.value).toBe(true)
      await vi.advanceTimersToNextTimerAsync()
      // earlier call is finished, but later call is not finished yet, so loading should be true
      expect(oneLoading.value).toBe(true)
      await vi.runAllTimersAsync()
      // all calls are finished, so loading should be false
      expect(oneLoading.value).toBe(false)
    })

    test('loading state should reflect the latest call when multiple async methods are called out of order', async () => {
      vi.useFakeTimers()
      const { one, oneLoading } = useAsync('one', async (ms: number) => {
        await wait(ms)
        return ms
      })
      expect(oneLoading.value).toBe(false)
      one(200)
      one(100)
      expect(oneLoading.value).toBe(true)
      await vi.advanceTimersToNextTimerAsync()
      // later call is finished earlier, so loading should be false
      expect(oneLoading.value).toBe(false)
      await vi.runAllTimersAsync()
      // all calls are finished, so loading should be false
      expect(oneLoading.value).toBe(false)
    })

    test('loading state should not interfere when multiple different async methods are called', async () => {
      vi.useFakeTimers()
      const { one, oneLoading } = useAsync('one', async (ms: number) => {
        await wait(ms)
        return ms
      })
      const { two, twoLoading } = useAsync('two', async (ms: number) => {
        await wait(ms)
        return ms
      })

      const oneFirst = one(200)
      expect(oneLoading.value).toBe(true)
      expect(twoLoading.value).toBe(false)
      const twoFirst = two(100)
      expect(oneLoading.value).toBe(true)
      expect(twoLoading.value).toBe(true)

      await vi.advanceTimersToNextTimerAsync()
      await expect(twoFirst).resolves.toBe(100)
      expect(oneLoading.value).toBe(true)
      expect(twoLoading.value).toBe(false)
      
      await vi.advanceTimersToNextTimerAsync()
      await expect(oneFirst).resolves.toBe(200)
      expect(oneLoading.value).toBe(false)
      expect(twoLoading.value).toBe(false)
    })

    test('arguments state should reflect the latest call when multiple async methods are called', async () => {
      vi.useFakeTimers()
      const { slow, slowArguments } = useAsync('slow', async (x: number) => {
        await wait(100)
        return x
      })
      slow(1)
      expect(slowArguments.value).toEqual([1])
      slow(2)
      expect(slowArguments.value).toEqual([2]) // updated to latest
      await vi.advanceTimersByTimeAsync(50)
      expect(slowArguments.value).toEqual([2]) // still latest
      await vi.runAllTimersAsync()
      expect(slowArguments.value).toBeUndefined()
    })

    test('error state should reflect the latest call when multiple async methods with errors are called out of order', async () => {
      vi.useFakeTimers()
      const { two, twoLoading, twoError } = useAsync('two', async (error?: any) => {
        await wait(100)
        if (error) throw error
        return 'ok'
      })
      expect(twoLoading.value).toBe(false)
      expect(twoError.value).toBeUndefined()
      const p1 = two('error')
      expect(twoLoading.value).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      const p2 = two('error2')
      await vi.advanceTimersToNextTimerAsync()
      await expect(p1).rejects.toThrow('error')
      expect(twoError.value).toBeUndefined()
      expect(twoLoading.value).toBe(true)
      await vi.runAllTimersAsync()
      await expect(p2).rejects.toThrow('error2')
      expect(twoError.value).toBe('error2')
      expect(twoLoading.value).toBe(false)
    })
  })
})
