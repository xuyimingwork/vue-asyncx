## 开始

### 安装

```console
pnpm i vue-asyncx
```

### 使用

#### useAsync 异步函数

```ts
import { submitOrder } from '@/api'
import { useAsync } from 'vue-asyncx'

/**
 * 函数 submit、加载状态 submitLoading
 * 随着 useAsync('submit', ...) 调用自动提示
 */
const { 
  submit, 
  submitLoading
} = useAsync('submit', (params: any) => submitOrder(params))

submit({ content: 'Hello World!' })
```

#### useAsyncData 异步数据

```ts
import { getUserById } from '@/api'
import { useAsyncData } from 'vue-asyncx'

/**
 * 变量 user、加载状态 queryUserLoading、函数 queryUser
 * 随着 useAsyncData('user', ...) 调用自动提示
 */
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', () => getUserById('1'), { immediate: true })
```

### 优势

- 单测覆盖率100%
- 在大型项目中统一对下列三者的命名，使项目具备更好的维护性
  - 异步函数
  - 异步函数调用加载状态
  - 异步函数获取的数据
- 通过 ts 提示，函数与变量声明过程无感，直观
- 代码编写过程思路流畅
  - 从需要 `submit` 函数开始，书写 `useAsync('submit', ...)`，后续解构均有提示辅助
  - 类似的，从需要 `user` 变量开始，书写 `useAsyncData('user', ...)`，后续变量、方法、加载变量均自动提示
