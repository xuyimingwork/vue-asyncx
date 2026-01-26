## useAsync

`useAsync` 用于封装异步函数，并提供关联的 loading、error、arguments 等响应式状态。

## 基本用法

```ts
const {
  confirm,
  confirmLoading,
} = useAsync('confirm', () => {
  return api.confirm()
})

confirm()
```

## 函数名称自定义

`useAsync` 会根据传入的名称派生函数、关联状态的名称。

```ts
const {
  init,
  initLoading
} = useAsync('init', () => {
  return api.init()
})

init()
```

除执行函数外，useAsync 还会派生 loading、arguments、error 等状态（见 [API](#api)）。

> 这种方式可以带来代码可读性上的巨大提升，详细设计见：[命名约定]()

## 原样使用

`useAsync` 返回的函数是对传入函数的包装，可以原样接收参数、返回结果

```ts
const { confirm } = useAsync('confirm', (id: string, payload: any) => {
  return api.confirm(id, payload)
})

confirm('item1', { force: true })

confirm('item2', { force: false })
  .then(result => {
    console.log('confirm result:', result)
  })
```

`useAsync` 不会改变函数的调用方式，无论返回是同步结果还是异步 Promise

如果需要展示 `result`，建议使用 `useAsyncData`

## 立即执行

默认情况下，函数不会自动执行，可以设置 `options.immediate = true` 自动调用函数。

```ts
const { 
  init, 
  initLoading 
} = useAsync('init', () => {
  return api.init()
}, { immediate: true })
```

## watch 执行

还可以在 Vue 响应式变量变化时执行

```ts
const { 
  init, 
  initLoading 
} = useAsync('init', () => {
  if (!props.id) return
  return api.init(props.id)
}, { 
  watch: () => props.id,
  immediate: true  
})
```

上面的写法等价于：

```ts
const { init, initLoading } = useAsync('init', () => {
  if (!props.id) return
  return api.init(props.id)
})
watch(() => props.id, () => init(), { immediate: true })
```

> `options.watch` 支持所有 [Vue watch 的 WatchSource](https://vuejs.org/api/reactivity-core.html#watch)


### watch 选项

对于 Vue watch 的其它配置，如 `once`、`deep`、`flush` 等，`useAsync` 全支持，可以通过 `options.watchOptions` 配置。

```ts
const { 
  init, 
  initLoading 
} = useAsync('init', () => {
  if (!props.id) return
  return api.init(props.id)
}, { 
  watch: () => props.id,
  watchOptions: {
    once: true,
  }  
})
```

### watch handler

对于需要过滤监听源的场景，可以通过 `options.watchOptions.handlerCreator` 配置

```ts
const { 
  init, 
  initLoading 
} = useAsync('init', (id) => {
  return api.init(id)
}, { 
  watch: () => props.id,
  watchOptions: {
    handlerCreator(fn) {
      return (newId, oldId, onCleanup) => {
        if (!newId) return
        fn(newId)
      }
    },
  }  
})
```

## 后置包装

可以通过 `options.setup` 改写最终的函数或在函数调用前后注入额外行为

### Debounce、Throttle

```ts
import { debounce } from 'es-toolkit';

const { 
  init, 
  initLoading 
} = useAsync('init', () => api.init(), { 
  immediate: true,
  setup(fn) {
    return debounce(fn, 500)
  }
})
```

上面例子中，`init` 等价于 `debounce(() => api.init(), 500)`。可以使用任意你喜欢的 `debounce` 函数。

注意：`options.setup` 返回的函数会成为最终调用的函数。所以 `options.immediate`、`options.watch` 触发的调用都是 `debounce` 后的。

### DOM/BOM 事件监听 / 轮询

```ts
import { debounce } from "es-toolkit"
import { useEventListener, useIntervalFn } from '@vueuse/core'

const { 
  init, 
  initLoading 
} = useAsync('init', () => api.init(), { 
  immediate: true,
  setup(fn) {
    useEventListener(document, 'visibilitychange', fn)
    useIntervalFn(fn, 1000)
    useEventListener('resize', debounce(fn, 500))
  }
})
```

在 `options.setup` 中可以像在 vue 组件的 `setup` 中一样注册外部监听器。在上面的例子中，`init` 会：

- 立即调用
- 文档显示隐藏时调用
- 间隔 1s 轮询
- 窗口尺寸变化时调用（`debounce` 版本）

由于 `options.setup` 没返回函数，此时 `init` 等价于 `() => api.init()`

> 注意，如果没有使用 `useEventListener` 等自动卸载的工具函数，你需要使用 vue 生命周期钩子手动卸载。

## API

### 响应

| 属性                     | 描述                            | 类型             | 默认值    |
| ------------------------ | ------------------------------- | ---------------- | --------- |
| {name}                   | 包装后的异步函数                | Function         | -         |
| {name}Loading            | 异步函数执行时的加载状态        | `Ref<boolean>`     | false     |
| {name}Arguments          | 异步函数执行时的传入的参数列表  | `ComputedRef<any[]>` | []        |
| {name}ArgumentFirst      | {name}Arguments 的首个参数      | `ComputedRef<any>` | undefined |
| {name}Error              | 异步函数执行时的异常            | `Ref<any>`         | undefined |

### 配置

| 配置名                      | 描述                                                  | 类型                                                    | 默认值    |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | --------- |
| immediate                   | 是否立即执行                                          | boolean                                                 | false     |
| watch                       | 传入 vue watch 的侦听数据源，发生变动时执行 `handler` | 与 vue WatchSource 一致                                 | -         |
| watchOptions                | 传入 vue watch 的配置项                               | 支持全部 vue WatchOptions，另有 `handlerCreator` 配置项 | -         |
| watchOptions.handlerCreator | 自定义传入 `watch` 的 `handler`                       | `(fn: Fn) => WatchCallback`                             | -         |
| setup                       | 转换函数或执行其它初始化操作                          | `(fn: Fn) => ((...args: any) => any) \\| void`           | -         |
