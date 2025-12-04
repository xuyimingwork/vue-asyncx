import { describe, expect, test } from "vitest"
import { getAsyncDataContext, prepareAsyncDataContext } from "../use-async-data.context"

// 正常流程	should [do X] when [valid input]
// 边界值	should [handle correctly] when [input = boundary]
// 异常输入	should throw [error] when [invalid input]
// 空值处理	should return [default] when [arg is null/undefined]
// 异步成功	should resolve with [value] when [condition]
// 异步失败	should reject with [error] when [failure condition]
// 状态变更	should set [state] to [value] after [action]

describe('context single', () => {
  test('should throw error when not prepare', () => {
    expect(() => getAsyncDataContext()).toThrowError()
  })
  test('should set context after prepare', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
  })
  test('should throw error after restore', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
    expect(() => getAsyncDataContext()).toThrowError()
  })
  test('should throw error when restore', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
    expect(() => getAsyncDataContext()).toThrowError()
  })
})

describe('context multiple', () => {
  test('should set context in order when prepare in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    expect(getAsyncDataContext()).toBe(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    restore2()
    restore1()
  })

  test('should restore context in order after restore in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    restore2()
    expect(getAsyncDataContext()).toBe(context1)
    restore1()
    expect(() => getAsyncDataContext()).toThrowError()
  })

  test('should throw error when not restore in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    expect(() => restore1()).toThrowError()
    expect(getAsyncDataContext()).toBe(context2)
    expect(() => restore2()).not.toThrowError()
    expect(getAsyncDataContext()).toBe(context1)
    expect(() => restore1()).not.toThrowError()
    expect(() => getAsyncDataContext()).toThrowError()
  })
})

import { useAsyncData } from '../use-async-data'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useAsyncData', () => {
  test('调用异步，中途更新', async () => {
    const { queryProgress, progress } = useAsyncData('progress', async function() {
      const { getData, updateData } = getAsyncDataContext()
      expect(getData()).toBeUndefined()
      updateData(0)
      await wait(100)
      expect(getData()).toBe(0)
      updateData(30)
      await wait(100)
      expect(getData()).toBe(30)
      updateData(60)
      await wait(100)
      expect(getData()).toBe(60)
      return 100
    })
    
    expect(progress.value).toBeUndefined()
    queryProgress()
    expect(progress.value).toBe(0)
    await wait(150)
    expect(progress.value).toBe(30)
    await wait(100)
    expect(progress.value).toBe(60)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('调用异步，中途更新，多次', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    const { queryProgress, progress } = useAsyncData('progress', async function() {
      const { getData, updateData } = getAsyncDataContext()
      updateData(0)
      await wait(100)
      expect(getData()).toBe(0)
      updateData(30)
      await wait(100)
      expect(getData()).toBe(30)
      updateData(60)
      await wait(100)
      expect(getData()).toBe(60)
      return 100
    })
    
    expect(progress.value).toBeUndefined()
    queryProgress()
    expect(progress.value).toBe(0)
    await wait(150)
    expect(progress.value).toBe(30)
    queryProgress()
    expect(progress.value).toBe(0)
    await wait(150)
    expect(progress.value).toBe(30)
    await wait(100)
    expect(progress.value).toBe(60)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('调用异步，中途更新，数据过期', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function(update: number, result: number, error: any) {
      const { updateData } = getAsyncDataContext()
      if (error) throw error
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      return updateData(result)
    })
    
    // 初始状态数据未过期
    expect(progressExpired.value).toBeFalsy()
    // p1 请求报错，数据过期
    await expect(queryProgress(1, 1, 'error')).rejects.toBe('error')
    expect(queryProgressError.value).toBeTruthy()
    expect(progressExpired.value).toBeTruthy()
    // 触发 p2，数据仍然过期
    queryProgress(50, 100, undefined)
    expect(progressExpired.value).toBeTruthy()
    expect(queryProgressError.value).toBeUndefined()
    // p2 中途更新数据，数据不过期
    await wait(150)
    expect(progress.value).toBe(50)
    expect(progressExpired.value).toBeFalsy()
    // p2 完成，数据不过期
    await wait(100)
    expect(progress.value).toBe(100)
    expect(progressExpired.value).toBeFalsy()
  })

  test('调用异步，结束后更新', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    const { queryProgress, progress } = useAsyncData('progress', async function(update: number, result: number) {
      const { updateData } = getAsyncDataContext()
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      // return 后仍调用 updateData，
      setTimeout(() => updateData(result + update), 0)
      return updateData(result)
    })
    
    queryProgress(50, 100)
    await wait(150)
    expect(progress.value).toBe(50)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('should update data when later error', async () => {
    const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function(update: number, result: number, error: any): Promise<number> {
      const { updateData } = getAsyncDataContext()
      if (error) throw error
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      updateData(result)
      return result
    }, { initialData: 0 })

    expect(progress.value).toBe(0)
    queryProgress(1, 2, undefined)
    queryProgress(3, 4, 'error')
    await wait(100)
    expect(progress.value).toBe(1)
    expect(progressExpired.value).toBe(true)
    await wait(100)
    expect(progress.value).toBe(2)
    expect(progressExpired.value).toBe(true)
  })

  test('should get origin data when data update', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    const { list, queryList } = useAsyncData('list', async function(page: number, ms: number) {
      const { getData } = getAsyncDataContext()
      await wait(ms)
      return [...getData(), page]
    }, { initialData: [] })
    
    await queryList(1, 0)
    expect(list.value).toEqual([1])
    queryList(2, 50) // 先更新
    // 如果此处调用 queryList(3, 100)，结果应该是什么？
    // 或者场景错误，不应该出现 queryList(3, 100) 场景
    queryList(2, 100) // 后更新
    await wait(100)
    expect(list.value).toEqual([1, 2])
  })
})