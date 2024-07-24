import { describe, expect, test, vi } from 'vitest'
import { useAsyncData } from '../use-async-data'

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