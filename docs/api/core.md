# 核心 API 参考

本文档介绍 Vue-AsyncX 的核心 API，这些 API 主要用于内部实现，一般不直接使用。

## setupFunctionPipeline

插件管道系统，负责组织和执行插件（Addon）。

**类型**：
```typescript
interface SetupFunctionPipeline {
  <
    Fn extends BaseFunction,
    Options,
    AddonResults extends any[],
  >(options: { 
    fn: Fn,
    options?: Options,
    addons: Addons<Fn, AddonResults> 
  } & (
    [GetAddonResultsDuplicateKeys<AddonResults>] extends [never] 
      ? {} 
      : { addons: `Error: Duplicate key [${GetAddonResultsDuplicateKeys<AddonResults>}]` }
  )): MergeAddonResults<AddonResults>
}
```

**参数**：
- `options.fn`：执行函数
- `options.options`：可选的配置参数，传递给 `useSetup`
- `options.addons`：插件数组

**返回**：合并后的插件状态

**说明**：
- 该函数是内部实现，不对外暴露
- 支持两阶段执行机制
- 自动检测重复键并抛出错误

## withFunctionMonitor

为函数添加监控能力。

**类型**：
```typescript
function withFunctionMonitor<Fn extends BaseFunction>(
  fn: Fn
): {
  run: Fn
  monitor: FunctionMonitor
}
```

**参数**：
- `fn`：要包装的函数

**返回**：
- `run`：包装后的函数，具有监控能力
- `monitor`：函数监控器，用于监听事件

**说明**：
- 包装函数，添加生命周期事件监控
- 支持监听 init、before、after、fulfill、reject 等事件
- 与 Tracker 集成，提供调用追踪能力

## createTracker

创建调用追踪器。

**类型**：
```typescript
function createTracker(): Tracker
```

**返回**：调用追踪器实例

**Tracker 接口**：
```typescript
type Tracker = {
  track: () => Track
}
```

**说明**：
- 用于追踪异步函数调用的生命周期
- 处理竟态条件，确保只有最新调用的状态才会更新
- 每次调用 `track()` 都会创建一个新的追踪对象，分配唯一的序号（sn）

## createFunctionMonitor

创建函数监控器。

**类型**：
```typescript
function createFunctionMonitor(): FunctionMonitor
```

**返回**：函数监控器实例

**FunctionMonitor 接口**：
```typescript
interface FunctionMonitor {
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  off<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  // @internal 内部 API，用于兼容功能，不对外暴露
  use(event: 'enhance-arguments', handler: (data: { args: any[], track: Track }) => any[] | void): void
}
```

**说明**：
- 提供事件发布订阅机制
- 支持多个监听器
- `use` 和 `get` 方法中的 `enhance-arguments` 是内部 API，仅用于兼容功能，不对外暴露

## Track 类型

调用追踪对象，表示单次函数调用的追踪信息。

**注意**：在 `monitor` 中暴露的 `Track` 类型是受限的，不包含状态修改方法（`fulfill()` 和 `reject()`），这些方法仅在内部使用。

**类型**：
```typescript
// 内部完整类型（tracker.ts）
type TrackFull = {
  readonly sn: number
  is: (state?: TrackQueryState) => boolean
  fulfill: () => void
  reject: () => void
  setData: (key: symbol, value?: any) => void
  getData: <V = any>(key: symbol) => V | undefined
  takeData: <V = any>(key: symbol) => V | undefined
}

// 对外暴露类型（monitor.ts）
type Track = Pick<TrackFull, 
  'sn' | 
  'is' |
  'getData' | 'setData'
> & {
  takeData: <V = any>(key: symbol) => V | undefined
}
```

**属性**：
- `sn`：调用序号，唯一标识每次调用（只读）
- `is(state?)`：检查当前是否处于指定状态
  - `state` 可选值：`'pending'` | `'fulfilled'` | `'rejected'` | `'finished'`
  - `'finished'` 是特殊状态，表示已完成（无论是成功还是失败）
- `setData(key, value)`：存储关联数据（使用 Symbol 作为键）
  - `value` 为 `undefined` 时删除该键
  - 受权限限制：`RUN_ARGUMENTS`、`RUN_ERROR`、`RUN_LOADING`、`RUN_DATA_UPDATED` 是只读的（monitor 专用）
  - `RUN_DATA` 只能在 `pending` 状态下写入
- `getData(key)`：获取关联数据
- `takeData(key)`：获取并移除关联数据（由 monitor 实现，会经过权限检查）

**竟态处理**：
Addon 需要自行维护状态来判断是否为最新调用。通过比较 `track.sn` 和 addon 内部记录的最新 sn 来判断调用顺序。

**状态类型**：
```typescript
type TrackState = 'pending' | 'fulfilled' | 'rejected'
type TrackQueryState = TrackState | 'finished'
```

**状态转换规则**：
- `PENDING` → `FULFILLED`/`REJECTED`
- `FULFILLED` → []（终态，不允许转换）
- `REJECTED` → []（终态，不允许转换）
- `FINISHED`：查询专用状态，不参与状态转换，表示已完成（`fulfilled` 或 `rejected`）

## 事件类型

### FunctionMonitorEventMap

事件映射类型。

**定义**：
```typescript
type FunctionMonitorEventMap = {
  'init': { args: any[], track: Track }
  'before': { args: any[], track: Track }
  'after': { track: Track }
  'fulfill': { track: Track, value: any }
  'reject': { track: Track, error: any }
  'track:updated': { track: Track }
}
```

**事件说明**：
- `init`：函数调用初始化，用于准备上下文
- `before`：函数执行前，用于观察逻辑
- `after`：函数执行后（同步部分完成）
- `fulfill`：函数成功完成
- `reject`：函数执行失败
- `track:updated`：track 数据变化事件，当 track 的 `setData` 被调用且 track 已激活时触发
  - 用于 addon 监听状态变化（如 `RUN_LOADING`、`RUN_ERROR`、`RUN_ARGUMENTS`、`RUN_DATA`）
  - 在 track 未激活（`init` 之前）时不会触发

**事件顺序**：
```
init → before → after → fulfill/reject
track:updated（在 setData 调用且 track 已激活时触发，与上述事件并行）
```

**注意**：`enhance-arguments` 是内部实现细节，用于兼容功能，不对外暴露。

---

**注意**：这些 API 主要用于内部实现，一般不需要直接使用。如需扩展功能，请参考 [Addon 开发指南](../guides/addon-development.md)。

