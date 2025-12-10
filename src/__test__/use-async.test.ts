import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
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

      test('should return independent values for each call even after a rejected call', async () => {
        const { method } = useAsync(async (type: string) => {
          if (type === 'err') throw new Error('fail')
          return `result-${type}`
        })
        await expect(method('err')).rejects.toThrow()
        const result = await method('ok')
        expect(result).toBe('result-ok') // 必须是原始返回值，不能是 undefined 或错误值
      })
    })

    test('Align: useAsyncFunction should be the same as useAsync', () => {
      expect(useAsyncFunction).toBe(useAsync)
    })
  })

  describe('Execution Control', () => {
    describe('Immediate Execution', () => {
      test('should not execute the function immediately when immediate option is not provided', () => {
        const temp = { fn: () => 1 }
        const fnSpy = vi.spyOn(temp, 'fn')
        expect(fnSpy).not.toBeCalled()
        useAsync(temp.fn)
        expect(fnSpy).toBeCalledTimes(0)
      })
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
      test('should execute function when watch source value changes', async () => {
        const spy = vi.fn(() => 1)
        const source = ref(1)
        useAsync(spy, { watch: source, immediate: false })
        expect(spy).not.toHaveBeenCalled() // 关键：确保没立即执行
        await nextTick()
        expect(spy).not.toHaveBeenCalled()
        source.value = 2
        await nextTick()
        expect(spy).toHaveBeenCalledTimes(1)
      })

      test('should execute function when watched value changes with immediate: true', async () => {
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

      test('should execute function when null or undefined in watch array', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation((message) => {
          if (typeof message === 'string' && message.includes('Invalid watch source: null')) {
            return
          }
        })
        const spy = vi.fn()
        const source = ref(1)
        useAsync(spy, { watch: [source, null, undefined] as any, immediate: true })
        expect(spy).toHaveBeenCalledTimes(1)
        source.value = 2
        await nextTick()
        expect(spy).toHaveBeenCalledTimes(2)
        consoleWarnSpy.mockRestore()
      })

      test('should support watching reactive object with deep option', async () => {
        const obj = reactive({ count: 0 })
        const spy = vi.fn()
        useAsync(spy, { watch: obj as any, watchOptions: { deep: true, immediate: true } })
        expect(spy).toHaveBeenCalledTimes(1)
        obj.count++
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
          handlerCreator() {
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
          handlerCreator() {
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

      test('should correctly handle interleaved manual and watch-triggered calls', async () => {
        const spy = vi.fn((x: number) => wait(x).then(() => x))
        const source = ref(1)
        const { method, methodLoading, methodArguments, methodError } = useAsync(
          spy,
          { watch: source, watchOptions: { handlerCreator: (fn) => (v) => fn(v) } }
        )

        // 1. 手动调用 (sn=1)
        method(10)
        expect(spy).toBeCalledTimes(1)
        expect(methodLoading.value).toBe(true)
        expect(methodArguments.value).toEqual([10])

        // 2. 修改 source，触发 watch 调用 (sn=2)
        source.value = 20
        await nextTick() // => 可能无法 fake
        expect(spy).toBeCalledTimes(2)
        expect(methodLoading.value).toBe(true)
        expect(methodArguments.value).toEqual([20]) // 应立即更新为新参数

        // 3. 再次手动调用 (sn=3)
        method(30)
        expect(spy).toBeCalledTimes(3)
        expect(methodLoading.value).toBe(true)
        expect(methodArguments.value).toEqual([30])

        // 先完成 sn=1（应被忽略：不影响 loading/arguments/error）
        await wait(10)
        expect(methodLoading.value).toBe(true)      // 仍在加载（sn=2,3 未完成）
        expect(methodArguments.value).toEqual([30]) // 仍为最新参数
        expect(methodError.value).toBeUndefined()

        // 再完成 sn=2（仍非最新，应被忽略）
        await wait(10)
        expect(methodLoading.value).toBe(true)      // sn=3 还没完
        expect(methodArguments.value).toEqual([30])

        // 最后完成 sn=3（应结束 loading，清空 arguments）
        await wait(10)
        expect(methodLoading.value).toBe(false)
        expect(methodArguments.value).toBeUndefined() // 调用结束后重置
        expect(methodError.value).toBeUndefined()
      })

      test('should pass nothing to watch-triggered calls when handlerCreator is not provided', async () => {
        const spy = vi.fn((...args) => args.length)
        const source = ref(1)
        useAsync(spy, { watch: source })
        source.value = 2
        await nextTick()
        expect(spy).toHaveBeenCalledWith() // no args
      })

      test('should pass arguments to watch-triggered calls as handlerCreator set', async () => {
        const spy = vi.fn((...args) => args.length)
        const source = ref(1)
        useAsync(spy, { watch: source, watchOptions: { handlerCreator: (fn) => () => fn('hello world') } })
        source.value = 2
        await nextTick()
        expect(spy).toHaveBeenCalledWith('hello world')
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

      test('should handle error thrown by setup-wrapped function', async () => {
        const { method, methodError, methodLoading } = useAsync(() => 'ok', {
          setup: () => () => { throw new Error('from setup') }
        })
        expect(() => method()).toThrow('from setup')
        expect(methodError.value).toBeUndefined() // 因为是同步抛错，error 不会被捕获进 ref
        expect(methodLoading.value).toBe(false)
      })

      test('should not cause infinite loop when setup returns another useAsync method', () => {
        const inner = useAsync(() => 'inner')
        const outer = useAsync(() => 'outer', {
          setup: () => inner.method
        })
        expect(outer.method()).toBe('inner') // 应正常工作，无递归
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

      test('should capture non-Error sync function throws (string, null, object)', () => {
        const cases = [
          'string error',
          null,
          undefined,
          { code: 400 },
          404
        ]

        for (const err of cases) {
          const { method, methodError } = useAsync(() => { throw err })
          try {
            method()
          } catch(e) {
            expect(e).toBe(err)
          }
          expect(methodError.value).toStrictEqual(err)
        }
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

      test('should clear error when a new sync call is made', () => {
        let shouldThrow = true
        const { method, methodError } = useAsync(() => {
          if (shouldThrow) throw new Error('first')
          return 'ok'
        })
        expect(() => method()).toThrow()
        expect(methodError.value).toBeDefined()

        shouldThrow = false
        method() // 第二次调用（sync 成功）
        expect(methodError.value).toBeUndefined() // 应在调用开始时清空
      })
    })
  })

  describe('Concurrency Control', () => {
    describe('Loading State', () => {
      test('should reflect the latest call when multiple async methods are finished in order', async () => {
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

      test('should reflect the latest call when multiple async methods are finished out of order', async () => {
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

      test('should not interfere when multiple different async methods are called', async () => {
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
    })

    describe('Arguments State', () => {
      test('should reflect the latest call when multiple async methods are finished in order', async () => {
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

      test('should reflect the latest call when multiple async methods are finished out of order', async () => {
        vi.useFakeTimers()
        const { method, methodArguments, methodArgumentFirst } = useAsync(async (x: number) => {
          await wait(x === 1 ? 200 : 50); // call1 慢，call2 快
          return x;
        });

        method(1); // 慢调用
        expect(methodArguments.value).toEqual([1]);
        expect(methodArgumentFirst.value).toBe(1)

        await vi.advanceTimersByTimeAsync(10);
        method(2); // 快调用 —— 应立即覆盖 arguments
        expect(methodArguments.value).toEqual([2]); // ✅ 关键：即使 call1 还在 pending，arguments 已更新
        expect(methodArgumentFirst.value).toBe(2)

        await vi.advanceTimersToNextTimerAsync(); // call2 完成
        expect(methodArguments.value).toBeUndefined(); // 完成后清空
        expect(methodArgumentFirst.value).toBeUndefined()

        await vi.runAllTimersAsync(); // call1 完成（但已是过期调用）
        expect(methodArguments.value).toBeUndefined(); // 仍为空
        expect(methodArgumentFirst.value).toBeUndefined()
      });

      test('should reflect the latest call when intermediate calls rejected', async () => {
        vi.useFakeTimers()
        const { method, methodArguments } = useAsync(async (id: number, shouldFail = false) => {
          if (shouldFail) throw new Error('fail')
          await wait(50)
          return id
        })

        method(1, true) // reject
        expect(methodArguments.value).toEqual([1, true])

        await vi.advanceTimersByTimeAsync(10)
        method(2, false) // fulfill
        expect(methodArguments.value).toEqual([2, false]) // ✅ 应立即更新

        await vi.runAllTimersAsync()
        expect(methodArguments.value).toBeUndefined() // fulfill 后清空
      })
    })

    describe('Error State', () => {
      test('should reflect the latest call when multiple async methods are finished with errors in order', async () => {
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
        // p1 50ms 后调用 p2
        const p2 = two('error2')
        await vi.advanceTimersToNextTimerAsync()
        // p1 完成，由于 p2 已发起，error 不会被赋值
        await expect(p1).rejects.toThrow('error')
        expect(twoError.value).toBeUndefined()
        // p2 未完成，loading 为 true
        expect(twoLoading.value).toBe(true)
        await vi.runAllTimersAsync()
        await expect(p2).rejects.toThrow('error2')
        expect(twoError.value).toBe('error2')
        expect(twoLoading.value).toBe(false)
      })

      test('should always be undefined when latest call is fulfilled first', async () => {
        vi.useFakeTimers()
        const { method, methodError, methodLoading } = useAsync(async (id: number) => {
          await wait(id === 1 ? 200 : 50); // call1 慢且失败，call2 快且成功
          if (id === 1) throw new Error('old fail');
          return 'ok';
        });

        const p1 = method(1); // 慢 + 失败
        await vi.advanceTimersByTimeAsync(10)
        method(2); // 快 + 成功

        // p2 先完成
        await vi.advanceTimersToNextTimerAsync();
        expect(methodError.value).toBeUndefined();
        expect(methodLoading.value).toBe(false);

        await vi.runAllTimersAsync();
        // p1 后 reject（不应影响状态）
        await expect(p1).rejects.toThrow();
        expect(methodError.value).toBeUndefined();
      });
    })
  })
})
