import { Ref, ref, watch, WatchOptions, WatchSource } from "vue"
import { StringDefaultWhenEmpty,  } from "./utils"

export type UseAsyncResult<Fn extends (...args: any) => any, Name extends string> = {
  [K in StringDefaultWhenEmpty<Name, 'method'>]: Fn
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Loading`]: Ref<boolean>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Arguments`]: Ref<Parameters<Fn>>
}

export type UseAsyncOptions = {
  watch?: WatchSource
  watchOptions?: WatchOptions
  immediate?: boolean 
}

function useAsync<Fn extends (...args: any) => any>(fn: Fn, options?: UseAsyncOptions): UseAsyncResult<Fn, 'method'>
function useAsync<Fn extends (...args: any) => any, Name extends string = string>(name: Name, fn: Fn, options?: UseAsyncOptions): UseAsyncResult<Fn, Name>
function useAsync(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')
  const { name, fn, options }: { 
    name: string, 
    fn: (...args: any) => any,
    options: UseAsyncOptions, 
  } = typeof args[0] === 'function' 
    ? { name: 'method', fn: args[0], options: args[1] }
    : { name: args[0] || 'method', fn: args[1], options: args[2] }
  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  const loading = ref(false)
  const _args = ref<Parameters<typeof fn>>()
  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const before = () => {
      loading.value = true
      _args.value = args
    }
    const after = () => {
      loading.value = false
      _args.value = undefined
    }

    before()
    const p = fn(...args)
    if (p instanceof Promise) {
      p.finally(() => after())
    } else {
      after()
    }
    return p
  }

  if (options) {
    const noop = () => {}
    const watchOptions = Object.assign({}, 
      'immediate' in options ? { immediate: options.immediate } : {}, 
      options.watchOptions ?? {}
    )
    const { watch: watchSource } = options
    watch(watchSource ?? noop, () => method(), watchOptions)
  }
  
  return {
    [name]: method,
    [`${name}Loading`]: loading,
    [`${name}Arguments`]: _args
  }
}

export { useAsync, useAsync as useAsyncFunction }