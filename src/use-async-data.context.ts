import { message } from "./utils"

type ContextGetter<D = any> = () => { 
  getData: () => D,
  updateData: (v: D) => void
}

let currentContextGetter: ContextGetter = () => {
  throw new Error(message('getAsyncDataContext must be called synchronously within useAsyncData function.'))
}

export function prepareAsyncDataContext<D = any>(context: ReturnType<ContextGetter<D>>) {
  const prev = currentContextGetter
  const getter = () => context
  currentContextGetter = getter
  function restoreAsyncDataContext() {
    if (getter !== currentContextGetter) throw new Error(message('[Internal] Nested AsyncDataContext must be restored in order.'))
    currentContextGetter = prev
  }

  return restoreAsyncDataContext
}

export function getAsyncDataContext() {
  return currentContextGetter()
}