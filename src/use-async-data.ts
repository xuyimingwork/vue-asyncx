import { computed, Ref, ref, ShallowRef, shallowRef } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { createFunctionTracker, Simplify, StringDefaultWhenEmpty, Track, upperFirst } from "./utils";
import { prepareAsyncDataContext } from "./use-async-data.context";

interface _UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> extends UseAsyncOptions<Fn> {
  initialData?: Awaited<ReturnType<Fn>>,
  shallow?: Shallow,
  /**
   * @deprecated 已废弃，请使用 getAsyncDataContext
   */
  enhanceFirstArgument?: boolean
}
type UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> = Simplify<_UseAsyncDataOptions<Fn, Shallow>>
export type UseAsyncDataResult<
  Fn extends (...args: any) => any,
  DataName extends string,
  Shallow extends boolean = false
> = Simplify<UseAsyncResult<Fn, `query${Capitalize<(StringDefaultWhenEmpty<DataName, 'data'>)>}`> 
  & { 
  [K in (StringDefaultWhenEmpty<DataName, 'data'>)]: Shallow extends true 
    ? ShallowRef<Awaited<ReturnType<Fn>>> 
    : Ref<Awaited<ReturnType<Fn>>> 
} & {
  /**
   * 当前 data 赋值后，有新的调用完成，但 data 未被覆盖。
   * 如：
   * - 某次调用的更新 data 后，该调用报错
   * - 某次调用成功后，后续调用报错
   * 与 error 区别：
   * - error 跟随调用，新调用发起后 error 立即重置
   * - expired 跟随 data，新调用的过程与结果才会影响 expired
   * 
   * @example
   * case1: p1 ok，p2 error，data 来自 p1，error 来自 p2，expired 为 true
   * case2: p1 ok，p2 error，p3 pending，data 来自 p1，error 为 undefined，expired 为 true
   * case3: p1 ok, p2 error，p3 update，data 来自 p3，error 为 undefined，expired 为 false
   */
  [K in `${StringDefaultWhenEmpty<DataName, 'data'>}Expired`]: Ref<boolean>
}>

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
  function update(v: any, { track }: { track: Track }) {
    // 结果错误时不更新已有数据
    if (track.inStateRejected()) return
    if (track.inStateUpdating() && !track.isLatestUpdate()) return
    if (track.inStateFulfilled() && !track.isLatestFulfill()) return
    data.value = v
    dataTrack.value = track
  }

  // 调用结束
  function finish(v: any, { scene, track }: { scene: 'normal' | 'error', track: Track }) {
    track.finish(scene === 'error', v)
    update(v, { track })
  }

  function getContext({ track }: { track: Track }) {
    return {
      getData: () => track.value,
      updateData: (v: any) => {
        track.update(v)
        // 拒绝结束后更新场景
        if (track.inStateUpdating()) update(v, { track })
        return v
      }
    }
  }

  function normalizeArguments(args: any[], {
    enhanceFirstArgument,
    context
  }: { 
    enhanceFirstArgument?: boolean
    context: any
  }) {
    if (!enhanceFirstArgument) return args
    const [_first, ...restArgs] = args
    const first: FirstArgumentEnhanced = {
      [FLAG_FIRST_ARGUMENT_ENHANCED]: true,
      ...(args.length ? { firstArgument: _first } : {}), 
      ...context
    }

    return [first, ...restArgs]
  }

  const tracker = createFunctionTracker()
  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const track = tracker(data.value)
    const context = getContext({ track })
    args = normalizeArguments(args, { enhanceFirstArgument, context })
    const restoreAsyncDataContext = prepareAsyncDataContext(context)
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
  const dataExpired = computed(() => {
    if (!dataTrack.value) return tracker.has.finished.value
    return dataTrack.value.isStaleValue()
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