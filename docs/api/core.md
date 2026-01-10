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
  track: () => Track,
  has: {
    finished: ComputedRef<boolean>
  }
}
```

**说明**：
- 用于追踪异步函数调用的生命周期
- 处理竟态条件，确保只有最新调用的状态才会更新
- 提供状态查询能力

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
  emit<T extends keyof FunctionMonitorEventMap>(
    event: T,
    data: FunctionMonitorEventMap[T]
  ): void
  // @internal 内部 API，用于兼容功能，不对外暴露
  use(event: 'enhance-arguments', handler: (data: { args: any[], track: Track }) => any[] | void): void
  get(event: 'enhance-arguments'): ((data: { args: any[], track: Track }) => any[] | void) | undefined
  has: {
    finished: ComputedRef<boolean>
  }
}
```

**说明**：
- 提供事件发布订阅机制
- 支持多个监听器
- `use` 和 `get` 方法中的 `enhance-arguments` 是内部 API，仅用于兼容功能，不对外暴露

## Track 类型

调用追踪对象，表示单次函数调用的追踪信息。

**类型**：
```typescript
type Track = {
  readonly sn: number
  inState: (state: State) => boolean
  canUpdate: () => boolean
  update: () => void
  fulfill: () => void
  reject: () => void
  isLatestCall: () => boolean
  isLatestUpdate: () => boolean
  isLatestFulfill: () => boolean
  hasLaterReject: () => boolean
  setData: (key: symbol, value?: any) => void
  getData: <V = any>(key: symbol) => V | undefined
  takeData: <V = any>(key: symbol) => V | undefined
}
```

**属性**：
- `sn`：调用序号，唯一标识每次调用
- `inState(state)`：检查当前是否处于指定状态
- `canUpdate()`：检查是否可以更新状态
- `update()`：转换到更新状态
- `fulfill()`：标记为成功完成
- `reject()`：标记为失败
- `isLatestCall()`：检查是否为最新调用
- `isLatestUpdate()`：检查是否为最新的更新调用
- `isLatestFulfill()`：检查是否为最新的成功完成调用
- `hasLaterReject()`：检查是否有后续的失败调用
- `setData(key, value)`：存储关联数据
- `getData(key)`：获取关联数据
- `takeData(key)`：获取并移除关联数据

## STATE 常量

调用状态常量。

**定义**：
```typescript
export const STATE = {
  PENDING: 0,    // 初始状态
  UPDATING: 1,   // 更新中
  FULFILLED: 2,  // 成功完成
  REJECTED: 3,   // 执行失败
  FINISHED: 4    // 查询专用，不参与状态转换
} as const
```

**状态转换规则**：
- `PENDING` → `UPDATING`/`FULFILLED`/`REJECTED`
- `UPDATING` → `UPDATING`/`FULFILLED`/`REJECTED`
- `FULFILLED` → []（终态）
- `REJECTED` → []（终态）

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
}
```

**事件说明**：
- `init`：函数调用初始化，用于准备上下文
- `before`：函数执行前，用于观察逻辑
- `after`：函数执行后（同步部分完成）
- `fulfill`：函数成功完成
- `reject`：函数执行失败

**事件顺序**：
```
init → before → after → fulfill/reject
```

**注意**：`enhance-arguments` 是内部实现细节，用于兼容功能，不对外暴露。

---

**注意**：这些 API 主要用于内部实现，一般不需要直接使用。如需扩展功能，请参考 [Addon 开发指南](../guides/addon-development.md)。

