import { afterEach, describe, expect, test, vi } from 'vitest'
import { unFirstArgumentEnhanced, useAsyncData } from '../use-async-data'
import { getAsyncDataContext } from '../use-async-data.context'
import { isReactive } from 'vue'
import { debounce } from 'es-toolkit'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useAsyncData', () => {
  afterEach(() => vi.useRealTimers())
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
    expect(result.queryDataArguments).toBeTruthy()
  })

  test('自定义名称', () => {
    const result = useAsyncData('one', () => 1)
    expect(result.one).toBeTruthy()
    expect(result.queryOne).toBeTruthy()
    expect(result.queryOneLoading).toBeTruthy()
    expect(result.queryOneArguments).toBeTruthy()
  })

  test('data 类型 - 默认 ref', () => {
    const result = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } } })
    expect(isReactive(result.one.value.v)).toBeTruthy()
  })

  test('data 类型 - 配置 shallowRef', () => {
    const result = useAsyncData('one', () => ({ v: { v: 1 } }), { shallow: true, initialData: { v: { v: 0 } } })
    expect(isReactive(result.one.value.v)).toBeFalsy()
  })

  test('data 初始值', () => {
    const result = useAsyncData('one', () => 1)
    expect(result.one).toBeTruthy()
    expect(result.one.value).toBeUndefined()

    const result2 = useAsyncData('two', () => 22, { initialData: 2 })
    expect(result2.two.value).toBe(2)
    result2.queryTwo()
    expect(result2.two.value).toBe(22)
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

  test('函数结果', async () => {
    const sum = (a: number, b: number) => a + b
    const { querySum } = useAsyncData('sum', () => sum(1, 1))
    expect(querySum()).toBe(2)
    const { queryAsyncSum } = useAsyncData('asyncSum', () => new Promise((resolve) => setTimeout(() => resolve(sum(1, 1)), 100)))
    expect(await queryAsyncSum()).toBe(2)
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
    const sumFunc = async (a: number, b: number) => {
      await wait(a + b)
      return a + b
    }
    const { querySum, sum } = useAsyncData('sum', sumFunc)
    
    const p1 = querySum(40, 30)
    const p2 = querySum(50, 40)

    expect(sum.value).toBeUndefined()
    await expect(p1).resolves.toBe(70)
    expect(sum.value).toBe(70)
    await expect(p2).resolves.toBe(90)
    expect(sum.value).toBe(90)
  })

  test('多次异步，结果异序', async () => {
    const sumFunc = async (a: number, b: number) => {
      await wait(a + b)
      return a + b
    }
    const { querySum, sum } = useAsyncData('sum', sumFunc)
    
    const p1 = querySum(170, 30)
    const p2 = querySum(70, 30)

    expect(sum.value).toBeUndefined()
    await expect(p2).resolves.toBe(100)
    expect(sum.value).toBe(100)

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
    const testFunc = async (result: number, error?: Error, ms?: number) => {
      if (ms) await wait(ms)
      if (error) throw error
      return result
    }

    const { queryTest, test, testExpired } = useAsyncData('test', testFunc)

    expect(test.value).toBeUndefined()
    const v = await queryTest(35, undefined, 30)
    expect(v).toBe(test.value)

    // 后者先到，展示后者数据，前者报错不影响
    const p1 = queryTest(36, new Error(), 100)
    const p2 = queryTest(51, undefined, 50)
    const r2 = await p2
    expect(r2).toBe(test.value)
    expect(testExpired.value).toBeFalsy()
    await expect(p1).rejects.toThrowError()
    expect(test.value).toBe(51)
    expect(testExpired.value).toBeFalsy()

    // 后者先到，报错，前者后到，忽略后到的前者数据
    const p3 = queryTest(37, undefined, 100)
    const p4 = queryTest(52, new Error(), 50)
    expect(testExpired.value).toBeFalsy()
    await expect(p4).rejects.toThrowError()
    expect(test.value).toBe(51)
    expect(testExpired.value).toBeTruthy()

    await expect(p3).resolves.toBe(37)
    expect(test.value).toBe(37)
    expect(testExpired.value).toBeTruthy()
  })

  test('增强首个参数', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      const { getData, updateData } = unFirstArgumentEnhanced(a)
      a = unFirstArgumentEnhanced(a).firstArgument
      expect(a).toBe(1)
      expect(getData).toBeTruthy()
      expect(updateData).toBeTruthy()
      return a + b
    }, { enhanceFirstArgument: true })
    expect(queryData(1, 1)).toBe(2)

    const { queryNoArgs } = useAsyncData('noArgs', function () {
      const { getData, updateData } = unFirstArgumentEnhanced(arguments[0])
      const result = unFirstArgumentEnhanced(arguments[0])
      expect('firstArgument' in result).toBeFalsy()
      expect(getData).toBeTruthy()
      expect(updateData).toBeTruthy()
      return true
    }, { enhanceFirstArgument: true })
    expect(queryNoArgs()).toBe(true)

    const { queryFirstUndefined } = useAsyncData('firstUndefined', function (u) {
      const { getData, updateData } = unFirstArgumentEnhanced(u)
      const result = unFirstArgumentEnhanced(u)
      expect('firstArgument' in result).toBeTruthy()
      expect(result.firstArgument).toBeUndefined()
      expect(getData).toBeTruthy()
      expect(updateData).toBeTruthy()
      return true
    }, { enhanceFirstArgument: true })
    expect(queryFirstUndefined(undefined)).toBe(true)
  })

  test('unFirstArgumentEnhanced - 默认值', () => {
    const { queryData } = useAsyncData((content?: string) => {
      return unFirstArgumentEnhanced(content, 'default').firstArgument
    }, { enhanceFirstArgument: true })
    expect(queryData()).toBe('default')
    expect(queryData(undefined)).toBe('default')
    expect(queryData('')).toBe('')
  })

  test('unFirstArgumentEnhanced - 未配置调用抛出异常', () => {
    const { queryData } = useAsyncData((a?: number, b?: number) => {
      expect(() => unFirstArgumentEnhanced(a)).toThrowError()
      return true
    })
    expect(queryData(1, 1)).toBe(true)
  })

  test('调用异步，中途更新', async () => {
    const { queryProgress, progress } = useAsyncData('progress', async function() {
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
      const { updateData } = unFirstArgumentEnhanced(update)
      update = unFirstArgumentEnhanced(update).firstArgument
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      // return 后仍调用 updateData，
      setTimeout(() => updateData(result + update), 0)
      return updateData(result)
    }, { enhanceFirstArgument: true })
    
    queryProgress(50, 100)
    await wait(150)
    expect(progress.value).toBe(50)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('setup', async () => {
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
    await wait(50)
    expect(queryDataLoading.value).toBeTruthy()
    expect(spy).toBeCalledTimes(1)
    await wait(100)
    expect(queryDataLoading.value).toBeFalsy()
    expect(data.value).toBe(3)
  })
})

describe('useAsyncData with getAsyncDataContext', () => {
  test('should update data during async execution', async () => {
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
    await wait(100)
    expect(progress.value).toBe(30)
    await wait(100)
    expect(progress.value).toBe(60)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('should handle multiple calls with intermediate updates', async () => {
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

  test('should mark data as expired when error occurs', async () => {
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
    await wait(150)
    expect(progress.value).toBe(50)
    expect(progressExpired.value).toBeFalsy()
    // p2 completes, data not expired
    await wait(100)
    expect(progress.value).toBe(100)
    expect(progressExpired.value).toBeFalsy()
  })

  test('should update data after async completion', async () => {
    const { queryProgress, progress } = useAsyncData('progress', async function(update: number, result: number) {
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
    await wait(150)
    expect(progress.value).toBe(50)
    await wait(100)
    expect(progress.value).toBe(100)
  })

  test('should update data when later call reports error', async () => {
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

    // Initial value
    expect(progress.value).toBe(0)

    // Later call reports error
    // Keep updates from previous call
    queryProgress(1, 2, undefined)
    queryProgress(3, 4, 'error')
    await wait(100)
    expect(progress.value).toBe(1)
    expect(progressExpired.value).toBe(true)
    await wait(100)
    expect(progress.value).toBe(2)
    expect(progressExpired.value).toBe(true)
  })

  test('should get original data when updating', async () => {
    vi.useFakeTimers()
    const { list, queryList } = useAsyncData('list', async function(page: number, ms: number) {
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
    const { queryData, data } = useAsyncData('data', async function(value: number) {
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
    await wait(50)
    expect(data.value).toBe(20)
    await wait(50)
    expect(data.value).toBe(30)
  })

  test('should throw error when getAsyncDataContext called outside useAsyncData', () => {
    expect(() => getAsyncDataContext()).toThrowError('[vue-asyncx] getAsyncDataContext 必须在 useAsyncData 的封装函数内调用')
  })
})