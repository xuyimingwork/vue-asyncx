# Hooks API 参考

本文档介绍 Vue-AsyncX 提供的 Hooks API。

## useAsync

管理异步函数的执行状态，不管理数据。

### 函数签名

```typescript
function useAsync<Fn extends BaseFunction>(
  fn: Fn,
  options?: UseAsyncOptions<Fn>
): UseAsyncResult<Fn, 'method', []>

function useAsync<Fn extends BaseFunction, Name extends string>(
  name: Name,
  fn: Fn,
  options?: UseAsyncOptions<Fn>
): UseAsyncResult<Fn, Name, []>
```

### 参数

#### 方式一：不指定名称

- `fn`：异步函数

#### 方式二：指定名称

- `name`：函数名称（可选）
- `fn`：异步函数
- `options`：配置选项（可选）

### 返回

返回一个对象，包含以下属性：

| 属性 | 类型 | 描述 |
|------|------|------|
| `{name}` | `Fn` | 包装后的异步函数 |
| `{name}Loading` | `Ref<boolean>` | 异步函数执行时的加载状态 |
| `{name}Arguments` | `ComputedRef<Parameters<Fn>>` | 异步函数执行时的传入的参数列表 |
| `{name}ArgumentFirst` | `ComputedRef<Parameters<Fn>['0']>` | 异步函数执行时的传入的首个参数 |
| `{name}Error` | `Ref<any>` | 异步函数执行时的异常 |

**命名规则**：
- 如果未指定 `name`，默认使用 `'method'`
- `{name}` 会被替换为实际名称（如 `submit`）
- `{name}Loading` 会被替换为 `submitLoading`

### 配置选项

#### UseAsyncOptions

```typescript
interface UseAsyncOptions<Fn extends BaseFunction> {
  watch?: WatchSource | WatchSource[]
  watchOptions?: UseAsyncWatchOptions<Fn>
  immediate?: boolean
  setup?: (fn: Fn) => BaseFunction | void
  addons?: Addons
}
```

**选项说明**：

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `immediate` | `boolean` | `false` | 是否立即执行 |
| `watch` | `WatchSource \| WatchSource[]` | - | 传入 vue watch 的侦听数据源，发生变动时执行 `handler` |
| `watchOptions` | `UseAsyncWatchOptions<Fn>` | - | 传入 vue watch 的配置项 |
| `watchOptions.handlerCreator` | `(fn: Fn) => WatchCallback` | - | 自定义传入 `watch` 的 `handler` |
| `setup` | `(fn: Fn) => BaseFunction \| void` | - | 转换函数或执行其它初始化操作 |
| `addons` | `Addons` | - | 自定义插件数组 |

### 使用示例

#### 基本用法

```typescript
import { useAsync } from 'vue-asyncx'
import { submitApi } from './api'

const { submit, submitLoading, submitError } = useAsync('submit', submitApi)

// 调用函数
submit(formData)
```

#### 立即执行

```typescript
const { query, queryLoading } = useAsync('query', fetchData, {
  immediate: true
})
```

#### 监听变化

```typescript
const props = defineProps<{ userId: string }>()

const { queryUser } = useAsync('user', () => fetchUser(props.userId), {
  watch: () => props.userId,
  immediate: true
})
```

#### 自定义 setup

```typescript
import { debounce } from 'es-toolkit'

const { query } = useAsync('query', fetchData, {
  setup: (fn) => debounce(fn, 500)
})
```

## useAsyncData

管理异步数据，包含 `useAsync` 的所有功能，额外管理数据状态。

### 函数签名

```typescript
function useAsyncData<Data = any, Fn extends (...args: any) => Data | Promise<Data>>(
  fn: Fn,
  options?: UseAsyncDataOptions<Fn, false>
): UseAsyncDataResult<Fn, 'data', false>

function useAsyncData<Data = any, Fn extends (...args: any) => Data | Promise<Data>, DataName extends string>(
  name: DataName,
  fn: Fn,
  options?: UseAsyncDataOptions<Fn, false>
): UseAsyncDataResult<Fn, DataName, false>
```

### 参数

#### 方式一：不指定名称

- `fn`：异步数据获取函数

#### 方式二：指定名称

- `name`：数据名称（可选）
- `fn`：异步数据获取函数
- `options`：配置选项（可选）

### 返回

返回一个对象，包含 `useAsync` 的所有属性，以及：

| 属性 | 类型 | 描述 |
|------|------|------|
| `{name}` | `Ref<Data> \| ShallowRef<Data>` | 异步函数的返回数据 |
| `{name}Expired` | `Ref<boolean>` | 数据是否过期 |

**命名规则**：
- 如果未指定 `name`，默认使用 `'data'`
- `{name}` 会被替换为实际名称（如 `user`）
- `query{Name}` 会被替换为 `queryUser`（函数名）
- `{name}Expired` 会被替换为 `userExpired`

### 配置选项

#### UseAsyncDataOptions

```typescript
interface UseAsyncDataOptions<Fn extends BaseFunction, Shallow extends boolean> extends UseAsyncOptions<Fn> {
  initialData?: Awaited<ReturnType<Fn>>
  shallow?: Shallow
  enhanceFirstArgument?: boolean  // @deprecated
}
```

**选项说明**：

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `initialData` | `Awaited<ReturnType<Fn>>` | `undefined` | data 的初始值 |
| `shallow` | `boolean` | `false` | 是否使用 `shallowRef` 保存 data，默认使用 `ref` |
| `enhanceFirstArgument` | `boolean` | `false` | 已废弃，请使用 `getAsyncDataContext` |

**继承自 UseAsyncOptions**：
- `immediate`
- `watch`
- `watchOptions`
- `setup`
- `addons`

### 使用示例

#### 基本用法

```typescript
import { useAsyncData } from 'vue-asyncx'
import { getUserApi } from './api'

const { user, queryUser, queryUserLoading, userExpired } = useAsyncData('user', getUserApi)

// 调用函数
queryUser('user123')
```

#### 初始数据

```typescript
const { user } = useAsyncData('user', getUserApi, {
  initialData: {}
})
```

#### 使用 shallowRef

```typescript
const { user } = useAsyncData('user', getUserApi, {
  shallow: true
})
```

#### 在执行过程中更新

```typescript
import { getAsyncDataContext, useAsyncData } from 'vue-asyncx'

const { progress, queryProgress } = useAsyncData('progress', async (init = 0) => {
  const { getData, updateData } = getAsyncDataContext()
  
  // 同步更新为入参
  updateData(init)
  
  await wait(100)
  // 间隔 100ms 后，更新为 50
  updateData(50)
  
  await wait(100)
  // 间隔 100ms 后，返回 100
  return 100
})

queryProgress(10)
```

#### 监听变化

```typescript
const props = defineProps<{ userId: string }>()

const { user } = useAsyncData('user', () => getUserApi(props.userId), {
  watch: () => props.userId,
  immediate: true
})
```

## useAsyncFunction

`useAsync` 的别名。

```typescript
export { useAsync as useAsyncFunction }
```

## getAsyncDataContext

获取当前 `useAsyncData` 函数的上下文对象。

### 函数签名

```typescript
function getAsyncDataContext(): {
  getData: () => any
  updateData: (v: any) => void
} | null
```

### 返回

- 如果当前在 `useAsyncData` 函数执行上下文中，返回上下文对象
- 否则返回 `null`

### 上下文对象

```typescript
{
  getData: () => any      // 获取当前数据
  updateData: (v: any) => void  // 更新数据（竟态安全）
}
```

### 使用示例

```typescript
import { getAsyncDataContext, useAsyncData } from 'vue-asyncx'

const { queryData } = useAsyncData('data', async (id) => {
  // 正确用法：在函数同步部分调用
  const { getData, updateData } = getAsyncDataContext()
  
  // 获取当前数据
  const currentData = getData()
  
  // 执行异步操作
  const newData = await fetch(`/api/data/${id}`)
  
  // 更新数据（竟态安全）
  updateData(newData)
  
  return newData
})
```

### 注意事项

1. **只在同步部分可用**：`getAsyncDataContext` 只在函数执行的同步部分可用
2. **异步回调中不可用**：在异步回调中调用会返回 `null`
3. **竟态安全**：`getData` 和 `updateData` 内部已自动处理竟态条件

### 错误用法

```typescript
// ❌ 错误：在外部调用
const context = getAsyncDataContext() // context === null

// ❌ 错误：在异步回调中调用
const { queryData } = useAsyncData('data', async (id) => {
  setTimeout(() => {
    const context = getAsyncDataContext() // context === null
  }, 1000)
  return fetch(`/api/data/${id}`)
})
```

---

**更多信息**：参考 [README.md](../../README.md) 和 [架构文档](../architecture.md)。

