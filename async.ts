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

export { useAsync }
