import type { ComputedRef, Ref, WatchCallback, WatchOptions, WatchSource } from 'vue'
import type { Simplify, StringDefaultWhenEmpty } from '../utils/index'

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

export type UseAsyncOptions<Fn extends (...args: any) => any> = {
  watch?: WatchSource | WatchSource[]
  watchOptions?: UseAsyncWatchOptions<Fn>
  immediate?: boolean 
  setup?: (fn: Fn) => ((...args: any) => any) | void
}