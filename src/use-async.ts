import { computed, ComputedRef, Ref, ref, watch, WatchCallback, WatchOptions, WatchSource } from "vue"
import { createTracker, getFunction, Simplify, StringDefaultWhenEmpty, Track,  } from "./utils"
import { parseArguments } from "./shared"

export type UseAsyncResult<Fn extends (...args: any) => any, Name extends string> = Simplify<{
  [K in StringDefaultWhenEmpty<Name, 'method'>]: Fn
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Loading`]: Ref<boolean>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Error`]: Ref<any>
}>

export interface UseAsyncWatchOptions<Fn extends (...args: any) => any> extends WatchOptions {
  handlerCreator?: (fn: Fn) => WatchCallback
}

export type UseAsyncOptions<Fn extends (...args: any) => any> = Simplify<{
  watch?: WatchSource
  watchOptions?: UseAsyncWatchOptions<Fn>
  immediate?: boolean 
  setup?: (fn: Fn) => ((...args: any) => any) | void
}>

export function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, 'method'>
export function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, Name>
export function useAsync(...args: any[]): any {
  const { name, fn, options } = parseArguments(args, { name: 'method' })

  const loading = ref(false)
  const _args = ref<Parameters<typeof fn>>()
  const error = ref()

  const tracker = createTracker()

  // 函数执行时立即调用，保证状态始终跟随最新的调用
  const before = (args: any[]) => {
    error.value = undefined
    loading.value = true
    _args.value = args
  }

  // 函数结束时调用并更新状态，通过 track 确保只有最新的调用才能更新状态
  const after = (v: any, { scene, track }: { scene: 'normal' | 'error', track: Track }) => {
    track.finish(scene === 'error', v)
    if (!track.isLatestCall()) return
    if (scene === 'error') error.value = v
    loading.value = false
    _args.value = undefined
  }

  function _method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const track = tracker()

    before(args)
    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        p.then(
          () => after(undefined, { scene: 'normal', track }),
          e => after(e, { scene: 'error', track })
        )
      } else {
        after(undefined, { scene: 'normal', track })
      }
      return p
    } catch (e) {
      after(e, { scene: 'error', track })
      throw e
    }
  }

  const method = getFunction(
    options?.setup, [_method], _method, 
    'Run options.setup failed, fallback to default behavior.'
  )

  if (options) {
    const { handlerCreator, ...watchOptions } = Object.assign({}, 
      'immediate' in options ? { immediate: options.immediate } : {}, 
      options.watchOptions ?? {}
    )
    const { watch: watchSource = () => {} } = options
    const handler = getFunction(
      handlerCreator, [method], () => method(),
      'Run options.watchOptions.handlerCreator failed, fallback to default behavior.'
    )
    watch(watchSource, handler, watchOptions)
  }
  
  return {
    [name]: method,
    [`${name}Loading`]: loading,
    [`${name}Arguments`]: computed(() => _args.value),
    [`${name}ArgumentFirst`]: computed(() => _args.value?.[0]),
    [`${name}Error`]: error,
  }
}

export { useAsync as useAsyncFunction }