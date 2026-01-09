import { Ref, ShallowRef } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "@/hooks/use-async/types"
import { upperFirst } from "@/utils/base";
import type { NonEmptyString, Simplify } from "@/utils/types";
import { useAsync } from "@/hooks/use-async/use-async";
import { withAddonData } from "@/addons/data";
import { toNamedAddons } from "@/core/naming";
import { parseArguments } from "@/hooks/utils";

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
> = Simplify<UseAsyncResult<Fn, `query${Capitalize<(NonEmptyString<DataName, 'data'>)>}`> 
  & { 
  [K in (NonEmptyString<DataName, 'data'>)]: Shallow extends true 
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
  [K in `${NonEmptyString<DataName, 'data'>}Expired`]: Ref<boolean>
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
  const { name = 'data', fn, options } = parseArguments(args)
  const queryName = `query${upperFirst(name) }` as const
  return useAsync(queryName, fn, {
    ...options,
    addons: toNamedAddons(name, [
      withAddonData({
        ...options,
        type: 'data'
      })
    ])
  })
}


export { unFirstArgumentEnhanced, getAsyncDataContext } from '@/addons/data'

