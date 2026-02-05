# 04: withAddonGroup

本文档描述 `withAddonGroup` addon 的设计与实现。`withAddonGroup` 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。

---

## 一、设计

### 概述

`withAddonGroup` 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。

### 核心需求

#### 使用场景

列表页有多个项，每个项都有相同的操作（如 confirm），但需要独立的状态管理：

```typescript
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ by: (id) => id })]
})

// 模板中使用（不需要可选链）
<button 
  :loading="confirmGroup[item.id].loading" 
  @click="confirm(item.id)"
>
  确认
</button>
```

#### 关键要求

1. **不使用可选链**：`confirmGroup[item.id].loading` 而不是 `confirmGroup[item.id]?.loading`
2. **固定属性**：`group[key]` 始终包含 `loading`、`error`、`arguments`、`data`
3. **直接值**：`group[key].loading` 是 `boolean`，不是 `Ref<boolean>`
4. **自动同步**：所有 addon 的 setData 操作自动同步到 group

### 架构设计

#### 核心机制：基于事件系统的自动同步

**设计思路：**
- **track 支持 'data' 事件**：在 `track.setData` 时触发事件
- **monitor 转发事件**：monitor 监听 track 的 `'data'` 事件，转发为 `'track:data'` 事件
- **withAddonGroup 统一监听**：通过 `monitor.on('track:data', ...)` 监听所有 setData 操作
- **自动同步**：所有 addon 调用 `track.setData` 时，自动同步到 groupRefs

#### withAddonGroup 实现

```typescript
// src/addons/group.ts
import { TRACK_ADDON_DATA } from './data'
import { TRACK_ADDON_LOADING } from './loading'
import { TRACK_ADDON_ERROR } from './error'
import { TRACK_ADDON_ARGUMENTS } from './arguments'
import { computed, reactive, ref } from 'vue'

const GROUP_KEY_KEY = Symbol('vue-asyncx:group:key')

export function withAddonGroup(config: { by: (args: any[]) => string | number }) {
  return (({ monitor }) => {
    const { by } = config
    
    const groupRefs = reactive<Record<string | number, {
      loading: Ref<boolean>
      error: Ref<any>
      arguments: Ref<any>
      data: Ref<any>
    }>>({})
    
    const groupComputed = computed(() => {
      return new Proxy({} as Record<string | number, {
        loading: boolean
        error: any
        arguments: any
        data: any
      }>, {
        get(target, key: string | number) {
          if (groupRefs[key]) {
            return {
              loading: groupRefs[key].loading.value,
              error: groupRefs[key].error.value,
              arguments: groupRefs[key].arguments.value,
              data: groupRefs[key].data.value
            }
          } else {
            return {
              loading: false,
              error: undefined,
              arguments: undefined,
              data: undefined
            }
          }
        }
      })
    })
    
    monitor.on('init', ({ args, track }) => {
      const key = by(args)
      track.setData(GROUP_KEY_KEY, key)
      
      if (!groupRefs[key]) {
        groupRefs[key] = {
          loading: ref(false),
          error: ref(undefined),
          arguments: ref(undefined),
          data: ref(undefined)
        }
      }
    })
    
    monitor.on('track:data', ({ track, key, value }) => {
      const groupKey = track.getData(GROUP_KEY_KEY)
      if (!groupKey || !groupRefs[groupKey]) return
      
      if (key === TRACK_ADDON_LOADING) {
        groupRefs[groupKey].loading.value = value ?? false
      } else if (key === TRACK_ADDON_ERROR) {
        groupRefs[groupKey].error.value = value
      } else if (key === TRACK_ADDON_ARGUMENTS) {
        groupRefs[groupKey].arguments.value = value
      } else if (key === TRACK_ADDON_DATA) {
        const data = track.getData(TRACK_ADDON_DATA)
        groupRefs[groupKey].data.value = data
      }
    })
    
    return { __name__Group: groupComputed }
  })
}
```

### 改造顺序（阶段 3-4）

#### 阶段 3：实现 withAddonGroup

1. **创建 withAddonGroup** (`src/addons/group.ts`)
   - 实现 Proxy 按需初始化
   - 实现 computed 返回
   - 实现 `init` 事件中的 key 存储
   - 实现 `track:data` 事件监听和自动同步

2. **类型定义**
   - 定义 `withAddonGroup` 的类型签名
   - 确保返回类型包含 `[name]Group`

#### 阶段 4：测试和优化

1. **单元测试**：EventBus、Track 事件、Monitor 转发、withAddonGroup 功能
2. **集成测试**：与现有 addon 集成、用户主动更改数据
3. **性能测试**：Proxy、大量 key

### 数据结构

```typescript
// 内部存储（ref）
type GroupRefs = Record<string | number, {
  loading: Ref<boolean>
  error: Ref<any>
  arguments: Ref<any>
  data: Ref<any>
}>

// 对外返回（直接值）
type GroupState = {
  loading: boolean
  error: any
  arguments: any
  data: any
}

type Group = Record<string | number, GroupState>
```

### 使用示例（设计）

#### 基础用法

```typescript
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ by: (id) => id })]
})

<button 
  :loading="confirmGroup[item.id].loading" 
  @click="confirm(item.id)"
>
  确认
</button>

if (confirmGroup.value[item.id].loading) {
  // ...
}
```

#### 与 useAsyncData 结合

```typescript
const { queryUser, userGroup } = useAsyncData('user', getUserApi, {
  addons: [withAddonGroup({ by: (id) => id })]
})

<template>
  <div v-for="id in userIds" :key="id">
    <div v-if="userGroup[id].loading">加载中...</div>
    <div v-else-if="userGroup[id].error">错误: {{ userGroup[id].error }}</div>
    <div v-else-if="userGroup[id].data">
      用户: {{ userGroup[id].data.name }}
    </div>
  </div>
</template>
```

### 设计决策总结

1. **初始化策略**：Proxy 按需初始化
2. **返回类型**：`ComputedRef`
3. **固定属性**：`loading`、`error`、`arguments`、`data`
4. **事件系统**：基于 track 'data' 事件和 monitor 'track:data' 事件
5. **私有 key 和共享 key 机制**：保护数据隐私和只读性
6. **延迟注册监听**：解决 addon 执行顺序导致的时序问题

### 待解决问题

1. **类型推导**：确保 TypeScript 正确推导 `[name]Group` 的类型
2. **Proxy 兼容性**：测试 Proxy 与 Vue reactive 的兼容性
3. **清理策略**：是否需要提供 `clearGroup` 方法？
4. **性能优化**：大量 key 时的性能考虑
5. **边界情况**：key 为 `undefined`/`null` 的处理
6. **映射冲突处理**：如果多个 addon 尝试映射同一个共享 key 的处理策略
7. **映射撤销**：是否需要支持撤销映射的功能？
8. **group data 与 withAddonData 逻辑不一致**：
   - **问题描述**：当前实现中，`withAddonGroup` 的 data 更新逻辑与 `withAddonData` 中的逻辑不一致。
   - **具体表现**：
     - `withAddonData` 在 `before` 事件中会设置当前的 `data.value`（可能是旧值）到 track，触发 `track:data` 事件
     - `withAddonData` 在 `fulfill` 事件中，如果当前 track 不是最新的（`dataTrack.value.sn > track.sn`），不会更新 `data.value`，但 `track.setData` 仍会执行并触发 `track:data` 事件
     - `withAddonGroup` 中，如果 track.sn 更大或等于当前 sn，会更新 group，但此时 value 可能是旧值
   - **影响**：旧的 data 可能会更新到 group 上，导致 group 中的 data 与 `withAddonData` 返回的 `data` 不一致
   - **解决方案**：需要调整 `withAddonGroup` 的 data 更新逻辑，确保只有最新的、有效的 data 才会更新到 group 上

---

## 二、实现

### 概述

本文档记录 `withAddonGroup` addon 的当前实现细节。

### 核心需求（实现视角）

1. **不使用可选链**：`confirmGroup[item.id].loading` 而不是 `confirmGroup[item.id]?.loading`
2. **固定属性**：`group[key]` 始终包含 `loading`、`error`、`arguments`、`data`
3. **直接值**：`group[key].loading` 是 `boolean`，不是 `Ref<boolean>`
4. **自动同步**：所有 addon 的 setData 操作自动同步到 group
5. **竟态处理**：只有最新调用的状态才会更新到 group

### 实现架构

#### 核心机制：基于事件系统的自动同步

**设计思路：**
- **track 支持 'data' 事件**：在 `track.setData` 时触发事件（仅当数据已映射到共享 key）
- **monitor 转发事件**：monitor 监听 track 的 `'data'` 事件，转发为 `'track:data'` 事件
- **withAddonGroup 统一监听**：通过 `monitor.on('track:data', ...)` 监听所有 setData 操作
- **自动同步**：所有 addon 调用 `track.setData` 时，自动同步到 groups

### 数据结构（实现）

```typescript
/**
 * 内部 Group 类型（包含 sn）
 */
type InnerGroup = {
  loading: boolean
  error: any
  arguments: any
  data: any
  sn: number  // 追踪最新的 track.sn
}

/**
 * Group 类型（对外返回，不包含 sn）
 */
type Group = {
  loading: boolean
  error: any
  arguments: any
  data: any
}

/**
 * Groups 类型
 */
type Groups = Record<string | number, InnerGroup>
```

### 核心实现

#### 1. 初始化

在 `init` 事件中：
- 根据函数参数生成 group key（通过 `by` 函数）
- 将 group key 存储到 track 中（供 `track:data` 事件使用）
- 初始化 group 状态（如果不存在）
- 更新 group 的 sn

```typescript
monitor.on('init', ({ args, track }) => {
  const key = by(args)
  track.setData(GROUP_KEY, key)
  updateGroup(key, { sn: track.sn })
})
```

#### 2. 状态更新

通过 `updateGroup` 函数统一更新 group 状态：

```typescript
function updateGroup(key: string | number, updates: Partial<InnerGroup> & { sn: number }): void {
  if (!groups[key]) {
    groups[key] = createDefaultGroupState()
  }
  
  const currentSn = groups[key].sn
  if (updates.sn < currentSn) return
  
  groups[key] = { ...groups[key], ...updates }
}
```

**更新逻辑：**
- 如果 `updates.sn < currentSn`：直接返回，不更新（旧调用）
- 如果 `updates.sn >= currentSn`：更新所有属性（最新调用或相同调用）

#### 3. 自动同步

```typescript
const keyToPropertyMap = new Map<symbol, 'loading' | 'error' | 'arguments' | 'data'>([
  [TRACK_ADDON_LOADING, 'loading'],
  [TRACK_ADDON_ERROR, 'error'],
  [TRACK_ADDON_ARGUMENTS, 'arguments'],
  [TRACK_ADDON_DATA, 'data']
])

monitor.on('track:data', ({ track, key, value }) => {
  const groupKey = track.getData<string | number>(GROUP_KEY)
  if (groupKey === undefined) return
  
  const property = keyToPropertyMap.get(key)
  if (!property) return
  
  updateGroup(groupKey, {
    sn: track.sn,
    [property]: value
  })
})
```

#### 4. Proxy 按需初始化

```typescript
const groupComputed = computed(() => {
  return new Proxy({} as Record<string | number, Group>, {
    get(target, p: string | symbol) {
      if (typeof p === 'symbol') return undefined
      const key = p as string | number
      
      const { sn, ...group } = groups[key] || createDefaultGroupState()
      return group
    }
  })
})
```

**特性：**
- 访问不存在的 key 时，返回默认值（不使用可选链）
- 自动排除 `sn` 属性（内部使用）
- 通过 `computed` 包装，确保响应式更新

### 竟态处理

#### 处理机制

通过 `sn`（调用序号）判断是否为最新调用：

1. **每个调用都有唯一的 sn**：由 tracker 分配，严格递增
2. **group 存储最新的 sn**：`groups[key].sn` 记录该 group key 的最新调用序号
3. **更新时比较 sn**：
   - `updates.sn < currentSn`：旧调用，不更新
   - `updates.sn >= currentSn`：最新调用或相同调用，更新

#### 示例场景

```typescript
// 调用 1（sn=1）：confirm(1)
// 调用 2（sn=2）：confirm(2)
// 调用 3（sn=3）：confirm(1)  // 同一个 key

// 如果调用 3 先完成，group[1] 会更新为调用 3 的结果
// 如果调用 1 后完成，group[1] 不会更新（因为 sn=1 < sn=3）
```

### 已知问题

#### 1. group.data 与 withAddonData 逻辑不一致

**问题描述：**

当前实现中，`withAddonGroup` 的 data 更新逻辑与 `withAddonData` 中的逻辑不一致。

**具体表现：**

1. **`withAddonData` 的 data 更新逻辑**：
   ```typescript
   function update(value: any, track: Track) {
     track.setData(VALUE_KEY, value)  // 总是执行，触发事件
     if (dataTrack.value && dataTrack.value.sn > track.sn) return  // 竟态检查
     data.value = value  // 只有最新数据才更新
     dataTrack.value = track
   }
   ```
   - 只要 data 是"最新的"（`dataTrack.value.sn` 是最大的），即使当前调用不是最新的（`track.sn < dataTrack.value.sn`），也会更新到 `data.value` 上
   - 这是因为 data 还支持 expired 逻辑，需要保留"最新的"数据，即使它不是"最新的"调用产生的
   - 配合 `dataExpired` 使用，可以判断数据是否过期

2. **`withAddonGroup` 的 data 更新逻辑**：
   ```typescript
   function updateGroup(key: string | number, updates: Partial<InnerGroup> & { sn: number }): void {
     const currentSn = groups[key].sn
     if (updates.sn < currentSn) return  // 只允许最新调用更新
     groups[key] = { ...groups[key], ...updates }
   }
   ```
   - 只允许"最新的"调用产生的 data 更新值（`updates.sn >= currentSn`）
   - 这是因为 loading/arguments/error 只反应最新的结果，所以 group 中的这些属性也应该只反应最新的调用

**影响：**

- `withAddonData` 返回的 `data` 可能包含"最新的"数据（即使不是最新调用产生的），配合 `dataExpired` 使用
- `withAddonGroup` 返回的 `group[key].data` 只包含"最新的"调用产生的数据
- 两者不一致，可能导致用户困惑

**示例场景：**

```typescript
// 调用 1（sn=1）：queryUser(1) -> 成功，返回 user1
// 调用 2（sn=2）：queryUser(1) -> 失败

// withAddonData 的行为：
// - data.value = user1（因为 user1 是最新的成功数据）
// - dataExpired.value = true（因为最新调用失败了）

// withAddonGroup 的行为：
// - group[1].data = undefined（因为最新调用失败了）
// - group[1].error = error（最新调用的错误）

// 不一致：withAddonData 有数据，但 group[1].data 没有
```

**解决方案：**

1. **方案 1**：在 `withAddonGroup` 中实现类似 `withAddonData` 的逻辑
2. **方案 2**：调整 `withAddonData` 的逻辑，让 data 也只反应最新调用的结果
3. **方案 3**：明确文档说明 `group[key].data` 只反应最新调用的结果

**推荐方案：方案 1**，保持一致性，但需要额外的实现复杂度。

### 使用示例（实现）

#### 基础用法

```typescript
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ by: (args) => args[0] })]
})

<button 
  :loading="confirmGroup[item.id].loading" 
  @click="confirm(item.id)"
>
  确认
</button>

if (confirmGroup.value[item.id].loading) {
  // ...
}
```

#### 与 useAsyncData 结合

```typescript
const { queryUser, userGroup } = useAsyncData('user', getUserApi, {
  addons: [withAddonGroup({ by: (args) => args[0] })]
})

<template>
  <div v-for="id in userIds" :key="id">
    <div v-if="userGroup[id].loading">加载中...</div>
    <div v-else-if="userGroup[id].error">错误: {{ userGroup[id].error }}</div>
    <div v-else-if="userGroup[id].data">
      用户: {{ userGroup[id].data.name }}
    </div>
  </div>
</template>
```

**注意**：由于已知问题，`userGroup[id].data` 可能不包含 `withAddonData` 返回的 `data`（如果最新调用失败但之前调用成功）。

### 技术细节

#### 事件系统

- **track 'data' 事件**：在 `track.setData` 时触发（仅当数据已映射到共享 key）
- **monitor 'track:data' 事件**：monitor 转发 track 的 data 事件
- **延迟注册**：monitor 在 `init` 事件之后才注册 track 监听，避免时序问题

#### 私有 key 和共享 key

- **私有 key**：addon 内部使用，不导出，不触发事件（除非映射到共享 key）
- **共享 key**：导出，供其他 addon 读取，通过 `shareData` 映射后才会触发事件
- **只读保护**：其他 addon 只能通过共享 key 读取数据，不能修改

#### 响应式机制

- **reactive 包装**：`groups` 使用 `reactive` 包装
- **computed 包装**：`groupComputed` 使用 `computed` 包装
- **Proxy 拦截**：通过 Proxy 拦截属性访问，按需返回 group 状态

### 总结

`withAddonGroup` 通过事件系统实现了自动同步，通过 `sn` 实现了竟态处理，通过 Proxy 实现了按需初始化。但存在与 `withAddonData` 逻辑不一致的问题，需要后续解决。
