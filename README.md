## 特性

- 异步函数样板代码减少50%
- 异步函数相关的函数、变量命名风格统一
- 良好的 ts 提示支持
- 单元测试覆盖率 100% 

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
 * 调用 useAsync('submit', ...)，
 * submit、submitLoading 自动提示
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
 * 调用 useAsyncData('user', ...)，
 * user、queryUserLoading、queryUser 自动提示
 */
const { 
  user, 
  queryUserLoading, 
  queryUser 
} = useAsyncData('user', () => getUserById('1'), { immediate: true })
```
