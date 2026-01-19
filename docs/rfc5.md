下面是一份**结构化、可执行、可写进 RFC 的改造方案回顾**。
我会严格基于我们这次对话已经达成的共识来整理，而不是引入新方向。

---

# vue-asyncx Track / Monitor / Addon 改造方案

> 目标：
> **在保留「中途更新 RUN_DATA」这一业务能力的前提下**，
> **收敛写入权、移除 shareData、简化 track，实现可控广播与插件间状态共享。**

---

## 一、核心问题回顾（Why）

现有设计中存在的问题：

1. **`shareData` 概念过重**

   * 引入了“私有 → 公共”的隐式映射
   * 插件可间接定义公共事实，语义不可控
2. **track 既存状态又发事件**

   * 职责过多
   * 状态与广播耦合
3. **插件拥有过强的“事件定义能力”**

   * 插件间可能形成隐式协议
   * 执行语义难以推理

但同时，**以下能力必须保留**：

* ✅ addon 在 `pending` 阶段 **中途更新 RUN_DATA**
* ✅ 插件间可以共享状态
* ✅ monitor 在公共状态变化时统一广播

---

## 二、最终抽象边界（What）

### 1️⃣ Track：纯状态容器（Dumb State Holder）

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

---

### 2️⃣ Monitor：唯一的公共写入者 + 广播者

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

---

## 三、写入权限模型（Critical）

### 公共 key 权限规则

#### 🔒 永远只读（对 addon）

* `RUN_ARGUMENTS`
* `RUN_LOADING`
* `RUN_ERROR`

只能由 **monitor** 写入。

---

#### ✍️ 条件可写（对 addon）

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

---

## 四、广播模型（Event Model）

### 关键结论

> **addon 不再“发事件”，
> addon 只能“改变事实”，
> 事件是 monitor 对事实变化的统一解释。**

---

### 新事件命名（对外）

```ts
monitor.on('track:updated', handler)
```

语义：

> “某个 track 的公共状态，在合法时序内发生了一次更新”

#### 为什么不用 `track:data`

* 不只 data
* 语义过窄
* 与“状态驱动模型”不匹配

---

### 广播时机

只要 monitor 判定这是一次合法的**公共 key 写入**：

```ts
monitorTrack.set(key, value)
→ rawTrack.set(key, value)
→ monitor.emit('track:updated', { track, key, value })
```

---

## 五、插件间共享状态（How）

### 结论

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

---

### 插件“失去的能力”（刻意放弃）

* ❌ 自定义事件类型
* ❌ 私有事件语义
* ❌ 绕过 monitor 的时序裁判

这是一次**有意识的收敛**，换来：

* 插件可组合
* 状态可推理
* 执行语义唯一

---

## 六、shareData 的最终命运

### 结论

> **`shareData` 可以被完全移除**

原因：

* 公共 key 由 monitor 定义
* 写入权限由 monitor 控制
* 广播由 monitor 统一完成

`shareData` 所解决的问题，在新模型中已经被**结构性消解**。

---

## 七、对现有代码的迁移建议（How to Refactor）

### 1️⃣ 拆分概念（逻辑层面）

* `createTrack` → RawTrack（无事件）
* monitor 内部封装 → MonitorTrack（受控 set）

---

### 2️⃣ 事件迁移

* `track:data` → `track:updated`
* 所有 addon 改为监听 `track:updated`

---

### 3️⃣ addon 改造原则

* addon **不再调用**：

  * `shareData`
  * 原始 `setData`
* addon 只通过：

  * `monitorTrack.set`
  * `monitor.on('track:updated')`

---

## 八、一句话设计宣言（可写进 README / RFC）

> **track 只保存状态，不关心事件；
> monitor 定义执行语义、写入规则与广播；
> addon 只能在 monitor 授权下参与状态演进。**

---

## 九、最终评价

这是一次：

* ❌ 表面“限制插件能力”
* ✅ 实际“收敛抽象、提高可维护性”
* ✅ 长期对类型系统、组合性、文档成本都极其友好

**这已经是一个成熟库在 API 定型阶段才会做的选择。**

如果你愿意，下一步我可以直接帮你把这份方案整理成：

* RFC 文档版
* 迁移指南（旧 → 新）
* 或直接对应你当前代码的 **diff 级改造清单**
