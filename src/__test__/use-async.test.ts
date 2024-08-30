import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useAsync } from '../use-async'

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

  test('watch 参数立即执行优先', async () => {
    const temp = { fn: () => 1 }
    const fnSpy = vi.spyOn(temp, 'fn')
    expect(fnSpy).not.toBeCalled()
    useAsync(temp.fn, { watchOptions: { immediate: false }, immediate: true })
    expect(fnSpy).toBeCalledTimes(0)
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
    const { doAsyncMethod, doAsyncMethodArguments } = useAsync('doAsyncMethod', function (a: number, b: number) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(a + b), 100)
      })
    })
    expect(doAsyncMethodArguments.value).toBeUndefined()
    const p = doAsyncMethod(1, 1)
    expect(doAsyncMethodArguments.value).toMatchObject([1, 1])
    await p.then(() => expect(doAsyncMethodArguments.value).toBeUndefined())
  })

  test('函数结果', async () => {
    const { method } = useAsync(() => 1)
    expect(method()).toBe(1)
    const { doAsyncMethod } = useAsync('doAsyncMethod', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
    await expect(doAsyncMethod()).resolves.toBe(1)
  })
})
