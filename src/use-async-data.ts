import { computed, Ref, ref, ShallowRef, shallowRef } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async.types"
import { useAsync } from "./use-async"
import { createTracker, Simplify, StringDefaultWhenEmpty, Track, upperFirst } from "./utils";
import { prepareAsyncDataContext } from "./use-async-data.context";
import { createEnhancedArgumentsNormalizer } from "./use-async-data.enhance-first-argument";
import { parseArguments } from "./shared";

interface _UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> extends UseAsyncOptions<Fn> {
  initialData?: Awaited<ReturnType<Fn>>,
  shallow?: Shallow,
  /**
   * @deprecated 已废弃，请使用 getAsyncDataContext
   */
  enhanceFirstArgument?: boolean
}
export type UseAsyncDataOptions<Fn extends (...args: any) => any, Shallow extends boolean> = Simplify<_UseAsyncDataOptions<Fn, Shallow>>
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

export function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  Shallow extends boolean = false
>(fn: Fn, options?: UseAsyncDataOptions<Fn, Shallow>): UseAsyncDataResult<Fn, 'data', Shallow>
export function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  DataName extends string = string,
  Shallow extends boolean = false
>(name: DataName, fn: Fn, options?: UseAsyncDataOptions<Fn, Shallow>): UseAsyncDataResult<Fn, DataName, Shallow>
export function useAsyncData(...args: any[]): any {
  const { name, fn, options } = parseArguments(args, { name: 'data' })

  const { enhanceFirstArgument, initialData, shallow, ...useAsyncOptions } = options as UseAsyncDataOptions<typeof fn, boolean> || {}
  const data = shallow 
    ? shallowRef<ReturnType<typeof fn>>(initialData) 
    : ref<ReturnType<typeof fn>>(initialData)
  const dataTrack = shallowRef<Track>()

  // 数据更新
  function update(v: any, { track }: { track: Track }) {
    // 结果错误时不更新 data（error 已在 useAsync 设置）
    if (track.inStateRejected()) return
    if (track.inStateUpdating() && !track.isLatestUpdate()) return
    if (track.inStateFulfilled() && !track.isLatestFulfill()) return
    data.value = v
    dataTrack.value = track
  }

  // 封装结束场景下的数据更新
  function finish(v: any, { scene, track }: { scene: 'normal' | 'error', track: Track }) {
    track.finish(scene === 'error', v)
    update(v, { track })
  }

  function getContext({ track }: { track: Track }) {
    return {
      getData: () => track.value,
      updateData: (v: any) => {
        if (!track.allowToStateUpdating()) return
        track.update(v)
        update(v, { track })
        return v
      }
    }
  }

  const normalizeArguments = createEnhancedArgumentsNormalizer({ enhanceFirstArgument })

  const tracker = createTracker()

  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const track = tracker(data.value)
    const context = getContext({ track })
    args = normalizeArguments(args, context)
    const restoreAsyncDataContext = prepareAsyncDataContext(context)
    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        p.then(
          v => finish(v, { scene: 'normal', track }), 
          () => finish(undefined, { scene: 'error', track })
        )
      } else {
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

export { unFirstArgumentEnhanced } from './use-async-data.enhance-first-argument'
export { getAsyncDataContext } from './use-async-data.context'