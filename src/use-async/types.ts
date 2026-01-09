import type { ComputedRef, Ref, WatchCallback, WatchOptions, WatchSource } from 'vue'
import type { BaseFunction, NonEmptyString, Simplify } from "../utils/types";
import { Addons, MergeAddonResults } from '../addons/types';
import { CamelReplaceKeys } from '../utils/types';

export type UseAsyncResult<
  Fn extends BaseFunction, 
  Name extends string,
  AddonResults extends any[] = any
> = Simplify<{
  [K in NonEmptyString<Name, 'method'>]: Fn
} & {
  [K in `${NonEmptyString<Name, 'method'>}Loading`]: Ref<boolean>
} & {
  [K in `${NonEmptyString<Name, 'method'>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${NonEmptyString<Name, 'method'>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${NonEmptyString<Name, 'method'>}Error`]: Ref<any>
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