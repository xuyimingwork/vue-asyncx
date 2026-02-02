# useAsyncData

`useAsyncData` 用于管理异步数据，将数据、查询函数、查询函数的状态等内容自动关联，提供响应式数据更新。

> 如果不需要展示数据，只是执行 confirm、submit 等异步操作，建议使用 [`useAsync`](/hooks/use-async.md)

## 基本用法

```ts
const {
  user,
  queryUser,
  queryUserLoading,
} = useAsyncData('user', () => {
  return api.getUser()
})

queryUser()
```

- `user` 是当前数据
- `queryUser` 是触发数据更新的查询函数
- `queryUserLoading` 表示查询函数调用的加载状态

## 数据名称自定义

`useAsyncData` 会根据传入的名称生成数据、查询函数以及关联状态的名称。

```ts
const {
  user,
  queryUser,
  queryUserLoading
} = useAsyncData('user', () => {
  return api.getUser()
})

queryUser()
```

`useAsyncData` 还能解构出 `userExpired`、`queryUserArguments` 等状态（见 [API](#api)）。

> 这种方式可以带来代码可读性上的巨大提升，详细设计见：[命名约定](/introduction)

## 数据状态

`useAsyncData` 返回的 `user` 数据是响应式的，会自动更新

```ts
const { user, queryUser } = useAsyncData('user', (id: string) => {
  return api.getUser(id)
})

queryUser('user1')
  .then(result => {
    console.log('user data:', user.value) // 与 result 相同
  })

queryUser('user2')
// 结束后 user.value 会自动更新为新的结果
```

> `useAsyncData` 会自动处理函数的返回值，无论是同步数据还是异步数据

## 初始数据

默认情况下，数据是 `undefined`。可以通过 `options.initialData` 设置数据的初始值

```ts
const { user } = useAsyncData('user', () => {
  return api.getUser()
}, { 
  initialData: { name: '', age: 0 }
})
```

## 使用 shallowRef

默认情况下，数据使用 `ref` 包裹。可以通过 `options.shallow = true` 使用 `shallowRef`

```ts
const { user } = useAsyncData('user', () => {
  return api.getUser()
}, { 
  shallow: true 
})
```

## 立即执行

默认情况下，函数不会自动执行。可以设置 `options.immediate = true` 自动调用函数。

```ts
const { 
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', () => {
  return api.getUser()
}, { immediate: true })
```

## watch 执行

除立即执行外，还可以在 Vue 响应式变量变化时执行

```ts
const { 
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', () => {
  if (!props.id) return
  return api.getUser(props.id)
}, { 
  watch: () => props.id,
  immediate: true  
})
```

上面的写法等价于：

```ts
const { user, queryUser } = useAsyncData('user', () => {
  if (!props.id) return
  return api.getUser(props.id)
})
watch(() => props.id, () => queryUser(), { immediate: true })
```

> `options.watch` 支持所有 [Vue watch 的 WatchSource](https://vuejs.org/api/reactivity-core.html#watch)

### watch 选项

对于 Vue watch 的其它配置，如 `once`、`deep`、`flush` 等，`useAsyncData` 全支持，可以通过 `options.watchOptions` 配置。

```ts
const { 
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', () => {
  if (!props.id) return
  return api.getUser(props.id)
}, { 
  watch: () => props.id,
  watchOptions: {
    once: true,
  }  
})
```

> 注：`options.watchOptions.immediate` 优先级高于 `options.immediate`

### watch handler

对于需要过滤监听源的场景，可以通过 `options.watchOptions.handlerCreator` 配置

```ts
const { 
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', (id) => {
  return api.getUser(id)
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
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', () => api.getUser(), { 
  immediate: true,
  setup(fn) {
    return debounce(fn, 500)
  }
})
```

上面例子中，`queryUser` 等价于 `debounce(() => api.getUser(), 500)`。可以使用任意你喜欢的 `debounce` 函数。

注意：由于 `options.setup` 返回的函数会成为 `queryUser`。因此 `options.immediate`、`options.watch` 配置的调用触发的都是 `debounce` 后的函数。

### DOM/BOM 事件监听 / 轮询

```ts
import { debounce } from "es-toolkit"
import { useEventListener, useIntervalFn } from '@vueuse/core'

const { 
  user, 
  queryUser,
  queryUserLoading 
} = useAsyncData('user', () => api.getUser(), { 
  immediate: true,
  setup(fn) {
    useEventListener(document, 'visibilitychange', fn)
    useIntervalFn(fn, 1000)
    useEventListener('resize', debounce(fn, 500))
  }
})
```

在 `options.setup` 中可以像在 Vue 组件的 `setup` 中一样注册外部监听器。在上面的例子中，`queryUser` 会：

- 立即调用
- 文档显示隐藏时调用
- 间隔 1s 轮询
- 窗口尺寸变化时调用（`debounce` 版本）

由于 `options.setup` 没返回函数，此时 `queryUser` 等价于 `() => api.getUser()`

> 注意，如果没有使用 `useEventListener` 等自动卸载的工具函数，你需要调用 Vue 的生命周期钩子函数手动卸载。

## 中途更新

对于需要在异步函数执行过程中更新数据的场景，可以使用 `getAsyncDataContext`

```ts
import { getAsyncDataContext, useAsyncData } from 'vue-asyncx'

const { progress, queryProgress } = useAsyncData('progress', async (init = 0) => {
  const { getData, updateData } = getAsyncDataContext()
  updateData(init)
  await wait(100)
  updateData(50)
  await wait(100)
  return 100
})

queryProgress(10)
```

> - `getAsyncDataContext` 仅在**函数同步部分**可拿到上下文，异步回调中为 `null`
> - `getData`、`updateData` 内部已自动处理竞态，使用时无需关心

延伸阅读：[高级用法：利用中途更新实现时间切片](https://juejin.cn/post/7600068631359963142)

## 数据过期状态

`useAsyncData` 提供了 `{name}Expired` 状态，用于标识数据是否过期。

数据过期的场景：
- 某次调用过程更新 data 后，调用报错
- 某次调用成功后，后续调用报错

与 `error` 的区别：
- `error` 跟随调用，新调用发起后 `error` 立即重置
- `expired` 跟随 data，新调用的过程更新或结果更新才会影响 `expired`

```ts
const { user, userExpired, queryUser, queryUserError } = useAsyncData('user', (id) => {
  return api.getUser(id)
})

// case1: p1 ok，p2 error，data 来自 p1，error 来自 p2，expired 为 true
queryUser('user1') // 成功，user.value 更新
queryUser('user2') // 失败，user.value 仍为 user1 的数据，userExpired.value 为 true

// case2: p1 ok，p2 error，p3 pending，data 来自 p1，error 为 undefined，expired 为 true
queryUser('user1') // 成功
queryUser('user2') // 失败
queryUser('user3') // 进行中，userExpired.value 仍为 true

// case3: p1 ok, p2 error，p3 update，data 来自 p3，error 为 undefined，expired 为 false
queryUser('user1') // 成功
queryUser('user2') // 失败
queryUser('user3') // 成功，user.value 更新，userExpired.value 为 false
```

## useAsync vs useAsyncData

- [`useAsync`](/hooks/use-async.md)：关注“动作”的执行
- [`useAsyncData`](/hooks/use-async-data.md)：关注“数据”的展示

如果你关心“执行什么动作”，使用 [`useAsync`](/hooks/use-async.md)

如果你需要“展示异步获取的数据”，使用 [`useAsyncData`](/hooks/use-async-data.md)

## API

### 响应

| 属性                     | 描述                            | 类型             | 默认值    |
| ------------------------ | ------------------------------- | ---------------- | --------- |
| `{name}`                   | 异步函数的返回数据              | `Ref<Data>` \| `ShallowRef<Data>` | `undefined` |
| `query{Name}`              | 包装后的异步函数                | `Function`         | -         |
| `query{Name}Loading`       | 异步函数执行时的加载状态        | `Ref<boolean>`     | `false`     |
| `query{Name}Arguments`     | 异步函数执行时的传入的参数列表  | `ComputedRef<any[]>` | `undefined`        |
| `query{Name}ArgumentFirst` | 参数列表 `query{Name}Arguments` 的首个值 | `ComputedRef<any>` | `undefined` |
| `query{Name}Error`         | 异步函数执行时的异常            | `Ref<any>`         | `undefined` |
| `{name}Expired`            | 数据是否过期                    | `Ref<boolean>`     | `false`     |

### 配置

| 配置名                      | 描述                                                  | 类型                                                    | 默认值    |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | --------- |
| `initialData`                 | data 的初始值                                          | `Awaited<ReturnType<Fn>>`                                 | `undefined` |
| `shallow`                     | 使用 `shallowRef` 保存 data，否则 `ref`                | `boolean`                                                 | `false`     |
| `immediate`                   | 是否立即执行                                          | `boolean`                                                 | `false`     |
| `watch`                       | 传入 Vue watch 的侦听数据源，发生变动时执行 `handler` | 与 Vue WatchSource 一致                                 | -         |
| `watchOptions`                | 传入 Vue watch 的配置项                               | 支持全部 Vue WatchOptions，另有 `handlerCreator` 配置项 | -         |
| `watchOptions.handlerCreator` | 自定义传入 `watch` 的 `handler`                       | `(fn: Fn) => WatchCallback`                             | -         |
| `setup`                       | 转换函数或执行其它初始化操作                          | `(fn: Fn) => ((...args: any) => any) \| void`           | -         |
