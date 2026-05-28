# 实施任务拆解 - harness-sync

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-sync` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-sync/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-sync/design.md` | 当前能力设计 |

### 1.2 实现范围

- Sync 类型定义（`SyncOptions`、`DocumentKind`、`SyncResult`、`SyncDocumentResult`）
- 文档注册表（readme/agents/claude/copilot 文档目标和模板策略）
- 输入加载器（`loadSyncInputs()`，读取 facts/rules/config）
- Fast scope 规划器（`resolveFastSyncScope()`，Git 变更判断与升级）
- 文档计划器（`planDocumentSync()`，生成目标内容、diff、drift）
- Managed block 工具（`replaceManagedBlock()`、`extractManagedBlock()`）
- 保护内容校验器（`validateProtectedContent()`）
- 4 个文档渲染器（readme、agents、claude、copilot）
- 报告写入器（`writeSyncReport()`，Markdown + JSON）
- Sync 命令 handler（`runSyncCommand()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与注册表基础                                        │
│  ┌──────────────┐  ┌──────────────┐                                      │
│  │ TASK-SY-01   │  │ TASK-SY-02   │                                      │
│  │ 类型定义      │  │ 文档注册表    │                                      │
│  └──────┬───────┘  └──────┬───────┘                                      │
│         │                 │                                               │
│         v                 v                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-SY-03  单元测试骨架（依赖: 01, 02）                       │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心模块（可并行）                           │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-SY-04   │  │ TASK-SY-05   │  │ TASK-SY-06   │        │   │ │
│  │  │  │ 输入+Fast     │  │ Managed块    │  │ 文档渲染器    │        │   │ │
│  │  │  │ 依赖: 03     │  │ 依赖: 03     │  │ 依赖: 03     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 计划与报告                           │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐                    │   │   │ │
│  │  │  │  │ TASK-SY-07   │  │ TASK-SY-08   │                    │   │   │ │
│  │  │  │  │ 文档计划器    │  │ 报告写入器    │                    │   │   │ │
│  │  │  │  │ 依赖: 04~06  │  │ 依赖: 04~06  │                    │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘                    │   │   │ │
│  │  │  │         │                 │                             │   │   │ │
│  │  │  │         v                 v                             │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler + 验证            │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-SY-09   │  │ TASK-SY-10   │              │   │   │   │ │
│  │  │  │  │  │ sync命令      │  │ 集成测试      │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 07,08  │  │ 依赖: 09     │              │   │   │   │ │
│  │  │  │  │  └──────────────┘  └──────────────┘              │   │   │   │ │
│  │  │  │  └──────────────────────────────────────────────────┘   │   │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-SY-01, TASK-SY-02 | ✅ 是 | 无 |
| 层级 2 | TASK-SY-03 | - | 层级 1 |
| 层级 3 | TASK-SY-04, TASK-SY-05, TASK-SY-06 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-SY-07, TASK-SY-08 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-SY-09, TASK-SY-10 | 顺序执行 | 层级 4 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 数据层 | 类型定义 | 共享类型和数据结构 |
| 接口层 | 核心服务模块 | 业务逻辑和接口 |
| 测试-骨架 | 测试类结构 | TDD 前置任务 |
| 测试-验证 | 测试用例实现 | 实现后验证 |

---

### [TASK-SY-01] Sync 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
定义 sync 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（18 个字段）、§5.3 SyncResult 核心字段

#### 输出
- `src/capabilities/sync/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/sync/types.ts`
2. 定义 `DocumentKind` 枚举：`"readme" | "agents" | "claude" | "copilot"`
3. 定义 `SyncOptions`：`{ check, fast, docs, dryRun, json }`
4. 定义 `SyncDocumentResult`：`{ path, status }`，status 枚举 `"up-to-date" | "planned" | "written" | "drifted" | "blocked"`
5. 定义 `SyncResult`：`{ mode, drift, documents, reportPath, reviewRequired }`
6. 定义 `SyncPlan`：`{ documents: DocumentPlan[], drift, reviewRequired }`
7. 定义 `DocumentPlan`：`{ path, currentContent, plannedContent, managedBlockChanged, reviewRequired }`
8. 定义 `ProtectedContentConflict`：`{ path, reason, snippet }`
9. 定义 `ReviewRequiredMarker`：`{ field, reason, targetDocument }`

#### 验收标准
- [ ] 所有类型与 design.md §1.1 字段追溯表一致
- [ ] `SyncDocumentResult.status` 包含 5 个枚举值
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表

---

### [TASK-SY-02] 文档注册表

- **类型**: 接口层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
实现 `createDocumentRegistry()` 函数，注册 readme/agents/claude/copilot 文档目标和模板策略。

#### 输入
- `src/capabilities/sync/types.ts`
- design.md §2.2 `src/capabilities/sync/document-registry.ts`

#### 输出
- `src/capabilities/sync/document-registry.ts`

#### 实现步骤
1. 创建 `src/capabilities/sync/document-registry.ts`
2. 实现 `createDocumentRegistry()` 函数，返回包含 4 个文档类型的注册表
3. README 规则：路径 `README.md`，renderer `renderReadmeBlock`
4. AGENTS 规则：路径 `AGENTS.md`，renderer `renderAgentsBlock`
5. CLAUDE 规则：路径 `CLAUDE.md`，renderer `renderClaudeBlock`
6. Copilot 规则：路径 `.github/copilot-instructions.md`，renderer `renderCopilotInstructions`
7. 每个规则包含 `kind`、`path`、`renderer`、`required`
8. 提供 `getDocumentRule(kind)`、`listDocumentRules()`、`filter(docs)` 方法

#### 验收标准
- [ ] 注册表包含 4 个文档规则
- [ ] `filter(["readme", "agents"])` 返回 2 个规则
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（同步默认文档、限定同步文档）
- design.md 章节：§2.2 `document-registry.ts`

---

### [TASK-SY-03] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-SY-01, TASK-SY-02
- **状态**: [ ] 未完成

#### 任务描述
编写 sync 模块完整单元测试骨架（红灯状态）。

#### 输入
- `src/capabilities/sync/types.ts`、`src/capabilities/sync/document-registry.ts`
- design.md §6.1 核心流程、§6.3 关键算法、§8.1 异常分类

#### 输出
- `test/sync/sync.test.ts`

#### 实现步骤
1. 创建 `test/sync/sync.test.ts`
2. 创建辅助函数：`createTempProjectWithDocs()`（创建含 README/AGENTS 的临时项目）
3. 编写 `loadSyncInputs` 测试骨架：
   - `should load repo-map.json and rules`
   - `should return 2404 when facts missing`
4. 编写 `resolveFastSyncScope` 测试骨架：
   - `should use git changes for fast check`
   - `should upgrade to full check on high-risk changes`
   - `should fallback to full check when git unavailable`
5. 编写 `replaceManagedBlock` / `extractManagedBlock` 测试骨架：
   - `should replace existing managed block`
   - `should insert block when not exists`
   - `should preserve non-managed content`
6. 编写 `validateProtectedContent` 测试骨架：
   - `should pass when only managed block changed`
   - `should return 2403 when non-managed content modified`
7. 编写 renderer 测试骨架（readme/agents/claude/copilot）
8. 编写 `planDocumentSync` 测试骨架：
   - `should detect drift when content differs`
   - `should mark up-to-date when content matches`
   - `should preserve REVIEW_REQUIRED markers`
9. 编写 `writeSyncReport` 测试骨架
10. 编写 `runSyncCommand` 测试骨架：
    - `should sync default docs`
    - `should check drift with --check`
    - `should return 2401 when drift detected in check mode`
    - `should respect --docs filter`
    - `should respect --dry-run (zero writes)`
    - `should return 2402 for invalid docs enum`
11. 所有测试标记为红灯

#### 验收标准
- [ ] 测试文件可被运行器发现
- [ ] 所有测试处于红灯状态
- [ ] 覆盖 design.md §6.1 核心流程所有分支
- [ ] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

### [TASK-SY-04] 输入加载与 Fast Scope

- **类型**: 接口层
- **依赖**: TASK-SY-03
- **状态**: [ ] 未完成

#### 任务描述
实现 `loadSyncInputs()` 和 `resolveFastSyncScope()` 函数。

#### 输入
- `src/capabilities/sync/types.ts`
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/input-loader.ts`
- `src/capabilities/sync/fast-scope.ts`

#### 实现步骤
1. 创建 `input-loader.ts`
2. 实现 `loadSyncInputs(paths, options): SyncInputs`：
   - 读取 `.harness/facts/repo-map.json`
   - 读取 `.harness/generated/rules.generated.md`（可选）
   - 读取目标文档当前内容
   - facts 缺失时返回 2404
3. 创建 `fast-scope.ts`
4. 实现 `resolveFastSyncScope(cwd, options): FastScopeResult`：
   - 读取 Git 变更文件列表
   - Git 不可用时降级完整检查并记录 warning
   - 变更命中高风险模式（package/build/CI/agent/SDD/facts/rules）时设置 `fastUpgraded=true`
   - 返回 `{ useFast, upgraded, upgradeReason, changedFiles }`

#### 验收标准
- [ ] `loadSyncInputs()` 正确读取 facts/rules/docs
- [ ] facts 缺失时返回 2404
- [ ] `resolveFastSyncScope()` 正确使用 Git 变更
- [ ] 高风险变更时升级完整检查
- [ ] Git 不可用时降级
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（CI 漂移检查、快速检查升级）
- design.md 章节：§4.2 接口 1（Sync 命令）、§6.3 Fast 检查升级算法

---

### [TASK-SY-05] Managed Block 与保护内容

- **类型**: 接口层
- **依赖**: TASK-SY-03
- **状态**: [ ] 未完成

#### 任务描述
实现 `replaceManagedBlock()`、`extractManagedBlock()` 和 `validateProtectedContent()` 函数。

#### 输入
- `src/capabilities/sync/types.ts`
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/managed-blocks.ts`
- `src/capabilities/sync/protected-content.ts`

#### 实现步骤
1. 创建 `managed-blocks.ts`
2. 实现 `extractManagedBlock(content, prefix): string | null`：
   - 查找 `<!-- {prefix}:start -->` 与 `<!-- {prefix}:end -->`
   - 存在时返回 block 内部内容
   - 不存在时返回 `null`
3. 实现 `replaceManagedBlock(content, prefix, newBlock): string`：
   - 存在完整 block 时仅替换 block 内部内容
   - 不存在 block 时将 block 插入到文档约定位置（末尾或标记位置）
   - 返回更新后的完整文档内容
4. 创建 `protected-content.ts`
5. 实现 `validateProtectedContent(current, planned, prefix): ProtectedContentConflict[]`：
   - 提取 block 外内容
   - 对比 current 与 planned 的 block 外内容是否 byte-for-byte 一致
   - 不一致时返回冲突列表

#### 验收标准
- [ ] `extractManagedBlock()` 正确提取 block 内容
- [ ] `replaceManagedBlock()` 仅替换 block 内部
- [ ] `replaceManagedBlock()` 不存在时插入
- [ ] `validateProtectedContent()` 检测非托管内容变更
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（同步默认文档 - 保留非托管用户内容）
- design.md 章节：§6.3 Managed block 替换算法

---

### [TASK-SY-06] 文档渲染器

- **类型**: 接口层
- **依赖**: TASK-SY-03
- **状态**: [ ] 未完成

#### 任务描述
实现 4 个文档渲染器：readme、agents、claude、copilot。

#### 输入
- `src/capabilities/sync/types.ts`
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/renderers/readme.ts`
- `src/capabilities/sync/renderers/agents.ts`
- `src/capabilities/sync/renderers/claude.ts`
- `src/capabilities/sync/renderers/copilot.ts`

#### 实现步骤
1. 创建 `readme.ts`：实现 `renderReadmeBlock(repoMap, rules, config): RenderedBlock`
   - 生成项目名称、描述、模块概览、快速开始等 managed block
   - 保留 REVIEW_REQUIRED 标记
2. 创建 `agents.ts`：实现 `renderAgentsBlock(repoMap, rules, config): RenderedBlock`
   - 生成跨 agent 规则入口、facts/rules 摘要
3. 创建 `claude.ts`：实现 `renderClaudeBlock(repoMap, config): RenderedBlock`
   - 生成 Claude 专属短入口、Skill 指针
4. 创建 `copilot.ts`：实现 `renderCopilotInstructions(repoMap, config): RenderedBlock`
   - 生成 Copilot instructions managed block
5. 所有渲染器不得将 REVIEW_REQUIRED 转写为确定语句
6. 所有渲染器不得包含敏感文件内容

#### 验收标准
- [ ] 4 个渲染器生成正确的 managed block
- [ ] REVIEW_REQUIRED 标记被保留
- [ ] 无敏感内容输出
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（未确认事实标注）
- design.md 章节：§2.2 需新建文件（renderers）、§6.3 REVIEW_REQUIRED 保留算法

---

### [TASK-SY-07] 文档计划器

- **类型**: 接口层
- **依赖**: TASK-SY-04, TASK-SY-05, TASK-SY-06
- **状态**: [ ] 未完成

#### 任务描述
实现 `planDocumentSync()` 函数，为每个文档生成目标内容、diff、drift 和状态。

#### 输入
- 所有已实现的 sync 模块
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/document-planner.ts`

#### 实现步骤
1. 创建 `src/capabilities/sync/document-planner.ts`
2. 实现 `planDocumentSync(inputs, options): SyncPlan`：
   - 根据 `options.docs` 找到对应 renderer
   - renderer 从 repoMap/rules/config 生成 managed block
   - `replaceManagedBlock()` 只替换 Harness managed block
   - `validateProtectedContent()` 确认非托管内容未被改动
   - 对比 current content 与 planned content，设置 drift/status
   - 收集 REVIEW_REQUIRED 标记
3. 返回 `{ documents: DocumentPlan[], drift, reviewRequired }`

#### 验收标准
- [ ] 正确检测漂移（planned ≠ current）
- [ ] 正确标记 up-to-date（planned = current）
- [ ] 保护内容冲突时返回 2403
- [ ] REVIEW_REQUIRED 被保留
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§4.2 接口 2（文档计划）

---

### [TASK-SY-08] 报告写入器

- **类型**: 接口层
- **依赖**: TASK-SY-04, TASK-SY-05, TASK-SY-06
- **状态**: [ ] 未完成

#### 任务描述
实现 `writeSyncReport()` 函数，生成 Markdown + JSON 同 stem 报告。

#### 输入
- `src/capabilities/sync/types.ts`
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/report-writer.ts`

#### 实现步骤
1. 创建 `src/capabilities/sync/report-writer.ts`
2. 实现 `writeSyncReport(result, plan, context): ReportPaths`：
   - 构建同 stem Markdown 和 JSON 报告路径（`.harness/reports/sync/<timestamp>-sync.md/json`）
   - Markdown 报告：mode、drift、documents、upgrade reason、reviewRequired、冲突摘要
   - JSON 报告：机器可读完整结构
   - 不得包含敏感文件正文
   - 通过 transaction 写入
   - 写入失败返回 5401

#### 验收标准
- [ ] Markdown 和 JSON 报告同 stem
- [ ] 报告包含 mode、drift、documents
- [ ] 无敏感内容
- [ ] 写入失败返回 5401
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（漂移检查与报告）
- design.md 章节：§4.2 接口 3（报告写入）

---

### [TASK-SY-09] Sync 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-SY-07, TASK-SY-08
- **状态**: [ ] 未完成

#### 任务描述
实现 `runSyncCommand()` 函数，串联 sync pipeline 并输出结果。

#### 输入
- 所有已实现的 sync 模块
- `test/sync/sync.test.ts`

#### 输出
- `src/capabilities/sync/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/sync/command.ts`
2. 实现 `runSyncCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 `SyncOptions`（`--check`、`--fast`、`--docs`、`--dry-run`、`--json`）
   - 校验 `--docs` 枚举，不合法返回 2402
   - `--fast` 时调用 `resolveFastSyncScope()`
   - 调用 `loadSyncInputs()`
   - 调用 `planDocumentSync()`
   - `--check` 或 `--dry-run` 时不写目标文档；漂移且 `--check` 返回 2401
   - 非 check/dry-run 时通过 transaction 写入 managed block
   - 调用 `writeSyncReport()`
   - 返回 `SyncResult`

#### 验收标准
- [ ] 默认同步写入 managed block
- [ ] `--check` 漂移时返回 2401
- [ ] `--docs` 过滤文档
- [ ] `--dry-run` 零写入
- [ ] `--fast` 正确使用/升级
- [ ] 非法 docs 返回 2402
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Sync 命令）、§6.1 核心流程

---

### [TASK-SY-10] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-SY-09
- **状态**: [ ] 未完成

#### 任务描述
编写并运行集成测试，验证 sync 端到端流程。

#### 输入
- 所有已实现的 sync 模块

#### 输出
- `test/sync/sync-integration.test.ts`

#### 实现步骤
1. 创建 `test/sync/sync-integration.test.ts`
2. 编写端到端场景：
   - 默认同步 → 验证 managed block 写入
   - `--check` 无漂移 → 返回 0
   - `--check` 有漂移 → 返回 2401
   - `--docs readme,agents` → 只同步指定文档
   - `--dry-run` → 零写入
   - `--fast` 高风险 → 升级完整检查
   - 保护内容冲突 → 返回 2403
   - facts 缺失 → 返回 2404
3. 运行全部测试、tsc、lint

#### 验收标准
- [ ] 所有集成测试通过
- [ ] 所有单元测试通过
- [ ] `npx tsc --noEmit` 无错误
- [ ] lint 无错误

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-SY-04 | 单元测试 | 输入加载（正常/缺失） | 正确加载或 2404 |
| TASK-SY-04 | 单元测试 | Fast scope（正常/升级/降级） | 正确判断 |
| TASK-SY-05 | 单元测试 | Managed block 替换/插入 | 内容正确 |
| TASK-SY-05 | 单元测试 | 保护内容校验 | 冲突检测 |
| TASK-SY-06 | 单元测试 | 4 个渲染器 | block 内容正确 |
| TASK-SY-07 | 单元测试 | 文档计划（drift/up-to-date/conflict） | 状态正确 |
| TASK-SY-08 | 单元测试 | 报告写入 | Markdown+JSON 正确 |
| TASK-SY-09 | 单元测试 | sync 命令全流程 | CliResponse 正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 默认同步 | 已初始化 + facts 存在 | sync | managed block 写入 |
| CI 漂移检查 | 文档有漂移 | sync --check | 返回 2401 |
| 限定文档 | 已初始化 | sync --docs readme | 只处理 README |
| dry-run | 已初始化 | sync --dry-run | 零写入 |
| fast 升级 | 高风险变更 | sync --fast | 升级完整检查 |
| 保护内容 | 非托管内容 | sync | 返回 2403 |

### 4.3 手动验证清单

- [ ] `harness sync --json` 输出合法 JSON
- [ ] `harness sync --check` 检测漂移
- [ ] `harness sync --docs readme,agents --dry-run` 预览计划
- [ ] 报告文件存在于 `.harness/reports/sync/`

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `Transaction`、config |
| `harness-inspect` | 其他能力 | 本变更 | ⏳ 待建 | repo-map、rules |
| `harness-adapter-skill-runtime` | 其他能力 | 本变更 | ⏳ 待建 | adapter 指针 |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | protected content |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | fast scope |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`DocumentRegistry`、`SyncPlanner`）
- 方法名：camelCase（`planDocumentSync`、`replaceManagedBlock`）
- 文件名：kebab-case（`document-planner.ts`、`managed-blocks.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2401-2404、5401）

### 6.3 日志规范

- 敏感信息处理：sync 不得读取或输出敏感文件内容

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/sync/types.ts` | 共享类型定义 | TASK-SY-01 |
| `src/capabilities/sync/document-registry.ts` | 文档注册表 | TASK-SY-02 |
| `src/capabilities/sync/input-loader.ts` | 输入加载器 | TASK-SY-04 |
| `src/capabilities/sync/fast-scope.ts` | Fast scope 规划器 | TASK-SY-04 |
| `src/capabilities/sync/managed-blocks.ts` | Managed block 工具 | TASK-SY-05 |
| `src/capabilities/sync/protected-content.ts` | 保护内容校验 | TASK-SY-05 |
| `src/capabilities/sync/renderers/readme.ts` | README 渲染器 | TASK-SY-06 |
| `src/capabilities/sync/renderers/agents.ts` | AGENTS 渲染器 | TASK-SY-06 |
| `src/capabilities/sync/renderers/claude.ts` | CLAUDE 渲染器 | TASK-SY-06 |
| `src/capabilities/sync/renderers/copilot.ts` | Copilot 渲染器 | TASK-SY-06 |
| `src/capabilities/sync/document-planner.ts` | 文档计划器 | TASK-SY-07 |
| `src/capabilities/sync/report-writer.ts` | 报告写入器 | TASK-SY-08 |
| `src/capabilities/sync/command.ts` | sync 命令 handler | TASK-SY-09 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/sync/sync.test.ts` | 单元测试 | TASK-SY-03~09 |
| `test/sync/sync-integration.test.ts` | 集成测试 | TASK-SY-10 |

### 7.3 文档更新

- [ ] README 更新（sync 命令说明）
- [ ] 接口文档更新
- [ ] 变更日志更新

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**（依赖字段已填写）
> - [x] **任务执行拓扑图已绘制**（层级关系清晰）
> - [x] 无循环依赖
