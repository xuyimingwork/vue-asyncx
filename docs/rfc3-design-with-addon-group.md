# RFC3: withAddonGroup 设计文档

## 概述

本文档详细讨论 `withAddonGroup` addon 的设计细节和实现方案。`withAddonGroup` 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。

## 核心需求

### 使用场景

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

### 关键要求

1. **不使用可选链**：`confirmGroup[item.id].loading` 而不是 `confirmGroup[item.id]?.loading`
2. **固定属性**：`group[key]` 始终包含 `loading`、`error`、`arguments`、`data`
3. **直接值**：`group[key].loading` 是 `boolean`，不是 `Ref<boolean>`
4. **自动同步**：所有 addon 的 setData 操作自动同步到 group

## 架构设计

### 核心机制：基于事件系统的自动同步

**设计思路：**
- **track 支持 'data' 事件**：在 `track.setData` 时触发事件
- **monitor 转发事件**：monitor 监听 track 的 `'data'` 事件，转发为 `'track:data'` 事件
- **withAddonGroup 统一监听**：通过 `monitor.on('track:data', ...)` 监听所有 setData 操作
- **自动同步**：所有 addon 调用 `track.setData` 时，自动同步到 groupRefs

### EventBus 抽象

为了在 monitor 和 track 之间复用事件逻辑，需要创建 EventBus 抽象：

```typescript
// src/core/eventbus.ts
export function createEventBus<EventMap extends Record<string, any>>() {
  const handlers = new Map<keyof EventMap, Set<(data: EventMap[keyof EventMap]) => void>>()
  
  return {
    on<T extends keyof EventMap>(event: T, handler: (data: EventMap[T]) => void): void {
      const set = handlers.get(event) || new Set()
      handlers.set(event, set)
      set.add(handler as any)
    },
    off<T extends keyof EventMap>(event: T, handler: (data: EventMap[T]) => void): void {
      handlers.get(event)?.delete(handler as any)
    },
    emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void {
      handlers.get(event)?.forEach(h => h(data))
    }
  }
}
```

### Track 事件系统

**核心设计：私有 key 映射到共享 key**

为了确保数据隐私和只读保护，track 使用私有 key 存储数据，通过 `shareData` 方法将私有 key 映射到共享 key。只有映射到共享 key 的数据才会触发事件，其他 addon 只能通过共享 key 读取数据，不能修改。

```typescript
// src/core/tracker.ts
import { createEventBus } from './eventbus'

type TrackEventMap = {
  'data': { key: symbol, value: any }
}

export type Track = {
  // ... 现有属性
  setData: (key: symbol, value?: any) => void
  getData: <V = any>(key: symbol) => V | undefined
  takeData: <V = any>(key: symbol) => V | undefined
  /**
   * 将私有 key 映射到共享 key
   * 
   * @description 将私有 key 映射到共享 key，只有映射到共享 key 的数据才会触发事件。
   * 其他 addon 只能通过共享 key 读取数据，不能修改（因为 setData 只接受私有 key）。
   * 
   * @param key - 私有 key（addon 内部使用）
   * @param sharedKey - 共享 key（其他 addon 可以读取）
   * 
   * @returns 如果映射成功返回 true，如果 key 已被映射或 sharedKey 已被使用返回 false
   */
  shareData: (key: symbol, sharedKey: symbol) => boolean
  // 新增：事件监听（内部使用，不暴露给外部）
  on: <T extends keyof TrackEventMap>(event: T, handler: (data: TrackEventMap[T]) => void) => void
  off: <T extends keyof TrackEventMap>(event: T, handler: (data: TrackEventMap[T]) => void) => void
}

function createTrack(tracker: InnerTracker): Track {
  const bus = createEventBus<TrackEventMap>()
  const data = new Map<symbol, any>()
  
  // 私有 key 到共享 key 的映射
  const keyToSharedMap = new Map<symbol, symbol>()
  // 共享 key 到私有 key 的映射（用于只读保护）
  const sharedToKeyMap = new Map<symbol, symbol>()
  
  const self: Track = {
    // ... 现有方法
    
    /**
     * 将私有 key 映射到共享 key
     */
    shareData(key: symbol, sharedKey: symbol): boolean {
      // 检查私有 key 是否已被映射
      if (keyToSharedMap.has(key)) return false
      // 检查共享 key 是否已被使用
      if (sharedToKeyMap.has(sharedKey)) return false
      
      keyToSharedMap.set(key, sharedKey)
      sharedToKeyMap.set(sharedKey, key)
      return true
    },
    
    /**
     * 存储关联数据（私有 key）
     * 
     * @description 使用私有 key 存储数据。如果该私有 key 已映射到共享 key，
     * 则会触发 'data' 事件（使用共享 key）。
     * 如果传入的是共享 key，直接返回，不执行任何操作。
     * 
     * @param key - 数据键（私有 key，Symbol）
     * @param value - 数据值（如果为 undefined 则删除）
     */
    setData: (key: symbol, value?: any) => {
      // 如果传入的是共享 key，直接返回
      if (sharedToKeyMap.has(key)) {
        return
      }
      
      if (value === undefined) {
        data.delete(key)
        // 如果已映射，触发删除事件
        const sharedKey = keyToSharedMap.get(key)
        if (sharedKey) {
          bus.emit('data', { key: sharedKey, value: undefined })
        }
        return
      }
      
      data.set(key, value)
      
      // 如果该私有 key 已映射到共享 key，触发事件（使用共享 key）
      const sharedKey = keyToSharedMap.get(key)
      if (sharedKey) {
        bus.emit('data', { key: sharedKey, value })
      }
    },
    
    /**
     * 获取关联数据（支持私有 key 和共享 key）
     * 
     * @description 根据 Symbol 键获取关联的数据。
     * 如果传入的是共享 key，会通过映射找到对应的私有 key 来读取数据。
     * 
     * @template V - 数据类型
     * 
     * @param key - 数据键（私有 key 或共享 key）
     * 
     * @returns 返回关联的数据，如果不存在返回 undefined
     */
    getData: <V = any>(key: symbol) => {
      // 如果是共享 key，通过映射找到私有 key
      const privateKey = sharedToKeyMap.get(key) || key
      return data.get(privateKey) as V | undefined
    },
    
    /**
     * 获取并移除关联数据（仅支持私有 key）
     * 
     * @description 根据私有 key 获取并删除数据。
     * 如果传入的是共享 key，直接返回 undefined，不执行任何操作。
     * 
     * @template V - 数据类型
     * 
     * @param key - 数据键（必须是私有 key）
     * 
     * @returns 返回关联的数据，如果不存在或传入的是共享 key 返回 undefined
     */
    takeData: <V = any>(key: symbol) => {
      // 如果传入的是共享 key，直接返回 undefined
      if (sharedToKeyMap.has(key)) {
        return undefined
      }
      
      if (!data.has(key)) return undefined
      const value = data.get(key) as V | undefined
      data.delete(key)
      return value
    },
    
    // 事件监听（内部使用，不暴露给外部）
    on: bus.on,
    off: bus.off
  }
  
  return self
}
```

### Monitor 事件转发

**设计决策：延迟注册监听，避免 init 阶段时序问题**

为了避免 addon 执行顺序导致的时序问题，monitor 在 `init` 事件触发**之后**才注册 track 的监听。这样：
- `init` 阶段的 `setData` 不会触发 `track:data` 事件（解决时序问题）
- `before` 及之后阶段的 `setData` 会正常触发 `track:data` 事件
- 所有 addon 的 `init` 处理器执行完成后，才开始转发事件

```typescript
// src/core/monitor.ts
import { createEventBus } from './eventbus'

type FunctionMonitorEventMap = {
  'init': { args: any[], track: Track }
  'before': { args: any[], track: Track }
  'after': { track: Track }
  'fulfill': { track: Track, value: any }
  'reject': { track: Track, error: any }
  // 新增：track:data 事件
  'track:data': { track: Track, key: symbol, value: any }
}

function createInternalFunctionMonitor(): InternalFunctionMonitor {
  const bus = createEventBus<FunctionMonitorEventMap>()
  
  return {
    // ... 现有方法
    on: bus.on,
    off: bus.off,
    emit: bus.emit
  }
}

export function withFunctionMonitor<Fn extends BaseFunction>(fn: Fn) {
  const tracker = createTracker()
  const monitor = createInternalFunctionMonitor()
  
  const run = ((...args: Parameters<Fn>): ReturnType<Fn> => {
    const { fulfill, reject, ...track } = tracker.track()
    
    // 触发 init 事件：用于初始化/准备逻辑
    // 注意：此时 monitor 还未注册 track 的监听，所以 init 阶段的 setData 不会触发 track:data 事件
    monitor.emit('init', { args, track })
    
    // 在 init 之后注册监听，开始转发 track 的 data 事件
    track.on('data', ({ key, value }) => {
      monitor.emit('track:data', { track, key, value })
    })
    
    // 触发 before 事件：用于执行前观察逻辑
    monitor.emit('before', { args, track })
    
    // ... 其他逻辑
  }) as Fn
  
  return { run, monitor: createFunctionMonitor(monitor, tracker) }
}
```

**Track 接口限制：**

为了限制外部 addon 对 track 状态的更改，monitor 传出的 Track 类型不包含事件监听方法：

```typescript
// src/core/monitor.ts
export type Track = Pick<TrackFull, 
  'sn' | 
  'is' | 'isLatest' | 'hasLater' |
  'getData' | 'setData' | 'takeData' |
  'shareData'
  // 注意：不包含 'on' 和 'off' 方法
>
```

### Symbol 导出规范

**私有 key 和共享 key 的区分：**

各个 addon 需要明确区分私有 key 和共享 key：
- **私有 key**：不导出，addon 内部使用，不触发事件（除非映射到共享 key）
- **共享 key**：导出，供其他 addon 读取，通过 `shareData` 映射后才会触发事件

```typescript
// src/addons/data/index.ts
// 共享 key（导出，供其他 addon 读取）
export const TRACK_ADDON_DATA = Symbol('vue-asyncx:addon:data')

// src/addons/data/state.ts
// 私有 keys（不导出，内部使用）
const VALUE_KEY = Symbol('value')      // 存储函数返回值
const CONTEXT_KEY = Symbol('context')  // 存储上下文对象
const RESTORE_KEY = Symbol('restore')  // 存储上下文恢复函数

// 在 init 事件中建立映射
monitor.on('init', ({ track }) => {
  // 将私有 key 映射到共享 key
  track.shareData(VALUE_KEY, TRACK_ADDON_DATA)
  
  // 使用私有 key 设置数据（会触发事件，使用共享 key）
  track.setData(VALUE_KEY, data.value)
  
  // 使用私有 key 设置数据（不触发事件，未映射）
  track.setData(CONTEXT_KEY, {...})
  track.setData(RESTORE_KEY, ...)
})

// src/addons/loading.ts
export const TRACK_ADDON_LOADING = Symbol('vue-asyncx:addon:loading')

// 在 loading addon 中
const LOADING_KEY = Symbol('loading')  // 私有 key

monitor.on('init', ({ track }) => {
  track.shareData(LOADING_KEY, TRACK_ADDON_LOADING)
})

monitor.on('before', ({ track }) => {
  track.setData(LOADING_KEY, true)  // 触发事件，使用共享 key TRACK_ADDON_LOADING
})

// src/addons/error.ts
export const TRACK_ADDON_ERROR = Symbol('vue-asyncx:addon:error')

// src/addons/arguments.ts
export const TRACK_ADDON_ARGUMENTS = Symbol('vue-asyncx:addon:arguments')
```

**使用示例：**

```typescript
// withAddonData：建立映射并设置数据
monitor.on('init', ({ track }) => {
  // 建立映射
  track.shareData(VALUE_KEY, TRACK_ADDON_DATA)
  
  // 使用私有 key 设置数据（会触发事件，使用共享 key TRACK_ADDON_DATA）
  track.setData(VALUE_KEY, data.value)
  
  // 私有数据不映射，不触发事件
  track.setData(CONTEXT_KEY, {...})
})

// withAddonGroup：监听共享 key 的变化
monitor.on('init', ({ args, track }) => {
  const key = by(args)
  track.setData(GROUP_KEY_KEY, key)
})

monitor.on('track:data', ({ track, key, value }) => {
  // 只监听共享 keys
  if (key === TRACK_ADDON_DATA) {
    // 通过共享 key 读取数据（只读）
    const data = track.getData(TRACK_ADDON_DATA)
    // 同步到 groupRefs
  }
  
  // 无法通过共享 key 修改数据（直接返回，不执行任何操作）
  // track.setData(TRACK_ADDON_DATA, newValue)  // ❌ 直接返回，不执行任何操作
})
```

### withAddonGroup 实现

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
    
    // 内部保存 ref，用于追踪状态
    const groupRefs = reactive<Record<string | number, {
      loading: Ref<boolean>
      error: Ref<any>
      arguments: Ref<any>
      data: Ref<any>
    }>>({})
    
    // 创建 computed，返回 Proxy
    const groupComputed = computed(() => {
      return new Proxy({} as Record<string | number, {
        loading: boolean
        error: any
        arguments: any
        data: any
      }>, {
        get(target, key: string | number) {
          if (groupRefs[key]) {
            // 有 ref，返回计算后的值（unref）
            return {
              loading: groupRefs[key].loading.value,
              error: groupRefs[key].error.value,
              arguments: groupRefs[key].arguments.value,
              data: groupRefs[key].data.value
            }
          } else {
            // 没有 ref，返回 mock 值
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
    
    // 在 init 事件中存储 key（提前到 init 阶段，避免时序问题）
    monitor.on('init', ({ args, track }) => {
      const key = by(args)
      track.setData(GROUP_KEY_KEY, key)
      
      // 初始化 ref（如果不存在）
      if (!groupRefs[key]) {
        groupRefs[key] = {
          loading: ref(false),
          error: ref(undefined),
          arguments: ref(undefined),
          data: ref(undefined)
        }
      }
    })
    
    // 监听所有 'track:data' 事件，自动同步到 groupRefs
    // 注意：只监听共享 keys，私有 keys 不会触发事件
    monitor.on('track:data', ({ track, key, value }) => {
      const groupKey = track.getData(GROUP_KEY_KEY)
      if (!groupKey || !groupRefs[groupKey]) return
      
      // 根据共享 key 同步到对应的 ref
      if (key === TRACK_ADDON_LOADING) {
        groupRefs[groupKey].loading.value = value ?? false
      } else if (key === TRACK_ADDON_ERROR) {
        groupRefs[groupKey].error.value = value
      } else if (key === TRACK_ADDON_ARGUMENTS) {
        groupRefs[groupKey].arguments.value = value
      } else if (key === TRACK_ADDON_DATA) {
        // 通过共享 key 读取数据（只读）
        const data = track.getData(TRACK_ADDON_DATA)
        groupRefs[groupKey].data.value = data
      }
    })
    
    return { __name__Group: groupComputed }
  })
}
```

## 改造顺序

### 阶段 1：事件系统改造（基础）

**目标**：建立事件系统基础设施，供 monitor 和 track 复用

1. **创建 EventBus** (`src/core/eventbus.ts`)
   - 实现通用的 `createEventBus` 函数
   - 提供 `on`、`off`、`emit` 方法

2. **修改 Tracker** (`src/core/tracker.ts`)
   - 使用 EventBus 实现 track 的 `on`/`off` 方法（内部使用）
   - 实现 `shareData` 方法，建立私有 key 到共享 key 的映射
   - 修改 `setData`：只接受私有 key，如果传入共享 key 直接返回；如果已映射则触发事件（使用共享 key）
   - 修改 `getData`：支持私有 key 和共享 key（共享 key 通过映射查找）
   - 修改 `takeData`：只支持私有 key，如果传入共享 key 直接返回 undefined
   - 添加 `TrackEventMap` 类型定义

3. **修改 Monitor** (`src/core/monitor.ts`)
   - 使用 EventBus 重构现有的 `on`/`off`/`emit` 实现
   - 添加 `'track:data'` 事件类型
   - 更新 `Track` 类型导出，包含 `shareData`，但不包含 `on`/`off`
   - 在 `withFunctionMonitor` 中：**延迟注册监听**（在 `init` 事件之后），转发 track 的 `data` 事件

**验收标准**：
- EventBus 可以正常工作
- track 的 `shareData` 可以建立映射
- track 的 `setData` 只接受私有 key，映射后触发事件（使用共享 key）
- track 的 `getData` 支持私有 key 和共享 key
- monitor 在 `init` 之后注册监听，`init` 阶段的 `setData` 不触发 `track:data` 事件
- monitor 可以监听并转发 track 事件

### 阶段 2：现有 Addon 改造

**目标**：修改现有 addon，在 track 中存储状态并导出 Symbol

1. **修改 withAddonLoading** (`src/addons/loading.ts`)
   - 导出 `TRACK_ADDON_LOADING` Symbol（共享 key）
   - 创建私有 key `LOADING_KEY`
   - 在 `init` 事件中调用 `track.shareData(LOADING_KEY, TRACK_ADDON_LOADING)`
   - 在 `before`、`fulfill`、`reject` 事件中使用私有 key 调用 `track.setData(LOADING_KEY, loading)`

2. **修改 withAddonError** (`src/addons/error.ts`)
   - 导出 `TRACK_ADDON_ERROR` Symbol（共享 key）
   - 创建私有 key `ERROR_KEY`
   - 在 `init` 事件中调用 `track.shareData(ERROR_KEY, TRACK_ADDON_ERROR)`
   - 在 `before`、`reject` 事件中使用私有 key 调用 `track.setData(ERROR_KEY, error)`

3. **修改 withAddonArguments** (`src/addons/arguments.ts`)
   - 导出 `TRACK_ADDON_ARGUMENTS` Symbol（共享 key）
   - 创建私有 key `ARGUMENTS_KEY`
   - 在 `init` 事件中调用 `track.shareData(ARGUMENTS_KEY, TRACK_ADDON_ARGUMENTS)`
   - 在 `before`、`fulfill`、`reject` 事件中使用私有 key 调用 `track.setData(ARGUMENTS_KEY, args)`

4. **修改 withAddonData** (`src/addons/data/state.ts`)
   - 导出 `TRACK_ADDON_DATA` Symbol（共享 key）
   - 在 `init` 事件中调用 `track.shareData(VALUE_KEY, TRACK_ADDON_DATA)`
   - 在 `update` 函数中使用私有 key 调用 `track.setData(VALUE_KEY, value)`
   - 保持 `CONTEXT_KEY` 和 `RESTORE_KEY` 为私有（不映射）

**验收标准**：
- 所有 addon 都导出共享 key Symbol
- 所有 addon 都使用私有 key 存储数据，并通过 `shareData` 映射到共享 key
- 私有数据（如 `CONTEXT_KEY`、`RESTORE_KEY`）不映射，不触发事件
- 其他 addon 只能通过共享 key 读取数据，不能修改
- 现有功能不受影响

### 阶段 3：实现 withAddonGroup

**目标**：实现 `withAddonGroup` addon

1. **创建 withAddonGroup** (`src/addons/group.ts`)
   - 实现 Proxy 按需初始化
   - 实现 computed 返回
   - 实现 `init` 事件中的 key 存储（提前到 init 阶段）
   - 实现 `track:data` 事件监听和自动同步（只监听共享 keys）

2. **类型定义**
   - 定义 `withAddonGroup` 的类型签名
   - 确保返回类型包含 `[name]Group`

**验收标准**：
- `withAddonGroup` 可以正常工作
- 用户不需要使用可选链
- 状态自动同步

### 阶段 4：测试和优化

**目标**：完善测试，优化性能

1. **单元测试**
   - EventBus 测试
   - Track 事件测试
   - Monitor 事件转发测试
   - withAddonGroup 功能测试

2. **集成测试**
   - 与现有 addon 的集成测试
   - 用户主动更改数据的测试（通过 `updateData`）

3. **性能测试**
   - Proxy 性能测试
   - 大量 key 时的性能测试

## 数据结构

### Group 状态对象

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

## 使用示例

### 基础用法

```typescript
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ by: (id) => id })]
})

// 模板中使用（Vue 自动 unref）
<button 
  :loading="confirmGroup[item.id].loading" 
  @click="confirm(item.id)"
>
  确认
</button>

// 脚本中使用（需要 .value）
if (confirmGroup.value[item.id].loading) {
  // ...
}
```

### 与 useAsyncData 结合

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

## 设计决策总结

### 已确定的方案

1. **初始化策略**：Proxy 按需初始化
   - 使用 Proxy 拦截属性访问
   - 当访问不存在的 key 时，返回 mock 值
   - 用户不需要使用可选链

2. **返回类型**：`ComputedRef`
   - `__name__Group` 返回 `ComputedRef`
   - Vue 模板自动 unref
   - 内部保存 ref，返回时 unref 为直接值

3. **固定属性**：`loading`、`error`、`arguments`、`data`
   - 不动态检测其他 addon
   - 简化类型推导
   - 统一用户体验

4. **事件系统**：基于 track 'data' 事件和 monitor 'track:data' 事件
   - track 使用私有 key 存储数据，通过 `shareData` 映射到共享 key
   - 只有映射到共享 key 的数据才会触发 `'data'` 事件（使用共享 key）
   - monitor 在 `init` 之后注册监听，转发为 `'track:data'` 事件
   - `withAddonGroup` 统一监听共享 keys，自动同步

5. **EventBus 抽象**：monitor 和 track 复用事件逻辑
   - 创建 `createEventBus` 函数
   - 统一事件管理机制

6. **私有 key 和共享 key 机制**：保护数据隐私和只读性
   - 每个 addon 使用私有 key 存储数据
   - 通过 `shareData` 将私有 key 映射到共享 key
   - 其他 addon 只能通过共享 key 读取，不能修改
   - 私有数据不映射，不触发事件

7. **延迟注册监听**：解决 addon 执行顺序导致的时序问题
   - monitor 在 `init` 事件之后才注册 track 监听
   - 确保所有 addon 的 `init` 处理器执行完成后，才开始转发事件

## 待解决问题

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