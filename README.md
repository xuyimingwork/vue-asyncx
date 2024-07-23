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
