## 特性

- 异步函数样板代码减少50%
- 异步函数相关的函数、变量命名风格统一
- 异步函数调用有序
- 良好的 ts 提示支持
- 单元测试覆盖率 100% 

## 安装

```console
pnpm i vue-asyncx
```

## 使用

### useAsync 异步函数

当需要执行一个异步函数，可以将要执行的异步函数传入 `useAsync` 中，可以得到

- 异步函数执行的 `loading` 状态
- 异步函数每次调用时传入的 `arguments`
- 异步函数报错时的 `error`

```ts
import { useAsync } from 'vue-asyncx'

const { 
  method, 
  methodLoading,
  methodArguments,
  methodError
} = useAsync(async (a: number, b: number) => a + b)

method(1, 1).then(total => console.log(total))
```

你可能不喜欢默认解构出来的 methodXXX 属性，可以直接命名：

```ts
import { useAsync } from 'vue-asyncx'

const { 
  sum, 
  sumLoading,
  sumArguments,
  sumError
} = useAsync('sum', async (a: number, b: number) => a + b)

sum(1, 1).then(total => console.log(total))
```

当你将 `sum` 字符串传入 `useAsync`，解构的 `sumXXX` 等内容将由 ts 自动推导得出。

同时，解构出的 `sum` 函数类型也与传入的函数类型一致。

想象一下在多人合作的大型项目中，使用这种约定的命名方式，开发人员可以自然地将相同模式的变量名关联在一起，互相间的代码 review 也变得容易，可以极大降低开发的心智负担。

### useAsyncData 异步数据

假设你在开发一个用户详情页，页面通过 `user` 数据渲染，`user` 数据通过 `getUserById` api 获取。

显然，`user` 是一个异步数据，通过 `useAsyncData`，你可以很容易处理这些内容，例子如下：

```ts
import { getUserById } from '@/api'
import { useAsyncData } from 'vue-asyncx'

/**
 * 调用 useAsyncData('user', ...)，
 * user、queryUserLoading、queryUser 自动提示
 */
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', () => getUserById('1'), { immediate: true })
```

开发流程的思路链条：
- 使用异步数据 user => `useAsyncData('user', `
- user 数据来自 getUserById 接口 => `useAsyncData('user', () => getUserById('1')`
- 进入页面后需要立即获取 user 数据 `useAsyncData('user', () => getUserById('1'), { immediate: true })`

ok，和 `useAsync` 一样，`useAsyncData` 自动提供了你需要的变量、函数、加载状态等内容。

- `user` 响应式变量自动定义并声明
- 获取 `user` 的函数被自动命名为 `queryUser`，
- 以及与 `queryUser` 相关的 `queryUserLoading` 等变量

### immediate 与 watch

注意到上面例子里的 `useAsyncData` 使用了 `immediate` 配置，效果是立即调用 `queryUser`，这个配置来自于大家都非常熟悉的 vue `watch` 配置。

除了 `immediate` 外，`useAsync` 和 `useAsyncData` 完整支持了 vue watch 的各种配置。
- 通过 `options.watch` 可以配置 watch source
- 通过 `options.watchOptions` 可以设置 watch 的其它 options

比如常见的通过 props 传递参数，props 参数改变，异步数据改变

```js
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', () => getUserById(props.id), { 
  watch: () => props.id,
  immediate: true,
  watchOptions: {
    once: true
    // ...支持所有传入 vue watch options 的配置
  }
})
```

> `options.watchOptions.immediate` 的优先级要高于 `options.immediate`；实际上 `options.immediate` 在底层也是通过 watch 机制触发调用

默认情况下，watch 触发的调用不会传递任何参数，此时 watch 的 handler 相当于：`() => queryUser()`。

但在 vue 中，watch 的 handler 会接收新旧数据和 `onCleanup`。

可以通过配置 `options.watchOptions.handlerCreator` 来自定义 watch 的 handler：

```js
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', (id) => getUserById(id), { 
  watch: () => props.id,
  immediate: true,
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

### 处理异步函数的乱序响应

fn 是个异步函数，且会被多次调用，考虑下下列的时间线顺序：

- 调用 fn，记做 fn1
- fn1 未结束，再次调用 fn，记做 fn2
- fn2 结束
- fn1 结束

这种场景很常见，每次都去处理 fn 的 loading 和调用结果很麻烦。

而使用 `useAsync` 和 `useAsyncData`，你无需再考虑这类问题，方法会自动帮你处理。

以上述例子举例：

- `fn1` 开始时，`loading` 开始
- **`fn2` 结束时**，`loading` 结束

在使用 `useAsyncData` 时，`data` 的响应式内容将始终以 `fn2` 调用的结果为准（即最晚的调用产生的结果）

即使 `fn1` 的结果更晚出现，但 `fn1` 的结果不会更新到 `data` 上，而是会被自动舍弃，因为这是一个“过期的”数据。

假设是如下时间线：

- 调用 fn，记做 fn1
- fn1 未结束，再次调用 fn，记做 fn2
- fn2 结束，**但发生报错**
- fn1 结束

此时：
- `fn2` 的报错会被记录到 `error` 上
- `fn1` 的结果会被更新到 `data` 上
- `expired` 会自动设置为 `true`，表明当前的 `data` 是个过期数据（因为 `data` 来自`fn1`，但最新的结果是 `fn2` 的报错）

> 大多数情况下，无需考虑 expired 的问题，因为它只会在 error 出现时出现。
> 所以，优先处理 error 往往是更好的做法

### 异步数据的半途获取与更新

在某些场景下，我们希望异步数据在异步获取的过程中更新，无需等到获取过程完全结束。

在 `useAsyncData` 中，可以通过 `options.enhanceFirstArgument = true` 支持这种需求。

```js
import { unFirstArgumentEnhanced, useAsyncData } from 'vue-asyncx'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const { 
  progress,
  queryProgress
} = useAsyncData('progress', async (init?: number) => {
  const { getData, updateData } = unFirstArgumentEnhanced(init)
  init = unFirstArgumentEnhanced(init).firstArgument
  updateData(init || 0)
  await wait(100)
  updateData(50)
  await wait(100)
  return 100
}, { 
  enhanceFirstArgument: true
})

queryProgress(10)
```

在上述代码的最后一行调用 `queryProgress(10)` 后：
- `progress.value` 会立即更新为 `10`
- 100ms 后 `progress.value` 更新为 `50`
- 再过 100ms 后，`progress.value` 更新为 `100`，本次调用结束

注意到核心改变在于 `fn` 内的

```js
const { getData, updateData } = unFirstArgumentEnhanced(init)
init = unFirstArgumentEnhanced(init).firstArgument
```

当 `options.enhanceFirstArgument = true` 后
- `fn` 的首个参数 `init` 便被拓展为 `FirstArgumentEnhanced` 类型。
- 实际调用 `fn` 是传入的 `init` 值在 `fn` 内变成了 `init.firstArgument`

只需要记住

- 可以像以往一般正常定义 `fn` 与调用 `fn`
- 在 `fn` 内部实现的最上方，加上上述的两行代码，剩下的均如往常一般

如果 `fn` 本身不接收参数，那么可以：

```js
const { 
  progress,
  queryProgress
} = useAsyncData('progress', async function () {
  const { getData, updateData } = unFirstArgumentEnhanced(arguments[0])
  updateData(0)
  await wait(100)
  updateData(50)
  await wait(100)
  return 100
}, { 
  enhanceFirstArgument: true
})

queryProgress()
```

在某些情况下，需要区分 `queryProgress()` 与 `queryProgress(undefined)`，可以通过：

```js
const firstArgumentEnhanced = unFirstArgumentEnhanced(arguments[0])
const undefinedOrEmpty = 'firstArgument' in firstArgumentEnhanced
```

即

- `firstArgumentEnhanced` 存在 `firstArgument` 属性时，是 `queryProgress(undefined)`
- `firstArgumentEnhanced` 不存在 `firstArgument` 属性时，是 `queryProgress()`

本块 api 设计思考过程见

- [rfc1-async-data-update](./docs/rfc1-async-data-update.md)















