# 实施任务拆解 - harness-workspace-config

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-workspace-config` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-workspace-config/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-workspace-config/design.md` | 当前能力设计 |

### 1.2 实现范围

- 路径解析工具（`resolveProjectRoot()`、`resolveWorkspacePaths()`，防路径越界）
- 工作区创建与状态检查（`ensureWorkspace()`、`readWorkspaceStatus()`）
- 配置模型与校验（`HarnessConfig` 类型、`loadHarnessConfig()`、`validateHarnessConfig()`、`mergeLocalConfig()`）
- 配置 Schema 校验器（内置最小校验，不依赖外部框架）
- 状态文件管理（`readStateFile()`、`writeStateFile()`）
- 事务写入系统（`beginTransaction()`、`stageWrite()`、`commitTransaction()`、`rollbackTransaction()`）
- 旧来源检测与迁移（`detectLegacySources()`、`buildMigrationPlan()`）
- 3 个命令 handler（`config`、`status`、`doctor`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（原生 `fs`、`path` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse` 类型
- 校验：内置最小 JSON Schema draft-07 校验器
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

| 策略 | 说明 | 拓扑结构 |
|--------|------|------------|
| 测试驱动 | 测试先行 | 测试骨架 → 实现代码 → 测试验证 |

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与路径基础                                          │
│  ┌──────────────┐  ┌──────────────┐                                      │
│  │ TASK-WS-01   │  │ TASK-WS-02   │                                      │
│  │ 类型定义      │  │ 路径解析      │                                      │
│  └──────┬───────┘  └──────┬───────┘                                      │
│         │                 │                                               │
│         v                 v                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-WS-03  单元测试骨架（依赖: 01, 02）                       │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心模块（可并行）                           │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-WS-04   │  │ TASK-WS-05   │  │ TASK-WS-06   │        │   │ │
│  │  │  │ 配置校验      │  │ 状态管理      │  │ 事务系统      │        │   │ │
│  │  │  │ 依赖: 03     │  │ 依赖: 03     │  │ 依赖: 03     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 工作区与迁移（可并行）                │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐                    │   │   │ │
│  │  │  │  │ TASK-WS-07   │  │ TASK-WS-08   │                    │   │   │ │
│  │  │  │  │ 工作区创建    │  │ 旧来源迁移    │                    │   │   │ │
│  │  │  │  │ 依赖: 04,06  │  │ 依赖: 04,06  │                    │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘                    │   │   │ │
│  │  │  │         │                 │                             │   │   │ │
│  │  │  │         v                 v                             │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler                   │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-WS-09   │  │ TASK-WS-10   │              │   │   │   │ │
│  │  │  │  │  │ status+doctor │  │ config命令    │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 07,08  │  │ 依赖: 07,08  │              │   │   │   │ │
│  │  │  │  │  └──────┬───────┘  └──────┬───────┘              │   │   │   │ │
│  │  │  │  │         │                 │                       │   │   │   │ │
│  │  │  │  │         v                 v                       │   │   │   │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │   │   │   │ │
│  │  │  │  │  │  层级 6 (依赖 L5) - 验证                      │ │   │   │   │ │
│  │  │  │  │  │  ┌──────────────┐                            │ │   │   │   │ │
│  │  │  │  │  │  │ TASK-WS-11   │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 集成测试验证  │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 依赖: 09,10  │                            │ │   │   │   │ │
│  │  │  │  │  │  └──────────────┘                            │ │   │   │   │ │
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
| 层级 1 | TASK-WS-01, TASK-WS-02 | ✅ 是 | 无 |
| 层级 2 | TASK-WS-03 | - | 层级 1 |
| 层级 3 | TASK-WS-04, TASK-WS-05, TASK-WS-06 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-WS-07, TASK-WS-08 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-WS-09, TASK-WS-10 | ✅ 是 | 层级 4 |
| 层级 6 | TASK-WS-11 | - | 层级 5 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 数据层 | 类型定义、Schema | 共享类型和数据结构 |
| 接口层 | 核心服务模块 | 业务逻辑和接口 |
| UI层 | 终端展示组件 | 状态/诊断/迁移计划展示 |
| 测试-骨架 | 测试类结构、Mock 设置 | TDD 模式下的测试前置任务 |
| 测试-验证 | 测试用例实现、断言 | 实现后的测试验证任务 |

---

### [TASK-WS-01] 工作区类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
定义 workspace-config 模块共享的 TypeScript 类型，包括 `HarnessConfig`、`WorkspaceStatus`、`WorkspaceRequest`、`MigrationOptions`、`MigrationPlan`、`TransactionRecord` 等。

#### 输入
- design.md §1.1 字段映射表（17 个字段）
- design.md §5.3 文件数据模型

#### 输出
- `src/core/types.ts`：所有共享类型定义

#### 实现步骤
1. 创建 `src/core/types.ts`
2. 定义 `HarnessConfig`：包含 `schemaVersion`、`project`（`{ name, type }`）、`aiTools`（`{ claude, codex, copilot, cursor }`）、`capabilities`（`{ inspect, sync, develop, review, knowledge }`）、`documents`（`{ managed, generatedBlockPrefix }`）、`orchestration`（`{ subagents, maxParallelAgents, validatorRequired }`）、`safety`（`{ dangerousCommandsBlocked, secretPatterns }`）
3. 定义 `WorkspaceRequest`：`{ cwd: string; dryRun: boolean; json: boolean }`
4. 定义 `MigrationOptions`：`{ migrateDocsync: boolean; migrateSdd: boolean; migrateReview: boolean }`
5. 定义 `WorkspaceStatus`：`{ workspace: string; schemaVersion: number | null; initialized: boolean; capabilities: Record<string, boolean> }`
6. 定义 `WorkspacePaths`：`{ root, harness, config, state, facts, generated, adapters, reports, cache, develop }`
7. 定义 `TransactionRecord`：`{ id, status, cwd, operations, createdAt }`
8. 定义 `MigrationPlan`：`{ sources, operations, conflicts, dryRun }`
9. 定义 `ConfigValidationResult`：`{ valid, errors, missing }`

#### 验收标准
- [x] 所有类型与 design.md §1.1 字段追溯表一致
- [x] `HarnessConfig` 包含全部 7 个顶层字段
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义（请求参数、响应结构）
- design.md 章节：§1.1 字段映射表、§5.3 文件数据模型

---

### [TASK-WS-02] 路径解析工具

- **类型**: 接口层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
实现 `resolveProjectRoot()` 和 `resolveWorkspacePaths()` 函数，解析 `--cwd` 并生成 `.harness/**` 完整路径树，防止路径越界。

#### 输入
- design.md §2.2 `src/core/paths.ts`
- `src/core/types.ts` 中的 `WorkspacePaths`

#### 输出
- `src/core/paths.ts`：路径解析模块

#### 实现步骤
1. 创建 `src/core/paths.ts`
2. 实现 `resolveProjectRoot(cwd?: string): string`：
   - 默认使用 `process.cwd()`
   - 解析为绝对路径并规范化
   - 校验目录存在（`fs.existsSync` + `statSync().isDirectory()`）
   - 不存在时抛出错误（code 1002）
3. 实现 `resolveWorkspacePaths(root: string): WorkspacePaths`：
   - 生成 `.harness`、`.harness/config`、`.harness/state`、`.harness/facts`、`.harness/generated`、`.harness/adapters`、`.harness/reports`、`.harness/cache`、`.harness/develop` 路径
4. 实现 `isPathWithinRoot(target: string, root: string): boolean`：防止路径越界（`../` 攻击）
5. 实现 `isWritablePath(target: string, paths: WorkspacePaths): boolean`：只允许写入 `.harness/**` 和平台必需投影路径

#### 验收标准
- [x] `resolveProjectRoot()` 对不存在路径抛出错误
- [x] `resolveProjectRoot()` 返回规范化的绝对路径
- [x] `resolveWorkspacePaths()` 返回完整路径树
- [x] `isPathWithinRoot()` 拒绝 `../` 越界路径
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（初始化工作区）
- design.md 章节：§2.2 `src/core/paths.ts`、§6.3 关键算法

---

### [TASK-WS-03] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-WS-01, TASK-WS-02
- **状态**: [x] 已完成

#### 任务描述
编写 workspace-config 模块的完整单元测试骨架（红灯状态），覆盖配置校验、事务系统、工作区创建、旧来源迁移等核心场景。

#### 输入
- `src/core/types.ts` 类型定义
- `src/core/paths.ts` 路径工具
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/core/workspace-config.test.ts`：单元测试骨架

#### 实现步骤
1. 创建 `test/core/workspace-config.test.ts`
2. 创建测试辅助函数：`createTempProject()`（创建临时目录模拟项目）、`cleanupTempProject()`
3. 编写 `validateHarnessConfig` 测试骨架：
   - `should accept valid config with all required fields`
   - `should reject config missing schemaVersion`
   - `should reject config missing project`
   - `should reject config with wrong schemaVersion type`
   - `should return missing field list in error`
4. 编写 `loadHarnessConfig` / `mergeLocalConfig` 测试骨架：
   - `should load valid config from .harness/config/`
   - `should merge local config overrides`
   - `should not include local values in reportableConfig`
   - `should fail when config file missing`
5. 编写 `Transaction` 测试骨架：
   - `should create transaction with unique id`
   - `should stage write operations`
   - `should commit all staged writes`
   - `should rollback on failure`
   - `should respect dry-run (zero writes)`
   - `should reject writes outside .harness/`
6. 编写 `ensureWorkspace` 测试骨架：
   - `should create .harness/ directory structure`
   - `should write harness.config.json and install.json`
   - `should return planned operations in dry-run`
   - `should rollback on partial failure`
7. 编写 `detectLegacySources` / `buildMigrationPlan` 测试骨架：
   - `should detect .docsync/ when present`
   - `should detect openspec/changes/ when present`
   - `should build migration plan with copy operations`
   - `should detect conflicts when target exists`
   - `should return empty plan when no legacy sources`
8. 编写 `runStatusCommand` / `runDoctorCommand` / `runConfigCommand` 测试骨架
9. 所有测试标记为红灯

#### 验收标准
- [x] 测试文件可被运行器发现
- [x] 所有测试处于红灯状态
- [x] 覆盖 design.md §6.1 核心流程所有分支
- [x] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§6.2 状态机、§8.1 异常分类

---

### [TASK-WS-04] 配置校验与加载

- **类型**: 接口层
- **依赖**: TASK-WS-03
- **状态**: [x] 已完成

#### 任务描述
实现 `validateHarnessConfig()`、`loadHarnessConfig()`、`writeHarnessConfig()` 和 `mergeLocalConfig()` 函数，使配置相关测试通过。

#### 输入
- `src/core/types.ts` 中的 `HarnessConfig`、`ConfigValidationResult`
- `test/core/workspace-config.test.ts` 中的配置测试用例

#### 输出
- `src/core/config-schema.ts`：配置校验器
- `src/core/config.ts`：配置加载/写入/合并

#### 实现步骤
1. 创建 `src/core/config-schema.ts`
2. 实现 `validateHarnessConfig(config: unknown): ConfigValidationResult`：
   - 校验 `schemaVersion`（number, 必须为 1）
   - 校验 `project`（object, 含 `name`、`type`）
   - 校验 `aiTools`（object）
   - 校验 `capabilities`（object, 含 inspect/sync/develop/review/knowledge）
   - 校验 `documents`（object）
   - 校验 `orchestration`（object）
   - 校验 `safety`（object）
   - 返回 `{ valid, errors, missing }`
3. 创建 `src/core/config.ts`
4. 实现 `loadHarnessConfig(cwd: string): HarnessConfig`：读取 `.harness/config/harness.config.json`，调用 `validateHarnessConfig()`，失败抛出 2101
5. 实现 `writeHarnessConfig(cwd: string, config: HarnessConfig, tx: Transaction): void`：通过 transaction 写入
6. 实现 `mergeLocalConfig(cwd: string, config: HarnessConfig): { effectiveConfig, reportableConfig }`：
   - 查找 `.harness/config/*.local.json`
   - 只允许覆盖预声明的运行字段
   - `reportableConfig` 不含 local 值

#### 验收标准
- [x] `validateHarnessConfig()` 对有效配置返回 `{ valid: true }`
- [x] `validateHarnessConfig()` 对缺失字段返回 `missing` 列表
- [x] `loadHarnessConfig()` 读取并校验配置
- [x] `mergeLocalConfig()` 产出 `effectiveConfig` 和 `reportableConfig`
- [x] 配置相关测试全部绿灯

#### 关联设计
- spec.md 章节：§1 场景（读取有效配置、本地私有配置）
- design.md 章节：§4.2 接口 1、§6.3 Local config 合并算法

---

### [TASK-WS-05] 状态文件管理

- **类型**: 接口层
- **依赖**: TASK-WS-03
- **状态**: [x] 已完成

#### 任务描述
实现 `readStateFile()` 和 `writeStateFile()` 函数，管理 `.harness/state/*.json` 文件。

#### 输入
- `src/core/types.ts` 中的类型定义
- `test/core/workspace-config.test.ts` 中的状态管理测试用例

#### 输出
- `src/core/state.ts`：状态文件管理模块

#### 实现步骤
1. 创建 `src/core/state.ts`
2. 实现 `readStateFile(paths: WorkspacePaths, name: string): object | null`：
   - 读取 `.harness/state/{name}.json`
   - 文件不存在返回 `null`
   - 校验 `schemaVersion` 字段存在
3. 实现 `writeStateFile(paths: WorkspacePaths, name: string, data: object, tx: Transaction): void`：
   - 自动注入 `schemaVersion: 1`
   - 通过 transaction 写入
4. 预定义状态文件名常量：`INSTALL_STATE`、`FACTS_STATE`、`ACTIVE_CHANGE_STATE`、`CAPABILITIES_STATE`

#### 验收标准
- [x] `readStateFile()` 对不存在文件返回 `null`
- [x] `readStateFile()` 读取有效 JSON 并校验 `schemaVersion`
- [x] `writeStateFile()` 自动注入 `schemaVersion`
- [x] `writeStateFile()` 通过 transaction 写入
- [x] 状态管理测试全部绿灯

#### 关联设计
- spec.md 章节：§4.3 数据存储
- design.md 章节：§5.3 文件数据模型

---

### [TASK-WS-06] 事务写入系统

- **类型**: 接口层
- **依赖**: TASK-WS-03
- **状态**: [x] 已完成

#### 任务描述
实现 `beginTransaction()`、`stageWrite()`、`commitTransaction()` 和 `rollbackTransaction()` 函数，提供 dry-run、backup、原子写入和回滚能力。

#### 输入
- `src/core/types.ts` 中的 `TransactionRecord`
- `src/core/paths.ts` 中的 `isPathWithinRoot()`
- `test/core/workspace-config.test.ts` 中的事务测试用例

#### 输出
- `src/core/transaction.ts`：事务写入模块

#### 实现步骤
1. 创建 `src/core/transaction.ts`
2. 实现 `beginTransaction(cwd: string): Transaction`：
   - 生成唯一 transaction id（`txn_{timestamp}_{random}`）
   - 初始化空 staged operations 列表
   - 设置 status 为 `"pending"`
3. 实现 `stageWrite(tx: Transaction, path: string, content: string | Buffer): void`：
   - 校验 path 在允许写入边界内（使用 `isPathWithinRoot`）
   - 若目标文件存在，记录 backup operation
   - 若不存在，记录 create operation
   - 将 operation 加入 staged 列表
4. 实现 `commitTransaction(tx: Transaction): TransactionRecord`：
   - `dryRun=true` 时只返回 planned operations，不执行 fs 写入
   - 按顺序执行：目录创建 → 备份 → 写入
   - 任一步失败，自动调用 `rollbackTransaction()`
   - 成功时设置 status 为 `"committed"`
5. 实现 `rollbackTransaction(tx: Transaction): TransactionRecord`：
   - 按相反顺序恢复 backup 或删除新建文件
   - rollback 失败时设置 status 为 `"failed"`，返回 5101
6. 实现 `getTransactionRecord(tx: Transaction): TransactionRecord`

#### 验收标准
- [x] `beginTransaction()` 生成唯一 id
- [x] `stageWrite()` 拒绝越界路径
- [x] `commitTransaction()` dry-run 时零写入
- [x] `commitTransaction()` 成功写入所有 staged 文件
- [x] `rollbackTransaction()` 恢复所有备份
- [x] 事务相关测试全部绿灯

#### 关联设计
- spec.md 章节：§1 场景（事务成功、事务失败）
- design.md 章节：§6.3 Transaction 写入算法

---

### [TASK-WS-07] 工作区创建与状态检查

- **类型**: 接口层
- **依赖**: TASK-WS-04, TASK-WS-06
- **状态**: [x] 已完成

#### 任务描述
实现 `ensureWorkspace()` 和 `readWorkspaceStatus()` 函数，创建 `.harness/` 目录结构并检查初始化状态。

#### 输入
- `src/core/paths.ts` 中的 `resolveWorkspacePaths()`
- `src/core/config.ts` 中的 `writeHarnessConfig()`
- `src/core/transaction.ts`
- `test/core/workspace-config.test.ts` 中的工作区测试用例

#### 输出
- `src/core/workspace.ts`：工作区管理模块

#### 实现步骤
1. 创建 `src/core/workspace.ts`
2. 实现 `ensureWorkspace(request: WorkspaceRequest, initialConfig: HarnessConfig): EnsureWorkspaceResult`：
   - 调用 `resolveWorkspacePaths(request.cwd)`
   - 创建 transaction
   - stage 目录创建：config、state、facts、generated、adapters、reports、cache、develop
   - stage 文件写入：`harness.config.json`、`install.json`
   - `dryRun=true` 时返回 planned operations
   - 非 dry-run 时 commit transaction
   - 失败时 rollback 并返回 2103
3. 实现 `readWorkspaceStatus(paths: WorkspacePaths): WorkspaceStatus`：
   - 检查 `.harness/config/harness.config.json` 是否存在
   - 存在则读取并返回 `initialized: true`、`schemaVersion`、`capabilities`
   - 不存在则返回 `initialized: false`

#### 验收标准
- [x] `ensureWorkspace()` 创建完整 `.harness/` 目录结构
- [x] `ensureWorkspace()` dry-run 时零写入
- [x] `ensureWorkspace()` 失败时自动 rollback
- [x] `readWorkspaceStatus()` 正确判断初始化状态
- [x] 工作区相关测试全部绿灯

#### 关联设计
- spec.md 章节：§1 场景（初始化工作区）
- design.md 章节：§4.2 接口 2（工作区创建）

---

### [TASK-WS-08] 旧来源检测与迁移

- **类型**: 接口层
- **依赖**: TASK-WS-04, TASK-WS-06
- **状态**: [x] 已完成

#### 任务描述
实现 `detectLegacySources()` 和 `buildMigrationPlan()` 函数，识别旧来源目录并生成迁移计划。

#### 输入
- `src/core/paths.ts`、`src/core/transaction.ts`
- `test/core/workspace-config.test.ts` 中的迁移测试用例

#### 输出
- `src/core/legacy-sources.ts`：旧来源检测与迁移模块

#### 实现步骤
1. 创建 `src/core/legacy-sources.ts`
2. 定义旧来源映射：
   - `.docsync/` → `.harness/rules/imported/docsync`
   - `openspec/changes/**` → `.harness/develop/changes`
   - `.kld-review/` → `.harness/reports/imported/kld-review`
   - `skywalk-sdd/` → `.harness/develop/imported/skywalk-sdd`
3. 实现 `detectLegacySources(cwd: string): LegacySource[]`：
   - 检查每个旧来源路径是否存在
   - 返回存在的旧来源列表（含路径、类型、文件数）
4. 实现 `buildMigrationPlan(cwd: string, options: MigrationOptions): MigrationPlan`：
   - 根据 migrate flags 筛选要迁移的来源
   - 生成 copy operations（`{ type, from, to }`）
   - 检测目标路径冲突
   - 存在不可自动合并冲突时标记 `conflicts`
5. 实现 `applyMigrationPlan(plan: MigrationPlan, tx: Transaction): void`：
   - 通过 transaction 执行 copy/write
   - 失败时 rollback

#### 验收标准
- [x] `detectLegacySources()` 正确识别存在的旧目录
- [x] `buildMigrationPlan()` 生成正确的 copy operations
- [x] `buildMigrationPlan()` 检测目标冲突
- [x] `applyMigrationPlan()` 通过 transaction 执行
- [x] 迁移相关测试全部绿灯

#### 关联设计
- spec.md 章节：§1 场景（兼容旧目录）
- design.md 章节：§4.2 接口 3（迁移计划与执行）

---

### [TASK-WS-09] status 与 doctor 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-WS-07, TASK-WS-08
- **状态**: [x] 已完成

#### 任务描述
实现 `runStatusCommand()` 和 `runDoctorCommand()` 函数，输出工作区状态和诊断信息。

#### 输入
- `src/core/workspace.ts`、`src/core/config.ts`、`src/core/legacy-sources.ts`
- `test/core/workspace-config.test.ts` 中的命令测试用例

#### 输出
- `src/commands/status.ts`：status 命令 handler
- `src/commands/doctor.ts`：doctor 命令 handler

#### 实现步骤
1. 创建 `src/commands/status.ts`
2. 实现 `runStatusCommand(context: CommandContext): Promise<CliResponse>`：
   - 从 context 获取 cwd
   - 调用 `resolveWorkspacePaths(cwd)`
   - 调用 `readWorkspaceStatus(paths)`
   - 返回 `CliResponse`（code 0，data 含 workspace、schemaVersion、initialized、capabilities）
   - 不输出 `*.local.json` 内容
3. 创建 `src/commands/doctor.ts`
4. 实现 `runDoctorCommand(context: CommandContext): Promise<CliResponse>`：
   - 检查 `.harness/` 目录完整性（必要子目录是否存在）
   - 检查配置有效性（`validateHarnessConfig`）
   - 检测 legacy sources 状态
   - 检查 `.gitignore` 是否包含 `*.local.json` 和 `.harness/cache/**`
   - 返回诊断结果和修复建议

#### 验收标准
- [x] `runStatusCommand()` 返回正确的 `WorkspaceStatus`
- [x] `runStatusCommand()` 不暴露 local config 值
- [x] `runDoctorCommand()` 检查目录完整性
- [x] `runDoctorCommand()` 检查配置有效性
- [x] `runDoctorCommand()` 检测 legacy sources
- [x] 命令测试全部绿灯

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§4.2 接口 1（工作区状态查询）

---

### [TASK-WS-10] config 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-WS-07, TASK-WS-08
- **状态**: [x] 已完成

#### 任务描述
实现 `runConfigCommand()` 函数，处理 `harness config --migrate-*` 请求（预览或执行迁移）。

#### 输入
- `src/core/legacy-sources.ts`、`src/core/transaction.ts`
- `test/core/workspace-config.test.ts` 中的 config 命令测试用例

#### 输出
- `src/commands/config.ts`：config 命令 handler

#### 实现步骤
1. 创建 `src/commands/config.ts`
2. 实现 `runConfigCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 migrate flags（`migrateDocsync`、`migrateSdd`、`migrateReview`）
   - 至少一个 flag 为 true，否则返回参数错误
   - 调用 `detectLegacySources(cwd)`
   - 调用 `buildMigrationPlan(cwd, options)`
   - `dryRun=true` 时返回迁移计划（code 0）
   - 非 dry-run 时调用 `applyMigrationPlan(plan, tx)`
   - 冲突时返回 2104
   - 成功时返回 transaction record

#### 验收标准
- [x] 无 migrate flag 时返回参数错误
- [x] dry-run 时返回迁移计划且零写入
- [x] 非 dry-run 时通过 transaction 执行迁移
- [x] 冲突时返回 code 2104
- [x] config 命令测试全部绿灯

#### 关联设计
- spec.md 章节：§1 场景（事务成功、事务失败、兼容旧目录）
- design.md 章节：§4.2 接口 3（迁移计划与执行）

---

### [TASK-WS-11] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-WS-09, TASK-WS-10
- **状态**: [x] 已完成

#### 任务描述
编写并运行集成测试，验证 workspace-config 端到端流程；执行构建和 lint 验证。

#### 输入
- 所有已实现的 workspace-config 模块

#### 输出
- `test/core/workspace-config-integration.test.ts`：集成测试

#### 实现步骤
1. 创建 `test/core/workspace-config-integration.test.ts`
2. 编写端到端场景：
   - 初始化工作区 → 读取状态 → 验证 initialized
   - 初始化 → 修改配置 → 重新读取 → 验证变更
   - 初始化 → 创建旧目录 → 检测 legacy → 迁移 dry-run → 迁移执行
   - 初始化 → 删除配置 → doctor → 验证诊断
   - 事务失败 → 验证 rollback
3. 运行 `npx vitest run`：所有测试通过
4. 运行 `npx tsc --noEmit`：无类型错误
5. 运行 lint：无错误

#### 验收标准
- [x] 所有集成测试通过
- [x] 所有单元测试通过
- [x] `npx tsc --noEmit` 无错误
- [x] lint 无错误
- [x] 测试覆盖率 ≥ 80%

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-WS-04 | 单元测试 | 配置校验（有效/缺失字段/类型错误） | `valid`、`missing` 列表正确 |
| TASK-WS-04 | 单元测试 | 配置加载与 local 合并 | `effectiveConfig` 和 `reportableConfig` 分离 |
| TASK-WS-05 | 单元测试 | 状态文件读写 | 读取返回 data/null，写入注入 schemaVersion |
| TASK-WS-06 | 单元测试 | 事务创建/stage/commit/rollback | 操作正确执行，越界拒绝 |
| TASK-WS-06 | 单元测试 | dry-run 零写入 | fs 无变更 |
| TASK-WS-07 | 单元测试 | 工作区创建与状态检查 | 目录结构完整，状态正确 |
| TASK-WS-08 | 单元测试 | 旧来源检测与迁移计划 | 来源识别正确，冲突检测正确 |
| TASK-WS-09 | 单元测试 | status/doctor 命令 | 输出格式正确 |
| TASK-WS-10 | 单元测试 | config 迁移命令 | dry-run/执行/冲突处理正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 完整初始化流程 | 空临时目录 | ensureWorkspace → readStatus | initialized=true |
| 配置修改与重读 | 已初始化 | writeConfig → loadConfig | 配置变更生效 |
| 迁移 dry-run | 已初始化 + .docsync/ 存在 | config --migrate-docsync --dry-run | 返回计划，零写入 |
| 迁移执行 | 已初始化 + .docsync/ 存在 | config --migrate-docsync | 文件复制到 .harness/ |
| 事务回滚 | 已初始化 | 模拟写入失败 | rollback 恢复原状态 |
| doctor 诊断 | 已初始化但配置损坏 | doctor | 返回 2101 + 修复建议 |

### 4.3 手动验证清单

- [x] 在临时目录执行初始化后 `.harness/` 结构完整
- [x] `harness status --json` 输出合法 JSON
- [x] `harness doctor --json` 输出诊断信息
- [x] `harness config --migrate-docsync --dry-run` 输出迁移计划
- [x] 事务失败后 backup 文件可用于人工恢复

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext`、`CliResponse` 类型 |
| `harness-adapter-skill-runtime` | 其他能力 | 本变更 | ⏳ 待建 | adapter 源目录读取 |
| `harness-develop` | 其他能力 | 本变更 | ⏳ 待建 | develop storage path |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | safety config 读取 |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path/JSON |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | ignored 文件检测 |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`Transaction`、`HarnessConfig`）
- 方法名：camelCase（`ensureWorkspace`、`loadHarnessConfig`、`beginTransaction`）
- 变量名：camelCase（`workspacePaths`、`effectiveConfig`）
- 常量：UPPER_SNAKE_CASE（`INSTALL_STATE`、`SCHEMA_VERSION`）
- 文件名：kebab-case（`config-schema.ts`、`legacy-sources.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式，所有导出函数必须有注释
- 异常处理：使用 `HarnessCliError` 体系（code 2101-2104、5101）
- 模块风格：ESM

### 6.3 日志规范

- 日志级别：诊断信息写 `stderr`，结果写 `stdout`
- 日志格式：JSON 模式下所有信息进入 `CliResponse`
- 敏感信息处理：`*.local.json` 不进入报告和 cache

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/core/types.ts` | 共享类型定义 | TASK-WS-01 |
| `src/core/paths.ts` | 路径解析工具 | TASK-WS-02 |
| `src/core/config-schema.ts` | 配置校验器 | TASK-WS-04 |
| `src/core/config.ts` | 配置加载/写入/合并 | TASK-WS-04 |
| `src/core/state.ts` | 状态文件管理 | TASK-WS-05 |
| `src/core/transaction.ts` | 事务写入系统 | TASK-WS-06 |
| `src/core/workspace.ts` | 工作区创建/检查 | TASK-WS-07 |
| `src/core/legacy-sources.ts` | 旧来源检测/迁移 | TASK-WS-08 |
| `src/commands/status.ts` | status 命令 handler | TASK-WS-09 |
| `src/commands/doctor.ts` | doctor 命令 handler | TASK-WS-09 |
| `src/commands/config.ts` | config 命令 handler | TASK-WS-10 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/core/workspace-config.test.ts` | 单元测试 | TASK-WS-03~10 |
| `test/core/workspace-config-integration.test.ts` | 集成测试 | TASK-WS-11 |

### 7.3 文档更新

- [x] README 更新（工作区结构说明）
- [x] 接口文档更新（config/status/doctor 命令）
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
