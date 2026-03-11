/* eslint-disable no-redeclare */
import { camelCase, capitalize, upperFirst } from "lodash-es"
import { Ref, ref } from "vue"

type UseAsyncResult<F, Name extends string> = {
  [K in `${Name}`]: F
} & {
  [K in `${Name}Loading`]: Ref<boolean>
}

function useAsync<T = Function>(fn: T): UseAsyncResult<T, 'method'>
function useAsync<T = Function, Name extends string = ''>(name: Name, fn: T): UseAsyncResult<T, Name>
function useAsync(fnOrName: unknown, fn?: Function): unknown {
  const loading = ref(false)
  const [name, _fn] = typeof fnOrName === 'function' ? ['method', fnOrName] : [fnOrName as string, fn]
  if (!_fn) throw Error()
  const method = (...args: any[]) => {
    loading.value = true
    const p = _fn(...args)
    if (p instanceof Promise) {
      p.finally(() => loading.value = false)
    } else {
      loading.value = false
    }
    return p
  }
  return {
    [name]: method, 
    [`${name}Loading`]: loading
  }
}

type UseAsyncDataOptions = {
  immediate?: boolean;
}

type UseAsyncDataResponse<Data, DataName extends string> = {
  [K in DataName]: Ref<Data | undefined>;
} & {
  [K in `query${Capitalize<DataName>}`]: (...args: any[]) => Promise<Data> | Data
} & {
  [K in `query${Capitalize<DataName>}Loading`]: Ref<boolean>
}

type Fn<R> = (...args: any[]) => Promise<R> | R

function useAsyncData<T>(fn: Fn<T>, options?: UseAsyncDataOptions): UseAsyncDataResponse<T, 'data'>
function useAsyncData<T, Name extends string = any>(name: Name, fn: Fn<T>,  options?: UseAsyncDataOptions): UseAsyncDataResponse<T, Name>
function useAsyncData<T>(...args: any[]): any {
  // eslint-disable-next-line no-sparse-arrays
  const [name = 'data', fn, options = { immediate: false }] = (typeof args[0] === 'function' ? [, args[0], args[1]] : args) as [string, Fn<T>, UseAsyncDataOptions]
  const loading = ref(false)
  const data = ref<T>()
  const method = (...args: any[]) => {
    const p = fn(...args)
    if (p instanceof Promise) {
      loading.value = true
      p.then(v => data.value = v)
        .finally(() => loading.value = false)
    } else {
      data.value = p
    }
    return p
  }
  if (options.immediate) method()
  return {
    [name]: data,
    [`query${upperFirst(name)}`]: method,
    [`query${upperFirst(name)}Loading`]: loading
  } as UseAsyncDataResponse<T, string>
}

function toAsync(fn: (...args: any[]) => any) {
  return (...args: any[]) => {
    const p = fn(...args)
    if (p instanceof Promise) return p
    return Promise.resolve(p)
  }
}

export { useAsync, useAsyncData, toAsync }
