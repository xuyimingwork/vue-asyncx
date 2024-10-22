import { computed, Ref, ref } from "vue"
import type { UseAsyncOptions, UseAsyncResult } from "./use-async"
import { useAsync } from "./use-async"
import { StringDefaultWhenEmpty, upperFirst } from "./utils";

export type UseAsyncDataOptions<Fn extends (...args: any) => any> = UseAsyncOptions<Fn>
export type UseAsyncDataResult<
  Fn extends (...args: any) => any,
  DataName extends string
> = UseAsyncResult<Fn, `query${Capitalize<(StringDefaultWhenEmpty<DataName, 'data'>)>}`> 
  & { 
  [K in (StringDefaultWhenEmpty<DataName, 'data'>)]: Ref<Awaited<ReturnType<Fn>>> 
} & {
  [K in `${StringDefaultWhenEmpty<DataName, 'data'>}Expired`]: Ref<boolean>
}


function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
>(fn: Fn, options?: UseAsyncDataOptions<Fn>): UseAsyncDataResult<Fn, 'data'>
function useAsyncData<
  Data = any,
  Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
  DataName extends string = string,
>(name: DataName, fn: Fn, options?: UseAsyncDataOptions<Fn>): UseAsyncDataResult<Fn, DataName>
function useAsyncData(...args: any[]): any {
  if (!Array.isArray(args) || !args.length) throw TypeError('参数错误：未传递')

  const { name, fn, options } = typeof args[0] === 'function' 
    ? { name: 'data', fn: args[0], options: args[1] } 
    : { name: args[0] || 'data', fn: args[1], options: args[2] }

  if (typeof name !== 'string') throw TypeError('参数错误：name')
  if (typeof fn !== 'function') throw TypeError('参数错误：fn')

  const times = ref({ 
    // 调用序号
    called: 0, 
    // 调用完成序号
    finished: 0,
    // 更新序号
    updated: 0,  
  })
  const data = ref<ReturnType<typeof fn>>()
  const dataExpired = computed(() => times.value.updated < times.value.finished)

  function after(v: any, { scene, sn }: { scene: 'update' | 'error', sn: number }) {
    // 更新结束序列号
    if (sn > times.value.finished) times.value.finished = sn

    if (scene === 'update') {
      if (sn > times.value.updated) {
        data.value = v
        times.value.updated = sn
      }
    }
  }

  function method(...args: Parameters<typeof fn>): ReturnType<typeof fn> {
    // 本次调用的序列号
    const sn = ++times.value.called
    try {
      const p = fn(...args)
      if (p instanceof Promise) {
        // promise 出现拒绝
        p.then(v => after(v, { scene: 'update', sn }), (e) => after(e, { scene: 'error', sn }))
      } else {
        after(p, { scene: 'update', sn })
      }
      return p
    } catch(e) {
      // 函数调用出现报错
      after(e, { scene: 'error', sn })
      throw e
    }
  }
  const resule = useAsync(`query${upperFirst(name)}`, method, options)
  return {
    ...resule,
    [name]: data,
    [`${name}Expired`]: dataExpired
  }
}

export { useAsyncData }