import { afterEach, describe, expect, test, vi } from 'vitest'
import { unFirstArgumentEnhanced, useAsyncData, getAsyncDataContext } from '../use-async-data'
import { isReactive } from 'vue'
import { debounce, upperFirst } from 'es-toolkit'

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

  test('should not enhance first argument when options.enhanceFirstArgument is false', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      expect(a).toBeTypeOf('number')
      expect(b).toBeTypeOf('number')
      expect(() => unFirstArgumentEnhanced(a)).toThrowError()
      return a + b
    }, { enhanceFirstArgument: false })
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

  test('should be ok when call unFirstArgumentEnhanced multiple times', () => {
    const { queryData } = useAsyncData((a: number, b: number) => {
      expect(() => unFirstArgumentEnhanced(a)).not.toThrowError()
      expect(() => unFirstArgumentEnhanced(a)).not.toThrowError()
      expect(unFirstArgumentEnhanced(a)).toStrictEqual(unFirstArgumentEnhanced(a))
      return unFirstArgumentEnhanced(a).firstArgument + b
    }, { enhanceFirstArgument: true })
    expect(queryData(1, 1)).toBe(2)
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
  describe('Parameter Validation', () => {
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
  })

  describe('Naming Conventions', () => {
    function expectResultStructure(result: any, name: string = 'data') {
      expect(Object.keys(result).sort()).toStrictEqual([
        `${name}`,
        `${name}Expired`,
        `query${upperFirst(name)}`,
        `query${upperFirst(name)}ArgumentFirst`,
        `query${upperFirst(name)}Arguments`,
        `query${upperFirst(name)}Error`,
        `query${upperFirst(name)}Loading`,
      ])
      expect(result[`${name}`]).toBeTruthy()
      expect(result[`${name}Expired`]).toBeTruthy()
      expect(result[`query${upperFirst(name)}`]).toBeTypeOf('function')
      expect(result[`query${upperFirst(name)}ArgumentFirst`]).toBeTruthy()
      expect(result[`query${upperFirst(name)}Arguments`]).toBeTruthy()
      expect(result[`query${upperFirst(name)}Error`]).toBeTruthy()
      expect(result[`query${upperFirst(name)}Loading`]).toBeTruthy()
    }

    test('should use default name when no name is passed', () => {
      expectResultStructure(useAsyncData(() => 1))
      expectResultStructure(useAsyncData('', () => 1))
    })

    test('should use custom name when name is passed', () => {
      expectResultStructure(useAsyncData('one', () => 1), 'one')
    })
  })

  describe('Data Ref Options', () => {
    test('should use ref when shallow is not passed', () => {
      const result = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } } })
      expect(isReactive(result.one.value.v)).toBeTruthy()
    })

    test('should use ref when shallow is false', () => {
      const result2 = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } }, shallow: false })
      expect(isReactive(result2.one.value.v)).toBeTruthy()
    })

    test('should use shallowRef when shallow is true', () => {
      const result = useAsyncData('one', () => ({ v: { v: 1 } }), { initialData: { v: { v: 0 } }, shallow: true })
      expect(isReactive(result.one.value.v)).toBeFalsy()
    })
  })

  describe('Data Initial Options', () => {
    test('should use undefined when not passed', () => {
      const result = useAsyncData('one', () => 1)
      expect(result.one.value).toBeUndefined()
    })

    test('should use initial data when passed', () => {
      const result = useAsyncData('one', () => 1, { initialData: 2 })
      expect(result.one.value).toBe(2)
    })
  })

  describe('Sync Function Calls', () => {
    test('should update data correctly when finished', () => {
      const { one, queryOne } = useAsyncData('one', () => 1)
      expect(one.value).toBeUndefined()
      const result = queryOne()
      expect(one.value).toBe(result)
    })

    test('should reflect last call result when called multiple times', () => {
      const { one, queryOne } = useAsyncData('one', (result: number) => result)
      expect(one.value).toBeUndefined()
      const result1 = queryOne(1)
      expect(one.value).toBe(result1)
      const result2 = queryOne(2)
      expect(one.value).toBe(result2)
    })

    test('should update error correctly when throws error', () => {
      const error = new Error('error')
      const { one, queryOne, queryOneError } = useAsyncData('one', () => { throw error })
      expect(one.value).toBeUndefined()
      expect(queryOneError.value).toBeUndefined()
      expect(() => queryOne()).toThrowError(error)
      expect(queryOneError.value).toBe(error)
      expect(one.value).toBe(undefined)
    })

    test('should not clear data when throws error', () => {
      const error = new Error('error')
      const { one, queryOne, queryOneError } = useAsyncData('one', (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(one.value).toBeUndefined()
      expect(queryOne(1)).toBe(one.value)
      expect(() => queryOne(2, error)).toThrowError(error)
      expect(one.value).toBe(1)
      expect(queryOneError.value).toBe(error)
    })

    test('should clear error when new call starts', () => {
      const error = new Error('error')
      const { one, queryOne, queryOneError } = useAsyncData('one', (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(queryOneError.value).toBeUndefined()
      expect(() => queryOne(1, error)).toThrowError(error)
      expect(queryOneError.value).toBe(error)
      expect(queryOne(2)).toBe(one.value)
      expect(queryOneError.value).toBeUndefined()
    })

    test('should reflect latest error when called throw error multiple times', () => {
      const { queryOne, queryOneError } = useAsyncData('one', (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(queryOneError.value).toBeUndefined()
      const error1 = new Error('error1')
      expect(() => queryOne(1, error1)).toThrowError(error1)
      expect(queryOneError.value).toBe(error1)
      const error2 = new Error('error2')
      expect(() => queryOne(2, error2)).toThrowError(error2)
      expect(queryOneError.value).toBe(error2)
    })

    test('should reflect last call result when error is thrown before', () => {
      const { one, queryOne, queryOneError } = useAsyncData('one', (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(queryOneError.value).toBeUndefined()
      const error1 = new Error('error1')
      expect(() => queryOne(1, error1)).toThrowError(error1)
      expect(queryOneError.value).toBe(error1)
      expect(queryOne(2)).toBe(2)
      expect(one.value).toBe(2)
    })
  })

  describe('Async Function Calls', () => {
    test('should update data correctly when async function is finished',  async () => {
      vi.useFakeTimers()
      const result = useAsyncData('one', () => new Promise((resolve) => setTimeout(() => resolve(1), 100)))
      const p = result.queryOne()
      await vi.runAllTimersAsync()
      expect(result.one.value).toBe(1)
      await expect(p).resolves.toBe(1)
    })

    test('should update error correctly when async function throws error', async () => {
      vi.useFakeTimers()
      const error = new Error('error')
      const result = useAsyncData('one', () => new Promise((_, reject) => setTimeout(() => reject(error), 100)))
      expect(result.one.value).toBeUndefined()
      expect(result.queryOneError.value).toBeUndefined()
      const p = result.queryOne()
      await vi.runAllTimersAsync()
      expect(result.one.value).toBe(undefined)
      expect(result.queryOneError.value).toBe(error)
      await expect(p).rejects.toBe(error)
    })

    test('should reflect latest call result when calls started and finished one by one', async () => {
      const count = 10
      const { total, queryTotal, queryTotalLoading } = useAsyncData('total', async (a: number, b: number) => {
        return a + b
      }, { initialData: 0 })
      const calls = Array.from({ length: count }, (_, i) => (prev: number) => queryTotal(prev, i + 1))
      const chain = calls.reduce((prev, call, i) => prev.then((result) => {
        expect(total.value).toBe(result)
        expect(total.value).toBe(i ? ((i * (i + 1)) / 2) : 0)
        expect(queryTotalLoading.value).toBe(false)
        return call(result)
      }), Promise.resolve(0))
      await chain
      expect(total.value).toBe(count * (count + 1) / 2)
    })

    test('should reflect latest call result when calls finished in order', async () => {
      vi.useFakeTimers()
      const count = 10
      const { total, queryTotal, queryTotalLoading } = useAsyncData('total', async (a: number, b: number, ms: number) => {
        await wait(ms)
        return a + b
      }, { initialData: 0 })
      const calls = Array.from({ length: count }, (_, i) => queryTotal(i + 1, i + 1, (i + 1) * 100))
      for (let i = 0; i < calls.length; i++) {
        await vi.advanceTimersToNextTimerAsync()
        expect(total.value).toBe((i + 1) * 2)
        expect(queryTotalLoading.value).toBe(i === calls.length - 1 ? false : true)
      }
    })
  })

  describe('Data Expired Basic', () => {
    test('should data expired when sync later call throws error', () => {
      const error = new Error('error')
      const { one, oneExpired, queryOne, queryOneError } = useAsyncData('one', (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(one.value).toBeUndefined()
      expect(queryOne(1)).toBe(one.value)
      expect(() => queryOne(2, error)).toThrowError(error)
      expect(one.value).toBe(1)
      expect(queryOneError.value).toBe(error)
      expect(oneExpired.value).toBeTruthy()
    })

    test('should data expired when async later call throws error', async () => {
      const error = new Error('error')
      const { one, oneExpired, queryOne, queryOneError } = useAsyncData('one', async (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(one.value).toBeUndefined()
      await expect(queryOne(1)).resolves.toBe(1)
      expect(one.value).toBe(1)
      await expect(queryOne(2, error)).rejects.toBe(error)
      expect(one.value).toBe(1)
      expect(queryOneError.value).toBe(error)
      expect(oneExpired.value).toBeTruthy()
    })

    test('should keep data expired state until async call get new data', async () => {
      const error = new Error('error')
      const { one, oneExpired, queryOne, queryOneLoading, queryOneError } = useAsyncData('one', async (result: number, error?: Error) => { 
        if (error) throw error 
        return result
      })
      expect(one.value).toBeUndefined()
      await expect(queryOne(1)).resolves.toBe(1)
      expect(one.value).toBe(1)
      await expect(queryOne(2, error)).rejects.toBe(error)
      expect(one.value).toBe(1)
      expect(queryOneError.value).toBe(error)
      expect(oneExpired.value).toBeTruthy()
      queryOne(3)
      expect(queryOneLoading.value).toBe(true) // 请求仍在进行
      expect(queryOneError.value).toBeUndefined() // 错误已置空
      expect(oneExpired.value).toBeTruthy() // 数据仍过期
      await wait(0)
      expect(queryOneLoading.value).toBe(false) // 请求结束
      expect(one.value).toBe(3)  // 新结果出现
      expect(oneExpired.value).toBeFalsy() // 数据未过期
    })
  })

  describe('Data Context API', () => {
    test('should get context when call getAsyncDataContext in sync part', async () => {
      const { queryOne, one } = useAsyncData('one', async function (result: number) {
        const context = getAsyncDataContext()
        expect(Object.keys(context).sort()).toStrictEqual(['getData', 'updateData'])
        expect(context).toHaveProperty('getData')
        expect(context).toHaveProperty('updateData')
        expect(context.getData).toBeInstanceOf(Function)
        expect(context.updateData).toBeInstanceOf(Function)
        return result
      })
      await expect(queryOne(1)).resolves.toBe(1)
      expect(one.value).toBe(1)
    })

    test('should throw error when call getAsyncDataContext in async part', async () => {
      const { queryOne } = useAsyncData('one', async function (result: number) {
        await wait(0)
        expect(() => getAsyncDataContext()).toThrowError()
        return result
      })
      await expect(queryOne(1)).resolves.toBe(1)
    })

    test('should throw error when call getAsyncDataContext outside of useAsyncData', async () => {
      expect(() => getAsyncDataContext()).toThrowError()
    })

    test('should call getData/updateData during execution', async () => {
      vi.useFakeTimers()
      const { queryProgress, progress } = useAsyncData('progress', async function (init: number) {
        const { getData, updateData } = getAsyncDataContext()
        expect(getData()).toBe(init)
        await wait(100)
        updateData(50)
        await wait(100)
        return 100
      }, { initialData: 0 })
      expect(progress.value).toBe(0)
      queryProgress(0)
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(50)
      await vi.runAllTimersAsync()
      expect(progress.value).toBe(100)
    })

    test('should call getData/updateData multiple times during execution', async () => {
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

      expect(data.value).toBeUndefined()
      queryData(10)
      expect(data.value).toBe(10)
      await vi.advanceTimersByTimeAsync(50)
      expect(data.value).toBe(20)
      await vi.runAllTimersAsync()
      expect(data.value).toBe(30)
    })

    test('should not call update after async function return', async () => {
      vi.useFakeTimers()
      const { queryProgress, progress } = useAsyncData('progress', async function (result: number, after:  number) {
        const { updateData } = getAsyncDataContext()
        await wait(100)
        setTimeout(() => updateData(after), 0)
        return updateData(result)
      })
      queryProgress(100, 101)
      await vi.runAllTimersAsync()
      expect(progress.value).toBe(100)
    })
  })

  // 竟态场景
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

  // 竟态场景
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

  test('should throw error when getAsyncDataContext called outside useAsyncData', () => {
    expect(() => getAsyncDataContext()).toThrowError('[vue-asyncx] getAsyncDataContext 必须在 useAsyncData 的封装函数内调用')
  })
})