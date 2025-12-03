type ContextGetter<D = any> = () => { 
  getData: () => D,
  updateData: (v: D) => void
}

let currentContextGetter: ContextGetter = () => {
  throw new Error('[vue-asyncx] getAsyncDataContext 必须在 useAsyncData 的封装函数内调用')
}

export function prepareAsyncDataContext<D = any>(context: ReturnType<ContextGetter<D>>) {
  const prev = currentContextGetter
  const getter = () => context
  currentContextGetter = getter
  function restoreAsyncDataContext() {
    if (getter !== currentContextGetter) throw new Error('[vue-asyncx] 嵌套 AsyncDataContext 必须顺序恢复')
    currentContextGetter = prev
  }

  return restoreAsyncDataContext
}

export function getAsyncDataContext() {
  return currentContextGetter()
}