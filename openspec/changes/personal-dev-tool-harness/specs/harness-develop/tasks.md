# 实施任务拆解 - harness-develop

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-develop` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-develop/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-develop/design.md` | 当前能力设计 |

### 1.2 实现范围

- Develop 类型定义（`DevelopOptions`、`DevelopResult`、`DevelopStage`、`StorageLocation`、`ProposalMeta`）
- 变更名称校验（`validateChangeName()`，kebab-case + 3-80 长度）
- 阶段标志解析（`resolveRequestedStage()`，互斥校验）
- 存储解析器（`resolveDevelopStorage()`，canonical/legacy/mixed/missing 标记）
- Legacy OpenSpec 读取（`readLegacyOpenSpecChange()`，只读兼容）
- 阶段检测器（`detectDevelopStage()`、`suggestNextStage()`）
- Proposal frontmatter 读取（`readProposalMeta()`，mode + test-strategy）
- Tasks 策略构建（`buildTasksPolicy()`，TDD/impl-first/none DAG 策略）
- 一致性检查器（`runDevelopCheck()`、`validateStageDependencies()`，只读）
- Artifact 写入器（`planArtifacts()`、`writeArtifactsTransactionally()`，含 dry-run）
- 报告写入器（`buildDevelopReport()`、`writeDevelopReport()`）
- Develop 命令 handler（`runDevelopCommand()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`
- YAML：frontmatter 解析（`gray-matter` 或内置解析）
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与校验基础                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ TASK-DV-01   │  │ TASK-DV-02   │  │ TASK-DV-03   │                    │
│  │ 类型定义      │  │ 名称校验      │  │ 阶段标志      │                    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                 │                             │
│         v                 v                 v                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-DV-04  单元测试骨架（依赖: 01, 02, 03）                   │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心模块（可并行）                           │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-DV-05   │  │ TASK-DV-06   │  │ TASK-DV-07   │        │   │ │
│  │  │  │ 存储+Legacy   │  │ Proposal解析  │  │ 阶段检测      │        │   │ │
│  │  │  │ 依赖: 04     │  │ 依赖: 04     │  │ 依赖: 04     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 执行与检查                           │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │   │ │
│  │  │  │  │ TASK-DV-08   │  │ TASK-DV-09   │  │ TASK-DV-10   │  │   │   │ │
│  │  │  │  │ Tasks策略     │  │ Check检查器   │  │ Artifact写入  │  │   │   │ │
│  │  │  │  │ 依赖: 06     │  │ 依赖: 05~07  │  │ 依赖: 05~07  │  │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │   │ │
│  │  │  │         │                 │                 │           │   │   │ │
│  │  │  │         v                 v                 v           │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler + 验证            │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-DV-11   │  │ TASK-DV-12   │              │   │   │   │ │
│  │  │  │  │  │ develop命令   │  │ 集成测试      │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 08~10  │  │ 依赖: 11     │              │   │   │   │ │
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
| 层级 1 | TASK-DV-01, TASK-DV-02, TASK-DV-03 | ✅ 是 | 无 |
| 层级 2 | TASK-DV-04 | - | 层级 1 |
| 层级 3 | TASK-DV-05, TASK-DV-06, TASK-DV-07 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-DV-08, TASK-DV-09, TASK-DV-10 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-DV-11, TASK-DV-12 | 顺序执行 | 层级 4 |

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

### [TASK-DV-01] Develop 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
定义 develop 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（26 个字段）、§5.1 DevelopChangeState

#### 输出
- `src/capabilities/develop/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/types.ts`
2. 定义 `DevelopStage` 枚举：`"propose" | "spec" | "design" | "tasks" | "check" | "apply" | "archive" | "unknown"`
3. 定义 `DevelopOptions`：`{ change, propose, spec, design, tasks, check, apply, archive, from, capability, parallel, dryRun, json }`
4. 定义 `StorageLocation`：`{ canonicalRoot, legacyRoot, source }`，source 枚举 `"canonical" | "legacy" | "mixed" | "missing"`
5. 定义 `ProposalMeta`：`{ mode, testStrategy }`，mode 枚举 `"full" | "simple"`，testStrategy 枚举 `"tdd" | "impl-first" | "none"`
6. 定义 `DevelopResult`：`{ change, stage, mode, testStrategy, source, artifacts }`
7. 定义 `DevelopArtifact`：`{ path, type, stage }`
8. 定义 `DevelopIssue`：`{ code, severity, message, suggestion }`
9. 定义 `TasksPolicy`：`{ testStrategy, dagOrder, requireTestBeforeImpl }`
10. 定义 `DevelopChangeState`：`{ change, stage, source, canonicalRoot, legacyRoot, updatedAt }`

#### 验收标准
- [ ] 所有类型与 design.md §1.1 字段追溯表一致
- [ ] `DevelopStage` 包含 8 个枚举值
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表、§5.1 数据模型

---

### [TASK-DV-02] 变更名称校验

- **类型**: 接口层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
实现 `validateChangeName()` 函数，校验 kebab-case 和 3-80 长度。

#### 输入
- `src/capabilities/develop/types.ts`
- design.md §2.2 `change-name.ts`

#### 输出
- `src/capabilities/develop/change-name.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/change-name.ts`
2. 实现 `validateChangeName(name: string): ValidationResult`：
   - 校验 kebab-case 正则：`/^[a-z0-9]+(-[a-z0-9]+)*$/`
   - 校验长度 3-80
   - 不合法返回 `{ valid: false, code: 2501, message, suggestion }`
   - 合法返回 `{ valid: true }`

#### 验收标准
- [ ] 合法 kebab-case 名称通过
- [ ] 非法名称（大写、空格、特殊字符）返回 2501
- [ ] 长度 < 3 或 > 80 返回 2501
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 错误码 2501
- design.md 章节：§2.2 `change-name.ts`

---

### [TASK-DV-03] 阶段标志解析

- **类型**: 接口层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
实现 `resolveRequestedStage()` 函数，解析互斥阶段标志。

#### 输入
- `src/capabilities/develop/types.ts`
- design.md §6.3.1 阶段标志互斥算法

#### 输出
- `src/capabilities/develop/stage-flags.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/stage-flags.ts`
2. 实现 `resolveRequestedStage(options: DevelopOptions): StageResolution`：
   - 收集 `propose/spec/design/tasks/check/apply/archive` 为 `requestedStages`
   - `requestedStages.length > 1` 时返回参数校验错误
   - 单一阶段时返回 `{ stage, explicit: true }`
   - 空时返回 `{ stage: "unknown", explicit: false }`

#### 验收标准
- [ ] 单一阶段标志正确解析
- [ ] 多阶段标志同时出现时返回错误
- [ ] 无阶段标志时返回 `explicit: false`
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（指定单阶段）
- design.md 章节：§6.3.1 阶段标志互斥算法

---

### [TASK-DV-04] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-DV-01, TASK-DV-02, TASK-DV-03
- **状态**: [ ] 未完成

#### 任务描述
编写 develop 模块完整单元测试骨架（红灯状态）。

#### 输入
- 已实现的类型、名称校验、阶段标志模块
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/develop/develop.test.ts`

#### 实现步骤
1. 创建 `test/develop/develop.test.ts`
2. 创建辅助函数：`createTempChangeProject()`（创建含 `.harness/develop/changes/` 的临时项目）
3. 编写 `validateChangeName` 测试骨架（已在 TASK-DV-02 覆盖，此处集成）
4. 编写 `resolveRequestedStage` 测试骨架（已在 TASK-DV-03 覆盖，此处集成）
5. 编写 `resolveDevelopStorage` 测试骨架：
   - `should detect canonical storage`
   - `should detect legacy storage`
   - `should detect mixed storage`
   - `should return missing when neither exists`
6. 编写 `readLegacyOpenSpecChange` 测试骨架：
   - `should read proposal from openspec/changes/`
   - `should read spec/design/tasks from legacy`
   - `should return null when legacy missing`
7. 编写 `readProposalMeta` 测试骨架：
   - `should parse mode and test-strategy from frontmatter`
   - `should return error when frontmatter missing`
   - `should return error when test-strategy invalid`
8. 编写 `buildTasksPolicy` 测试骨架：
   - `should generate TDD policy with test-before-impl`
   - `should generate impl-first policy`
   - `should generate none policy`
9. 编写 `detectDevelopStage` / `suggestNextStage` 测试骨架
10. 编写 `runDevelopCheck` 测试骨架：
    - `should pass when all dependencies satisfied`
    - `should fail with 2502 when proposal missing`
    - `should fail with 2504 when stage dependency missing`
    - `should be read-only (no writes)`
11. 编写 `runDevelopCommand` 测试骨架：
    - `should auto-detect next stage`
    - `should run explicit single stage`
    - `should respect --check (read-only)`
    - `should respect --dry-run (zero writes)`
    - `should return 2503 for unknown capability`
12. 所有测试标记为红灯

#### 验收标准
- [ ] 测试文件可被运行器发现
- [ ] 所有测试处于红灯状态
- [ ] 覆盖 design.md §6.2 状态机所有状态
- [ ] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

### [TASK-DV-05] 存储解析与 Legacy 读取

- **类型**: 接口层
- **依赖**: TASK-DV-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `resolveDevelopStorage()` 和 `readLegacyOpenSpecChange()` 函数。

#### 输入
- `src/capabilities/develop/types.ts`
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/storage-resolver.ts`
- `src/capabilities/develop/legacy-openspec.ts`

#### 实现步骤
1. 创建 `storage-resolver.ts`
2. 实现 `resolveDevelopStorage(cwd, change): StorageLocation`：
   - 检查 `.harness/develop/changes/<change>/` 是否存在
   - 检查 `openspec/changes/<change>/` 是否存在
   - 两者都存在返回 `source: "mixed"`
   - 仅 canonical 返回 `source: "canonical"`
   - 仅 legacy 返回 `source: "legacy"`
   - 都不存在返回 `source: "missing"`
3. 创建 `legacy-openspec.ts`
4. 实现 `readLegacyOpenSpecChange(cwd, change): LegacyChange | null`：
   - 读取 `openspec/changes/<change>/proposal.md`
   - 读取 `openspec/changes/<change>/specs/<capability>/*.md`
   - 不存在返回 `null`
   - 只读，不迁移

#### 验收标准
- [ ] 正确检测 canonical/legacy/mixed/missing
- [ ] Legacy 读取只读，不写入
- [ ] Legacy 不存在时返回 `null`
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（兼容旧 OpenSpec）
- design.md 章节：§2.2 `storage-resolver.ts`、`legacy-openspec.ts`

---

### [TASK-DV-06] Proposal Frontmatter 解析

- **类型**: 接口层
- **依赖**: TASK-DV-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `readProposalMeta()` 函数，读取 proposal 的 mode 和 test-strategy。

#### 输入
- `src/capabilities/develop/types.ts`
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/proposal-frontmatter.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/proposal-frontmatter.ts`
2. 实现 `readProposalMeta(proposalPath: string): ProposalMeta`：
   - 读取 proposal.md 文件
   - 解析 YAML frontmatter（使用 `gray-matter` 或内置解析）
   - 提取 `mode`（`"full" | "simple"`，默认 `"full"`）
   - 提取 `test-strategy`（`"tdd" | "impl-first" | "none"`，默认 `"tdd"`）
   - 转换为 camelCase `testStrategy`
   - frontmatter 缺失或非法时返回错误

#### 验收标准
- [ ] 正确解析 mode 和 test-strategy
- [ ] 缺失时使用默认值
- [ ] 非法值时返回错误
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（TDD 任务策略传递）
- design.md 章节：§2.2 `proposal-frontmatter.ts`、§6.3.3 TDD 任务策略传递算法

---

### [TASK-DV-07] 阶段检测器

- **类型**: 接口层
- **依赖**: TASK-DV-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `detectDevelopStage()` 和 `suggestNextStage()` 函数，根据已有文档判断下一步。

#### 输入
- `src/capabilities/develop/types.ts`
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/stage-detector.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/stage-detector.ts`
2. 实现 `detectDevelopStage(storage, capability?): StageDetection`：
   - 优先检查 canonical root；不存在则读取 legacy root
   - proposal 不存在时建议 `propose`
   - proposal 存在但目标能力 spec 缺失时建议 `spec`
   - spec 存在但 design 缺失时建议 `design`
   - design 存在但 tasks 缺失时建议 `tasks`
   - tasks 存在时建议 `check`
3. 实现 `suggestNextStage(detection: StageDetection): StageSuggestion[]`：
   - 返回建议列表和阻断原因
   - 仅返回建议，不自动触发

#### 验收标准
- [ ] 正确检测缺失文档并建议下一阶段
- [ ] 建议仅返回给用户，不自动触发
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（自动进入下一阶段）
- design.md 章节：§6.3.2 自动下一阶段检测算法

---

### [TASK-DV-08] Tasks 策略构建

- **类型**: 接口层
- **依赖**: TASK-DV-06
- **状态**: [ ] 未完成

#### 任务描述
实现 `buildTasksPolicy()` 函数，将 testStrategy 转换为 tasks DAG 策略。

#### 输入
- `src/capabilities/develop/types.ts`
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/tasks-policy.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/tasks-policy.ts`
2. 实现 `buildTasksPolicy(testStrategy: TestStrategy): TasksPolicy`：
   - `tdd`：测试骨架 → 实现代码 → 测试验证；实现任务依赖测试任务
   - `impl-first`：实现代码 → 测试验证；测试任务依赖实现任务
   - `none`：仅实现代码；不生成测试任务
3. 值缺失或非法时返回可操作错误，不静默降级

#### 验收标准
- [ ] TDD 策略生成测试先行 DAG
- [ ] impl-first 策略生成代码先行 DAG
- [ ] none 策略不生成测试任务
- [ ] 非法值返回错误
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（TDD 策略）
- design.md 章节：§6.3.3 TDD 任务策略传递算法

---

### [TASK-DV-09] 一致性检查器

- **类型**: 接口层
- **依赖**: TASK-DV-05, TASK-DV-06, TASK-DV-07
- **状态**: [ ] 未完成

#### 任务描述
实现 `runDevelopCheck()` 和 `validateStageDependencies()` 函数，只读检查文档一致性。

#### 输入
- 所有已实现的 develop 模块
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/checker.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/checker.ts`
2. 实现 `validateStageDependencies(storage, stage): DevelopIssue[]`：
   - spec 阶段检查 proposal 存在（2502）
   - design 阶段检查 spec 存在（2504）
   - tasks 阶段检查 design 存在（2504）
   - apply 阶段检查 tasks 存在且 check 通过（2504/2505）
3. 实现 `runDevelopCheck(options, storage): CheckResult`：
   - 只读检查 proposal/spec/design/tasks 一致性
   - 校验 capability 存在于 proposal 能力列表（2503）
   - 创建 `ReadonlyEffectGuard`，禁止任何写入
   - 返回问题列表和阻断原因

#### 验收标准
- [ ] 正确检测阶段依赖缺失
- [ ] `--check` 禁止任何写入
- [ ] capability 不存在时返回 2503
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（只读检查）
- design.md 章节：§6.3.4 check 只读保护算法、§8.1 异常分类

---

### [TASK-DV-10] Artifact 写入器与报告

- **类型**: 接口层
- **依赖**: TASK-DV-05, TASK-DV-06, TASK-DV-07
- **状态**: [ ] 未完成

#### 任务描述
实现 `planArtifacts()`、`writeArtifactsTransactionally()`、`buildDevelopReport()` 和 `writeDevelopReport()` 函数。

#### 输入
- `src/capabilities/develop/types.ts`
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/artifact-writer.ts`
- `src/capabilities/develop/report-writer.ts`

#### 实现步骤
1. 创建 `artifact-writer.ts`
2. 实现 `planArtifacts(stage, storage, options): ArtifactPlan`：
   - 根据阶段生成文档写入计划
   - `dryRun=true` 时返回计划但不落盘
3. 实现 `writeArtifactsTransactionally(plan, tx): WriteResult`：
   - 通过 transaction 写入文档
   - `ReadonlyEffectGuard` 存在时返回 2505
   - 失败时 rollback
4. 创建 `report-writer.ts`
5. 实现 `buildDevelopReport(result, issues): DevelopReport`
6. 实现 `writeDevelopReport(report, context): string`：写入 `.harness/reports/develop/`

#### 验收标准
- [ ] `planArtifacts()` 生成正确计划
- [ ] `dryRun=true` 时零写入
- [ ] `writeArtifactsTransactionally()` 通过 transaction 写入
- [ ] 报告写入 `.harness/reports/develop/`
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§2.2 `artifact-writer.ts`、`report-writer.ts`

---

### [TASK-DV-11] Develop 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-DV-08, TASK-DV-09, TASK-DV-10
- **状态**: [ ] 未完成

#### 任务描述
实现 `runDevelopCommand()` 函数，串联 develop pipeline 并输出结果。

#### 输入
- 所有已实现的 develop 模块
- `test/develop/develop.test.ts`

#### 输出
- `src/capabilities/develop/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/develop/command.ts`
2. 实现 `runDevelopCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 `DevelopOptions`
   - `validateChangeName()` 校验 change
   - `resolveRequestedStage()` 校验阶段标志互斥
   - `resolveDevelopStorage()` 扫描存储
   - 需要 proposal 时调用 `readProposalMeta()`
   - `--capability` 时校验存在于 proposal 能力列表
   - 无阶段标志时调用 `detectDevelopStage()`
   - `validateStageDependencies()` 校验上游文档
   - `--check` 走 `runDevelopCheck()`
   - 其他阶段走 `runDevelopStage()`
   - `dryRun=true` 时只返回计划
   - 输出 `DevelopResult`

#### 验收标准
- [ ] 自动检测下一阶段
- [ ] 单阶段标志正确执行
- [ ] `--check` 只读
- [ ] `--dry-run` 零写入
- [ ] 错误码正确（2501-2505、5501）
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Develop CLI）、§6.1 核心流程

---

### [TASK-DV-12] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-DV-11
- **状态**: [ ] 未完成

#### 任务描述
编写并运行集成测试，验证 develop 端到端流程。

#### 输入
- 所有已实现的 develop 模块

#### 输出
- `test/develop/develop-integration.test.ts`

#### 实现步骤
1. 创建 `test/develop/develop-integration.test.ts`
2. 编写端到端场景：
   - 新建 change → propose → spec → design → tasks → check
   - 自动检测下一阶段
   - 单阶段执行（`--spec`）
   - `--check` 只读检查
   - `--dry-run` 零写入
   - Legacy OpenSpec 兼容读取
   - TDD 策略传递到 tasks
   - 非法 change 名称 → 2501
   - Proposal 缺失 → 2502
   - Capability 不存在 → 2503
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
| TASK-DV-02 | 单元测试 | 名称校验（合法/非法/长度） | 正确通过或 2501 |
| TASK-DV-03 | 单元测试 | 阶段标志（单一/多/无） | 正确解析或错误 |
| TASK-DV-05 | 单元测试 | 存储检测（canonical/legacy/mixed/missing） | 正确标记 |
| TASK-DV-05 | 单元测试 | Legacy 读取（存在/不存在） | 正确读取或 null |
| TASK-DV-06 | 单元测试 | Frontmatter 解析（正常/缺失/非法） | 正确解析或错误 |
| TASK-DV-07 | 单元测试 | 阶段检测（各缺失情况） | 正确建议 |
| TASK-DV-08 | 单元测试 | Tasks 策略（tdd/impl-first/none） | 正确 DAG |
| TASK-DV-09 | 单元测试 | Check（通过/失败/只读） | 正确结果 |
| TASK-DV-10 | 单元测试 | Artifact 写入（正常/dry-run/失败） | 正确写入或计划 |
| TASK-DV-11 | 单元测试 | develop 命令全流程 | CliResponse 正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 完整流程 | 空项目 | propose → spec → design → tasks → check | 各阶段文档生成 |
| 自动检测 | 已有 proposal | develop <change> | 建议 spec |
| 单阶段 | 已有 proposal | develop <change> --spec | 只处理 spec |
| Check | 已有文档链 | develop <change> --check | 只读检查 |
| TDD 传递 | proposal test-strategy=tdd | develop <change> --tasks | tasks DAG 测试先行 |
| Legacy 兼容 | openspec/changes/ 存在 | develop <change> | 读取 legacy |

### 4.3 手动验证清单

- [ ] `harness develop my-change --json` 输出合法 JSON
- [ ] `harness develop my-change --check` 只读检查
- [ ] `harness develop my-change --dry-run` 零写入
- [ ] `harness develop my-change --spec` 只处理 spec 阶段

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `Transaction`、canonical storage |
| `harness-inspect` | 其他能力 | 本变更 | ⏳ 待建 | repo facts（design 阶段） |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | 阶段边界、并行安全 |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | apply/archive 检查 |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`StageDetector`、`TasksPolicy`）
- 方法名：camelCase（`detectDevelopStage`、`readProposalMeta`）
- 文件名：kebab-case（`stage-detector.ts`、`proposal-frontmatter.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2501-2505、5501）

### 6.3 日志规范

- 敏感信息处理：文档不得包含明文密钥或外部知识库连接信息

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/develop/types.ts` | 共享类型定义 | TASK-DV-01 |
| `src/capabilities/develop/change-name.ts` | 名称校验 | TASK-DV-02 |
| `src/capabilities/develop/stage-flags.ts` | 阶段标志解析 | TASK-DV-03 |
| `src/capabilities/develop/storage-resolver.ts` | 存储解析 | TASK-DV-05 |
| `src/capabilities/develop/legacy-openspec.ts` | Legacy 读取 | TASK-DV-05 |
| `src/capabilities/develop/proposal-frontmatter.ts` | Frontmatter 解析 | TASK-DV-06 |
| `src/capabilities/develop/stage-detector.ts` | 阶段检测 | TASK-DV-07 |
| `src/capabilities/develop/tasks-policy.ts` | Tasks 策略 | TASK-DV-08 |
| `src/capabilities/develop/checker.ts` | 一致性检查 | TASK-DV-09 |
| `src/capabilities/develop/artifact-writer.ts` | Artifact 写入 | TASK-DV-10 |
| `src/capabilities/develop/report-writer.ts` | 报告写入 | TASK-DV-10 |
| `src/capabilities/develop/command.ts` | develop 命令 handler | TASK-DV-11 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/develop/develop.test.ts` | 单元测试 | TASK-DV-04~11 |
| `test/develop/develop-integration.test.ts` | 集成测试 | TASK-DV-12 |

### 7.3 文档更新

- [ ] README 更新（develop 命令说明）
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
