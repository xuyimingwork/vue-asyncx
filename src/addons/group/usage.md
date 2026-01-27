## withAddonGroup

`withAddonGroup` 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。适用于列表页多个项都有相同操作但需要独立状态管理的场景。

## 基本用法

```ts
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})

// 模板中使用（需要使用可选链）
<button 
  :loading="confirmGroup[item.id]?.loading" 
  @click="confirm(item.id)"
>
  确认
</button>
```

## 核心特性

### 1. 固定属性

`group[key]` 始终包含以下属性：
- `loading`: `boolean` - 加载状态
- `error`: `any` - 错误信息
- `arguments`: `Parameters<Method> | undefined` - 函数调用参数
- `argumentFirst`: `Parameters<Method>['0'] | undefined` - 第一个参数
- `data`: `Awaited<ReturnType<Method>> | undefined` - 返回数据
- `dataExpired`: `boolean` - 数据是否过期

### 2. 直接值

`group[key]?.loading` 是 `boolean`，不是 `Ref<boolean>`。注意 `group[key]` 可能为 `undefined`，所以需要使用可选链 `?.` 访问属性。

### 3. 自动同步

所有 addon 的状态操作（loading、error、arguments、data）会自动同步到对应的 group。

### 4. 竟态处理

只有最新调用的状态才会更新到 group，自动处理竟态条件。

## 配置选项

### key

**类型**: `(args: any[]) => string | number`

**必需**: 是

根据函数参数生成 group key 的函数。

```ts
// 使用第一个参数作为 key
withAddonGroup({ key: (args) => args[0] })

// 使用多个参数组合作为 key
withAddonGroup({ key: (args) => `${args[0]}-${args[1]}` })

// 使用对象属性作为 key
withAddonGroup({ key: (args) => args[0].id })
```

### scope

**类型**: `(args: any[]) => string | number`

**必需**: 否

根据函数参数获取请求的 scope。当设置 scope 时，相同 scope 的 group 会自动清理其他 scope 的 group（使用 debounce 机制）。

```ts
withAddonGroup({ 
  key: (args) => args[0],
  scope: (args) => args[1] // 根据第二个参数确定 scope
})
```

### clearAutoDelay

**类型**: `number`

**必需**: 否

**默认值**: `100`

scope 自动清理的延迟时间（毫秒）。当切换 scope 时，会自动清理其他 scope 的 group。此配置控制清理操作的延迟时间。

使用 debounce 机制，在延迟时间内如果再次切换 scope，会重置计时器。

```ts
withAddonGroup({ 
  key: (args) => args[0],
  scope: (args) => args[1],
  clearAutoDelay: 200 // 自定义延迟时间为 200ms
})
```

## 使用场景

### 列表页操作

最常见的场景是列表页多个项都有相同的操作（如确认、删除、编辑等），但需要独立的状态管理。

```ts
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})

// 模板
<template>
  <div v-for="item in items" :key="item.id">
    <button 
      :loading="confirmGroup[item.id]?.loading" 
      @click="confirm(item.id)"
    >
      {{ confirmGroup[item.id]?.loading ? '确认中...' : '确认' }}
    </button>
    <div v-if="confirmGroup[item.id]?.error">
      错误: {{ confirmGroup[item.id]?.error.message }}
    </div>
    <div v-if="confirmGroup[item.id]?.data">
      {{ confirmGroup[item.id]?.data }}
    </div>
  </div>
</template>
```

### 与 useAsyncData 结合

```ts
const { queryUser, userGroup } = useAsyncData('user', getUserApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})

<template>
  <div v-for="id in userIds" :key="id">
    <div v-if="userGroup[id]?.loading">加载中...</div>
    <div v-else-if="userGroup[id]?.error">
      错误: {{ userGroup[id]?.error.message }}
    </div>
    <div v-else-if="userGroup[id]?.data">
      用户: {{ userGroup[id]?.data.name }}
    </div>
  </div>
</template>
```

### 使用 scope 自动清理

当需要在切换 scope 时自动清理其他 scope 的 group：

```ts
const { queryData, dataGroup } = useAsyncData('data', getDataApi, {
  addons: [withAddonGroup({ 
    key: (args) => args[0],      // 使用第一个参数作为 key
    scope: (args) => args[1]      // 使用第二个参数作为 scope
  })]
})

// 当切换 scope 时，其他 scope 的 group 会自动清理
queryData('key1', 'scope1')  // 创建 group['key1']
queryData('key2', 'scope1')  // 创建 group['key2']
queryData('key1', 'scope2')  // 创建 group['key1']，自动清理 scope1 的所有 group
```

## 清理 Group

可以通过 `clear{Name}Group` 方法手动清理 group。即使在请求未结束时也可以清理，清理后该 group 会被立即移除，即使后续请求完成也不会重新创建该 group。

```ts
const { confirm, confirmGroup, clearConfirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})

// 清理指定 key 的 group
clearConfirmGroup('item1')

// 清理所有 group
clearConfirmGroup()
```

### 在请求未结束时清理

可以在请求进行中时清理 group，清理后即使请求完成也不会重新创建该 group：

```ts
const { queryUser, userGroup, clearUserGroup } = useAsyncData('user', getUserApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})

// 开始请求
const promise = queryUser('user1')

// 在请求进行中时清理
clearUserGroup('user1')

// 即使请求完成，group['user1'] 也不会被重新创建
await promise
expect(userGroup.value['user1']).toBeUndefined()
```

## 注意事项

### 1. 需要使用可选链

`group[key]` 可能为 `undefined`（当该 key 还没有被调用过时），所以需要使用可选链 `?.` 访问属性。

**原因**：TypeScript 类型系统无法保证所有可能的 key 都存在，且实现上只有在函数调用时才会创建对应的 group，因此 `group[key]` 可能为 `undefined`。TypeScript 也会自动提示使用可选链。

```ts
// ✅ 正确
confirmGroup[item.id]?.loading

// ❌ 错误（如果 item.id 还没有被调用过，会报错）
confirmGroup[item.id].loading
```

### 2. 在脚本中使用需要 .value

在模板中 Vue 会自动 unref，但在脚本中需要使用 `.value`：

```ts
// 模板中（自动 unref，需要使用可选链）
<button :loading="confirmGroup[item.id]?.loading">

// 脚本中（需要 .value 和可选链）
if (confirmGroup.value[item.id]?.loading) {
  // ...
}
```

### 3. 数据同步

`group[key]?.data` 只反映最新调用的结果。如果最新调用失败但之前调用成功，`group[key]?.data` 可能不包含之前成功的数据。如果需要完整的过期逻辑，建议使用 `withAddonData` 返回的 `data` 和 `dataExpired`。

### 4. Key 类型

key 可以是 `string` 或 `number`。内部会将所有 key 转换为 `string` 进行存储，所以 `group[1]` 和 `group['1']` 指向同一个 group。

## API

### 返回属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `{name}Group` | `ComputedRef<Record<string \| number, GroupType<Method>>>` | Group 状态对象 |
| `clear{Name}Group` | `(key?: string \| number) => void` | 清理 group 的方法 |

### GroupType

```ts
type GroupType<M extends (...args: any[]) => any> = {
  loading: boolean
  error: any
  arguments: Parameters<M> | undefined
  argumentFirst: Parameters<M>['0'] | undefined
  data: Awaited<ReturnType<M>> | undefined
  dataExpired: boolean
}
```
