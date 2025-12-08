import { describe, expect, test, vi } from 'vitest'
import { ref, shallowRef, watch } from 'vue'
import { useAsync } from '../use-async'
import { debounce } from 'es-toolkit'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useAsync', () => {
  // 参数验证
  describe('Parameter Validation', () => {
    test('When invalid parameters are passed to useAsync, it should throw appropriate errors', () => {
      // @ts-expect-error
      expect(() => useAsync()).toThrowError('参数错误：未传递')
      // @ts-expect-error
      expect(() => useAsync(1, () => {})).toThrowError('参数错误：name')
      // @ts-expect-error
      expect(() => useAsync('', 1)).toThrowError('参数错误：fn')
    })
  })

  // 命名功能
  describe('Naming Functionality', () => {
    test('When no custom name is provided to useAsync, it should use default method names', () => {
      const result = useAsync(() => 1)
      expect(result.method).toBeTruthy()
      expect(result.methodLoading).toBeTruthy()
      expect(result.methodArguments).toBeTruthy()
    })

    test('When a custom name is provided to useAsync, it should use the custom method names', () => {
      const result = useAsync('getOne', () => 1)
      expect(result.getOne).toBeTruthy()
      expect(result.getOneLoading).toBeTruthy()
      expect(result.getOneArguments).toBeTruthy()
    })
  })

  // 立即执行
  describe('Immediate Execution', () => {
    test('When immediate option is true, useAsync should execute the function immediately', () => {
      const temp = { fn: () => 1 }
      const fnSpy = vi.spyOn(temp, 'fn')
      expect(fnSpy).not.toBeCalled()
      useAsync(temp.fn, { immediate: true })
      expect(fnSpy).toBeCalledTimes(1)
    })
  })

  // Watch 功能
  describe('Watch Functionality', () => {
    test('When watch option is provided, useAsync should execute function when watched value changes', async () => {
      const temp = { fn: () => 1 }
      const fnSpy = vi.spyOn(temp, 'fn')
      expect(fnSpy).not.toBeCalled()
      const source = ref(1)
      useAsync(temp.fn, { watch: source, immediate: true })
      expect(fnSpy).toBeCalledTimes(1)
      source.value++
      await new Promise(r => setTimeout(r));
      expect(fnSpy).toBeCalledTimes(2)
    })

    test('When watchOptions.immediate is true, useAsync should execute function immediately', async () => {
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

    test('When both watchOptions.immediate and immediate options are provided, watchOptions takes priority', async () => {
      const temp = { fn: () => 1 }
      const fnSpy = vi.spyOn(temp, 'fn')
      expect(fnSpy).not.toBeCalled()
      useAsync(temp.fn, { watchOptions: { immediate: false }, immediate: true })
      expect(fnSpy).toBeCalledTimes(0)
    })

    test('When custom handlerCreator is provided, useAsync should use the custom handler', async () => {
      const temp = { fn: () => 1, handler: () => false }
      const fnSpy = vi.spyOn(temp, 'fn')
      const handlerSpy = vi.spyOn(temp, 'handler')
      expect(fnSpy).not.toBeCalled()
      expect(handlerSpy).not.toBeCalled()
      useAsync(temp.fn, { watchOptions: { 
        handlerCreator(fn) {
          return () => {
            const r = temp.handler()
            if (!r) return
            fn()
          }
        }
      }, immediate: true })
      expect(handlerSpy).toBeCalledTimes(1)
      expect(fnSpy).toBeCalledTimes(0)
    })

    test('When handlerCreator throws an error, useAsync should fall back to default handler', async () => {
      const temp = { fn: () => 1, handler: () => false }
      const fnSpy = vi.spyOn(temp, 'fn')
      const handlerSpy = vi.spyOn(temp, 'handler')
      expect(fnSpy).not.toBeCalled()
      expect(handlerSpy).not.toBeCalled()
      useAsync(temp.fn, { watchOptions: { 
        handlerCreator(fn) {
          throw Error()
          return () => {
            const r = temp.handler()
            if (!r) return
            fn()
          }
        }
      }, immediate: true })
      expect(handlerSpy).toBeCalledTimes(0)
      expect(fnSpy).toBeCalledTimes(1)
    })

    test('When handlerCreator returns invalid value, useAsync should fall back to default handler', async () => {
      const temp = { fn: () => 1, handler: () => false }
      const fnSpy = vi.spyOn(temp, 'fn')
      expect(fnSpy).not.toBeCalled()
      useAsync(temp.fn, { watchOptions: { 
        handlerCreator(fn) {
          return '' as any
        }
      }, immediate: true })
      expect(fnSpy).toBeCalledTimes(1)
    })
  })

  // 异步加载状态
  describe('Async Loading State', () => {
    test('When executing an async function, methodLoading should be true during execution', () => {
      const { method, methodLoading } = useAsync(() => new Promise((resolve) => setTimeout(resolve, 100)))
      expect(methodLoading.value).toBe(false)
      method()
      expect(methodLoading.value).toBe(true)
    })

    test('When async function completes, methodLoading should be false', async () => {
      const { method, methodLoading } = useAsync(() => new Promise((resolve) => setTimeout(resolve, 100)))
      expect(methodLoading.value).toBe(false)
      await method()
      expect(methodLoading.value).toBe(false)
    })
  })

  // 函数参数和结果
  describe('Function Arguments and Results', () => {
    test('When method is called with arguments, it should store arguments in reactive references', async () => {
      const { doAsyncMethod, doAsyncMethodArguments, doAsyncMethodArgumentFirst } = useAsync('doAsyncMethod', function (a: number, b: number) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(a + b), 100)
        })
      })
      expect(doAsyncMethodArguments.value).toBeUndefined()
      expect(doAsyncMethodArgumentFirst.value).toBeUndefined()
      const p = doAsyncMethod(1, 1)
      expect(doAsyncMethodArguments.value).toMatchObject([1, 1])
      expect(doAsyncMethodArgumentFirst.value).toBe(1)
      await p.then(() => {
        expect(doAsyncMethodArguments.value).toBeUndefined()
        expect(doAsyncMethodArgumentFirst.value).toBeUndefined()
      })
    })

    test('When method is called, it should return the correct result', async () => {
      const { method } = useAsync(() => 1)
      expect(method()).toBe(1)
      const { doAsyncMethod } = useAsync('doAsyncMethod', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
      await expect(doAsyncMethod()).resolves.toBe(1)
    })
  })

  // 多次异步调用
  describe('Multiple Async Calls', () => {
    test('When multiple async methods are called in order, loading state should reflect the latest call', async () => {
      const { one, oneLoading } = useAsync('one', async (ms: number) => {
        await wait(ms)
        return ms
      })

      const first = one(100)
      const second = one(200)

      expect(oneLoading.value).toBe(true)

      await first
      // 由于仅等待了 first，仍处于 second 过程，因此应为 true
      expect(oneLoading.value).toBe(true)

      await second
      expect(oneLoading.value).toBe(false)
    })

    test('When multiple async methods are called out of order, loading state should reflect the latest call', async () => {
      const { one, oneLoading } = useAsync('one', async (ms: number) => {
        await wait(ms)
        return ms
      })

      const first = one(200)
      const second = one(100)

      expect(oneLoading.value).toBe(true)

      await second
      expect(oneLoading.value).toBe(false)

      await first
      expect(oneLoading.value).toBe(false)
    })

    test('When multiple different async methods are called, their loading states should not interfere', async () => {
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

      await expect(twoFirst).resolves.toBe(100)
      expect(oneLoading.value).toBe(true)
      expect(twoLoading.value).toBe(false)
      

      await expect(oneFirst).resolves.toBe(200)
      expect(oneLoading.value).toBe(false)
      expect(twoLoading.value).toBe(false)
    })
  })

  // 异常处理
  describe('Error Handling', () => {
    test('When sync method throws an error, it should propagate the error and reset loading state', () => {
      const error = Error()
      const { one, oneLoading } = useAsync('one', () => {
        throw error
      })

      expect(() => one()).toThrow(error)
      expect(oneLoading.value).toBe(false)
    })

    test('When async method throws an error, it should propagate the error and reset loading state', async () => {
      const twoError = Error()
      const { two, twoLoading } = useAsync('two', async () => {
        await wait(100)
        throw twoError
      })

      await expect(() => {
        const p = two()
        expect(twoLoading.value).toBe(true)
        return p
      }).rejects.toThrow(twoError)
      expect(twoLoading.value).toBe(false)
    })

    test('When multiple async methods with errors are called out of order, only latest error should be stored', async () => {
      const { two, twoLoading, twoError } = useAsync('two', async (error?: any) => {
        await wait(100)
        if (error) throw error
        return 'ok'
      })

      expect(twoLoading.value).toBe(false)
      expect(twoError.value).toBeUndefined()
      const p1 = two('error')
      expect(twoLoading.value).toBe(true)
      await wait(50)
      const p2 = two('error2')
      await expect(p1).rejects.toThrow('error')
      expect(twoError.value).toBeUndefined()
      expect(twoLoading.value).toBe(true)
      await expect(p2).rejects.toThrow('error2')
      expect(twoError.value).toBe('error2')
      expect(twoLoading.value).toBe(false)
    })
  })

  // Setup 功能
  describe('Setup Functionality', () => {
    test('When setup function is provided, useAsync should use the setup-wrapped function', async () => {
      const ref = { 
        fn: async () => {
          await wait(100)
        } 
      }
      const spy = vi.spyOn(ref, 'fn')
      const { method, methodLoading } = useAsync(ref.fn, { 
        setup(fn) {
          return debounce(fn, 50)
        }
      })
      method()
      method()
      method()
      expect(spy).not.toBeCalled()
      expect(methodLoading.value).toBeFalsy()
      await wait(50)
      expect(methodLoading.value).toBeTruthy()
      expect(spy).toBeCalledTimes(1)
      await wait(100)
      expect(methodLoading.value).toBeFalsy()
    })

    test('When setup function throws an error, useAsync should fall back to original function', async () => {
      const ref = { 
        fn: async () => {
          await wait(100)
        } 
      }
      const spy = vi.spyOn(ref, 'fn')
      const { method, methodLoading } = useAsync(ref.fn, { 
        setup(fn) {
          throw Error()
          return debounce(fn, 50) as any
        }
      })
      method()
      method()
      method()
      expect(spy).toBeCalledTimes(3)
      expect(methodLoading.value).toBeTruthy()
      await wait(100)
      expect(methodLoading.value).toBeFalsy()
    })

    test('When setup function returns undefined, useAsync should manage loading state for external calls', async () => {
      const ref = { 
        fn: async () => {
          await wait(100)
        } 
      }
      const spy = vi.spyOn(ref, 'fn')
      const source = shallowRef(0)
      const { methodLoading } = useAsync(ref.fn, { 
        setup(fn) {
          watch(source, () => fn())
        }
      })
      expect(spy).toBeCalledTimes(0)
      source.value++
      await wait(0)
      expect(spy).toBeCalledTimes(1)
      expect(methodLoading.value).toBeTruthy()
      await wait(100)
      expect(methodLoading.value).toBeFalsy()
    })
  })
})
