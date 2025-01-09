import { computed, Ref, ref } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { StringDefaultWhenEmpty, upperFirst } from "./utils";

export interface UseAsyncDataOptions<Fn extends (...args: any) => any> extends UseAsyncOptions<Fn> {
  enhanceFirstArgument?: boolean
}
export type UseAsyncDataResult<
  Fn extends (...args: any) => any,
  DataName extends string
> = UseAsyncResult<Fn, `query${Capitalize<(StringDefaultWhenEmpty<DataName, 'data'>)>}`> 
  & { 
  [K in (StringDefaultWhenEmpty<DataName, 'data'>)]: Ref<Awaited<ReturnType<Fn>>> 
} & {
  [K in `${StringDefaultWhenEmpty<DataName, 'data'>}Expired`]: Ref<boolean>
}

const FLAG_FIRST_ARGUMENT_ENHANCED = '__va_fae'

export type FirstArgumentEnhanced<T = any, D = any> = {
  [FLAG_FIRST_ARGUMENT_ENHANCED]: true
  firstArgument?: T, 
  getData: () => D,
  updateData: (v: D) => void
}


function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
>(fn: Fn, options?: UseAsyncDataOptions<Fn>): UseAsyncDataResult<Fn, 'data'>
function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  DataName extends string = string,
>(name: DataName, fn: Fn, options?: UseAsyncDataOptions<Fn>): UseAsyncDataResult<Fn, DataName>
function useAsyncData(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')

  const { name, fn, options } = typeof args[0] === 'function' 
    ? { name: 'data', fn: args[0], options: args[1] } 
    : { name: args[0] || 'data', fn: args[1], options: args[2] }

  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  const { enhanceFirstArgument, ...useAsyncOptions } = options || {}

  const times = ref({ 
    // 调用序号（即：fn 第 called 次调用）
    called: 0, 
    // 完成序号（即：fn 第 finished 次调用完成）
    finished: 0,
    // 数据被更新的调用序号（即：data 数据由第 dataUpdateByCalled 次调用更新）
    dataUpdateByCalled: 0,
    // 数据完成更新序号（即：data 数据由第 dataUpdateByFinished 次调用完成后更新）
    dataUpdateByFinished: 0,  
  })
  const data = ref<ReturnType<typeof fn>>()
  /**
   * 数据过期：正常完成调用，times.finished 数值应该与 times.dataUpdateByFinished 一致
   * - 当 fn1 调用失败，dataUpdateByFinished = 0，finished = 1，dataUpdateByCalled = 0，数据过期
   * - 继续调用 fn2，fn2 更新 data，未结束：dataUpdateByFinished = 0，finished = 1，dataUpdateByCalled = 2，数据未过期
   * - 继续 fn2 失败：dataUpdateByFinished = 0，finished = 2，dataUpdateByCalled = 2，数据过期
   */
  const dataExpired = computed(() => {
    if (times.value.dataUpdateByFinished >= times.value.finished) return false
    if (times.value.dataUpdateByCalled > times.value.finished) return false
    return true
  })

  // 数据更新
  function update(v: any, { sn, scene }: { scene: 'finish' | 'update', sn: number }) {
    // 如果数据已被较新的调用更新，则忽略这次较旧的更新
    if (sn < times.value.dataUpdateByCalled) return
    data.value = v
    times.value.dataUpdateByCalled = sn;
    if (scene === 'finish') times.value.dataUpdateByFinished = sn
  }

  // 调用结束
  function finish(v: any, { scene, sn }: { scene: 'normal' | 'error', sn: number }) {
    // 异常状态已在底层处理，此处只需要处理正常结束的数据
    if (scene === 'normal') update(v, { sn, scene: 'finish' })
    // 第 sn 次调用结束，更新完成序号
    if (sn > times.value.finished) times.value.finished = sn
  }

  function normalizeArguments(args: any[], {
    enhanceFirstArgument,
    sn
  }: { 
    enhanceFirstArgument: boolean
    sn: number
  }) {
    if (!enhanceFirstArgument) return args
    const [_first, ...restArgs] = args
    const first: FirstArgumentEnhanced = {
      [FLAG_FIRST_ARGUMENT_ENHANCED]: true,
      ...(args.length ? { firstArgument: _first } : {}), 
      getData: () => data.value,
      updateData: (v: any) => {
        update(v, { sn, scene: 'update' })
        return v
      }
    }

    return [first, ...restArgs]
  }

  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    // 本次调用的序列号
    const sn = ++times.value.called

    args = normalizeArguments(args, { enhanceFirstArgument, sn })

    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        p.then(
          // promise 正常结束
          v => finish(v, { scene: 'normal', sn }), 
          // promise 出现拒绝
          e => finish(e, { scene: 'error', sn })
        )
      } else {
        // 非 promise 正常结束
        finish(p, { scene: 'normal', sn })
      }
      return p
    } catch(e) {
      // 调用报错
      finish(e, { scene: 'error', sn })
      throw e
    }
  }
  const result = useAsync(`query${upperFirst(name)}`, method, useAsyncOptions)
  return {
    ...result,
    [name]: data,
    [`${name}Expired`]: dataExpired
  }
}

/**
 * 
 * @param arg 首个参数
 * @param defaultValue 当 arg === undefined 时的默认值
 * @returns 首个参数解构结果（符合 ts 类型要求）
 */
export function unFirstArgumentEnhanced<Arg = any, Data = any>(arg: Arg, defaultValue?: Arg): Arg extends undefined 
  ? FirstArgumentEnhanced<Arg, Data> 
  : Required<FirstArgumentEnhanced<Arg, Data>> {
  if (typeof arg !== 'object' || !arg || !arg[FLAG_FIRST_ARGUMENT_ENHANCED]) throw Error('请配置 options.enhanceFirstArgument = true')
  const enhanced: FirstArgumentEnhanced<Arg, Data> = arg as unknown as any
  /**
   * js 的默认参数允许在传入 undefined 时使用默认值，
   * 即 hello() 与 hello(undefined) 等价，此处与 js 保持一致
   * 因此直接判断 enhanced.firstArgument 是否与 undefined 全等即可
   */
  if (arguments.length === 2 && enhanced.firstArgument === undefined) return { ...enhanced, firstArgument: defaultValue } as any
  return enhanced as any
}

export { useAsyncData }