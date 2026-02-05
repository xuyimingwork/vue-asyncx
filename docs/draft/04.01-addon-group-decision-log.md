update in 25-12-24

现在的 useAsync / useAsyncData 模型，在“并行、同源、同语义操作”这个维度上是不完备的。

场景：比如一个列表页有10个项，每个项都有一个 confirm 按钮，这些 confirm 按钮触发的是同一个 confirm 操作，只是入参不同。 但同时，如果同时触发多个 confirm 按钮，需要有多个 loading 等的状态。

Single Source × Single Execution Stream 

vs

Single Source × Multiple Concurrent Executions

| 维度 | 详情页 | 列表 confirm   |
| -- | --- | ------------ |
| fn | 1   | 1            |
| 语义 | 1   | 1            |
| 调用 | 串行  | 并行           |
| 状态 | 全局  | **按 key 分裂** |

排除方案：

- 通过 options 添加能力 => options 爆炸
- 让用户拆组件 / 拆 hook => 使用上不直爽，破坏了 fn 一致的现实模型

确定方案

- 通过能力模块化（Addon / Extension），将能力通过插件形式提供到 useAsync / useAsyncData

理想状态

- useAsync 暴露 addons 能力；
- useAsyncData 通过基于 useAsync addons 实现 data 功能，用户侧的其它 addon 可再次传入进行增强
- 移除现有内部实现中的 _useAsync 方法（useAsyncData 直接基于 useAsync 公共 API 实现）

现实差距

- 目前的插件体系过于灵活，不可以直接对外暴露
- 可基于现有插件体系，设计受限的对外插件体系

任务：设计对外的 addon api，考虑返回参数与现有 name 系统的结合方式。

-----------------------------------

Here is a summary of our design evolution for **vue-asyncx**, moving from a simple list-page requirement to a robust, plugin-based architecture.

### 1. The Core Problem

You identified that the standard `useAsync` pattern (single loading/data state) fails in **list scenarios** (e.g., a table with 10 rows, each with its own "Confirm" button). Managing these states manually creates boilerplate, while sharing one state causes "UI flickering" where all rows show a loading spinner simultaneously.

### 2. The Solution: The "Group" Concept

We agreed on a **Keyed State Manager**. By providing a `groupBy` logic, the hook can track loading and data states for individual entities (like a `userId` or `eventId`) separately from the global state.

### 3. The API Design Evolution

We moved through three stages of design:

* **Draft:** `confirm.group[id].loading` (Attaching properties to functions).
* **Refinement:** Returning a separate `[name]Group` object for safety and reactivity.
* **Final Architecture:** A **Plugin-based "Addon" system** using **Higher-Order Hooks**.

---

### 4. Final Architectural Blueprint

#### The Hooks

* **`useAsync`**: The base engine for actions (e.g., `confirm`).
* **`useAsyncData`**: A higher-order hook built on `useAsync` that includes the `withData` addon by default.

#### The Addon: `withGroup`

This addon intercepts the lifecycle of the async call to perform **Dual Dispatch**:

1. **Global Dispatch:** Updates the standard `loading` and `error` states.
2. **Keyed Dispatch:** Updates a specific entry in a `reactive` group object based on a key extractor.

#### Usage Example

```javascript
// A "confirm" action grouped by eventId
const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
  addons: [withGroup({ by: (id) => id })]
})

// Access in template
// <button :loading="confirmGroup[item.id]?.loading" @click="confirm(item.id)">

```

---

### 5. Why this is a "Senior" Library Design

* **Composition over Bloat:** Instead of making `useAsync` 500 lines long, features like `groupBy`, `cache`, and `retry` are moved into standalone **Addons**.
* **Consistency:** The design works identically for both `useAsync` (actions) and `useAsyncData` (state).
* **Tree-shakability:** Users who don't need grouping don't include the `withGroup` code in their bundle.
* **Safety:** By returning a `group` object, we avoid the "unwrapping" issues inherent in adding properties directly to Vue Refs.

### 6. Suggested Next Steps for `vue-asyncx`

* **Internal Interceptor API:** Define the `context` (e.g., `onBefore`, `onSuccess`) that addons use to talk to the core.
* **TypeScript Inference:** Ensure that when `withGroup` is added to the `addons` array, the return type of the hook automatically includes the `[name]Group` property.
* **Memory Management:** Consider a `clearGroup()` method to purge the reactive registry when data is no longer needed.