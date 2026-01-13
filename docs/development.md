# 开发指南

本文档为 Vue-AsyncX 项目的开发者提供详细的开发指南。

## 一、项目结构

### 目录结构说明

```
vue-asyncx/
├── src/
│   ├── core/              # 核心模块
│   │   ├── monitor.ts     # 事件监控系统
│   │   ├── tracker.ts     # 调用追踪和竟态处理
│   │   ├── setup-pipeline.ts  # 插件管道系统
│   │   ├── naming.ts      # 命名转换系统
│   │   └── types.ts       # 核心类型定义
│   ├── addons/            # 插件模块
│   │   ├── loading.ts     # 加载状态插件
│   │   ├── error.ts       # 错误状态插件
│   │   ├── arguments.ts   # 参数追踪插件
│   │   ├── data/          # 数据管理插件
│   │   ├── function.ts    # 函数返回插件
│   │   └── watch.ts       # 自动监听插件
│   ├── hooks/             # Hooks 层
│   │   ├── use-async/     # useAsync 实现
│   │   ├── use-async-data/  # useAsyncData 实现
│   │   └── shared.ts      # 共享逻辑
│   ├── utils/             # 工具函数
│   │   ├── base.ts        # 基础工具函数
│   │   └── types.ts       # 类型工具
│   └── main.ts            # 入口文件
├── docs/                  # 文档
├── demo/                  # 示例代码
├── scripts/               # 构建脚本
└── tests/                # 测试文件
```

### 文件命名规范

- **源文件**：使用 kebab-case（如 `setup-pipeline.ts`）
- **测试文件**：使用 `*.test.ts` 或 `*.test-d.ts`
- **类型文件**：使用 `types.ts`
- **入口文件**：使用 `index.ts` 或 `main.ts`

### 模块组织原则

1. **单一职责**：每个模块只负责一个功能
2. **依赖清晰**：模块之间的依赖关系明确
3. **接口稳定**：公开 API 保持稳定
4. **内部实现灵活**：内部实现可以灵活调整

## 二、开发工具

### 推荐 IDE 配置

**VS Code 推荐插件**：
- TypeScript
- ESLint / Oxlint
- Prettier（可选）
- Vitest

**VS Code 设置**（`.vscode/settings.json`）：
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

### 调试方法

1. **使用 VS Code 调试器**：
   - 创建 `.vscode/launch.json`
   - 配置调试任务

2. **使用 console.log**：
   - 在关键位置添加日志
   - 使用 `console.group` 组织日志

3. **使用断点**：
   - 在代码中设置断点
   - 使用调试器逐步执行

### 性能分析工具

1. **Chrome DevTools**：
   - Performance 面板
   - Memory 面板

2. **Vue DevTools**：
   - 查看响应式状态
   - 追踪组件更新

## 三、核心概念深入

### 插件系统工作原理

插件系统是 Vue-AsyncX 的核心，它允许通过 Addon 扩展功能。

**执行流程**：
1. 创建 monitor 和 tracker
2. 阶段一：执行所有 addon，收集基础状态和高级 addon
3. 执行 useSetup 包装函数
4. 阶段二：执行高级 addon
5. 合并所有状态并返回

**详细说明**：参考 [架构文档](./architecture.md#插件系统设计)

### 事件系统详解

事件系统使用发布订阅模式，支持多个监听器。

**事件类型**：
- `init`：初始化
- `before`：执行前
- `after`：执行后
- `fulfill`：成功完成
- `reject`：执行失败

**事件顺序**：
```
init → before → after → fulfill/reject
```

**注意**：`enhance-arguments` 是内部实现细节，用于兼容功能，不对外暴露。

**详细说明**：参考 [架构文档](./architecture.md#monitor-事件监控系统)

### 类型推导机制

Vue-AsyncX 使用复杂的类型系统来确保类型安全。

**推导流程**：
1. 从函数参数推导 `Fn` 类型
2. 将 `Fn` 传入 Addon 类型系统
3. 收集所有 Addon 的返回类型
4. 合并返回类型，检测重复键
5. 应用命名转换，生成最终类型

**关键类型工具**：
- `CamelReplace`：驼峰替换
- `MergeTypes`：类型合并
- `ObjectShape`：提取对象形状
- `IsUnion`：判断联合类型

**详细说明**：参考 [架构文档](./architecture.md#类型系统的设计思路)

### 竟态处理算法

竟态处理通过序号（sn）和状态机实现。

**算法原理**：
1. 每次调用分配唯一序号
2. 记录每种状态的最新序号
3. 只有最新调用的状态才会更新
4. 通过 `isLatest()` 等方法判断调用顺序

**状态转换规则**：
```
PENDING → FULFILLED/REJECTED
FULFILLED → []（终态，不允许转换）
REJECTED → []（终态，不允许转换）
```

**详细说明**：参考 [架构文档](./architecture.md#竟态处理的实现原理)

## 四、常见开发任务

### 添加新的 Addon

1. **创建 Addon 文件**：
   ```typescript
   // src/addons/custom.ts
   export function withAddonCustom() {
     // 实现
   }
   ```

2. **实现 Addon 逻辑**：
   - 监听需要的事件
   - 管理状态
   - 返回状态对象

3. **添加到 Hook**：
   ```typescript
   // src/hooks/use-async/use-async.ts
   addons: [
     withAddonLoading(),
     withAddonError(),
     withAddonCustom(),  // 添加新 Addon
   ]
   ```

4. **编写测试**：
   - 创建测试文件
   - 测试状态更新
   - 测试事件处理

5. **更新文档**：
   - 更新 API 文档
   - 添加使用示例

**详细说明**：参考 [Addon 开发指南](./guides/addon-development.md)

### 修改核心逻辑

1. **理解现有实现**：
   - 阅读相关代码
   - 理解设计意图
   - 查看相关测试

2. **制定修改方案**：
   - 确定修改范围
   - 评估影响
   - 设计测试用例

3. **实施修改**：
   - 修改代码
   - 更新测试
   - 更新文档

4. **验证修改**：
   - 运行所有测试
   - 检查覆盖率
   - 验证功能

### 类型系统扩展

1. **理解类型工具**：
   - 查看 `utils/types.ts`
   - 理解类型工具的作用
   - 学习类型推导机制

2. **添加新类型工具**：
   ```typescript
   // src/utils/types.ts
   export type NewTypeTool<T> = // 实现
   ```

3. **使用类型工具**：
   - 在需要的地方使用
   - 确保类型推导正确
   - 编写类型测试

### 性能优化

1. **识别性能瓶颈**：
   - 使用性能分析工具
   - 定位慢速代码
   - 分析调用频率

2. **优化策略**：
   - 减少不必要的计算
   - 使用缓存
   - 优化数据结构

3. **验证优化效果**：
   - 对比优化前后性能
   - 确保功能正确
   - 更新文档

## 五、调试技巧

### 如何调试插件系统

1. **添加日志**：
   ```typescript
   console.log('Addon executed:', addonName)
   console.log('State:', state)
   ```

2. **使用断点**：
   - 在 `setup-pipeline.ts` 中设置断点
   - 在 Addon 中设置断点
   - 逐步执行

3. **检查状态合并**：
   ```typescript
   console.log('Merged states:', mergedStates)
   ```

### 如何调试类型问题

1. **使用类型断言**：
   ```typescript
   const result = addon() as any
   ```

2. **检查类型推导**：
   - 使用 IDE 的类型提示
   - 查看类型定义
   - 使用 `typeof` 检查

3. **编写类型测试**：
   ```typescript
   // *.test-d.ts
   import { expectType } from 'tsd'
   expectType<ExpectedType>(actualValue)
   ```

### 常见问题排查

#### 问题 1：Addon 状态未更新

**可能原因**：
- 未监听正确的事件
- 未检查 `isLatest()`
- 状态合并失败

**排查步骤**：
1. 检查事件监听是否正确
2. 检查竟态处理逻辑
3. 检查状态合并逻辑

#### 问题 2：类型推导失败

**可能原因**：
- 类型定义不正确
- 泛型参数缺失
- 类型工具错误

**排查步骤**：
1. 检查类型定义
2. 检查泛型参数
3. 检查类型工具

#### 问题 3：性能问题

**可能原因**：
- 事件监听器过多
- 状态更新频繁
- 计算开销大

**排查步骤**：
1. 使用性能分析工具
2. 检查事件监听器
3. 优化计算逻辑

## 六、性能考虑

### 性能关键路径

1. **函数调用路径**：
   ```
   用户函数 → monitor → tracker → addons
   ```

2. **状态更新路径**：
   ```
   事件触发 → addon 处理 → 响应式更新
   ```

### 优化建议

1. **事件监听器管理**：
   - 使用 `Set` 存储，快速添加/移除
   - 及时清理不需要的监听器

2. **状态更新**：
   - 只在最新调用时更新
   - 避免不必要的响应式更新

3. **类型推导**：
   - 编译期完成，不影响运行时性能
   - 避免复杂的类型计算

4. **懒加载**：
   - 插件按需执行
   - 避免不必要的初始化

### 性能测试方法

1. **基准测试**：
   ```typescript
   import { bench } from 'vitest'
   
   bench('function call', () => {
     // 测试代码
   })
   ```

2. **性能分析**：
   - 使用 Chrome DevTools
   - 分析调用栈
   - 识别瓶颈

3. **内存分析**：
   - 检查内存泄漏
   - 分析对象创建
   - 优化内存使用

## 七、测试指南

### 单元测试

**位置**：`src/**/__test__/*.test.ts`

**示例**：
```typescript
import { describe, it, expect } from 'vitest'
import { createTracker } from '@/core/tracker'

describe('createTracker', () => {
  it('should create a tracker', () => {
    const tracker = createTracker()
    expect(tracker).toBeDefined()
  })
})
```

### 类型测试

**位置**：`src/**/__test__/*.test-d.ts`

**示例**：
```typescript
import { expectType } from 'tsd'
import { useAsync } from '@/hooks/use-async/use-async'

expectType<{
  submit: () => Promise<void>
  submitLoading: Ref<boolean>
}>(useAsync('submit', async () => {}))
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试并监听
pnpm test --watch

# 运行测试并生成覆盖率
pnpm test:unit:coverage
```

## 八、代码审查清单

在提交 PR 前，请确认：

- [ ] 所有测试通过
- [ ] 代码检查通过
- [ ] 测试覆盖率不降低
- [ ] 代码注释完整
- [ ] 文档已更新
- [ ] 类型定义正确
- [ ] 没有控制台警告
- [ ] 性能没有退化

---

**文档版本**：1.0  
**最后更新**：2026年

