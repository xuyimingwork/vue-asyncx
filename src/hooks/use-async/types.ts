import type { Addons, MergeAddonResults } from '@/addons/types';
import type { BaseFunction, CamelReplaceKeys, NonEmptyString, Simplify } from "@/utils/types";
import type { ComputedRef, Ref, WatchCallback, WatchOptions, WatchSource } from 'vue';

type UseAsyncNameDefault = 'method'

export type UseAsyncResult<
  Fn extends BaseFunction, 
  Name extends string,
  AddonResults extends any[] = any[]
> = Simplify<{
  [K in NonEmptyString<Name, UseAsyncNameDefault>]: Fn
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Loading`]: Ref<boolean>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Error`]: Ref<any>
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

export interface UseAsync {
  <
    Fn extends BaseFunction, 
    AddonResults extends any[] = any[]
  >(
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, UseAsyncNameDefault, AddonResults>;
  <
    Fn extends BaseFunction, 
    Name extends string = string,
    AddonResults extends any[] = any[]
  >(
    name: Name, 
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, Name, AddonResults>
}

