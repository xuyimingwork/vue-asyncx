# 快速开始

使用你喜欢的包管理器安装 `vue-asyncx`：

```bash
# pnpm
pnpm install vue-asyncx

# npm
npm install vue-asyncx

# yarn
yarn add vue-asyncx
```

## useAsync - 异步函数管理

当你只需要管理异步函数的执行状态（如 loading、error），而不需要管理数据时，使用 `useAsync`。

### 最简示例

```ts
import { useAsync } from 'vue-asyncx'
import { submitApi } from './api'

const { 
  submit,           // 包装后的异步函数
  submitLoading,   // 加载状态
  submitError,     // 错误状态
} = useAsync('submit', submitApi)

// 调用函数
submit(formData)
```

`useAsync` 会自动处理与异步函数相关的 `loading`、`error`、`arguments` 等状态，让你专注于业务逻辑。

> 📖 **了解更多**：查看 [useAsync 完整文档](/hooks/use-async.md)

## useAsyncData - 异步数据管理

当你需要管理异步数据时，使用 `useAsyncData`。它会自动处理数据、loading、error 等所有相关状态。

### 最简示例

```ts
import { useAsyncData } from 'vue-asyncx'
import { getUserApi } from './api'

const { 
  user,              // 异步数据
  queryUser,         // 查询函数
  queryUserLoading,  // 加载状态
  queryUserError,    // 错误状态
} = useAsyncData('user', getUserApi)

// 调用函数获取数据
queryUser('Mike')
```

`useAsyncData` 会自动处理与异步数据相关的 `data`、`loading`、`arguments`、`error`、`expired` 等状态，并内置竞态条件处理。

> 📖 **了解更多**：查看 [useAsyncData 完整文档](/hooks/use-async-data.md)