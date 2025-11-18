import { describe, expect, test } from 'vitest'
import { unFirstArgumentEnhanced, useAsyncData } from '../use-async-data'
import { isReactive } from 'vue'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  test('函数结果', () => {
    const sum = (a: number, b: number) => a + b
    const { querySum } = useAsyncData('sum', () => sum(1, 1))
    expect(querySum()).toBe(2)
    const { queryAsyncSum } = useAsyncData('asyncSum', () => new Promise((resolve) => setTimeout(() => resolve(sum(1, 1)), 100)))
    expect(queryAsyncSum()).resolves.toBe(2)
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
    const { queryProgress, progress, progressExpired } = useAsyncData('progress', async function(update: number, result: number, error: any) {
      const { updateData } = unFirstArgumentEnhanced(update)
      update = unFirstArgumentEnhanced(update).firstArgument
      if (error) throw error
      if (update) {
        await wait(100)
        updateData(update)
      }
      await wait(100)
      setTimeout(() => updateData(result), 0)
      return updateData(result)
    }, { enhanceFirstArgument: true })
    
    expect(progressExpired.value).toBeFalsy()
    await expect(queryProgress(1, 1, 'error')).rejects.toBe('error')
    expect(progressExpired.value).toBeTruthy()
    queryProgress(50, 100, undefined)
    expect(progressExpired.value).toBeTruthy()
    await wait(150)
    expect(progress.value).toBe(50)
    expect(progressExpired.value).toBeFalsy()
    await wait(100)
    expect(progress.value).toBe(100)
    expect(progressExpired.value).toBeFalsy()
  })

  
})