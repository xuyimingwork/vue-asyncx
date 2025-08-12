import { computed, ComputedRef, Ref, ref, watch, WatchCallback, WatchOptions, WatchSource } from "vue"
import { StringDefaultWhenEmpty,  } from "./utils"

export type UseAsyncResult<Fn extends (...args: any) => any, Name extends string> = {
  [K in StringDefaultWhenEmpty<Name, 'method'>]: Fn
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Loading`]: Ref<boolean>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Error`]: Ref<any>
}

export interface UseAsyncWatchOptions<Fn extends (...args: any) => any> extends WatchOptions {
  handlerCreator?: (fn: Fn) => WatchCallback
}

export type UseAsyncOptions<Fn extends (...args: any) => any> = {
  watch?: WatchSource
  watchOptions?: UseAsyncWatchOptions<Fn>
  immediate?: boolean 
}

function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, 'method'>
function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions<Fn>): UseAsyncResult<Fn, Name>
function useAsync(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')
  const { name, fn, options }: { 
    name: string, 
    fn: (...args: any) => any,
    options: UseAsyncOptions<(...args: any) => any>, 
  } = typeof args[0] === 'function' 
    ? { name: 'method', fn: args[0], options: args[1] }
    : { name: args[0] || 'method', fn: args[1], options: args[2] }
  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  // 调用过程的加载状态
  const loading = ref(false)
  // 调用过程的入参，调用结束后重置
  const _args = ref<Parameters<typeof fn>>()
  const argFirst = computed(() => _args.value?.[0])
  // 上次调用的错误，下次调用开始后重置
  const error = ref()

  const times = { called: 0, finished: 0 }

  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    // 初始化本次调用序列号
    const sn = ++times.called

    const before = (args) => {
      // 方法调用，则上次报错置空、则开始加载、则调用参数更新
      error.value = undefined
      loading.value = true
      _args.value = args
    }
    
    const after = (v, { scene, sn }: { scene: 'normal' | 'error', sn: number }) => {
      // 更新结束序列号
      if (sn > times.finished) times.finished = sn
      // 是否最后一次更新
      const isLastCalledFinished = times.called === times.finished
      if (!isLastCalledFinished) return
      if (scene === 'error') error.value = v
      loading.value = false
      _args.value = undefined
    }

    before(args)
    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        p.then(
          () => after(undefined, { scene: 'normal', sn }),
          e => after(e, { scene: 'error', sn })
        )
      } else {
        after(undefined, { scene: 'normal', sn })
      }
      return p
    } catch (e) {
      after(e, { scene: 'error', sn })
      throw e
    }
  }

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
    [`${name}Arguments`]: _args,
    [`${name}ArgumentFirst`]: argFirst,
    [`${name}Error`]: error,
  }
}

export { useAsync, useAsync as useAsyncFunction }