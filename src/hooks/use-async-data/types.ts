import type { UseAsyncOptions, UseAsyncResult } from "@/hooks/use-async/types";
import type { BaseFunction, NonEmptyString, Simplify } from "@/utils/types";
import type { Ref, ShallowRef } from "vue";
import type { Addons } from '@/addons/types';

type UseAsyncDataNameDefault = 'data'

export interface UseAsyncDataOptions<Fn extends BaseFunction, Shallow extends boolean, AddonResults extends any[] = any[]> extends UseAsyncOptions<Fn, Addons<Fn, AddonResults>> {
  initialData?: Awaited<ReturnType<Fn>>,
  shallow?: Shallow,
  /**
   * @deprecated 已废弃，请使用 getAsyncDataContext
   */
  enhanceFirstArgument?: boolean
}

export type UseAsyncDataResult<
  Fn extends BaseFunction,
  Name extends string,
  Shallow extends boolean = false,
  AddonResults extends any[] = any[]
> = Simplify<UseAsyncResult<Fn, `query${Capitalize<(NonEmptyString<Name, UseAsyncDataNameDefault>)>}`, AddonResults> 
  & { 
  [K in (NonEmptyString<Name, UseAsyncDataNameDefault>)]: Shallow extends true 
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
  [K in `${NonEmptyString<Name, UseAsyncDataNameDefault>}Expired`]: Ref<boolean>
}>

export interface UseAsyncData {
  <
    Data = any,
    Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
    Shallow extends boolean = false,
    AddonResults extends any[] = any[]
  >(
    fn: Fn, 
    options?: UseAsyncDataOptions<Fn, Shallow, AddonResults>
  ): UseAsyncDataResult<Fn, UseAsyncDataNameDefault, Shallow, AddonResults>;
  <
    Data = any,
    Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
    DataName extends string = string,
    Shallow extends boolean = false,
    AddonResults extends any[] = any[]
  >(
    name: DataName, 
    fn: Fn, 
    options?: UseAsyncDataOptions<Fn, Shallow, AddonResults>
  ): UseAsyncDataResult<Fn, DataName, Shallow, AddonResults>
}

