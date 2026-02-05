# 贡献指南

感谢您对 Vue-AsyncX 项目的关注！我们欢迎各种形式的贡献。

## 一、欢迎贡献

### 贡献方式

您可以通过以下方式为项目做出贡献：

1. **报告问题**：在 GitHub Issues 中报告 bug 或提出功能建议
2. **提交代码**：通过 Pull Request 提交代码改进
3. **改进文档**：完善文档、添加示例、修复错别字等
4. **分享经验**：在 Discussions 中分享使用经验或最佳实践

### 行为准则

- 保持友好和尊重
- 接受建设性的批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

## 二、开发环境设置

### 环境要求

- **Node.js**：>= 18.0.0
- **pnpm**：>= 8.0.0（推荐使用 pnpm，项目使用 pnpm workspace）

### 安装步骤

1. **Fork 项目**

   ```bash
   # 在 GitHub 上 Fork 项目
   ```

2. **Clone 项目**

   ```bash
   git clone https://github.com/your-username/vue-asyncx.git
   cd vue-asyncx
   ```

3. **安装依赖**

   ```bash
   pnpm install
   ```

4. **验证安装**

   ```bash
   pnpm test
   ```

### 开发命令

- `pnpm test`：运行单元测试
- `pnpm test:unit:coverage`：运行测试并生成覆盖率报告
- `pnpm build`：构建项目
- `pnpm lint`：运行代码检查
- `pnpm lint:fix`：自动修复代码问题

## 三、开发流程

### Fork 和 Clone

1. 在 GitHub 上 Fork 项目
2. Clone 你的 Fork 到本地
3. 添加上游仓库（可选，用于同步更新）：

   ```bash
   git remote add upstream https://github.com/xuyimingwork/vue-asyncx.git
   ```

### 创建分支

分支命名规范：
- `fix/xxx`：修复 bug
- `feat/xxx`：新功能
- `docs/xxx`：文档更新
- `refactor/xxx`：重构
- `test/xxx`：测试相关

示例：
```bash
git checkout -b feat/add-retry-mechanism
```

### 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

**格式**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码格式（不影响代码运行）
- `refactor`：重构
- `perf`：性能优化
- `test`：测试相关
- `chore`：构建过程或辅助工具的变动

**示例**：
```
feat(addons): add retry mechanism

Add retry mechanism to handle failed requests automatically.
The retry count and delay can be configured via options.

Closes #123
```

### PR 流程

1. **确保代码质量**
   - 通过所有测试：`pnpm test`
   - 通过代码检查：`pnpm lint`
   - 确保测试覆盖率不降低

2. **更新文档**
   - 如果添加了新功能，更新 README.md
   - 如果修改了 API，更新相关文档
   - 更新 CHANGELOG.md（如果适用）

3. **创建 Pull Request**
   - 标题清晰描述变更内容
   - 在描述中说明：
     - 变更的原因
     - 变更的内容
     - 如何测试
     - 相关的 Issue（如有）

4. **等待审查**
   - 维护者会审查你的 PR
   - 根据反馈进行修改
   - 保持 PR 的更新（通过 rebase 或 merge）

## 四、代码规范

### TypeScript 规范

- 使用 TypeScript 严格模式
- 优先使用类型推导，必要时显式声明类型
- 避免使用 `any`，优先使用 `unknown` 或具体类型
- 使用有意义的变量和函数名

### 代码风格

- 使用 2 空格缩进
- 使用单引号（字符串）
- 行尾不使用分号（根据项目配置）
- 函数和类使用 PascalCase，变量使用 camelCase
- 常量使用 UPPER_SNAKE_CASE

### 测试要求

- **所有新功能必须包含测试**
- **所有 bug 修复必须包含回归测试**
- 测试覆盖率应保持在 100%
- 测试文件命名：`*.test.ts` 或 `*.test-d.ts`（类型测试）

### 注释规范

**基本原则**：
- 公开 API 必须包含 JSDoc 注释
- 复杂逻辑必须包含注释说明
- 使用中文注释（公开 API）或英文注释（内部实现）

**示例**：
```typescript
/**
 * 创建异步数据状态管理器
 * 
 * @param monitor - 函数监控器
 * @param options - 配置选项
 * @param options.initialData - 初始数据
 * @param options.shallow - 是否使用 shallowRef
 * 
 * @returns 返回数据状态和过期标识
 * 
 * @example
 * ```ts
 * const { data, dataExpired } = useStateData(monitor, {
 *   initialData: null,
 *   shallow: false
 * })
 * ```
 */
export function useStateData(monitor: FunctionMonitor, options?: Options) {
  // ...
}
```

## 五、测试指南

### 如何运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试并监听文件变化
pnpm test --watch

# 运行测试并生成覆盖率报告
pnpm test:unit:coverage
```

### 如何编写测试

1. **测试文件位置**：与源文件同目录，使用 `__test__` 目录
2. **测试文件命名**：`*.test.ts`（功能测试）或 `*.test-d.ts`（类型测试）
3. **测试结构**：使用 `describe` 和 `it`/`test`

**示例**：
```typescript
import { describe, it, expect } from 'vitest'
import { createTracker } from '@/core/tracker'

describe('createTracker', () => {
  it('should create a tracker instance', () => {
    const tracker = createTracker()
    expect(tracker).toBeDefined()
    expect(typeof tracker.track).toBe('function')
  })
  
  it('should track function calls', () => {
    const tracker = createTracker()
    const track1 = tracker.track()
    const track2 = tracker.track()
    
    expect(track2.sn).toBe(track1.sn + 1)
  })
})
```

### 覆盖率要求

- **目标覆盖率**：100%
- **新代码**：必须达到 100% 覆盖率
- **修改代码**：不应降低现有覆盖率

## 六、文档贡献

### 文档更新流程

1. 如果修改了 API，必须更新相关文档
2. 如果添加了新功能，更新 README.md 和 API 文档
3. 如果修改了架构，更新架构文档

### 文档风格指南

- 使用 Markdown 格式
- 代码示例使用 TypeScript
- 保持文档与代码同步
- 使用清晰的结构和标题

### 文档位置

- **用户文档**：`README.md`
- **贡献指南**：`CONTRIBUTING.md`（本文件）

## 七、发布流程

### 版本号规则

我们遵循 [语义化版本](https://semver.org/)：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### CHANGELOG 更新

每次发布前，必须更新 `CHANGELOG.md`：

- 按版本分组
- 列出所有变更（新功能、修复、破坏性变更等）
- 使用清晰的分类和描述

### 发布检查清单

发布前请确认：

- [ ] 所有测试通过
- [ ] 代码检查通过
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 版本号已更新
- [ ] 构建成功
- [ ] 类型定义正确生成

## 八、获取帮助

如果您在贡献过程中遇到问题：

1. **查看文档**：先查看相关文档和示例
2. **搜索 Issues**：查看是否有类似问题
3. **创建 Issue**：如果问题仍未解决，创建新的 Issue
4. **参与讨论**：在 Discussions 中参与讨论

## 九、致谢

感谢所有为 Vue-AsyncX 做出贡献的开发者！

---

**最后更新**：2026年

