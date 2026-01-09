import type { ComputedRef, Ref, WatchCallback, WatchOptions, WatchSource } from 'vue'
import type { Simplify, StringDefaultWhenEmpty } from '../utils/index'
import { Fn as BaseFunction } from "../utils/base";
import { Addons, MergeAddonResults } from '../addons/types';
import { CamelReplaceKeys } from '../utils/types/utils';

export type UseAsyncResult<
  Fn extends BaseFunction, 
  Name extends string,
  AddonResults extends any[] = any
> = Simplify<{
  [K in StringDefaultWhenEmpty<Name, 'method'>]: Fn
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Loading`]: Ref<boolean>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${StringDefaultWhenEmpty<Name, 'method'>}Error`]: Ref<any>
} & CamelReplaceKeys<MergeAddonResults<AddonResults>, Name>>

export interface UseAsyncWatchOptions<Fn extends BaseFunction> extends WatchOptions {
  handlerCreator?: (fn: Fn) => WatchCallback
}

export type UseAsyncOptions<Fn extends BaseFunction, Addons = any> = {
  watch?: WatchSource | WatchSource[]
  watchOptions?: UseAsyncWatchOptions<Fn>
  immediate?: boolean 
  setup?: (fn: Fn) => BaseFunction | void
  addons?: Addons
}

type UseAsyncNameDefault = 'method'

export interface UseAsync {
  <
    Fn extends BaseFunction, 
    AddonResults extends any[] = any
  >(
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, UseAsyncNameDefault, AddonResults>;
  <
    Fn extends BaseFunction, 
    Name extends string = string,
    AddonResults extends any[] = any
  >(
    name: Name, 
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, Name, AddonResults>
}