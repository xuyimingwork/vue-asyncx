import { describe, expect, test, vi } from 'vitest'
import { useAsync, useAsyncData } from '../main'
import { ref } from 'vue'

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
  })

  test('自定义名称', () => {
    const result = useAsync('getOne', () => 1)
    expect(result.getOne).toBeTruthy()
    expect(result.getOneLoading).toBeTruthy()
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

  test('函数结果', () => {
    const { method } = useAsync(() => 1)
    expect(method()).toBe(1)
    const { doAsyncMethod } = useAsync('doAsyncMethod', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
    expect(doAsyncMethod()).resolves.toBe(1)
  })
})

describe('useAsyncData', () => {
  test('非法参数', () => {
    // @ts-expect-error
    expect(() => useAsyncData()).toThrowError('参数错误：未传递')
    // @ts-expect-error
    expect(() => useAsyncData(1, () => {})).toThrowError('参数错误：name')
    // @ts-expect-error
    expect(() => useAsyncData('', 1)).toThrowError('参数错误：fn')
  })

  test('默认名称', () => {
    const result = useAsyncData(() => 1)
    expect(result.data).toBeTruthy()
    expect(result.queryData).toBeTruthy()
    expect(result.queryDataLoading).toBeTruthy()
  })

  test('自定义名称', () => {
    const result = useAsyncData('one', () => 1)
    expect(result.one).toBeTruthy()
    expect(result.queryOne).toBeTruthy()
    expect(result.queryOneLoading).toBeTruthy()
  })

  test('data 初始值', () => {
    const result = useAsyncData('one', () => 1)
    expect(result.one).toBeTruthy()
    expect(result.one.value).toBeUndefined()
  })

  test('data 值正确', () => {
    const result = useAsyncData('one', () => 1)
    result.queryOne()
    expect(result.one.value).toBe(1)
  })

  test('data 异步值正确', async () => {
    const result = useAsyncData('one', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
    await result.queryOne()
    expect(result.one.value).toBe(1)
  })

  test('函数结果', () => {
    const sum = (a: number, b: number) => a + b
    const { querySum } = useAsyncData('sum', () => sum(1, 1))
    expect(querySum()).toBe(2)
    const { queryAsyncSum } = useAsyncData('asyncSum', () => new Promise((resolve) => setTimeout(() => resolve(sum(1, 1)), 100)))
    expect(queryAsyncSum()).resolves.toBe(2)
  })
})