import { afterEach, describe, expect, test, vi } from 'vitest'
import { unFirstArgumentEnhanced, useAsyncData, getAsyncDataContext } from '@/hooks/use-async-data/use-async-data'
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
      expect(() => useAsyncData()).toThrow(TypeError)
      // @ts-expect-error
      expect(() => useAsyncData()).toThrow('Expected at least 1 argument, but got 0.')
    })

    test('should throw error when name is not a string', () => {
      // @ts-expect-error
      expect(() => useAsyncData()).toThrow(TypeError)
      // @ts-expect-error
      expect(() => useAsyncData(1, () => {})).toThrow('Expected "name" to be a string, but received number.')
    })

    test('should throw error when fn is not a function', () => {
      // @ts-expect-error
      expect(() => useAsyncData('', 1)).toThrow(TypeError)
      // @ts-expect-error
      expect(() => useAsyncData('', 1)).toThrow('Expected "fn" to be a function, but received number.')
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
    test('should not expire when set initial data', async () => {
      const { data, dataExpired, queryData } = useAsyncData(() => Promise.reject(new Error('error')) as any, {
        initialData: 'initial'
      });
      
      // 初始状态不应过期
      expect(data.value).toBe('initial');
      expect(dataExpired.value).toBe(false);
      
      // 错误调用后应设置为过期
      await expect(queryData()).rejects.toThrowError();
      expect(data.value).toBe('initial');
      expect(dataExpired.value).toBe(true);
    });

    test('should not expire when first call not update/finished', async () => {
      const { data, dataExpired, queryData } = useAsyncData(async () => 'success', {
        initialData: 'initial'
      });
      const p = queryData()
      // 请求发起不应过期
      expect(data.value).toBe('initial');
      expect(dataExpired.value).toBe(false);
      await p
      expect(data.value).toBe('success');
      expect(dataExpired.value).toBe(false);
    });

    test('should data expired when call update in middle then throw error', async () => {
      vi.useFakeTimers()
      const error = new Error('error')
      const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number): Promise<number> {
        const { updateData } = getAsyncDataContext()
        await wait(100)
        updateData(update) // 中间更新数据
        await wait(100)
        throw error // 然后抛出错误
      }, { initialData: 0 })

      const p = queryProgress(50)
      
      // 等待中间更新
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(50)
      expect(progressExpired.value).toBe(false) // 更新时还未报错，数据未过期
      
      // 等待错误抛出
      await vi.advanceTimersByTimeAsync(100)
      await expect(p).rejects.toThrow(error)
      
      // 数据应该被标记为过期，因为请求本身被拒绝了
      expect(progress.value).toBe(50) // 数据保持为中间更新的值
      expect(progressExpired.value).toBe(true) // 因为请求被拒绝，数据过期
      expect(queryProgressError.value).toBe(error)
    })

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

    test('should return null when call getAsyncDataContext in async part', async () => {
      const { queryOne } = useAsyncData('one', async function (result: number) {
        await wait(0)
        expect(getAsyncDataContext()).toBeNull()
        return result
      })
      await expect(queryOne(1)).resolves.toBe(1)
    })

    test('should return null when call getAsyncDataContext outside of useAsyncData', async () => {
      expect(getAsyncDataContext()).toBeNull()
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

    test('should not update data when call updateData after async function return', async () => {
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

    test('should updateData ok when later call throw error', async () => {
      vi.useFakeTimers()
      const { queryProgress, progress, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any): Promise<number> {
        const { updateData } = getAsyncDataContext()
        await wait(0)
        if (error) throw error
        if (update) {
          await wait(100)
          updateData(update)
        }
        await wait(100)
        updateData(result)
        return result
      }, { initialData: 0 })

      queryProgress(1, 2, undefined)
      queryProgress(3, 4, 'error')

      // 到达 p2 报错节点，p2 结束
      await vi.advanceTimersByTimeAsync(0)
      expect(queryProgressError.value).toBe('error')

      //  到达 p1 更新节点
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(1) //  update data 正常更新

      // 所有流程结束
      await vi.runAllTimersAsync()
    })

    test('should mark data expired when update data after later call throw error', async () => {
      vi.useFakeTimers()
      const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any): Promise<number> {
        const { updateData } = getAsyncDataContext()
        await wait(0)
        if (error) throw error
        if (update) {
          await wait(100)
          updateData(update)
        }
        await wait(100)
        updateData(result)
        return result
      }, { initialData: 0 })

      queryProgress(1, 2, undefined)
      queryProgress(3, 4, 'error')

      // 到达  p2 报错节点
      await vi.advanceTimersByTimeAsync(0)
      expect(queryProgressError.value).toBe('error')
      expect(progress.value).toBe(0)
      expect(progressExpired.value).toBe(true) // 报错数据属于过期数据

      //  到达 p1 更新节点
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(1)
      expect(progressExpired.value).toBe(true) // 更新后的数据属于过期数据

      // 所有流程结束
      await vi.runAllTimersAsync()
    })

    test('should clear dataExpired when call updateData', async () => {
      vi.useFakeTimers()
      const { queryProgress, progress, progressExpired, queryProgressError } = useAsyncData('progress', async function (update: number, result: number, error: any): Promise<number> {
        const { updateData } = getAsyncDataContext()
        await wait(0)
        if (error) throw error
        if (update) {
          await wait(100)
          updateData(update)
        }
        await wait(100)
        updateData(result)
        return result
      }, { initialData: 0 })

      queryProgress(0.5, 1, 'error')
      queryProgress(1.5, 2, undefined)

      // 到达  p1 报错节点
      await vi.advanceTimersByTimeAsync(0)
      expect(queryProgressError.value).toBeUndefined() // 报错信息被 p2 调用清除
      expect(progress.value).toBe(0)
      expect(progressExpired.value).toBe(true) // 报错数据属于过期数据

      //  到达 p2 更新节点
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(1.5)
      expect(progressExpired.value).toBe(false)

      // 所有流程结束
      await vi.runAllTimersAsync()
    })

    test('should get original data when updating', async () => {
      vi.useFakeTimers()
      const { list, queryList } = useAsyncData('list', async function (page: number, ms: number) {
        const { getData } = getAsyncDataContext()
        await wait(ms)
        return [...getData(), page]
      }, { initialData: [0] })
      expect(list.value).toEqual([0])
      queryList(1, 50)
      expect(list.value).toEqual([0])
      queryList(2, 100)
      // p1 更新完成
      await vi.advanceTimersToNextTimerAsync()
      expect(list.value).toEqual([0, 1])
      // p2 更新完成
      await vi.advanceTimersToNextTimerAsync()
      expect(list.value).toEqual([0, 2]) // 不是 0, 1, 2
      vi.useRealTimers()
    })

    test('should isolate contexts between different async calls', async () => {
      vi.useFakeTimers()
      const { queryData, data } = useAsyncData(async (id: number, delay: number): Promise<number[]> => {
        const { getData, updateData } = getAsyncDataContext();
        const initial = getData();
        await wait(delay);
        updateData([...initial, id]);
        await wait(delay);
        return [...initial, id, id];
      }, { initialData: [0] });
      
      // 两个并发调用，确保上下文隔离
      queryData(1, 50);
      queryData(2, 75);
      
      await vi.advanceTimersByTimeAsync(50);
      expect(data.value).toEqual([0, 1]); // p1更新
      
      await vi.advanceTimersByTimeAsync(30);
      expect(data.value).toEqual([0, 2]); // p2 更新

      await vi.advanceTimersByTimeAsync(30);
      expect(data.value).toEqual([0, 2]); // p1 结束，p2 已更新，保留 p2 更新数据
      
      await vi.advanceTimersByTimeAsync(50);
      expect(data.value).toEqual([0, 2, 2]); // p2 结束
    });
  })

  describe('Race Condition', () => {
    test('should reflect latest call result when calls finished out of order', async () => {
      vi.useFakeTimers()
      const { queryDouble, double } = useAsyncData('double', async (a: number, delay: number) => {
        await wait(delay)
        return a *  2
      })
      // 全随机设定结束时间
      Array.from({ length: 100 }, (_, i) => queryDouble(i, Math.floor(Math.random() * 1000) + 100))
      await vi.runAllTimersAsync()
      // 结果一定是最后一个调用的结果
      expect(double.value).toBe(198)
    })

    test('should update data when later call throw error', async () => {
      vi.useFakeTimers()
      const { 
        queryProgress, 
        progress, 
        progressExpired,
        queryProgressError,
        queryProgressLoading
      } = useAsyncData('progress', async function (update: number, result: number, error: any): Promise<number> {
        const { updateData } = getAsyncDataContext()
        await wait(0)
        if (error) throw error
        if (update) {
          await wait(100)
          updateData(update)
        }
        await wait(100)
        updateData(result)
        return result
      }, { initialData: 0 })

      queryProgress(0.5, 1, undefined)
      queryProgress(1.5, 2, 'error')

      // 到达 p2 报错节点，p2 结束
      await vi.advanceTimersByTimeAsync(0)
      expect(progress.value).toBe(0) // p2 报错，数据不更新
      expect(queryProgressLoading.value).toBeFalsy() // p2 报错，loading 结束
      expect(queryProgressError.value).toBe('error')

      //  到达 p1 更新节点
      await vi.advanceTimersByTimeAsync(100)
      expect(progress.value).toBe(0.5) // p1 updateData 正常更新
      expect(progressExpired.value).toBe(true) // p2 已结束，数据是过期数据
      expect(queryProgressLoading.value).toBeFalsy() // p2 已结束，loading 不影响
      expect(queryProgressError.value).toBe('error') // 保持 p2 报错信息

      // 所有流程结束
      await vi.runAllTimersAsync()
      expect(progress.value).toBe(1) // p1 updateData 正常更新
      expect(progressExpired.value).toBe(true) // p2 已结束，数据是过期数据
      expect(queryProgressLoading.value).toBeFalsy() // p2 已结束，loading 不影响
      expect(queryProgressError.value).toBe('error') // 保持 p2 报错信息
    })

    test('should handle mixed success and failure in high concurrency', async () => {
      vi.useFakeTimers()
      const { queryData, data, dataExpired, queryDataError } = useAsyncData('data', async (index: number, shouldFail: boolean, delay: number) => {
        await wait(delay)
        if (shouldFail) throw new Error(`Error at ${index}`)
        return index
      })

      // 模拟混合成功和失败的并发请求，乱序结束
      Array.from({ length: 200 }, (_, i) => {
        const shouldFail = i % 3 === 0 // 每3个请求中有1个失败
        const delay = Math.random() * 500 + 50
        return queryData(i, shouldFail, delay)
      })

      await vi.runAllTimersAsync()
      
      // 最后一个请求是成功的（199不是3的倍数）
      expect(data.value).toBe(199)
      expect(dataExpired.value).toBe(false)
      expect(queryDataError.value).toBeUndefined()
    })

    test('should handle concurrent requests with intermediate updates', async () => {
      vi.useFakeTimers()
      const { queryData, data, queryDataLoading } = useAsyncData('data', async (index: number, updateSteps: number, delay: number) => {
        const { updateData } = getAsyncDataContext()
        
        // 中间更新
        for (let i = 1; i <= updateSteps; i++) {
          await wait(delay / (updateSteps + 1))
          updateData(`${index}-step-${i}`)
        }
        
        await wait(delay / (updateSteps + 1))
        return `${index}-final`
      })

      // 并发请求，带有不同数量的中间更新
      queryData(1, 5, 200) // 5次中间更新，共200ms
      queryData(2, 3, 150) // 3次中间更新，共150ms
      queryData(3, 10, 100) // 10次中间更新，共300ms
      queryData(4, 1, 50) // 1次中间更新，共50ms

      // 快速推进时间，观察中间状态
      await vi.advanceTimersByTimeAsync(10)
      expect(data.value).toBe('3-step-1')

      await vi.advanceTimersByTimeAsync(10)
      expect(data.value).toBe('3-step-2')

      await vi.advanceTimersByTimeAsync(10)
      expect(data.value).toBe('4-step-1')

      await vi.advanceTimersByTimeAsync(10)
      expect(data.value).toBe('4-step-1') // 4 更新后不会再更新
      expect(queryDataLoading.value).toBeTruthy() // 4 正在更新

      await vi.advanceTimersByTimeAsync(10)
      expect(data.value).toBe('4-final')
      expect(queryDataLoading.value).toBeFalsy() // 4 完成
      
      await vi.runAllTimersAsync()
      expect(data.value).toBe('4-final')
    })
  })

  describe('Setup Function', () => {
    test('should apply setup function to query method', async () => {
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
})