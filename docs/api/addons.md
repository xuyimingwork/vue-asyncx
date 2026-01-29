# Addons API 参考

本文档介绍 Vue-AsyncX 提供的内置 Addon（插件）。

## 概述

Addon 是 Vue-AsyncX 的插件系统，用于扩展 `useAsync` 和 `useAsyncData` 的功能。所有内置 Addon 都已自动集成到相应的 Hook 中，无需手动添加。

## 内置 Addon 列表

- `withAddonLoading`：管理加载状态
- `withAddonError`：管理错误状态
- `withAddonArguments`：追踪函数参数
- `withAddonData`：管理数据状态（仅 `useAsyncData`）
- `withAddonFunction`：返回包装后的函数
- `withAddonWatch`：自动监听并执行

## withAddonLoading

管理异步函数的加载状态。

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `__name__Loading` | `Ref<boolean>` | 加载状态，函数执行时为 `true`，完成后为 `false` |

### 实现逻辑

- 监听 `track:updated` 事件：当 `RUN_LOADING` 变化时更新状态
- 通过 `defineStateLoading` 管理状态，自动处理竟态条件
- 只有最新调用的状态才会更新到最终结果

### 使用示例

```typescript
const { submit, submitLoading } = useAsync('submit', submitApi)

// submitLoading.value 会自动更新
console.log(submitLoading.value) // false
submit()
console.log(submitLoading.value) // true
```

## withAddonError

管理异步函数的错误状态。

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `__name__Error` | `Ref<any>` | 错误状态，函数执行失败时存储错误信息，新调用开始时重置 |

### 实现逻辑

- 监听 `track:updated` 事件：当 `RUN_ERROR` 变化时更新状态
- 通过 `defineStateError` 管理状态，自动处理竟态条件
- 在 `pending` 状态时重置错误，在 `rejected` 状态时设置错误
- 只有最新调用的状态才会更新到最终结果

### 使用示例

```typescript
const { submit, submitError } = useAsync('submit', submitApi)

try {
  await submit()
} catch (e) {
  // submitError.value 会自动更新
  console.log(submitError.value) // 错误信息
}
```

## withAddonArguments

追踪异步函数的参数。

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `__name__Arguments` | `ComputedRef<Parameters<Fn>>` | 函数执行时的传入的参数列表 |
| `__name__ArgumentFirst` | `ComputedRef<Parameters<Fn>['0']>` | 函数执行时的传入的首个参数 |

### 实现逻辑

- 监听 `track:updated` 事件：当 `RUN_ARGUMENTS` 变化时更新状态
- 通过 `defineStateArguments` 管理状态，自动处理竟态条件
- 在 `pending` 状态时存储参数，在 `fulfilled` 或 `rejected` 状态时清空参数
- 只有最新调用的状态才会更新到最终结果
- `argumentFirst` 通过 `computed` 自动计算首个参数

### 使用示例

```typescript
const { submit, submitArguments, submitArgumentFirst } = useAsync('submit', submitApi)

submit('user123', { include: 'profile' })

// submitArguments.value = ['user123', { include: 'profile' }]
// submitArgumentFirst.value = 'user123'
```

## withAddonData

管理异步数据状态（仅 `useAsyncData` 使用）。

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `__name__` | `Ref<Data> \| ShallowRef<Data>` | 异步函数的返回数据 |
| `__name__Expired` | `Ref<boolean>` | 数据是否过期 |

### 实现逻辑

- 监听 `init` 事件：准备上下文，设置初始值到 `RUN_DATA`
- 监听 `before` 事件：设置上下文到全局，使得 `getAsyncDataContext` 可以获取
- 监听 `track:updated` 事件：当 `RUN_DATA` 或 `RUN_ERROR` 变化时更新状态
  - 通过 `defineStateData` 管理状态，自动处理竟态条件
  - 支持在函数执行过程中手动更新数据（通过 `getAsyncDataContext`）
  - 使用 `RUN_DATA_UPDATED` 标记数据是否已更新，确保只有已更新的数据才会被应用
- 监听 `after` 事件：恢复上下文（移除全局上下文）
- 计算 `dataExpired`：通过 `computed` 自动判断数据是否过期
  - 无数据状态，但已有完成的调用（可能是失败）
  - 当前数据对应的调用最终结果是报错
  - 在当前数据之后有调用发生了报错

### 数据过期机制

数据在以下情况下会被标记为过期（通过 `dataExpired` 计算属性自动判断）：

1. **无数据状态**：如果当前没有数据，但已有完成的调用（可能是失败），则标记为过期
2. **数据对应的调用失败**：如果当前数据对应的调用最终结果是报错，则标记为过期
3. **后续调用失败**：如果在当前数据之后有调用发生了报错，则标记为过期

过期机制的目的是标识数据可能不是最新的，帮助开发者了解数据状态。

### 使用示例

```typescript
const { user, userExpired, queryUser } = useAsyncData('user', getUserApi)

queryUser('user123')

// user.value 会自动更新
// userExpired.value 会标识数据是否过期
```

## withAddonFunction

返回包装后的函数（高级 Addon）。

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `__name__` | `Fn` | 包装后的异步函数 |

### 实现逻辑

- 阶段二：返回最终的 method

### 使用示例

```typescript
const { submit } = useAsync('submit', submitApi)

// submit 是包装后的函数，具有监控能力
submit(formData)
```

## withAddonWatch

自动监听并执行（高级 Addon）。

### 功能

根据配置的 `watch` 和 `watchOptions`，自动设置 Vue 的 `watch`，在数据变化时自动执行函数。

### 实现逻辑

- 阶段二：根据配置设置 `watch`
- 支持 `immediate`、`handlerCreator` 等选项

### 使用示例

```typescript
const props = defineProps<{ userId: string }>()

const { user } = useAsyncData('user', () => getUserApi(props.userId), {
  watch: () => props.userId,
  immediate: true
})

// 当 props.userId 变化时，会自动调用 getUserApi
```

## 工具函数

### getAsyncDataContext

获取当前 `useAsyncData` 函数的上下文对象。

**类型**：
```typescript
function getAsyncDataContext(): {
  getData: () => any
  updateData: (v: any) => void
} | null
```

**说明**：
- 只在函数执行的同步部分可用
- 在异步回调中会返回 `null`
- `getData` 和 `updateData` 内部已自动处理竟态条件
- `updateData` 只能在函数未完成时调用（`finished` 状态前）

**使用示例**：
```typescript
const { queryData } = useAsyncData('data', async (id) => {
  const { getData, updateData } = getAsyncDataContext()
  
  // 获取当前数据
  const currentData = getData()
  
  // 更新数据
  updateData(newData)
  
  return newData
})
```

### unFirstArgumentEnhanced

解构增强后的第一个参数（已废弃）。

**类型**：
```typescript
function unFirstArgumentEnhanced<T>(
  args: [FirstArgumentEnhanced<T>, ...any[]],
  defaultValue?: T
): [T, ...any[]]
```

**说明**：
- 已废弃，请使用 `getAsyncDataContext` 获取上下文
- 用于解构 `enhanceFirstArgument` 增强后的第一个参数

## 自定义 Addon

你可以创建自定义 Addon 来扩展功能。参考 [Addon 开发指南](../guides/addon-development.md) 了解如何开发自定义 Addon。

### 使用自定义 Addon

```typescript
import { useAsync } from 'vue-asyncx'
import { withAddonCustom } from './custom-addon'

const { submit, submitCustom } = useAsync('submit', submitApi, {
  addons: [withAddonCustom()]
})
```

---

**更多信息**：
- [Addon 开发指南](../guides/addon-development.md)
- [架构文档](../architecture.md)

