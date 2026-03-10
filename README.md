让异步像写诗的 Vue 3 / 2.7 组合式工具库 [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/xuyimingwork/vue-asyncx) [![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/xuyimingwork/vue-asyncx) [![Test Status](https://github.com/xuyimingwork/vue-asyncx/actions/workflows/test.yml/badge.svg)](https://github.com/xuyimingwork/vue-asyncx/actions/workflows/test.yml) [![codecov](https://codecov.io/gh/xuyimingwork/vue-asyncx/graph/badge.svg)](https://codecov.io/gh/xuyimingwork/vue-asyncx)


**不重复、有语义，天然防竞态、自由可扩展**

![](./docs/compare-code.png)

- 官方文档：[Vue Asyncx](https://vue-asyncx.js.org/)
- 在线演示：[Playground](https://www.typescriptlang.org/play/?ts=5.9.3#code/PQKhCgAIUg3BXApgWgIYGcCeA7AxgD0kH95QCldAuT0Gj5QCH-A5uUADvQVWVAGJUFhNQIXNBIf6hgBVMAHRAGVcAJwCW-AC6QACgBtUmAOaiA9vGwATQFj-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)

## 特性

- 异步样板代码减少 40%+，专注业务逻辑本身
- 关联状态自动生成并命名，代码结构自解释
- 内建竞态处理机制，避免并发请求导致的数据错乱
- 插件化 addon 架构，异步能力可组合、可扩展
- SSR 友好设计，无浏览器依赖，服务端执行安全可控
- 兼容 Vue 3 / Vue 2.7，零第三方依赖
- 完整的 TypeScript 类型设计与推导支持
- 100% 单元测试覆盖，300+ 用例保障行为稳定

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

更多内容，见：[useAsyncData](https://vue-asyncx.js.org/hooks/use-async-data.html)

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

更多内容，见：[useAsync](https://vue-asyncx.js.org/hooks/use-async.html)

## 设计哲学：约定带来效率

与 [`useRequest`](https://ahooks.js.org/hooks/use-request/index) 返回固定的 `data`、`loading`、`error` 不同，`useAsyncData` 将关联的函数、变量统一命名：

- `user`：由异步函数更新的数据 `data`
- `queryUser`：更新 `user` 的异步函数
- `queryUserLoading`：调用 `queryUser` 时的 `loading` 状态

刚接触可能有些不习惯，但这种方式带来可读性和效率的双重提升，在大型项目、多人团队中尤为明显。

代码中看到 `queryUserLoading` 变量，就知道它和 `user` 变量以及 `queryUser` 函数有关。

并且这一切，都可以自动提示。

![](./docs/demo-basic.gif)


更多内容，见：[命名约定](https://vue-asyncx.js.org/introduction.html#naming-convention)

## 高级用法示例：并行同语义操作

在一些场景中，同一个异步操作可能需要分组**并行多次调用**（例如列表中多个按钮触发同一操作）。

`vue-asyncx` 通过 `withAddonGroup` 插件提供支持

![](./docs/demo-addon-group.gif)

👉 适用于：列表操作 / 批量操作 / 多实例异步

```ts
const { 
  confirm, 
  confirmGroup 
} = useAsync('confirm', confirmApi, {
  addons: [
    withAddonGroup({
      key: (args) => args[0], // 使用第一个参数作为分组 key
    }),
  ],
})
```

详细内容，见：[withAddonGroup](https://vue-asyncx.js.org/addons/group.html)

## 兼容性

- TS >= 5.4；可放宽至 TS >= 4.1
- 支持 Vue 3.x / 2.7