import { describe, expect, test, vi } from 'vitest'
import { ref, shallowRef, watch } from 'vue'
import { useAsync } from '../use-async'
import { debounce } from 'es-toolkit'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useAsync', () => {
  test('非法参数', () => {
    // @ts-expect-error
    expect(() => useAsync()).toThrowError('参数错误：未传递')
    // @ts-expect-error
    expect(() => useAsync(1, () => {})).toThrowError('参数错误：name')
    // @ts-expect-error
    expect(() => useAsync('', 1)).toThrowError('参数错误：fn')
  })

  test('默认名称', () => {
    const result = useAsync(() => 1)
    expect(result.method).toBeTruthy()
    expect(result.methodLoading).toBeTruthy()
    expect(result.methodArguments).toBeTruthy()
  })

  test('自定义名称', () => {
    const result = useAsync('getOne', () => 1)
    expect(result.getOne).toBeTruthy()
    expect(result.getOneLoading).toBeTruthy()
    expect(result.getOneArguments).toBeTruthy()
  })

  test('立即执行', () => {
    const temp = { fn: () => 1 }
    const fnSpy = vi.spyOn(temp, 'fn')
    expect(fnSpy).not.toBeCalled()
    useAsync(temp.fn, { immediate: true })
    expect(fnSpy).toBeCalledTimes(1)
  })

  test('使用 watch', async () => {
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

  test('使用 watch 参数', async () => {
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

  test('watch 参数优先级', async () => {
    const temp = { fn: () => 1 }
    const fnSpy = vi.spyOn(temp, 'fn')
    expect(fnSpy).not.toBeCalled()
    useAsync(temp.fn, { watchOptions: { immediate: false }, immediate: true })
    expect(fnSpy).toBeCalledTimes(0)
  })

  test('watch 自定义 handler', async () => {
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

  test('watch 自定义 handler 异常', async () => {
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

  test('watch 自定义 handler 无效', async () => {
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

  test('异步加载', () => {
    const { method, methodLoading } = useAsync(() => new Promise((resolve) => setTimeout(resolve, 100)))
    expect(methodLoading.value).toBe(false)
    method()
    expect(methodLoading.value).toBe(true)
  })

  test('异步加载完成', async () => {
    const { method, methodLoading } = useAsync(() => new Promise((resolve) => setTimeout(resolve, 100)))
    expect(methodLoading.value).toBe(false)
    await method()
    expect(methodLoading.value).toBe(false)
  })

  test('函数参数', async () => {
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

  test('函数结果', async () => {
    const { method } = useAsync(() => 1)
    expect(method()).toBe(1)
    const { doAsyncMethod } = useAsync('doAsyncMethod', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
    await expect(doAsyncMethod()).resolves.toBe(1)
  })

  test('多次异步，结果顺序', async () => {
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

  test('多次异步，结果异序', async () => {
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

  test('交叉异步，互不影响', async () => {
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

  test('方法异常', () => {
    const error = Error()
    const { one, oneLoading } = useAsync('one', () => {
      throw error
    })

    expect(() => one()).toThrow(error)
    expect(oneLoading.value).toBe(false)
  })

  test('异步异常', async () => {
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

  test('异步乱序异常', async () => {
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

  test('setup', async () => {
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

  test('setup 异常', async () => {
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

  test('setup 无返回', async () => {
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
