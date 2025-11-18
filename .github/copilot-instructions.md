<!-- GitHub Copilot / AI Agent 指南（为快速上手本仓库定制） -->

# 快速上下文（Big picture）
- 本仓库实现一组 Vue 3 的组合函数（composables），用于统一管理异步函数及异步数据状态。
- 主要入口：`src/main.ts`（导出 `useAsync`, `useAsyncData`, `unFirstArgumentEnhanced`）；打包由 `vite.config.ts`（library 模式）负责，输出到 `dist/`。

# 重要文件与职责
- `src/use-async.ts`：通用的异步函数封装，处理调用序号、loading、error、args；返回命名遵循 `name`, `nameLoading`, `nameArguments`, `nameArgumentFirst`, `nameError`。
- `src/use-async-data.ts`：基于 `useAsync` 的数据专用封装，管理 `data`、`dataExpired`、`enhanceFirstArgument` 等；关键策略为序号（`times.called/finished`）避免旧异步结果覆盖新结果。
- `src/utils.ts`：小工具（`upperFirst` / `StringDefaultWhenEmpty`）用于命名约定。
- `vite.config.ts`：库打包配置；`external: ['vue']`（不要打包 Vue），并启用 `vite-plugin-dts` 生成声明文件。
- `vitest.config.ts`：测试配置，运行在 `jsdom` 环境，测试根目录为 `src`。

# 开发 / 构建 / 测试 命令（必知）
- 安装、运行脚本使用 pnpm（仓库使用 pnpm 流程）；示例：
  - `pnpm run build` -> 调用 `vite build`，生成 `dist/`。
  - `pnpm run test` 或 `pnpm run test:unit` -> 运行 Vitest（jsdom）。
  - `pnpm run test:unit:coverage` -> 生成覆盖率报告（V8 coverage plugin）。
  - 发布前会执行 `prepublish` 脚本（等同于 `pnpm run build`）。

# 项目约定与模式（对 AI 很重要）
- 命名约定：`useAsyncData('user', fn)` 会导出：
  - `user`（Ref 或 ShallowRef）
  - `queryUser`（触发器函数）
  - `queryUserLoading` / `queryUserArguments` / `queryUserArgumentFirst` / `queryUserError`
  - `userExpired`（数据是否过期）
- `useAsync` 和 `useAsyncData` 都允许两种调用签名：`(fn, options)` 或 `(name, fn, options)`；默认 name 分别为 `'method'` 与 `'data'`。
- `useAsyncData` 支持 `enhanceFirstArgument`：内部将首参数替换为包含 `getData`/`updateData` 的 helper；对应的反解函数是 `unFirstArgumentEnhanced`。
- 处理并发/过时结果的核心策略：使用数值序号（`called/finished/dataUpdateByCalled/...`）决定是否应用更新，避免旧 Promise 结果覆盖新数据。

# 要点示例（可直接引用到代码）
- 如果需要自定义 watch 的 handler，传入 `watchOptions.handlerCreator = (fn) => (newVal, oldVal, onCleanup) => { ... }`（见 `use-async.ts`）。
- 如果想禁用深度响应，传入 `shallow: true` 到 `useAsyncData`，函数会使用 `shallowRef` 来保存 data（见 `use-async-data.ts`）。

# 调试提示
- 若怀疑旧异步结果覆盖问题，打印或断点 `times` 对象（`use-async-data.ts`）并观察 `called/finished/dataUpdateByFinished` 的关系。
- 测试时注意 Vitest 使用 `jsdom`，测试根目录在 `src`（参见 `vitest.config.ts`）。

# 打包/发布注意事项
- `vite.config.ts` 将 `vue` 标记为外部（peerDependency）；构建产物为 `dist/vue-asyncx.js`（ESM）和 `dist/vue-asyncx.umd.cjs`（CommonJS），类型声明由 `vite-plugin-dts` 生成到 `dist`。
- package.json 中 `types` 指向 `dist/vue-asyncx.d.ts`，`prepublish` 会触发构建，请在发布前确保 `pnpm run build` 成功。

# 供 AI 的生成/修改约束（实用规则）
- 当编辑导出 API（`src/main.ts` 或任一导出），保持 `src` 到 `dist` 的打包入口一致，且不要把 `vue` 变为内置依赖。
- 修改异步序号逻辑时，保持对 `times` 的不回退原则（旧序号不应覆盖新序号）。
- 写新 API 时，遵循现有命名约定以保证自动提示一致（`{name}`, `query{Name}`, `query{Name}Loading` 等）。

---

如果你希望我把该文件合并到已有的 `.github/copilot-instructions.md`（若存在）或扩充某一节，请指出要保留的内容或希望强调的点。是否需要我同时提交一个简短的 PR 描述？
