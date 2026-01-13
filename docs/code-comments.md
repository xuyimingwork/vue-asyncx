# 代码注释规范

本文档定义了 Vue-AsyncX 项目的代码注释规范，旨在保持代码的可读性和可维护性。

## 一、注释原则

### 为什么需要注释

- **解释"为什么"**：说明代码的设计意图和业务逻辑
- **解释"是什么"**：说明复杂算法和类型定义
- **提供上下文**：帮助其他开发者快速理解代码

### 何时需要注释

**必须注释**：
- 所有公开的 API（函数、类、接口、类型）
- 复杂的算法和业务逻辑
- 非显而易见的实现细节
- 临时解决方案（TODO、FIXME）

**可选注释**：
- 简单的工具函数（如果函数名已足够清晰）
- 自解释的代码

**不需要注释**：
- 显而易见的代码
- 重复函数名的注释

### 注释的层次

1. **文件级注释**：说明文件的用途和模块职责
2. **模块级注释**：说明模块的设计和依赖关系
3. **函数级注释**：说明函数的功能、参数、返回值
4. **行内注释**：说明关键逻辑和实现细节

## 二、JSDoc 规范

### 基本格式

使用 JSDoc 格式编写注释：

```typescript
/**
 * 函数功能描述（一句话概括）
 * 
 * @description 详细描述（可选，如果功能描述已足够详细则省略）
 * 
 * @template T - 泛型参数说明
 * 
 * @param param1 - 参数1说明
 * @param param2 - 参数2说明（可选参数标注 optional）
 * 
 * @returns 返回值说明
 * 
 * @example
 * ```ts
 * // 使用示例
 * ```
 * 
 * @throws {Error} 错误情况说明
 * 
 * @internal 内部实现说明（仅内部使用）
 * @deprecated 废弃说明（如果已废弃）
 */
```

### 必需标签

#### @description

详细描述函数的功能、行为和使用场景。如果函数名和简短描述已足够清晰，可以省略。

```typescript
/**
 * 创建函数监控器
 * 
 * @description 为函数添加生命周期事件监控能力，支持监听函数执行的各个阶段。
 * 监控器会追踪函数的调用、执行和完成状态，并提供事件发布订阅机制。
 */
```

#### @param

描述函数参数。格式：`@param <参数名> - <参数说明>`

```typescript
/**
 * @param monitor - 函数监控器实例，用于监听函数执行事件
 * @param options - 配置选项（可选）
 * @param options.initialData - 初始数据值
 * @param options.shallow - 是否使用 shallowRef，默认为 false
 */
```

#### @returns

描述返回值。格式：`@returns <返回值说明>`

```typescript
/**
 * @returns 返回包含数据和过期标识的对象
 * @returns {Ref} data - 响应式数据引用
 * @returns {Ref<boolean>} dataExpired - 数据是否过期的标识
 */
```

#### @example

提供使用示例。使用代码块格式：

```typescript
/**
 * @example
 * ```ts
 * const { data, dataExpired } = useStateData(monitor, {
 *   initialData: null,
 *   shallow: false
 * })
 * 
 * // 监听数据变化
 * watch(data, (newValue) => {
 *   console.log('Data updated:', newValue)
 * })
 * ```
 */
```

### 可选标签

#### @template

描述泛型参数：

```typescript
/**
 * @template T - 函数返回值的类型
 * @template Options - 配置选项的类型
 */
```

#### @throws

描述可能抛出的错误：

```typescript
/**
 * @throws {TypeError} 当参数不是函数时抛出
 * @throws {Error} 当插件返回重复键时抛出
 */
```

#### @deprecated

标记已废弃的 API：

```typescript
/**
 * @deprecated 已废弃，请使用 getAsyncDataContext 获取上下文
 * 
 * @param enhanceFirstArgument - 是否增强第一个参数
 */
```

#### @internal

标记内部使用的 API（不对外暴露）：

```typescript
/**
 * @internal 内部实现，不对外暴露
 * 
 * 该函数用于合并插件返回的结果，检测重复键并抛出错误。
 */
```

## 三、注释风格

### 语言选择

- **公开 API**：使用中文注释，便于中文用户理解
- **内部实现**：可以使用英文或中文，保持一致性
- **类型定义**：优先使用中文，复杂类型可以中英文结合

### 注释格式示例

#### 函数注释

```typescript
/**
 * 创建异步数据状态管理器
 * 
 * @description 该函数创建一个响应式的数据状态管理器，用于追踪异步函数的返回值。
 * 支持在函数执行过程中手动更新数据，并自动处理竟态条件。
 * 
 * @template Data - 数据类型
 * 
 * @param monitor - 函数监控器，用于监听函数执行事件
 * @param options - 配置选项
 * @param options.initialData - 初始数据值，默认为 undefined
 * @param options.shallow - 是否使用 shallowRef，默认为 false
 * 
 * @returns 返回包含数据和过期标识的对象
 * @returns {Ref<Data> | ShallowRef<Data>} data - 响应式数据引用
 * @returns {Ref<boolean>} dataExpired - 数据是否过期的标识
 * 
 * @example
 * ```ts
 * const { data, dataExpired } = useStateData(monitor, {
 *   initialData: null,
 *   shallow: false
 * })
 * 
 * // 监听数据变化
 * watch(data, (newValue) => {
 *   console.log('Data updated:', newValue)
 * })
 * ```
 * 
 * @internal 该函数仅供内部使用，不对外暴露
 */
export function useStateData<Data = any>(
  monitor: FunctionMonitor,
  options?: Options
): { data: Ref<Data> | ShallowRef<Data>, dataExpired: Ref<boolean> } {
  // ...
}
```

#### 类型注释

```typescript
/**
 * 函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件发布订阅机制。
 * 支持监听 init、before、after、fulfill、reject 等事件。
 * 
 * @example
 * ```ts
 * const monitor = createFunctionMonitor()
 * 
 * monitor.on('before', ({ args, track }) => {
 *   console.log('Function called with:', args)
 * })
 * 
 * monitor.on('fulfill', ({ track, value }) => {
 *   console.log('Function fulfilled with:', value)
 * })
 * ```
 */
export interface FunctionMonitor {
  /**
   * 注册事件监听器
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 移除事件监听器
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  off<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 触发事件
   * 
   * @param event - 事件类型
   * @param data - 事件数据
   */
  emit<T extends keyof FunctionMonitorEventMap>(
    event: T,
    data: FunctionMonitorEventMap[T]
  ): void
}
```

#### 复杂逻辑注释

```typescript
/**
 * 合并插件返回的结果
 * 
 * @description 将多个插件返回的状态对象合并为一个对象。
 * 如果存在重复的键，会抛出错误。
 * 
 * @param base - 基础对象
 * @param patch - 要合并的对象
 * 
 * @returns 合并后的对象
 * 
 * @throws {Error} 当存在重复键时抛出错误
 * 
 * @internal 内部实现，不对外暴露
 */
function mergeAddonResults(base: any, patch: any): any {
  if (typeof patch !== 'object' || !patch) return base
  if (!Object.keys(patch).length) return base
  
  // 检测重复键
  const duplicates = getDuplicateKeys(base, patch)
  if (duplicates.length) {
    throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
  }
  
  return { ...base, ...patch }
}
```

## 四、模块级注释

### 文件头注释

在文件开头添加模块说明：

```typescript
/**
 * @fileoverview 函数监控系统
 * 
 * 该模块提供函数执行生命周期的事件监控能力。
 * 主要功能包括：
 * - 事件发布订阅机制
 * - 参数增强拦截器
 * - 与 Tracker 集成
 * 
 * @module core/monitor
 */
```

### 模块说明

对于复杂的模块，可以在文件开头添加详细的模块说明：

```typescript
/**
 * @fileoverview 调用追踪和竟态处理系统
 * 
 * 该模块实现了异步函数调用的追踪和竟态条件处理。
 * 
 * ## 核心概念
 * 
 * - **Track**：单次调用的追踪对象，包含序号（sn）和状态
 * - **Tracker**：追踪器，管理所有调用的状态
 * - **状态机**：PENDING → FULFILLED/REJECTED
 * 
 * ## 竟态处理原理
 * 
 * 1. 每次调用分配唯一序号（sn）
 * 2. 记录每种状态的最新序号
 * 3. 只有最新调用的状态才会更新到最终结果
 * 
 * @module core/tracker
 */
```

### 依赖说明

如果模块有特殊的依赖关系，可以在注释中说明：

```typescript
/**
 * @fileoverview 插件管道系统
 * 
 * 该模块负责组织和执行插件（Addon），合并插件返回的状态。
 * 
 * ## 依赖关系
 * 
 * - 依赖 `monitor` 模块提供事件监控能力
 * - 依赖 `tracker` 模块提供调用追踪能力
 * - 依赖 `naming` 模块提供命名转换能力
 * 
 * @module core/setup-pipeline
 */
```

## 五、函数注释模板

### 简单函数

```typescript
/**
 * 获取函数的最大值
 * 
 * @param a - 第一个数值
 * @param b - 第二个数值
 * 
 * @returns 返回较大的数值
 */
export function max(a: number, b: number): number {
  return a > b ? a : b
}
```

### 泛型函数

```typescript
/**
 * 创建响应式引用
 * 
 * @template T - 值的类型
 * 
 * @param value - 初始值
 * 
 * @returns 返回响应式引用
 * 
 * @example
 * ```ts
 * const count = ref(0)
 * count.value++ // 触发响应式更新
 * ```
 */
export function ref<T>(value: T): Ref<T> {
  // ...
}
```

### 复杂函数

```typescript
/**
 * 设置函数管道
 * 
 * @description 该函数创建一个函数执行管道，支持插件化扩展。
 * 管道会按顺序执行所有插件，合并插件返回的状态。
 * 
 * @template Fn - 核心业务逻辑函数的类型
 * @template Options - 传递给 useSetup 的配置项类型
 * @template AddonResults - 插件返回结果的元组类型
 * 
 * @param options - 配置对象
 * @param options.fn - 执行函数
 * @param options.options - 可选的配置参数
 * @param options.addons - 插件数组
 * 
 * @returns 返回合并后的插件状态
 * 
 * @throws {Error} 当插件返回重复键时抛出错误
 * 
 * @example
 * ```ts
 * const result = setupFunctionPipeline({
 *   fn: fetchUser,
 *   options: { immediate: true },
 *   addons: [withAddonLoading(), withAddonError()]
 * })
 * 
 * // result 包含 { userLoading, userError }
 * ```
 */
export function setupFunctionPipeline(options: PipelineOptions): any {
  // ...
}
```

## 六、类型注释规范

### 接口注释

```typescript
/**
 * 函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件发布订阅机制。
 */
export interface FunctionMonitor {
  /**
   * 注册事件监听器
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
}
```

### 类型别名注释

```typescript
/**
 * 基础函数类型
 * 
 * @description 匹配任何具有任意参数和返回值的函数。
 */
export type BaseFunction = (...args: any) => any

/**
 * 合并两个类型
 * 
 * @description 从 A 中剔除 B 已有的键，然后合并 B。
 * 若有同名键，B 的类型将覆盖 A。
 * 
 * @template A - 基础类型
 * @template B - 覆盖类型（高优先级）
 * 
 * @example
 * ```ts
 * type Res = Merge<{ a: string, b: number }, { b: string }>
 * // Res = { a: string, b: string }
 * ```
 */
export type Merge<A, B> = A extends any ? Simplify<Omit<A, keyof B> & B> : never
```

### 复杂类型工具注释

```typescript
/**
 * 驼峰替换工具
 * 
 * @description 将字符串中的 Pattern 替换为 Replacement，并自动处理驼峰命名。
 * 
 * @template Input - 原始字符串 (e.g., "get__name__")
 * @template Pattern - 待匹配的占位符模式 (e.g., "__name__")
 * @template Replacement - 替换后的目标内容 (e.g., "user")
 * @template OnNoPattern - 若 Input 中完全不含 Pattern 时的返回结果，默认为 Input
 * @template IsSuffix - 标记当前是否已处于匹配项之后的后缀部分
 * 
 * @example
 * ```ts
 * type Result = CamelReplace<'get__name__', '__name__', 'user'>
 * // Result = 'getUser'
 * ```
 */
export type CamelReplace<
  Input extends string,
  Pattern extends string,
  Replacement extends string,
  OnNoPattern = Input,
  IsSuffix extends boolean = false,
> = // ... 实现
```

## 七、行内注释

### 关键逻辑注释

```typescript
// 检测重复键，如果存在则抛出错误
const duplicates = getDuplicateKeys(base, patch)
if (duplicates.length) {
  throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
}

// 只有最新调用的状态才会更新到最终结果
if (!track.isLatest()) return
```

### 算法说明注释

```typescript
// 竟态处理算法：
// 1. 每次调用分配唯一序号（sn）
// 2. 记录每种状态的最新序号
// 3. 通过 isLatest() 判断是否为最新调用
// 4. 只有最新调用的状态才会更新
```

### TODO 和 FIXME

```typescript
// TODO: 优化性能，考虑使用缓存
// FIXME: 修复嵌套调用的问题
// NOTE: 这是一个临时解决方案，后续需要重构
```

## 八、最佳实践

### 1. 保持注释与代码同步

- 修改代码时同步更新注释
- 删除代码时删除相关注释
- 定期审查注释的准确性

### 2. 避免冗余注释

```typescript
// ❌ 不好的注释（冗余）
const count = 0 // 初始化 count 为 0

// ✅ 好的注释（有价值）
// 使用序号追踪调用顺序，确保竟态安全
const sn = tracker.sn()
```

### 3. 使用清晰的表达

```typescript
// ❌ 不好的注释（不清晰）
// 处理数据

// ✅ 好的注释（清晰）
// 合并插件返回的状态，检测重复键并抛出错误
```

### 4. 提供上下文

```typescript
// ❌ 不好的注释（缺少上下文）
// 检查状态

// ✅ 好的注释（提供上下文）
// 检查是否为最新调用，只有最新调用的状态才会更新到最终结果
if (!track.isLatest()) return
```

## 九、检查清单

在提交代码前，请确认：

- [ ] 所有公开 API 都有 JSDoc 注释
- [ ] 复杂逻辑都有注释说明
- [ ] 注释与代码保持同步
- [ ] 注释清晰、准确、有价值
- [ ] 使用了正确的 JSDoc 标签
- [ ] 提供了使用示例（如果适用）

---

**文档版本**：1.0  
**最后更新**：2026年

