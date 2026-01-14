# RFC: Result-Driven Async State & Addon-Level State Logic

## 背景

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

---

## 目标

1. **将“状态语义判断”从 tracker 中移除**
2. **使 addon 能独立实现并共享状态逻辑**
3. **让 `withAddonGroup` 成为真正的二级 state machine，而非 projection**
4. **不引入全局 timeline 或复杂 reducer**

---

## 核心观察

### 1. `track.is(state)` 已经包含了足够的结果信息

每个 `track` 天然具有以下事实：

* `track.sn`：全局单调递增
* `track.is('fulfilled' | 'rejected' | 'pending')`：**最终结果**

对于以下状态：

* data
* dataExpired

**我们只关心“发生过什么结果”**，而不关心：

* 请求何时开始（init）
* 中途是否 pending
* 是否是 latest at time X

---

### 2. data 是“结果驱动状态”，不是“过程驱动状态”

data 的语义可以定义为：

> **最近一次成功结果（fulfilled）的值**

dataExpired 的语义可以定义为：

> **最近一次结果是否为 rejected，且发生在最近一次 fulfilled 之后**

这两个语义 **只依赖于结果事件**：

* fulfill
* reject

而与 init / before **无关**。

---

## 新抽象：Result-Driven State

### 事件模型（隐式）

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

---

## createStateData 设计

### 状态定义

```ts
interface DataState<T> {
  data: Ref<T | undefined>
  expired: ComputedRef<boolean>
  update(track: Track): void
}
```

### 语义规则

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

### 特点

* ❌ 不需要 init
* ❌ 不需要 isLatest / hasLater
* ❌ 不需要 timeline
* ✅ 支持并发 / out-of-order
* ✅ 可重放、可共享
* ✅ group / single 完全一致

---

## 对比现有实现

| 维度         | 现有          | 新模型      |
| ---------- | ----------- | -------- |
| tracker 责任 | 执行 + 语义     | 仅执行事实    |
| data 更新    | 过程判断        | 结果判断     |
| expired    | timeline 推导 | 结果比较     |
| group 支持   | projection  | 二级 state |
| 逻辑复用       | 困难          | 完全复用     |

---

## 对其他 addon 的影响

### loading / arguments

* 仍然是 **过程驱动状态**
* 需要 init / before / fulfill / reject
* 不适用 result-driven 模型

### error（显示）

* 可选：

  * 过程驱动（init 清空）
  * 或结果驱动（最近一次 reject）

RFC 不强制统一 error 语义。

---

## 对 withAddonGroup 的意义

* 每个 group key：

  * 拥有一个独立的 state 实例（如 `createStateData()`）
* update 逻辑完全复用
* group 不再是 track:data 的旁听者
* group 与 global 语义完全一致

---

## 对 tracker 的影响

### 移除或弃用的 API

```ts
track.isLatest()
track.hasLater()
```

### 保留的最小职责

```ts
track.sn
track.is(state)
```

tracker 成为：

> **纯粹的执行事实与结果载体**

---

## 设计原则总结

1. **状态语义属于 addon，不属于 tracker**
2. **data 是结果，不是过程**
3. **group 是 state 的复制，不是 state 的镜像**
4. **最小充分信息优于全局时间轴**

---

## 未解决问题（刻意留白）

* cache / retry / pagination 等 timeline-aware 状态
* 是否引入显式 reducer（未来 RFC）

---

## 结论

通过引入 **Result-Driven State**：

* vue-asyncx 可以在不增加复杂度的前提下：

  * 获得一致的 group / single 语义
  * 移除 tracker 中的状态判断
  * 为未来状态模型演进打下基础

---

如果你愿意，下一步我可以帮你做三件事之一：

1. ✂️ **把现有 `useStateData` 精确映射到这个 RFC**
2. 🧩 **补一段 `createStateLoading`，形成完整 state family**
3. 🧠 **帮你写 RFC 的「Rejected Alternatives」部分（非常重要）**

你现在这个方向，已经是**可以写进 README 的核心理念**了。
