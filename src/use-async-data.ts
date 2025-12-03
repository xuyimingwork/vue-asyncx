import { computed, Ref, ref, ShallowRef, shallowRef } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { createFunctionTracker, StringDefaultWhenEmpty, Track, upperFirst } from "./utils";
import { prepareAsyncDataContext } from "./use-async-data.context";

export interface UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> extends UseAsyncOptions<Fn> {
  initialData?: any,
  shallow?: Shallow,
  /**
   * @deprecated 已废弃，请使用 getAsyncDataContext
   */
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
  /**
   * 当前 data 赋值后，有新的调用完成，但 data 未被覆盖。
   * 
   * @example
   * case1: p1 ok，p2 error，data 来自 p1，error 来自 p2，expired 为 true
   * case2: p1 ok，p2 error，p3 pending，data 来自 p1，error 为 undefined，expired 为 true
   * case3: p1 ok, p2 error，p3 update，data 来自 p3，error 为 undefined，expired 为 false
   */
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
  const dataTrack = shallowRef<Track>()

  // 数据更新
  function update(v: any, { track, scene, error = false }: { scene: 'finish' | 'update', track: Track, error?: boolean }) {
    if (scene === 'update') track.progress()
    if (scene === 'update' && track.expired('progress')) return
    if (scene === 'finish') track.finish(error)
    if (scene === 'finish' && track.expired('result:ok')) return
    // 发生错误时保持已有数据
    if (scene === 'finish' && error) return
    data.value = v
    dataTrack.value = track
  }

  // 调用结束
  function finish(v: any, { scene, track }: { scene: 'normal' | 'error', track: Track }) {
    update(v, { track, scene: 'finish', error: scene === 'error' })
  }

  function getContext({ track }) {
    return {
      getData: () => data.value,
      updateData: (v: any) => {
        update(v, { track, scene: 'update' })
        return v
      }
    }
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
      ...getContext({ track })
    }

    return [first, ...restArgs]
  }

  const tracker = createFunctionTracker()
  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const track = tracker()
    args = normalizeArguments(args, { enhanceFirstArgument, track })
    const restoreAsyncDataContext = prepareAsyncDataContext(getContext({ track }))
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
    } finally {
      restoreAsyncDataContext()
    }
  }
  const result = useAsync(`query${upperFirst(name)}`, method, useAsyncOptions)
  // 最新调用结果不是 data 时，表示 data 过期。
  // 如新的调用出现异常，或本次调用更新进度后，最终结果异常
  const dataExpired = computed(() => {
    if (!tracker.tracking.value) return false
    if (!dataTrack.value) return tracker.has.finished.value
    return dataTrack.value.expired('result')
  })
  return {
    ...result,
    [name]: data,
    [`${name}Expired`]: dataExpired
  }
}

/**
 * @deprecated 已废弃，请使用 getAsyncDataContext
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

export { getAsyncDataContext } from './use-async-data.context'
export { useAsyncData }