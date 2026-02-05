# 03: Addon 设计

本文档描述 vue-asyncx 的 Addon 系统架构设计，包含：Track/Monitor 改造方案、Result-Driven 状态语义、以及事件机制基础设施。

---

## 一、Track / Monitor / Addon 改造方案

> 目标：
> **在保留「中途更新 RUN_DATA」这一业务能力的前提下**，
> **收敛写入权、移除 shareData、简化 track，实现可控广播与插件间状态共享。**

### 1. 核心问题回顾（Why）

现有设计中存在的问题：

1. **`shareData` 概念过重**

   * 引入了"私有 → 公共"的隐式映射
   * 插件可间接定义公共事实，语义不可控
2. **track 既存状态又发事件**

   * 职责过多
   * 状态与广播耦合
3. **插件拥有过强的"事件定义能力"**

   * 插件间可能形成隐式协议
   * 执行语义难以推理

但同时，**以下能力必须保留**：

* ✅ addon 在 `pending` 阶段 **中途更新 RUN_DATA**
* ✅ 插件间可以共享状态
* ✅ monitor 在公共状态变化时统一广播

### 2. 最终抽象边界（What）

#### Track：纯状态容器（Dumb State Holder）

**track 的职责被严格压缩为：**

* 存储状态
* 提供 get / raw set
* 维护执行状态（pending / fulfilled / rejected）

**track 不再：**

* ❌ 判断 public / private
* ❌ 触发事件
* ❌ 知道 monitor / addon 的存在

```ts
interface RawTrack {
  get(key): any
  set(key, value): void      // 不广播、不校验
  is(status): boolean
  fulfill(): void
  reject(): void
}
```

👉 **track 的事件系统可以完全移除**

#### Monitor：唯一的公共写入者 + 广播者

monitor 是整个系统的**中枢与裁判**：

* 封装 track
* 重写 `set`
* 控制：

  * 谁能写
  * 写什么
  * 什么时候写
* 在合法写入后统一广播

monitor 提供给 addon 的不是 raw track，而是：

```ts
interface MonitorTrack {
  get(key): any
  set(key, value): void   // 受控写入
}
```

### 3. 写入权限模型（Critical）

#### 公共 key 权限规则

**🔒 永远只读（对 addon）**

* `RUN_ARGUMENTS`
* `RUN_LOADING`
* `RUN_ERROR`

只能由 **monitor** 写入。

**✍️ 条件可写（对 addon）**

* `RUN_DATA`

**条件：**

```ts
track.is('pending') === true
```

monitor 在 `set` 中统一校验：

```ts
function canWrite(key, track, caller) {
  if (caller === 'monitor') return true

  if (key === RUN_DATA) {
    return track.is('pending')
  }

  return false
}
```

### 4. 广播模型（Event Model）

**关键结论**

> **addon 不再"发事件"，
> addon 只能"改变事实"，
> 事件是 monitor 对事实变化的统一解释。**

**新事件命名（对外）**

```ts
monitor.on('track:updated', handler)
```

语义：

> "某个 track 的公共状态，在合法时序内发生了一次更新"

#### 为什么不用 `track:data`

* 不只 data
* 语义过窄
* 与"状态驱动模型"不匹配

**广播时机**

只要 monitor 判定这是一次合法的**公共 key 写入**：

```ts
monitorTrack.set(key, value)
→ rawTrack.set(key, value)
→ monitor.emit('track:updated', { track, key, value })
```

### 5. 插件间共享状态（How）

**结论**

> **插件间共享状态 = 使用相同公共 key**

* 不需要 `shareData`
* 不需要事件协议
* 不需要额外概念

```ts
addon A:
  track.set(SHARED_KEY, v)

addon B:
  monitor.on('track:updated', ({ key }) => {
    if (key === SHARED_KEY) { … }
  })
```

**插件"失去的能力"（刻意放弃）**

* ❌ 自定义事件类型
* ❌ 私有事件语义
* ❌ 绕过 monitor 的时序裁判

这是一次**有意识的收敛**，换来：

* 插件可组合
* 状态可推理
* 执行语义唯一

### 6. shareData 的最终命运

**结论**

> **`shareData` 可以被完全移除**

原因：

* 公共 key 由 monitor 定义
* 写入权限由 monitor 控制
* 广播由 monitor 统一完成

`shareData` 所解决的问题，在新模型中已经被**结构性消解**。

### 7. 对现有代码的迁移建议（How to Refactor）

**拆分概念（逻辑层面）**

* `createTrack` → RawTrack（无事件）
* monitor 内部封装 → MonitorTrack（受控 set）

**事件迁移**

* `track:data` → `track:updated`
* 所有 addon 改为监听 `track:updated`

**addon 改造原则**

* addon **不再调用**：

  * `shareData`
  * 原始 `setData`
* addon 只通过：

  * `monitorTrack.set`
  * `monitor.on('track:updated')`

### 8. 设计宣言

> **track 只保存状态，不关心事件；
> monitor 定义执行语义、写入规则与广播；
> addon 只能在 monitor 授权下参与状态演进。**

---

## 二、Result-Driven Async State & Addon-Level State Logic

### 背景

当前 `vue-asyncx` 中：

* `tracker / track` 同时承担：

  * **执行事实提供者**（sn / 状态）
  * **语义判断者**（isLatest / hasLater）
* 各 addon（如 `withAddonData`、`withAddonLoading`）：

  * 在不同层级重复实现「latest 判断」「过期判断」
* `withAddonGroup` 只能监听 `track:data`，无法复用全局状态语义

这导致：

* 状态语义分散
* group 与 single 行为不一致
* tracker 语义过重，难以演进

### 目标

1. **将"状态语义判断"从 tracker 中移除**
2. **使 addon 能独立实现并共享状态逻辑**
3. **让 `withAddonGroup` 成为真正的二级 state machine，而非 projection**
4. **不引入全局 timeline 或复杂 reducer**

### 核心观察

#### 1. `track.is(state)` 已经包含了足够的结果信息

每个 `track` 天然具有以下事实：

* `track.sn`：全局单调递增
* `track.is('fulfilled' | 'rejected' | 'pending')`：**最终结果**

对于以下状态：

* data
* dataExpired

**我们只关心"发生过什么结果"**，而不关心：

* 请求何时开始（init）
* 中途是否 pending
* 是否是 latest at time X

#### 2. data 是"结果驱动状态"，不是"过程驱动状态"

data 的语义可以定义为：

> **最近一次成功结果（fulfilled）的值**

dataExpired 的语义可以定义为：

> **最近一次结果是否为 rejected，且发生在最近一次 fulfilled 之后**

这两个语义 **只依赖于结果事件**：

* fulfill
* reject

而与 init / before **无关**。

### 新抽象：Result-Driven State

**事件模型（隐式）**

不引入 payload，也不引入新的 event type，仅使用：

```ts
track.is('fulfilled')
track.is('rejected')
track.sn
```

addon 在 update 时只接收 `track`：

```ts
state.update(track)
```

### createStateData 设计

**状态定义**

```ts
interface DataState<T> {
  data: Ref<T | undefined>
  expired: ComputedRef<boolean>
  update(track: Track): void
}
```

**语义规则**

```ts
- fulfilled(track):
    如果 track.sn >= lastDataTrack.sn
    ⇒ data = track.value
    ⇒ lastDataTrack = track

- rejected(track):
    如果 track.sn >= lastErrorTrack.sn
    ⇒ lastErrorTrack = track

- expired:
    lastErrorTrack.sn > lastDataTrack.sn
```

**特点**

* ❌ 不需要 init
* ❌ 不需要 isLatest / hasLater
* ❌ 不需要 timeline
* ✅ 支持并发 / out-of-order
* ✅ 可重放、可共享
* ✅ group / single 完全一致

### 对比现有实现

| 维度         | 现有          | 新模型      |
| ---------- | ----------- | -------- |
| tracker 责任 | 执行 + 语义     | 仅执行事实    |
| data 更新    | 过程判断        | 结果判断     |
| expired    | timeline 推导 | 结果比较     |
| group 支持   | projection  | 二级 state |
| 逻辑复用       | 困难          | 完全复用     |

### 对其他 addon 的影响

**loading / arguments**

* 仍然是 **过程驱动状态**
* 需要 init / before / fulfill / reject
* 不适用 result-driven 模型

**error（显示）**

* 可选：

  * 过程驱动（init 清空）
  * 或结果驱动（最近一次 reject）

RFC 不强制统一 error 语义。

### 对 withAddonGroup 的意义

* 每个 group key：

  * 拥有一个独立的 state 实例（如 `createStateData()`）
* update 逻辑完全复用
* group 不再是 track:data 的旁听者
* group 与 global 语义完全一致

### 对 tracker 的影响

**移除或弃用的 API**

```ts
track.isLatest()
track.hasLater()
```

**保留的最小职责**

```ts
track.sn
track.is(state)
```

tracker 成为：

> **纯粹的执行事实与结果载体**

### 设计原则总结

1. **状态语义属于 addon，不属于 tracker**
2. **data 是结果，不是过程**
3. **group 是 state 的复制，不是 state 的镜像**
4. **最小充分信息优于全局时间轴**

### 未解决问题（刻意留白）

* cache / retry / pagination 等 timeline-aware 状态
* 是否引入显式 reducer（未来 RFC）

---

## 三、Addon 事件机制（基于 shareData 的实现方案）

以下为基于 track 事件系统与 shareData 的 addon 基础设施设计，与上文改造方案为不同阶段的实现思路。

### 核心机制：基于事件系统的自动同步

**设计思路：**
- **track 支持 'data' 事件**：在 `track.setData` 时触发事件
- **monitor 转发事件**：monitor 监听 track 的 `'data'` 事件，转发为 `'track:data'` 事件
- **addon 统一监听**：通过 `monitor.on('track:data', ...)` 监听所有 setData 操作

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
    
    shareData(key: symbol, sharedKey: symbol): boolean {
      if (keyToSharedMap.has(key)) return false
      if (sharedToKeyMap.has(sharedKey)) return false
      
      keyToSharedMap.set(key, sharedKey)
      sharedToKeyMap.set(sharedKey, key)
      return true
    },
    
    setData: (key: symbol, value?: any) => {
      if (sharedToKeyMap.has(key)) {
        return
      }
      
      if (value === undefined) {
        data.delete(key)
        const sharedKey = keyToSharedMap.get(key)
        if (sharedKey) {
          bus.emit('data', { key: sharedKey, value: undefined })
        }
        return
      }
      
      data.set(key, value)
      
      const sharedKey = keyToSharedMap.get(key)
      if (sharedKey) {
        bus.emit('data', { key: sharedKey, value })
      }
    },
    
    getData: <V = any>(key: symbol) => {
      const privateKey = sharedToKeyMap.get(key) || key
      return data.get(privateKey) as V | undefined
    },
    
    takeData: <V = any>(key: symbol) => {
      if (sharedToKeyMap.has(key)) {
        return undefined
      }
      
      if (!data.has(key)) return undefined
      const value = data.get(key) as V | undefined
      data.delete(key)
      return value
    },
    
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
  'track:data': { track: Track, key: symbol, value: any }
}

// ... 在 withFunctionMonitor 中：
monitor.emit('init', { args, track })

track.on('data', ({ key, value }) => {
  monitor.emit('track:data', { track, key, value })
})

monitor.emit('before', { args, track })
```

**Track 接口限制：**

```typescript
export type Track = Pick<TrackFull, 
  'sn' | 
  'is' | 'isLatest' | 'hasLater' |
  'getData' | 'setData' | 'takeData' |
  'shareData'
>
```

### Symbol 导出规范

**私有 key 和共享 key 的区分：**

- **私有 key**：不导出，addon 内部使用，不触发事件（除非映射到共享 key）
- **共享 key**：导出，供其他 addon 读取，通过 `shareData` 映射后才会触发事件

```typescript
// src/addons/data/index.ts
export const TRACK_ADDON_DATA = Symbol('vue-asyncx:addon:data')

// src/addons/data/state.ts
const VALUE_KEY = Symbol('value')
const CONTEXT_KEY = Symbol('context')
const RESTORE_KEY = Symbol('restore')

monitor.on('init', ({ track }) => {
  track.shareData(VALUE_KEY, TRACK_ADDON_DATA)
  track.setData(VALUE_KEY, data.value)
  track.setData(CONTEXT_KEY, {...})
  track.setData(RESTORE_KEY, ...)
})

// src/addons/loading.ts
export const TRACK_ADDON_LOADING = Symbol('vue-asyncx:addon:loading')

// src/addons/error.ts
export const TRACK_ADDON_ERROR = Symbol('vue-asyncx:addon:error')

// src/addons/arguments.ts
export const TRACK_ADDON_ARGUMENTS = Symbol('vue-asyncx:addon:arguments')
```

**使用示例：**

```typescript
// withAddonData：建立映射并设置数据
monitor.on('init', ({ track }) => {
  track.shareData(VALUE_KEY, TRACK_ADDON_DATA)
  track.setData(VALUE_KEY, data.value)
  track.setData(CONTEXT_KEY, {...})
})

// 其他 addon：监听共享 key 的变化
monitor.on('track:data', ({ track, key, value }) => {
  if (key === TRACK_ADDON_DATA) {
    const data = track.getData(TRACK_ADDON_DATA)
    // ...
  }
})
```

### 改造顺序（阶段 1-2）

#### 阶段 1：事件系统改造（基础）

1. **创建 EventBus** (`src/core/eventbus.ts`)
2. **修改 Tracker** (`src/core/tracker.ts`)
   - 使用 EventBus 实现 track 的 `on`/`off` 方法
   - 实现 `shareData` 方法
   - 修改 `setData`、`getData`、`takeData`
3. **修改 Monitor** (`src/core/monitor.ts`)
   - 添加 `'track:data'` 事件类型
   - 在 `init` 事件之后注册 track 监听

#### 阶段 2：现有 Addon 改造

1. **修改 withAddonLoading**：导出共享 key，使用 shareData
2. **修改 withAddonError**：同上
3. **修改 withAddonArguments**：同上
4. **修改 withAddonData**：同上
