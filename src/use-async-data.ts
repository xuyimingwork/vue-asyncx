import { Ref, ref } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { StringDefaultWhenEmpty, upperFirst } from "./utils";

export type UseAsyncDataOptions = UseAsyncOptions
export type UseAsyncDataResult<
  Fn extends (...args: any) => any,
  DataName extends string
>
  = UseAsyncResult<Fn, `query${Capitalize<(StringDefaultWhenEmpty<DataName, 'data'>)>}`> 
  & { [K in (StringDefaultWhenEmpty<DataName, 'data'>)]: Ref<Awaited<ReturnType<Fn>>> }


function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
>(fn: Fn, options?: UseAsyncDataOptions): UseAsyncDataResult<Fn, 'data'>
function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  DataName extends string = string,
>(name: DataName, fn: Fn, options?: UseAsyncDataOptions): UseAsyncDataResult<Fn, DataName>
function useAsyncData(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')

  const { name, fn, options } = typeof args[0] === 'function' 
    ? { name: 'data', fn: args[0], options: args[1] } 
    : { name: args[0] || 'data', fn: args[1], options: args[2] }

  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  const data = ref<ReturnType<typeof fn>>()
  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    const p = fn(...args)
    if (p instanceof Promise) {
      p.then(v => data.value = v)
    } else {
      data.value = p
    }
    return p
  }
  const resule = useAsync(`query${upperFirst(name)}`, method, options)
  return {
    ...resule,
    [name]: data,
  }
}

export { useAsyncData }