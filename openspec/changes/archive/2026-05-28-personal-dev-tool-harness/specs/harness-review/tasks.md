# 实施任务拆解 - harness-review

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-review` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-review/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-review/design.md` | 当前能力设计 |

### 1.2 实现范围

- Review 类型定义（`ReviewOptions`、`ReviewScope`、`ReviewFinding`、`ReviewResult`、`ReviewSummary`、`ReviewFilterStats`、`ReviewFixResult`）
- 参数校验器（`validateReviewOptions()`，scope/fix/full-lite 互斥）
- 范围解析器（`resolveReviewScope()`，local/staged/scan/remote）
- Git 范围适配器（`resolveLocalRange()`、`resolveStagedRange()`）
- 路径守卫（`assertPathInsideProject()`，防越界）
- 上下文构建器（`buildReviewContext()`，脱敏过滤）
- Reviewer 规划器（`planReviewers()`，full/lite 选择）
- Reviewer 执行器（`runReviewers()`，并行执行）
- Finding 归一化器（`normalizeFinding()`）
- Finding 验证器（`validateFindings()`，validator 复核）
- 置信度过滤器（`filterByConfidence()`，阈值 80）
- Finding 去重器（`dedupeFindings()`）
- 修复规划器（`planMechanicalFixes()`，低风险机械问题）
- 修复执行器（`applyMechanicalFixes()`，事务写入）
- 报告写入器（`writeReviewReports()`，Markdown + JSON 双报告）
- 远程评论器（`postRemoteComments()`，PR/MR 评论）
- Review 命令 handler（`runReviewCommand()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path`、`child_process` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`
- Git：`>= 2.30.0`（diff、staged、branch 范围解析）
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与校验基础                                         │
│  ┌──────────────┐  ┌──────────────┐                                      │
│  │ TASK-RV-01   │  │ TASK-RV-02   │                                      │
│  │ 类型定义      │  │ 参数校验      │                                      │
│  └──────┬───────┘  └──────┬───────┘                                      │
│         │                 │                                               │
│         v                 v                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-RV-03  单元测试骨架（依赖: 01, 02）                       │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 范围与上下文（可并行）                       │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-RV-04   │  │ TASK-RV-05   │  │ TASK-RV-06   │        │   │ │
│  │  │  │ 范围解析      │  │ Git适配器     │  │ 上下文构建    │        │   │ │
│  │  │  │ 依赖: 03     │  │ 依赖: 03     │  │ 依赖: 03     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - Reviewer 执行与 Finding 处理         │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │   │ │
│  │  │  │  │ TASK-RV-07   │  │ TASK-RV-08   │  │ TASK-RV-09   │  │   │   │ │
│  │  │  │  │ Reviewer规划  │  │ Finding处理   │  │ 验证过滤去重  │  │   │   │ │
│  │  │  │  │ 依赖: 04~06  │  │ 依赖: 07     │  │ 依赖: 08     │  │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │   │ │
│  │  │  │         │                 │                 │           │   │   │ │
│  │  │  │         v                 v                 v           │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 修复与报告                     │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-RV-10   │  │ TASK-RV-11   │              │   │   │   │ │
│  │  │  │  │  │ 修复执行      │  │ 报告写入      │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 09     │  │ 依赖: 09     │              │   │   │   │ │
│  │  │  │  │  └──────┬───────┘  └──────┬───────┘              │   │   │   │ │
│  │  │  │  │         │                 │                       │   │   │   │ │
│  │  │  │  │         v                 v                       │   │   │   │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │   │   │   │ │
│  │  │  │  │  │  层级 6 (依赖 L5) - 命令 Handler + 验证        │ │   │   │   │ │
│  │  │  │  │  │  ┌──────────────┐  ┌──────────────┐          │ │   │   │   │ │
│  │  │  │  │  │  │ TASK-RV-12   │  │ TASK-RV-13   │          │ │   │   │   │ │
│  │  │  │  │  │  │ review命令    │  │ 集成测试      │          │ │   │   │   │ │
│  │  │  │  │  │  │ 依赖: 10,11  │  │ 依赖: 12     │          │ │   │   │   │ │
│  │  │  │  │  │  └──────────────┘  └──────────────┘          │ │   │   │   │ │
│  │  │  │  │  └──────────────────────────────────────────────┘ │   │   │   │ │
│  │  │  │  └──────────────────────────────────────────────────┘   │   │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-RV-01, TASK-RV-02 | ✅ 是 | 无 |
| 层级 2 | TASK-RV-03 | - | 层级 1 |
| 层级 3 | TASK-RV-04, TASK-RV-05, TASK-RV-06 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-RV-07, TASK-RV-08, TASK-RV-09 | 顺序执行 | 层级 3 |
| 层级 5 | TASK-RV-10, TASK-RV-11 | ✅ 是 | 层级 4 |
| 层级 6 | TASK-RV-12, TASK-RV-13 | 顺序执行 | 层级 5 |

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

### [TASK-RV-01] Review 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
定义 review 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（30 个字段）、§5.1 ReviewJsonReport

#### 输出
- `src/capabilities/review/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/types.ts`
2. 定义 `ReviewOptions`：`{ local, staged, scan, fix, noFix, full, lite, comment, json }`
3. 定义 `ReviewScope`：`{ kind, files, baseRef?, headRef? }`，kind 枚举 `"local" | "staged" | "scan" | "remote"`
4. 定义 `ReviewFinding`：`{ id, file, lineRange, ruleId, severity, confidence, message, evidence, validatorStatus? }`
5. 定义 `ReviewSummary`：`{ p0, p1, p2, discarded }`
6. 定义 `ReviewFilterStats`：`{ lowConfidence, validatorRejected, deduplicated, total }`
7. 定义 `ReviewFixResult`：`{ file, finding, reason, validationStatus }`，validationStatus 枚举 `"passed" | "failed" | "skipped"`
8. 定义 `ReviewReports`：`{ markdown, json }`
9. 定义 `ReviewResult`：`{ scope, findings, summary, filterStats, fixResults?, reports }`
10. 定义 `ReviewJsonReport`：包含 `schemaVersion: "review.v1"` 及所有字段

#### 验收标准
- [x] 所有类型与 design.md §1.1 字段追溯表一致
- [x] `ReviewFinding` 包含 confidence 字段（0-100）
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表、§5.1 数据模型

---

### [TASK-RV-02] 参数校验器

- **类型**: 接口层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
实现 `validateReviewOptions()` 函数，校验 scope/fix/full-lite 参数互斥。

#### 输入
- `src/capabilities/review/types.ts`
- design.md §2.2 `options-validator.ts`

#### 输出
- `src/capabilities/review/options-validator.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/options-validator.ts`
2. 实现 `validateReviewOptions(options: ReviewOptions): ValidationResult`：
   - 校验 `local/staged/scan` 互斥，冲突返回 2602
   - 校验 `fix/noFix` 互斥
   - 校验 `full/lite` 互斥
   - 默认 `noFix=true`（未显式传入 `fix` 时）
   - 合法返回 `{ valid: true }`

#### 验收标准
- [x] `local+staged` 同时出现返回 2602
- [x] `fix+noFix` 同时出现返回参数错误
- [x] `full+lite` 同时出现返回参数错误
- [x] 默认 `noFix=true`
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 错误码 2602
- design.md 章节：§6.3.1 Scope 解析算法

---

### [TASK-RV-03] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-RV-01, TASK-RV-02
- **状态**: [x] 已完成

#### 任务描述
编写 review 模块完整单元测试骨架（红灯状态）。

#### 输入
- 已实现的类型、参数校验模块
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/review/review.test.ts`

#### 实现步骤
1. 创建 `test/review/review.test.ts`
2. 创建辅助函数：`createTempGitProject()`（创建含 Git 仓库的临时项目）
3. 编写 `validateReviewOptions` 测试骨架（已在 TASK-RV-02 覆盖，此处集成）
4. 编写 `resolveReviewScope` 测试骨架：
   - `should resolve local scope with git diff`
   - `should resolve staged scope`
   - `should resolve scan scope`
   - `should reject scan path outside project (2603)`
   - `should return 2602 when multiple scope flags`
5. 编写 `buildReviewContext` 测试骨架：
   - `should filter secret files from context`
   - `should include diff and file snippets`
6. 编写 `planReviewers` 测试骨架：
   - `should select full reviewers when > 3 files`
   - `should select lite reviewers when --lite`
   - `should select full reviewers when --full`
7. 编写 `normalizeFinding` 测试骨架：
   - `should normalize reviewer output to unified schema`
   - `should discard findings missing required fields`
8. 编写 `validateFindings` 测试骨架：
   - `should accept valid findings`
   - `should reject findings with low confidence`
   - `should return 2604 when validator fails`
9. 编写 `filterByConfidence` 测试骨架：
   - `should discard findings with confidence < 80`
   - `should record discarded count`
10. 编写 `dedupeFindings` 测试骨架：
    - `should dedupe by file+line+rule+fingerprint`
    - `should keep highest severity and confidence`
11. 编写 `planMechanicalFixes` / `applyMechanicalFixes` 测试骨架：
    - `should only fix low-risk mechanical issues`
    - `should not fix when --no-fix`
    - `should rollback on failure`
12. 编写 `writeReviewReports` 测试骨架：
    - `should write Markdown + JSON reports`
    - `should include schemaVersion in JSON`
    - `should return 2605 on write failure`
13. 编写 `runReviewCommand` 测试骨架：
    - `should return 2601 when P0 findings exist`
    - `should respect --no-fix (no source changes)`
    - `should respect --fix (mechanical fixes only)`
14. 所有测试标记为红灯

#### 验收标准
- [x] 测试文件可被运行器发现
- [x] 所有测试处于红灯状态
- [x] 覆盖 design.md §6.2 状态机所有状态
- [x] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

### [TASK-RV-04] 范围解析器

- **类型**: 接口层
- **依赖**: TASK-RV-03
- **状态**: [x] 已完成

#### 任务描述
实现 `resolveReviewScope()` 和 `assertPathInsideProject()` 函数。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/scope-resolver.ts`
- `src/capabilities/review/path-guard.ts`

#### 实现步骤
1. 创建 `path-guard.ts`
2. 实现 `assertPathInsideProject(scanPath, projectRoot): void`：
   - normalize、resolve 路径
   - 检查 scanPath 是否以 projectRoot 为前缀
   - 越界抛出 2603
3. 创建 `scope-resolver.ts`
4. 实现 `resolveReviewScope(options, projectRoot): ReviewScope`：
   - `local=true` 时调用 Git 解析主分支基准与当前 head
   - `staged=true` 时读取 Git index
   - `scan` 存在时先调用 `assertPathInsideProject()`
   - 未提供范围时默认走 `local`，Git 不可用时提示使用 `--scan`
   - 返回 `{ kind, files, baseRef?, headRef? }`

#### 验收标准
- [x] local 范围正确解析 Git diff
- [x] staged 范围正确读取暂存区
- [x] scan 范围正确校验路径
- [x] 越界路径返回 2603
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（本地分支审查、暂存区审查、目录扫描审查）
- design.md 章节：§6.3.1 Scope 解析算法

---

### [TASK-RV-05] Git 范围适配器

- **类型**: 接口层
- **依赖**: TASK-RV-03
- **状态**: [x] 已完成

#### 任务描述
实现 `resolveLocalRange()` 和 `resolveStagedRange()` 函数，通过 Git 获取分支 diff 与暂存区文件。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/git-range.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/git-range.ts`
2. 实现 `resolveLocalRange(projectRoot): GitRange`：
   - 执行 `git rev-parse --abbrev-ref HEAD` 获取当前分支
   - 执行 `git merge-base main HEAD` 或 `git merge-base master HEAD` 获取基准
   - 执行 `git diff --name-only <base>...HEAD` 获取变更文件
   - Git 不可用时返回错误
3. 实现 `resolveStagedRange(projectRoot): GitRange`：
   - 执行 `git diff --cached --name-only` 获取暂存区文件
   - 设置 `scope=staged`
4. 返回 `{ baseRef, headRef, files }`

#### 验收标准
- [x] local 范围正确获取 base/head 引用
- [x] staged 范围正确获取暂存区文件
- [x] Git 不可用时返回可操作错误
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（本地分支审查、暂存区审查）
- design.md 章节：§2.2 `git-range.ts`

---

### [TASK-RV-06] 上下文构建器

- **类型**: 接口层
- **依赖**: TASK-RV-03
- **状态**: [x] 已完成

#### 任务描述
实现 `buildReviewContext()` 函数，根据 scope 构建 diff、文件片段和必要上下文，并过滤敏感内容。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/context-builder.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/context-builder.ts`
2. 实现 `buildReviewContext(scope, projectRoot, secretPatterns): ReviewContext`：
   - 读取 scope 内文件的 diff 和摘要
   - 过滤命中 secretPatterns 的文件内容
   - 读取 module map 和 rules（来自 inspect）
   - 返回脱敏后的审查上下文
3. 上下文写入 `.harness/cache/review/<runId>/context.json`（临时，命令结束后可清理）

#### 验收标准
- [x] 正确读取 scope 内文件
- [x] 敏感文件内容被过滤
- [x] 包含 module map 和 rules
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§5.2 数据安全
- design.md 章节：§2.2 `context-builder.ts`

---

### [TASK-RV-07] Reviewer 规划与执行

- **类型**: 接口层
- **依赖**: TASK-RV-04, TASK-RV-05, TASK-RV-06
- **状态**: [x] 已完成

#### 任务描述
实现 `planReviewers()` 和 `runReviewers()` 函数，按 full/lite/文件数量选择 reviewer 并并行执行。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/reviewer-planner.ts`
- `src/capabilities/review/reviewer-runner.ts`

#### 实现步骤
1. 创建 `reviewer-planner.ts`
2. 实现 `planReviewers(context, options): ReviewerPlan`：
   - `full=true` 或文件数超过 3 时选择完整 reviewer 集合
   - `lite=true` 时只选择规则审查与浅层 bug reviewer
   - 完整集合：规则审查、浅层 bug、深层 bug、历史回归、团队标准、契约一致性
   - reviewer 输入只包含脱敏上下文和 scope 内文件
3. 创建 `reviewer-runner.ts`
4. 实现 `runReviewers(plan, context): CandidateFinding[]`：
   - 并行执行 reviewer（受 safety orchestration 控制并发）
   - 单个 reviewer 失败时记录 issue，不直接使全部失败
   - agent 不可用时降级为单进程 lite 审查

#### 验收标准
- [x] full 模式选择完整 reviewer 集合
- [x] lite 模式选择轻量 reviewer
- [x] 并行执行且失败隔离
- [x] agent 不可用时降级
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（标准审查流程）
- design.md 章节：§6.3.2 Reviewer 计划算法

---

### [TASK-RV-08] Finding 归一化

- **类型**: 接口层
- **依赖**: TASK-RV-07
- **状态**: [x] 已完成

#### 任务描述
实现 `normalizeFinding()` 函数，归一化 reviewer 输出为统一 finding schema。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/finding-normalizer.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/finding-normalizer.ts`
2. 实现 `normalizeFinding(raw: unknown): ReviewFinding | null`：
   - 校验必填字段：file、lineRange、ruleId、severity、confidence、message、evidence
   - 缺少必填字段的 candidate 直接丢弃（返回 null）
   - 转换为统一 `ReviewFinding` schema
   - 生成 semanticFingerprint（用于去重）

#### 验收标准
- [x] 正确归一化 reviewer 输出
- [x] 缺少必填字段时返回 null
- [x] 生成 semanticFingerprint
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（多 agent 审查与 finding 验证）
- design.md 章节：§2.2 `finding-normalizer.ts`、§6.3.3 Finding 验证过滤算法

---

### [TASK-RV-09] Finding 验证、过滤与去重

- **类型**: 接口层
- **依赖**: TASK-RV-08
- **状态**: [x] 已完成

#### 任务描述
实现 `validateFindings()`、`filterByConfidence()` 和 `dedupeFindings()` 函数。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/validator.ts`
- `src/capabilities/review/confidence-filter.ts`
- `src/capabilities/review/deduper.ts`

#### 实现步骤
1. 创建 `validator.ts`
2. 实现 `validateFindings(findings: ReviewFinding[]): ValidatedFinding[]`：
   - 对每条 finding 做上下文复核
   - 产出 accepted/rejected 与 validator reason
   - 未完成返回 2604
3. 创建 `confidence-filter.ts`
4. 实现 `filterByConfidence(findings, minConfidence=80): { filtered, stats }`：
   - 丢弃 confidence < 80 或 validator rejected 的 finding
   - 记录 lowConfidence、validatorRejected 统计
5. 创建 `deduper.ts`
6. 实现 `dedupeFindings(findings): { deduped, stats }`：
   - 以 `file + lineRange + ruleId + semanticFingerprint` 去重
   - 保留最高严重度与最高置信度版本
   - 记录 deduplicated 统计

#### 验收标准
- [x] validator 正确复核 finding
- [x] confidence < 80 被丢弃
- [x] validator rejected 被丢弃
- [x] 去重保留最高严重度/置信度
- [x] 统计正确记录
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（低置信 finding）
- design.md 章节：§6.3.3 Finding 验证过滤算法

---

### [TASK-RV-10] 修复规划与执行

- **类型**: 接口层
- **依赖**: TASK-RV-09
- **状态**: [x] 已完成

#### 任务描述
实现 `planMechanicalFixes()` 和 `applyMechanicalFixes()` 函数，处理低风险机械修复。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/fix-planner.ts`
- `src/capabilities/review/fix-applier.ts`

#### 实现步骤
1. 创建 `fix-planner.ts`
2. 实现 `planMechanicalFixes(findings, options): FixPlan`：
   - `noFix=true` 或未显式 `fix=true` 时返回空计划
   - 只允许自动修复：格式化、拼写、明显未使用 import 等机械问题
   - 单文件局部修改
   - 有明确验证命令或静态检查可确认
   - P0/P1 业务逻辑 finding 不自动修复
3. 创建 `fix-applier.ts`
4. 实现 `applyMechanicalFixes(plan, tx): ReviewFixResult[]`：
   - 通过 transaction 写入修复
   - 失败时回滚并记录验证状态
   - 只能修改审查范围内文件

#### 验收标准
- [x] `--no-fix` 时不调用修复
- [x] 只修复低风险机械问题
- [x] P0/P1 不自动修复
- [x] 修复通过 transaction 写入
- [x] 失败时回滚
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（只报告不修复、允许自动修复）
- design.md 章节：§6.3.4 Fix 边界算法

---

### [TASK-RV-11] 报告写入与远程评论

- **类型**: 接口层
- **依赖**: TASK-RV-09
- **状态**: [x] 已完成

#### 任务描述
实现 `writeReviewReports()` 和 `postRemoteComments()` 函数。

#### 输入
- `src/capabilities/review/types.ts`
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/report-writer.ts`
- `src/capabilities/review/remote-commenter.ts`

#### 实现步骤
1. 创建 `report-writer.ts`
2. 实现 `writeReviewReports(result, context): ReviewReports`：
   - 生成 Markdown 报告：scope、findings、summary、fix results
   - 生成 JSON 报告：包含 `schemaVersion: "review.v1"` 及所有字段
   - 报告默认写入 `.harness/reports/review/<timestamp>-<branch>.md/json`
   - 通过 transaction 原子写入
   - 写入失败返回 2605
   - 报告不得包含敏感文件内容
3. 创建 `remote-commenter.ts`
4. 实现 `postRemoteComments(result, options): CommentResult`：
   - `--comment` 时在远程 PR/MR 发表评论
   - 需要用户已配置凭据
   - 失败时跳过评论并在报告记录 warning
   - 过滤本地绝对私密路径

#### 验收标准
- [x] Markdown + JSON 双报告写入
- [x] JSON 报告包含 schemaVersion
- [x] 写入失败返回 2605
- [x] 远程评论失败时本地报告仍保留
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（报告与修复策略）
- design.md 章节：§2.2 `report-writer.ts`、`remote-commenter.ts`

---

### [TASK-RV-12] Review 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-RV-10, TASK-RV-11
- **状态**: [x] 已完成

#### 任务描述
实现 `runReviewCommand()` 函数，串联 review pipeline 并输出结果。

#### 输入
- 所有已实现的 review 模块
- `test/review/review.test.ts`

#### 输出
- `src/capabilities/review/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/review/command.ts`
2. 实现 `runReviewCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 `ReviewOptions`
   - `validateReviewOptions()` 校验互斥
   - `resolveReviewScope()` 解析范围
   - `buildReviewContext()` 构建上下文
   - `planReviewers()` 规划 reviewer
   - `runReviewers()` 并行执行
   - `normalizeFinding()` 归一化
   - `validateFindings()` 验证
   - `filterByConfidence()` 过滤
   - `dedupeFindings()` 去重
   - `--fix` 时调用 `planMechanicalFixes()` 和 `applyMechanicalFixes()`
   - `writeReviewReports()` 写入报告
   - `--comment` 时调用 `postRemoteComments()`
   - P0 finding 数量 > 0 时返回 2601
   - 否则返回成功

#### 验收标准
- [x] 完整 pipeline 正确执行
- [x] P0 finding 返回 2601
- [x] `--no-fix` 不修改源码
- [x] `--fix` 只修复机械问题
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Review CLI）、§6.1 核心流程

---

### [TASK-RV-13] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-RV-12
- **状态**: [x] 已完成

#### 任务描述
编写并运行集成测试，验证 review 端到端流程。

#### 输入
- 所有已实现的 review 模块

#### 输出
- `test/review/review-integration.test.ts`

#### 实现步骤
1. 创建 `test/review/review-integration.test.ts`
2. 编写端到端场景：
   - local 审查 → 验证 scope、findings、reports
   - staged 审查 → 验证 scope=staged
   - scan 审查 → 验证路径校验
   - `--no-fix` → 验证不修改源码
   - `--fix` → 验证只修复机械问题
   - P0 finding → 验证返回 2601
   - 低置信 finding → 验证被丢弃
   - 范围参数冲突 → 验证返回 2602
   - 路径越界 → 验证返回 2603
3. 运行全部测试、tsc、lint

#### 验收标准
- [x] 所有集成测试通过
- [x] 所有单元测试通过
- [x] `npx tsc --noEmit` 无错误
- [x] lint 无错误

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-RV-02 | 单元测试 | 参数校验（互斥/默认） | 正确通过或错误码 |
| TASK-RV-04 | 单元测试 | 范围解析（local/staged/scan/越界） | 正确 scope 或错误码 |
| TASK-RV-05 | 单元测试 | Git 范围（local/staged/不可用） | 正确 base/head/files |
| TASK-RV-06 | 单元测试 | 上下文构建（脱敏/包含） | 正确过滤 |
| TASK-RV-07 | 单元测试 | Reviewer 规划（full/lite/阈值） | 正确选择 |
| TASK-RV-08 | 单元测试 | Finding 归一化（正常/缺失字段） | 正确转换或丢弃 |
| TASK-RV-09 | 单元测试 | 验证/过滤/去重 | 正确处理和统计 |
| TASK-RV-10 | 单元测试 | 修复规划/执行（no-fix/fix/回滚） | 正确行为 |
| TASK-RV-11 | 单元测试 | 报告写入/远程评论 | 正确输出 |
| TASK-RV-12 | 单元测试 | review 命令全流程 | CliResponse 正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| local 审查 | Git 项目有变更 | review --local | 输出 findings 和 reports |
| staged 审查 | 有暂存区文件 | review --staged | scope=staged |
| scan 审查 | 指定目录 | review --scan src | 扫描指定目录 |
| no-fix | 有 finding | review --no-fix | 不修改源码 |
| fix | 有机械 finding | review --fix | 只修复机械问题 |
| P0 finding | 有 P0 | review | 返回 2601 |
| 范围冲突 | 多 scope 标志 | review --local --staged | 返回 2602 |

### 4.3 手动验证清单

- [x] `harness review --local --json` 输出合法 JSON
- [x] `harness review --staged` 审查暂存区
- [x] `harness review --scan src --no-fix` 只报告
- [x] `harness review --fix` 只修复机械问题
- [x] 报告存在于 `.harness/reports/review/`

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `Transaction`、报告路径 |
| `harness-inspect` | 其他能力 | 本变更 | ⏳ 待建 | module map、rules |
| `harness-develop` | 其他能力 | 本变更 | ⏳ 待建 | spec/design/tasks 摘要 |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | 并行控制、fix 边界 |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path/child_process |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | diff/staged/branch |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`ReviewPlanner`、`FindingValidator`）
- 方法名：camelCase（`resolveReviewScope`、`validateFindings`）
- 文件名：kebab-case（`scope-resolver.ts`、`confidence-filter.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2601-2605、5601）

### 6.3 日志规范

- 敏感信息处理：报告不得包含敏感文件内容

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/review/types.ts` | 共享类型定义 | TASK-RV-01 |
| `src/capabilities/review/options-validator.ts` | 参数校验 | TASK-RV-02 |
| `src/capabilities/review/scope-resolver.ts` | 范围解析 | TASK-RV-04 |
| `src/capabilities/review/path-guard.ts` | 路径守卫 | TASK-RV-04 |
| `src/capabilities/review/git-range.ts` | Git 适配器 | TASK-RV-05 |
| `src/capabilities/review/context-builder.ts` | 上下文构建 | TASK-RV-06 |
| `src/capabilities/review/reviewer-planner.ts` | Reviewer 规划 | TASK-RV-07 |
| `src/capabilities/review/reviewer-runner.ts` | Reviewer 执行 | TASK-RV-07 |
| `src/capabilities/review/finding-normalizer.ts` | Finding 归一化 | TASK-RV-08 |
| `src/capabilities/review/validator.ts` | Finding 验证 | TASK-RV-09 |
| `src/capabilities/review/confidence-filter.ts` | 置信度过滤 | TASK-RV-09 |
| `src/capabilities/review/deduper.ts` | Finding 去重 | TASK-RV-09 |
| `src/capabilities/review/fix-planner.ts` | 修复规划 | TASK-RV-10 |
| `src/capabilities/review/fix-applier.ts` | 修复执行 | TASK-RV-10 |
| `src/capabilities/review/report-writer.ts` | 报告写入 | TASK-RV-11 |
| `src/capabilities/review/remote-commenter.ts` | 远程评论 | TASK-RV-11 |
| `src/capabilities/review/command.ts` | review 命令 handler | TASK-RV-12 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/review/review.test.ts` | 单元测试 | TASK-RV-03~12 |
| `test/review/review-integration.test.ts` | 集成测试 | TASK-RV-13 |

### 7.3 文档更新

- [x] README 更新（review 命令说明）
- [x] 接口文档更新
- [x] 变更日志更新

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
