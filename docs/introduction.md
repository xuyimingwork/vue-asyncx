# Vue 3 异步工具库

让异步像写诗：不重复、有语义，天然防竞态、自由可扩展

![](./compare.png)

## 特性

- 异步相关样板代码减少40%+
- 关联状态变量自动命名、风格统一
- 竟态条件自动处理
- 完整 TS 类型支持
- 100% 单测覆盖率，200+ 测试用例

## 安装

```console
pnpm i vue-asyncx
```

## 快速开始

### useAsyncData (异步数据管理)

需要使用异步数据 `user` 时，调用 `useAsyncData` 传入数据名和数据获取函数即可。`useAsyncData` 会自动处理与异步函数相关的 `data`, `loading`, `arguments`, `error` 等状态。

```ts
import { getUserApi } from './api'
import { useAsyncData } from 'vue-asyncx'

const { 
  user, 
  queryUserLoading,
  queryUser, 
} = useAsyncData('user', getUserApi) // 代码即注释：使用异步数据 user

queryUser('Mike')
```

### useAsync (异步函数管理)

当不需要异步数据，只关注异步函数的执行状态时：调用 `useAsync` 传入函数名和异步函数即可。`useAsync` 会自动处理与该异步函数相关的 `loading`, `arguments`, `error` 等状态。

```ts
import { submitApi } from './api'
import { useAsync } from 'vue-asyncx'

const { 
  submit, 
  submitLoading,
  submitError,
} = useAsync('submit', submitApi) // 代码即注释：使用异步函数 submit

// 表单提交
action="@click="submit(formData)"
```

## 设计哲学：约定带来效率

与 [`useRequest`](https://ahooks.js.org/hooks/use-request/index) 返回固定的 `data`、`loading`、`error` 不同，`useAsyncData` 将关联的函数、变量统一命名：

- `user`：由异步函数更新的数据 `data`
- `queryUser`：更新 `user` 的异步函数
- `queryUserLoading`：调用 `queryUser` 时的 `loading` 状态

刚接触可能有些不习惯，但这种方式带来可读性和效率的双重提升，在大型项目、多人团队中尤为明显。

代码中看到 `queryUserLoading` 变量，就知道它和 `user` 变量以及 `queryUser` 函数有关。

![](./vscode-hint.png)

并且这一切，都可以自动提示。
