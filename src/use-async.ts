import { computed, ComputedRef, Ref, ref, watch, WatchCallback, WatchOptions, WatchSource } from "vue"
import { createFunctionTracker, Simplify, StringDefaultWhenEmpty, Track,  } from "./utils"

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
  if (!Array.isArray(args) || !args.length) throw TypeError('Expected at least 1 argument, but got 0.')
  const { name, fn, options }: { 
    name: string, 
    fn: (...args: any) => any,
    options: UseAsyncOptions<(...args: any) => any>, 
  } = typeof args[0] === 'function' 
    ? { name: 'method', fn: args[0], options: args[1] }
    : { name: args[0] || 'method', fn: args[1], options: args[2] }
  if (typeof name !== 'string') throw TypeError(`Expected "name" to be a string, but received ${typeof name}.`)
  if (typeof fn !== 'function') throw TypeError(`Expected "fn" to be a function, but received ${typeof fn}.`)

  const loading = ref(false)
  const _args = ref<Parameters<typeof fn>>()
  const error = ref()

  const tracker = createFunctionTracker()

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

  const method = getFunction(_method, options?.setup)

  if (options) {
    const noop = () => {}
    const { handlerCreator, ...watchOptions } = Object.assign({}, 
      'immediate' in options ? { immediate: options.immediate } : {}, 
      options.watchOptions ?? {}
    )
    const { watch: watchSource } = options
    const getHandler = () => {
      const defaultHandler = () => method()
      if (typeof handlerCreator !== 'function') return defaultHandler
      try {
        const _handler = handlerCreator(method)
        return typeof _handler === 'function' ? _handler : defaultHandler
      } catch (e) {
        return defaultHandler
      }
    }
    const handler = getHandler()
    watch(watchSource ?? noop, handler, watchOptions)
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

function getFunction<Fn extends (...args: any) => any = any>(fn: Fn, setup?: (fn: Fn) => (Fn | void)): Fn {
  if (typeof setup !== 'function') return fn
  try {
    const result = setup(fn)
    return typeof result === 'function' ? result : fn
  } catch {
    return fn
  }
}