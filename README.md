## 特性

- 样板代码减少50%+
- 异步操作命名风格统一
- 异步乱序响应自动处理
- 全 TS 支持 + 100% 单元测试
- 易于编写符合“干净架构”理念的函数

## 安装

```console
pnpm i vue-asyncx
```

## 使用

### useAsync 异步函数

当需要执行一个异步函数，可以将要执行的异步函数传入 `useAsync` 中，可以得到

- 一个异步函数的包裹函数
- 记录异步函数执行 `loading` 响应式数据
- 等等

```ts
import { useAsync } from 'vue-asyncx'

const { 
  method, 
  methodLoading,
} = useAsync(async (a: number, b: number) => a + b)

method(1, 1).then(total => console.log(total))
```

如果不喜欢默认解构出来的 `method` 与 `methodLoading`，除了解构赋值的重命名，你还可以直接：

```ts
import { useAsync } from 'vue-asyncx'

const { 
  sum, 
  sumLoading
} = useAsync('sum', async (a: number, b: number) => a + b)

sum(1, 1).then(total => console.log(total))
```

当你将 `sum` 字符串传入 `useAsync`，结果属性自动替换为 `sum` 和 `sumLoading`，并且，**解构附带 ts 提示**，在结果对象内输入 `s`，相关内容会自动提示。

同时，解构出的 `sum` TS 类型由传入的函数推到出，二者 TS 类型一致。

想象一下在多人合作的大型项目中，通过这种方式约束命名。不同开发人员可以自然地将相同模式的变量名关联在一起，互相间理解代码、review 内容变得更简单。

### useAsyncData 异步数据

除了异步函数，另一个常见场景是异步数据。

假设你在开发一个用户详情页，页面通过 `user` 数据渲染，`user` 数据通过 `getUserById` api 获取。

显然，`user` 是一个异步数据，通过 `useAsyncData`，你可以很容易处理这些内容：

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
- 数据命名：页面需要使用异步数据 user => `useAsyncData('user', `
- 数据获取：user 数据来自 getUserById 接口 => `useAsyncData('user', () => getUserById('1')`
- 触发获取：进入页面后需要立即获取 user 数据 `useAsyncData('user', () => getUserById('1'), { immediate: true })`

ok，和 `useAsync` 一样，`useAsyncData` 自动提供了你需要的变量、函数、加载状态等内容。

- `user` 响应式变量自动定义并声明
- 获取 `user` 的函数被自动命名为 `queryUser`
- 类似 `useAsync`，与 `queryUser` 关联的 `queryUserLoading` 自动定义并声明

> `useAsyncData` 底层使用 `useAsync`，即 `useAsync` 的所有能力 `useAsyncData` 都具备。
> 除 `useAsync` 的能力外，`useAsyncData` 额外支持了一些与数据相关的能力。
> 二者区别：
> `useAsync` 关注异步函数，往往不需要长久保留结果值，如 `submit`、`confirm` 等操作
> `useAsyncData` 则关注异步数据，异步函数是数据的获取方式

### immediate 与 watch

注意到上面例子里的 `useAsyncData` 使用了 `immediate` 配置，效果是立即调用 `queryUser`

这个配置来自 vue `watch`，除了 `immediate` 外，**`useAsync` 和 `useAsyncData`** 完整支持了 vue watch 的各种配置
- 通过 `options.watch` 配置 watch source
- 通过 `options.watchOptions` 配置 watch 的其它 options

比如常见的通过 props 传递参数，props 参数改变，触发异步数据改变：

```js
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', () => getUserById(props.id), { 
  watch: () => props.id, // 此处用 props 举例，支持所有 vue watch source 的用法
  immediate: true,
  watchOptions: {
    once: true // 此处用 once 举例，支持所有 vue watch options 内的配置
    // 这里也可以配置 immediate，与上一层的 immediate 效果一致，优先级更高
  }
})
```

> 实际上即使不配置 `options.watch`，设置 `options.immediate` 后内部也是通过 watch 机制触发的立即调用

默认情况下，由 watch 触发的调用不会传递任何参数。watch 的 handler 相当于：`() => queryUser()`。但在 vue 中，watch 的 handler 可以接收新、旧数据以及 `onCleanup`

`useAsync` 和 `useAsyncData` 可以通过配置 `options.watchOptions.handlerCreator` 来自定义 watch handler：

```js
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', (id) => getUserById(id), { 
  watch: () => props.id,
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

### 调用报错与参数

除了 `loading`，`useAsync` 与 `useAsyncData` 还支持记录调用的 `error` 与 `arguments`，默认状态下，它们的命名是：

```js
const { 
  methodError,
  methodArguments,
} = useAsync(() => {})

const { 
  queryDataError,
  queryDataArguments
} = useAsyncData(() => {})
```

与之前例子一致，当自定义命名时，结果随之改变：

```js
const { 
  confirmError,
  confirmArguments,
} = useAsync('confirm', () => {})

const { 
  queryUserError,
  queryUserArguments
} = useAsyncData('user', () => {})
```

`error`
- **最后一次**调用 fn，且调用结果失败
  - 调用异步 fn 的 reject 内容
  - 调用同步 fn 的 throw 内容
- **新一次**调用开始时，`error` 自动置空

`arguments`
- 与 `loading` 一致，调用开始时记录本次调用传入的参数
- 调用结果出现后，`arguments` 自动置空

### 异步函数乱序响应

```js
// 使用 useAsync，没有 user 变量
const { 
  queryUser,
  queryUserLoading,
} = useAsync('queryUser', () => {})

// 或者，使用 useAsyncData
const { 
  user,
  queryUser,
  queryUserLoading
} = useAsyncData('user', () => {})
```

`queryUser` 是个异步函数，由于异步操作时间不定，多次调用情况下会出现乱序响应，考虑下列的时间线顺序：

- 调用 `queryUser`，记做 `queryUser1`
- `queryUser1` 未结束，再次调用 `queryUser`，记做 `queryUser2`
- `queryUser2` 结束
- `queryUser1` 结束

即：**依次调用 `queryUser1` 和 `queryUser2`，但 `queryUser2` 先于 `queryUser1` 结束**，这种场景很常见，专门处理很麻烦。

而使用 `useAsync` 和 `useAsyncData`，你无需再考虑这类问题，方法会自动帮你处理。

以上述例子举例：

- `queryUser1` 开始时，`queryUserLoading.value` 为 `true`
- **`queryUser2` 结束时**，`queryUserLoading.value` 为 `false`

对于 `useAsyncData`，`queryUser` 对应的 `user` 数据：

- `user.value` 将始终以 `queryUser2` 的结果为准（取**最晚的调用**产生的结果）
- 即使 `queryUser1` 的产生结果的时间更晚，但 `queryUser1` 的结果不会更新到 `user.value` 上
- `queryUser1` 的结果会被自动舍弃，因为这是一个“过期的”数据

> 另一种处理重复调用的方式是不允许在上次调用未结束时再次调用
> 
> 由于 `useAsync` 和 `useAsyncData` 提供了响应式的 `loading`，对于常用组件库，向按钮传入 `loading` 状态或在 `disabled` 属性中添加 `loading` 判断即可轻松避免

### 数据过期

> 标注过期数据是 `useAsyncData` 独有功能

```js
const { 
  user,
  queryUser,
  queryUserError,
  userExpired
} = useAsyncData('user', () => {})
```

假设是以下时间线：

- 调用 `queryUser`，记做 `queryUser1`
- `queryUser1` 未结束，再次调用 `queryUser`，记做 `queryUser2`
- `queryUser2` 结束，**但发生报错**
- `queryUser1` 结束

此时：
- `queryUser2` 的错误会被记录到 `queryUserError.value` 上
- `queryUser1` 的结果会被更新到 `user.value` 上
- `userExpired.value` 会被设置为 `true`，表明当前的 `user.value` 是个过期数据（因为 `user.value` 来自`queryUser1`，而最新的结果是 `queryUser2` 的报错）

> 大多数情况下，无需考虑 `userExpired.value` 的问题，因为它只会在 `queryUserError.value` 出现时出现，优先处理 `queryUserError.value` 往往是更好的做法

> `userExpired.value` 为 `true` 后，直到下次调用更新 `user.value` 前，`userExpired.value` 将一直保持 `true` 状态。
> 原因：`userExpired.value` 为 `true` 后，虽然再次调用了 `queryUser`，但在 `user.value` 再次更新前，`user.value` 当前的值仍是“过期的”珊瑚橘

> 由于乱序的问题，如果在 `queryUser1` 时使用了 `.then(res => ...)`，`res` 的值是 `queryUser1` 的结果，与 `user.value` 不一致。

### 异步数据的中途获取与更新

> 异步数据中途获取与更新是 `useAsyncData` 独有功能

在某些场景下，我们希望异步数据可以在异步获取过程中更新，无需等到获取过程完全结束。

可以通过 `options.enhanceFirstArgument = true` 支持这种需求。

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

注意到在传入 `useAsyncData` 的 `fn` 内，有

```js
const { getData, updateData } = unFirstArgumentEnhanced(init)
init = unFirstArgumentEnhanced(init).firstArgument
```

原理：

当 `options.enhanceFirstArgument = true` 后
- `fn` 的首个参数 `init` 便被拓展为 `FirstArgumentEnhanced` 类型。
- 实际调用 `queryProgress(10)` 时传入的 `10` 在 `fn` 内部通过 `init` 接收时变成了 `{ getData, updateData, firstArgument }`，`10` 被赋在了 `init.firstArgument` 上
- `unFirstArgumentEnhanced(init)` 先解构出 `getData` 和 `updateData`，再将 `init` 重新赋值为传入的 `10`

> 也就是在 `fn` 内部可以直接通过
> `const { getData, updateData, firstArgument } = init`
> 但是这样写需要自行处理 TS 类型问题，因此提供了 `unFirstArgumentEnhanced` 辅助函数。

只需要记住

- 可以像以往一般正常定义 `fn`、调用 `queryProgress`
- 在 `fn` 内部实现的最上方，加上上述的两行代码，余下即可正常使用

如果 `fn` 本身不接收参数，那么可以改成普通函数，通过 `arguments[0]` 传递：

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

其它

- `getData` 总是返回最新的数据
- `setData` 不保证设置成功（比如发生了乱序响应的情况）
- 接上，`setData` 支持处理乱序响应，一旦有新的调用触发 `setData`，旧调用的 `setData` 操作会被忽略

## 理念

在“干净架构”里，函数拆分的原则是：一个函数应该做且只做一件事

- 对于传入 `useAsyncData` 的函数 `fn` 而言，唯一需要关注的就是如何设置 `data` 的值
  - 对于在 `data` 值初始化后需要干的其它事情，可以在 `useAsyncData` **外部** 通过 vue 的 watch data 去触发
- 对于 `useAsyncData` 整体而言，我们将与 `data` 值相关的代码都聚集在了一起
  - loading、error、expired、arguments 等数据与 data 或 fn 紧密相关
  - watch 设置了 fn 的调用时机，即初始化 data 的时机

通过上面的约定，很容易写出“干净”的函数与高内聚的代码块，提高代码可读性

