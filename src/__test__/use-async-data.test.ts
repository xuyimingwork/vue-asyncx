import { afterEach, describe, expect, test, vi } from 'vitest'
import { unFirstArgumentEnhanced, useAsyncData, getAsyncDataContext } from '../use-async-data'
import { isReactive } from 'vue'
import { debounce } from 'es-toolkit'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
afterEach(() => vi.useRealTimers())

describe('unFirstArgumentEnhanced', () => {
  test('should not enhance first argument when options.enhanceFirstArgument is not provided', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      expect(a).toBeTypeOf('number')
      expect(b).toBeTypeOf('number')
      expect(() => unFirstArgumentEnhanced(a)).toThrowError()
      return a + b
    })
    expect(queryData(1, 1)).toBe(2)
  })

  test('should enhance first argument correctly when options.enhanceFirstArgument is true', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      expect(a).toBeTypeOf('object')
      expect(() => unFirstArgumentEnhanced(a)).not.toThrowError()
      expect(unFirstArgumentEnhanced(a).firstArgument).toBe(1)
      expect(b).toBeTypeOf('number')
      expect(() => unFirstArgumentEnhanced(b)).toThrowError()
      return unFirstArgumentEnhanced(a).firstArgument + b
    }, { enhanceFirstArgument: true })
    expect(queryData(1, 1)).toBe(2)
  })

  test('should not enhance first argument when options.enhanceFirstArgument is false', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      expect(a).toBeTypeOf('number')
      expect(b).toBeTypeOf('number')
      expect(() => unFirstArgumentEnhanced(a)).toThrowError()
      return a + b
    }, { enhanceFirstArgument: false })
    expect(queryData(1, 1)).toBe(2)
  })

  test('should not have firstArgument property when no argument is passed', () => {
    const { queryNoArgs } = useAsyncData('noArgs', function () {
      const result = unFirstArgumentEnhanced(arguments[0])
      expect('firstArgument' in result).toBeFalsy()
      return true
    }, { enhanceFirstArgument: true })
    expect(queryNoArgs()).toBe(true)
  })

  test('should have firstArgument property when undefined is passed', () => {
    const { queryFirstUndefined } = useAsyncData('firstUndefined', function (u) {
      const result = unFirstArgumentEnhanced(u)
      expect('firstArgument' in result).toBeTruthy()
      expect(result.firstArgument).toBeUndefined()
      return true
    }, { enhanceFirstArgument: true })
    expect(queryFirstUndefined(undefined)).toBe(true)
  })

  test('should use default value when undefined is passed', () => {
    const { queryData } = useAsyncData((content?: string) => {
      return unFirstArgumentEnhanced(content, 'default').firstArgument
    }, { enhanceFirstArgument: true })
    expect(queryData(undefined)).toBe('default')
  })

  test('should use default value when no argument is passed', () => {
    const { queryData } = useAsyncData((content?: string) => {
      return unFirstArgumentEnhanced(content, 'default').firstArgument
    }, { enhanceFirstArgument: true })
    expect(queryData()).toBe('default')
  })

  test(`should not use default value when falsy value but not undefined is passed`, () => {
    const { queryData } = useAsyncData((content?: any) => {
      return unFirstArgumentEnhanced(content, 'default').firstArgument
    }, { enhanceFirstArgument: true })
    ;[null, -0, 0, NaN, '', false].forEach(v => {
      expect(queryData(v)).toBe(v)
    })
  })

  test('should compat with getAsyncDataContext', () => {
    const { queryData } = useAsyncData((content?: any) => {
      const { firstArgument, __va_fae, ...context } = unFirstArgumentEnhanced(content, 'default')
      expect(context).toStrictEqual(getAsyncDataContext())
      return firstArgument
    }, { enhanceFirstArgument: true })
    expect(queryData(1)).toBe(1)
  })
})

describe('useAsyncData', () => {
  test('should throw error when no arguments are passed', () => {
    // @ts-expect-error
    expect(() => useAsyncData()).toThrowError('参数错误：未传递')
  })

  test('should throw error when name is not a string', () => {
    // @ts-expect-error
    expect(() => useAsyncData(1, () => { })).toThrowError('参数错误：name')
  })

  test('should throw error when fn is not a function', () => {
    // @ts-expect-error
    expect(() => useAsyncData('', 1)).toThrowError('参数错误：fn')
  })

  test('should use default name when no name is passed', () => {
    const result = useAsyncData(() => 1)
    expect(Object.keys(result).sort()).toEqual([
      "data",
      "dataExpired",
      "queryData",
      "queryDataArgumentFirst",
      "queryDataArguments",
      "queryDataError",
      "queryDataLoading",
    ])
    expect(result.data).toBeTruthy()
    expect(result.dataExpired).toBeTruthy()
    expect(result.queryData).toBeTypeOf('function')
    expect(result.queryDataArgumentFirst).toBeTruthy()
    expect(result.queryDataArguments).toBeTruthy()
    expect(result.queryDataError).toBeTruthy()
    expect(result.queryDataLoading).toBeTruthy()
  })

  test('should use custom name when name is passed', () => {
    const result = useAsyncData('one', () => 1)
    expect(Object.keys(result).sort()).toEqual([
      "one",
      "oneExpired",
      "queryOne",
      "queryOneArgumentFirst",
      "queryOneArguments",
      "queryOneError",
      "queryOneLoading",
    ])
    expect(result.one).toBeTruthy()
    expect(result.oneExpired).toBeTruthy()
    expect(result.queryOne).toBeTypeOf('function')
    expect(result.queryOneArgumentFirst).toBeTruthy()
    expect(result.queryOneArguments).toBeTruthy()
    expect(result.queryOneError).toBeTruthy()
    expect(result.queryOneLoading).toBeTruthy()
  })

  test('should use ref when shallow is false or not passed', () => {
    const result = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } } })
    expect(isReactive(result.one.value.v)).toBeTruthy()
    const result2 = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } }, shallow: false })
    expect(isReactive(result2.one.value.v)).toBeTruthy()
  })

  test('should use shallowRef when shallow is true', () => {
    const result = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } }, shallow: true })
    expect(isReactive(result.one.value.v)).toBeFalsy()
  })

  test('should use undefined as initial data when not passed', () => {
    const result = useAsyncData('one', () => 1)
    expect(result.one.value).toBeUndefined()
  })

  test('should use initial data when passed', () => {
    const result = useAsyncData('one', () => 1, { initialData: 2 })
    expect(result.one.value).toBe(2)
  })

  test('should update data correctly when sync function is called', () => {
    const { one, queryOne } = useAsyncData('one', () => 1)
    expect(one.value).toBeUndefined()
    const result = queryOne()
    expect(one.value).toBe(result)
  })

  test('should update data correctly when async function is called',  async () => {
    vi.useFakeTimers()
    const result = useAsyncData('one', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
    const p = result.queryOne()
    await vi.runAllTimersAsync()
    expect(result.one.value).toBe(1)
    await expect(p).resolves.toBe(1)
  })

  test('多次异步，依次起止', async () => {
    const sumFunc = async (a: number, b: number) => {
      await Promise.resolve()
      return a + b
    }
    const { querySum, sum } = useAsyncData('sum', sumFunc)

    const p1 = querySum(40, 30)
    expect(sum.value).toBeUndefined()
    await p1
    expect(sum.value).toBe(70)

    const p2 = querySum(50, 40)
    // 上次计算结果
    expect(sum.value).toBe(70)
    await p2
    expect(sum.value).toBe(90)
  })

  test('多次异步，结果顺序', async () => {
    vi.useFakeTimers()
    const sumFunc = async (a: number, b: number) => {
      await wait(a + b)
      return a + b
    }
    const { querySum, sum } = useAsyncData('sum', sumFunc)
    // fast
    const p1 = querySum(40, 30)
    // slow
    const p2 = querySum(50, 40)
    expect(sum.value).toBeUndefined()
    await vi.advanceTimersToNextTimerAsync()
    await expect(p1).resolves.toBe(70)
    expect(sum.value).toBe(70)
    await vi.advanceTimersToNextTimerAsync()
    await expect(p2).resolves.toBe(90)
    expect(sum.value).toBe(90)
  })

  test('多次异步，结果异序', async () => {
    vi.useFakeTimers()
    const sumFunc = async (a: number, b: number) => {
      await wait(a + b)
      return a + b
    }
    const { querySum, sum } = useAsyncData('sum', sumFunc)
    // slow
    const p1 = querySum(170, 30)
    // fast
    const p2 = querySum(70, 30)
    expect(sum.value).toBeUndefined()

    await vi.advanceTimersToNextTimerAsync()
    await expect(p2).resolves.toBe(100)
    expect(sum.value).toBe(100)

    await vi.advanceTimersToNextTimerAsync()
    await expect(p1).resolves.toBe(200)
    expect(sum.value).toBe(100)
  })

  test('调用异常', async () => {
    const testFunc = (result: number, error?: Error) => {
      if (error) throw error
      return result
    }
    const { queryTest, test, testExpired } = useAsyncData('test', testFunc)

    expect(test.value).toBeUndefined()
    expect(queryTest(25)).toBe(test.value)

    const error = new Error()
    expect(() => queryTest(30, error)).toThrow(error)
    expect(test.value).toBe(25)
    expect(testExpired.value).toBeTruthy()
  })

  test('调用异步异常', async () => {
    vi.useFakeTimers()
    const testFunc = async (result: number, error?: Error, ms?: number) => {
      if (ms) await wait(ms)
      if (error) throw error
      return result
    }

    const { queryTest, test, testExpired } = useAsyncData('test', testFunc)

    expect(test.value).toBeUndefined()
    const p = queryTest(35, undefined, 30)
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBe(test.value)

    // 后者先到，展示后者数据，前者报错不影响
    const p1 = queryTest(36, new Error(), 100)
    const p2 = queryTest(51, undefined, 50)

    // p2 先结束
    await vi.advanceTimersToNextTimerAsync()
    await expect(p2).resolves.toBe(test.value)
    expect(testExpired.value).toBeFalsy()

    // p1 后结束
    await vi.advanceTimersToNextTimerAsync()
    await expect(p1).rejects.toThrowError()
    expect(test.value).toBe(51)
    expect(testExpired.value).toBeFalsy()

    // 后者先到，报错，前者后到，更新后到的前者数据
    const p3 = queryTest(37, undefined, 100)
    const p4 = queryTest(52, new Error(), 50)
    expect(testExpired.value).toBeFalsy()
    // p4 先结束，报错
    await vi.advanceTimersToNextTimerAsync()
    await expect(p4).rejects.toThrowError()
    expect(test.value).toBe(51)
    expect(testExpired.value).toBeTruthy()

    // p3 后结束，由于 p4 报错，p3 是最新的正确数据，更新 test.value 为 p3 的值
    await vi.advanceTimersToNextTimerAsync()
    await expect(p3).resolves.toBe(37)
    expect(test.value).toBe(37)
    expect(testExpired.value).toBeTruthy()
  })

  test('调用异步，中途更新', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function () {
      const { getData, updateData } = unFirstArgumentEnhanced(arguments[0])
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
    }, { enhanceFirstArgument: true })

    expect(progress.value).toBeUndefined()
    queryProgress()
    expect(progress.value).toBe(0)
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(30)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(60)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(100)
  })

  test('调用异步，中途更新，多次', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function () {
      const { getData, updateData } = unFirstArgumentEnhanced(arguments[0])
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
    }, { enhanceFirstArgument: true })

    expect(progress.value).toBeUndefined()
    queryProgress()
    expect(progress.value).toBe(0)
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(30)
    queryProgress()
    expect(progress.value).toBe(0)
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(30)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(60)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(100)
  })

  test('调用异步，中途更新，数据过期', async () => {
    // queryProgress 约耗时 300ms，每隔 100ms 更新
    vi.useFakeTimers()
    const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any) {
      const { updateData } = unFirstArgumentEnhanced(update)
      update = unFirstArgumentEnhanced(update).firstArgument
      if (error) throw error
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      return updateData(result)
    }, { enhanceFirstArgument: true })

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
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(50)
    expect(progressExpired.value).toBeFalsy()
    // p2 完成，数据不过期
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(100)
    expect(progressExpired.value).toBeFalsy()
  })

  test('should not update progress after async function return', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function (result: number, after:  number) {
      const { updateData } = unFirstArgumentEnhanced(result)
      result = unFirstArgumentEnhanced(result).firstArgument
      await wait(100)
      // return 后仍调用 updateData，
      setTimeout(() => updateData(after), 0)
      return updateData(result)
    }, { enhanceFirstArgument: true })

    queryProgress(100, 101)
    await vi.runAllTimersAsync()
    expect(progress.value).toBe(100)
  })

  test('setup', async () => {
    vi.useFakeTimers()
    const ref = {
      fn: async (result: number) => {
        await wait(100)
        return result
      }
    }
    const spy = vi.spyOn(ref, 'fn')
    const { queryData, data, queryDataLoading } = useAsyncData(ref.fn, {
      setup(fn) {
        return debounce(fn, 50)
      }
    })
    queryData(1)
    queryData(2)
    queryData(3)
    expect(spy).not.toBeCalled()
    expect(queryDataLoading.value).toBeFalsy()
    await vi.advanceTimersByTimeAsync(50)
    expect(queryDataLoading.value).toBeTruthy()
    expect(spy).toBeCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(queryDataLoading.value).toBeFalsy()
    expect(data.value).toBe(3)
  })
})

describe('useAsyncData with getAsyncDataContext', () => {
  test('should update data during async execution', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function () {
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
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(30)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(60)
    await vi.runAllTimersAsync()
    expect(progress.value).toBe(100)
  })

  test('should handle multiple calls with intermediate updates', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function () {
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
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(30)
    queryProgress()
    expect(progress.value).toBe(0)
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(30)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(60)
    await vi.runAllTimersAsync()
    expect(progress.value).toBe(100)
  })

  test('should mark data as expired when error occurs', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any) {
      const { updateData } = getAsyncDataContext()
      if (error) throw error
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      return updateData(result)
    })

    // Initial state - data not expired
    expect(progressExpired.value).toBeFalsy()
    // p1 request fails, data expires
    await expect(queryProgress(1, 1, 'error')).rejects.toBe('error')
    expect(queryProgressError.value).toBeTruthy()
    expect(progressExpired.value).toBeTruthy()
    // Trigger p2, data still expired
    queryProgress(50, 100, undefined)
    expect(progressExpired.value).toBeTruthy()
    expect(queryProgressError.value).toBeUndefined()
    // p2 updates data mid-execution, data no longer expired
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(50)
    expect(progressExpired.value).toBeFalsy()
    // p2 completes, data not expired
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(100)
    expect(progressExpired.value).toBeFalsy()
  })

  test('should update data after async completion', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress } = useAsyncData('progress', async function (update: number, result: number) {
      const { updateData } = getAsyncDataContext()
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      // Call updateData after return
      setTimeout(() => updateData(result + update), 0)
      return updateData(result)
    })

    queryProgress(50, 100)
    await vi.advanceTimersByTimeAsync(150)
    expect(progress.value).toBe(50)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(100)
  })

  test('should update data when later call reports error', async () => {
    vi.useFakeTimers()
    const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any): Promise<number> {
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

    // Initial value
    expect(progress.value).toBe(0)

    // Later call reports error
    // Keep updates from previous call
    queryProgress(1, 2, undefined)
    queryProgress(3, 4, 'error')
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(1)
    expect(progressExpired.value).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(progress.value).toBe(2)
    expect(progressExpired.value).toBe(true)
  })

  test('should get original data when updating', async () => {
    vi.useFakeTimers()
    const { list, queryList } = useAsyncData('list', async function (page: number, ms: number) {
      const { getData } = getAsyncDataContext()
      await wait(ms)
      return [...getData(), page]
    }, { initialData: [] })
    queryList(1, 0)
    expect(list.value).toEqual([])
    await vi.advanceTimersToNextTimerAsync()
    expect(list.value).toEqual([1])
    queryList(2, 50) // Updates first
    queryList(3, 100) // Updates later
    await vi.advanceTimersToNextTimerAsync()
    expect(list.value).toEqual([1, 2])
    await vi.advanceTimersToNextTimerAsync()
    expect(list.value).toEqual([1, 3])
    vi.useRealTimers()
  })

  test('should handle sequential updates during async execution', async () => {
    vi.useFakeTimers()
    const { queryData, data } = useAsyncData('data', async function (value: number) {
      const { getData, updateData } = getAsyncDataContext()
      updateData(value)
      await wait(50)
      expect(getData()).toBe(value)
      updateData(value * 2)
      await wait(50)
      expect(getData()).toBe(value * 2)
      updateData(value * 3)
      return value * 3
    })

    queryData(10)
    expect(data.value).toBe(10)
    await vi.advanceTimersByTimeAsync(50)
    expect(data.value).toBe(20)
    await vi.advanceTimersByTimeAsync(50)
    expect(data.value).toBe(30)
  })

  test('should throw error when getAsyncDataContext called outside useAsyncData', () => {
    expect(() => getAsyncDataContext()).toThrowError('[vue-asyncx] getAsyncDataContext 必须在 useAsyncData 的封装函数内调用')
  })
})