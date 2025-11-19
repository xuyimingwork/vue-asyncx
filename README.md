优雅好用的异步函数/数据管理工具

![](./docs/compare.png)

## 特性

- 异步相关样板代码减少40%+
- 关联状态变量自动命名、风格统一
- 竟态条件自动处理
- 完整 TS 类型支持
- 100% 单元测试覆盖率

## 安装

```console
pnpm i vue-asyncx
```

## 快速开始

```ts
import { getUserApi } from './api'
import { useAsyncData } from '../dist/vue-asyncx'

const { 
  user, 
  queryUserLoading,
  queryUser, 
} = useAsyncData('user', getUserApi)

queryUser('Mike')
```

当需要异步数据 `user` 时，只需要传入数据的变量名和获取数据的异步函数即可。`useAsyncData` 会自动处理与异步函数相关的 `loading`, `data`, `function`、`error` 等状态。

## 约定带来效率

与 [`useRequest`](https://ahooks.js.org/hooks/use-request/index) 返回固定的 `data`、`loading`、`error` 不同，`useAsyncData` 将关联的函数、变量统一命名：

- `user`：由异步函数更新的数据 `data`
- `queryUser`：更新 `user` 的异步函数
- `queryUserLoading`：调用 `queryUser` 时的 `loading` 状态

刚接触可能有些不习惯，但这种方式带来可读性和效率的双重提升，在大型项目、多人团队中尤为明显。

代码中看到 `queryUserLoading` 变量，就知道它和 `user` 变量以及 `queryUser` 函数有关。

![](./docs/vscode-hint.png)

并且这一切，都可以自动提示。

## 用法

### 立即执行

默认情况下，异步函数需要手动调用，可以设置 `options.immediate = true` 自动触发异步函数。

```ts
const { 
  user, 
  queryUserLoading 
} = useAsyncData('user', getUserApi, { immediate: true })
```

### watch 执行

除了 `immediate`，`useAsyncData` 还完整支持 [vue watch](https://vuejs.org/api/reactivity-core.html#watch)

#### `options.watch` 配置 watch source

```ts
import { getUserApi } from './api'
import { useAsyncData } from '../dist/vue-asyncx'

const props = defineProps<{
  userId: string;
}>();

const { user } = useAsyncData('user', () => getUserApi(props.userId), { 
  watch: () => props.userId,
  immediate: true
})
```

`useAsyncData` 会立即执行，并在每次 `props.userId` 变化时执行。

上面的写法等价于：

```ts
const { user, queryUser } = useAsyncData('user', () => getUserApi(props.userId))
watch(() => props.userId, () => queryUser(), { immediate: true })
```

#### `options.watchOptions` 配置 watch options

```ts
const { user } = useAsyncData('user', () => getUserApi(props.userId), { 
  watch: () => props.userId,
  watchOptions: {
    once: true, // 此处用 once 举例，支持所有 vue watch options 内的配置
  }
})
```

> 注：`options.watchOptions.immediate` 优先级高于 `options.immediate`

#### `options.watchOptions.handlerCreator` 配置 watch handler

```ts
const { 
  user,
  queryUser 
} = useAsyncData('user', (userId) => getUserApi(userId), { 
  watch: () => props.userId,
  immediate: true,
  watchOptions: {
    // fn 等价于 queryUser
    handlerCreator(fn) {
      // handlerCreator 需要返回 watch 的 handler
      return (newId, oldId, onCleanup) => {
        // handler 用法与 vue watch handler 一致，可以排除某些非法调用
        if (!newId) return
        fn(newId)
      }
    },
  }
})
```

### 初始数据配置

```ts
const { user } = useAsyncData('user', getUserApi, { 
  // 未配置时，user 首次调用前为 undefined
  initialData: {} 
})
```

### 异步函数执行过程中更新数据

`{name}` 数据通常在异步函数调用执行结束时更新，但也可以在异步函数执行过程中更新。

通过配置 `options.enhanceFirstArgument = true` 实现。

```js
import { unFirstArgumentEnhanced, useAsyncData } from 'vue-asyncx'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const { 
  progress,
  queryProgress
} = useAsyncData('progress', async (init?: number) => {
  const { getData, updateData } = unFirstArgumentEnhanced(init)
  init = unFirstArgumentEnhanced(init).firstArgument
  // 同步更新为入参 10
  updateData(init || 0)
  await wait(100)
  // 间隔 100ms 后，更新为 50
  updateData(50)
  await wait(100)
  // 间隔 100ms 后，返回 100，本次异步函数完全结束。
  return 100
}, { 
  enhanceFirstArgument: true
})

queryProgress(10)
```

当 `options.enhanceFirstArgument = true` 后
- 异步函数的首个参数 `init` 便被转换为 `FirstArgumentEnhanced` 类型，包含 `{ getData, updateData, firstArgument }` 属性。
- 调用 `queryProgress(10)` 时传入的 `10` 在异步函数内部被赋在 `init.firstArgument` 上
- `unFirstArgumentEnhanced(init)` 先解构出 `getData` 和 `updateData`，再将 `init` 重新赋值为传入的 `10`

> 注意，异步函数的 `init` 不可以直接设置默认值。如：`(init: number = 0) => {}`，可以通过 `unFirstArgumentEnhanced(init, 0)` 设置默认值。

> 注意，`queryProgress()` 时，`'firstArgument' in unFirstArgumentEnhanced(init)` === `false`，这可以用来区分 `queryProgress()` 与 `queryProgress(undefined)`

### Debounce / Throttle

```ts
import { debounce } from 'es-toolkit';

const { 
  user, 
  queryUser 
} = useAsyncData('user', getUserApi, { 
  immediate: true,
  setup(fn) {
    // throttle 配置方式一致
    return debounce(fn, 500)
  }
})
```

上面例子中，`queryUser` 等价于 `debounce(fn, 500)`。可以使用任意你喜欢的 `debounce` 函数

> `fn` 是 `useAsyncData` 内部对 `getUserApi` 做的封装。`setup` 返回值为函数类型时，会成为最终返回的 `queryUser`。

### DOM/BOM 事件监听 / 轮询

```ts
import { debounce } from "es-toolkit"
import { useEventListener, useIntervalFn } from '@vueuse/core'

const { 
  user, 
  queryUser 
} = useAsyncData('user', getUserApi, {
  immediate: true,
  setup(fn) {
    useEventListener(document, 'visibilitychange', fn)
    useIntervalFn(fn, 1000)
    useEventListener('resize', debounce(fn, 500))
  }
})
```

在 `setup` 中可以像在 vue 组件的 `setup` 中一样注册外部监听器。在上面的例子中，`queryUser` 会：

- 立即调用
- 文档显示隐藏时调用
- 间隔 1s 轮询
- 窗口尺寸变化时调用（`debounce` 版本）

注意到：`setup` 没返回函数，此时 `queryUser` === `fn`。

> 注意，如果没有使用 `useEventListener` 等自动卸载的工具函数，你需要使用 vue 生命周期钩子手动卸载。

## API

### 响应

| 属性                     | 描述                            | 类型             | 默认值    |
| ------------------------ | ------------------------------- | ---------------- | --------- |
| {name}                   | 异步函数的返回数据              | any \\ undefined | undefined |
| query{Name}Loading       | 异步函数执行时的加载状态        | boolean          | false     |
| query{Name}Arguments     | 异步函数执行时的传入的参数列表  | any[] \\ []      | []        |
| query{Name}ArgumentFirst | query{Name}Arguments 的首个参数 | any \\ undefined | undefined |
| query{Name}Error         | 异步函数执行时的异常            | any \\ undefined | undefined |
| {name}Expired            | {name} 数据是否过期             | any \\ undefined | undefined |

### 配置

| 配置名                      | 描述                                                  | 类型                                                    | 默认值    |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | --------- |
| immediate                   | 是否立即执行                                          | boolean                                                 | false     |
| watch                       | 传入 vue watch 的侦听数据源，发生变动时执行 `handler` | 与 vue WatchSource 一致                                 | -         |
| watchOptions                | 传入 vue watch 的配置项                               | 支持全部 vue WatchOptions，另有 `handlerCreator` 配置项 | -         |
| watchOptions.handlerCreator | 自定义传入 `watch` 的 `handler`                       | `(fn: Fn) => WatchCallback`                             | -         |
| initialData                 | data 的初始值                                         | any                                                     | undefined |
| shallow                     | 是否使用 `shallowRef` 保存 data，默认使用 `ref`       | boolean                                                 | false     |
| enhanceFirstArgument        | 是否强化首个入参                                      | boolean                                                 | false     |
| setup                       | 转换函数或执行其它初始化操作                          | `(fn: Fn) => ((...args: any) => any) \| void`           | -         |

