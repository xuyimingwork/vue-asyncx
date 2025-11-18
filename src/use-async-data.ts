import { computed, Ref, ref, ShallowRef, shallowRef } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { createFunctionTracker, StringDefaultWhenEmpty, Track, upperFirst } from "./utils";

export interface UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> extends UseAsyncOptions<Fn> {
  initialData?: any,
  shallow?: Shallow,
  enhanceFirstArgument?: boolean
}
export type UseAsyncDataResult<
  Fn extends (...args: any) => any,
  DataName extends string,
  Shallow extends boolean = false
> = UseAsyncResult<Fn, `query${Capitalize<(StringDefaultWhenEmpty<DataName, 'data'>)>}`> 
  & { 
  [K in (StringDefaultWhenEmpty<DataName, 'data'>)]: Shallow extends true 
    ? ShallowRef<Awaited<ReturnType<Fn>>> 
    : Ref<Awaited<ReturnType<Fn>>> 
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
  Shallow extends boolean = false
>(fn: Fn, options?: UseAsyncDataOptions<Fn, Shallow>): UseAsyncDataResult<Fn, 'data', Shallow>
function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  DataName extends string = string,
  Shallow extends boolean = false
>(name: DataName, fn: Fn, options?: UseAsyncDataOptions<Fn, Shallow>): UseAsyncDataResult<Fn, DataName, Shallow>
function useAsyncData(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')

  const { name, fn, options } = typeof args[0] === 'function' 
    ? { name: 'data', fn: args[0], options: args[1] } 
    : { name: args[0] || 'data', fn: args[1], options: args[2] }

  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  const { enhanceFirstArgument, initialData, shallow, ...useAsyncOptions } = options as UseAsyncDataOptions<typeof fn, boolean> || {}
  const data = shallow 
    ? shallowRef<ReturnType<typeof fn>>(initialData) 
    : ref<ReturnType<typeof fn>>(initialData)
  const track = shallowRef<Track>()

  // 数据更新
  function update(v: any, { track: _track, scene }: { scene: 'finish' | 'update', track: Track }) {
    if (scene === 'update') _track.progress()
    if (scene === 'finish' && _track.expired('result:ok')) return
    // 函数返回数据后，又调用了 update 方法
    if (scene === 'update' && _track.expired('progress')) return
    data.value = v
    track.value = _track
  }

  // 调用结束
  function finish(v: any, { scene, track }: { scene: 'normal' | 'error', track: Track }) {
    track.finish(scene === 'error')
    // 异常状态已在底层处理，此处只需要处理正常结束的数据
    if (scene === 'normal') update(v, { track, scene: 'finish' })
  }

  function normalizeArguments(args: any[], {
    enhanceFirstArgument,
    track
  }: { 
    enhanceFirstArgument?: boolean
    track: Track
  }) {
    if (!enhanceFirstArgument) return args
    const [_first, ...restArgs] = args
    const first: FirstArgumentEnhanced = {
      [FLAG_FIRST_ARGUMENT_ENHANCED]: true,
      ...(args.length ? { firstArgument: _first } : {}), 
      getData: () => data.value,
      updateData: (v: any) => {
        update(v, { track, scene: 'update' })
        return v
      }
    }

    return [first, ...restArgs]
  }

  const tracker = createFunctionTracker()
  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const track = tracker()

    args = normalizeArguments(args, { enhanceFirstArgument, track })

    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        p.then(
          // promise 正常结束
          v => finish(v, { scene: 'normal', track }), 
          // promise 出现拒绝
          e => finish(e, { scene: 'error', track })
        )
      } else {
        // 非 promise 正常结束
        finish(p, { scene: 'normal', track })
      }
      return p
    } catch(e) {
      // 调用报错
      finish(e, { scene: 'error', track })
      throw e
    }
  }
  const result = useAsync(`query${upperFirst(name)}`, method, useAsyncOptions)
  /**
   * 数据过期：正常完成调用，times.finished 数值应该与 times.dataUpdateByFinished 一致
   * - 当 fn1 调用失败，dataUpdateByFinished = 0，finished = 1，dataUpdateByCalled = 0，数据过期
   * - 继续调用 fn2，fn2 更新 data，未结束：dataUpdateByFinished = 0，finished = 1，dataUpdateByCalled = 2，数据未过期
   * - 继续 fn2 失败：dataUpdateByFinished = 0，finished = 2，dataUpdateByCalled = 2，数据过期
   */
  const dataExpired = computed(() => {
    if (!tracker.tracking.value) return false
    if (!track.value) return tracker.has.finished.value
    return track.value.expired('result')
  })
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
  if (!isFirstArgumentEnhanced(arg)) throw Error('请配置 options.enhanceFirstArgument = true')
  const enhanced: FirstArgumentEnhanced<Arg, Data> = arg
  /**
   * js 的参数默认值规则：当参数为 undefined 时，使用默认值。
   * 即 hello() 与 hello(undefined) 都会触发默认值赋值规则。
   * 因此，当有配置默认值时，直接判断 enhanced.firstArgument 与 undefined 是否全等即可
   */
  if (arguments.length === 2 && enhanced.firstArgument === undefined) return { ...enhanced, firstArgument: defaultValue } as any
  return enhanced as any
}

function isFirstArgumentEnhanced(v: any): v is FirstArgumentEnhanced {
  return typeof v === 'object' && !!v && (FLAG_FIRST_ARGUMENT_ENHANCED in v)
}

export { useAsyncData }