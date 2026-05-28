# 局部技术实现方案 - harness-workspace-config

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **⚠️ 边界声明**：本设计仅服务于当前 Capability，严禁越权设计或覆盖其他模块逻辑。
>
> **【质量红线】专注"本业务如何落地"；严禁写入全局中间件或框架选型；必须为任务拆解提供足够局部细节

---

## 1. 字段完整性追溯表

> **⛔ 核心红线**：用户在 Spec 中输入的所有字段必须在此表中体现，严禁无故丢弃！

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `--cwd` | `WorkspaceRequest.cwd` | path/string | ✅ 保留 | 所有 workspace、config、status、doctor 操作的项目根目录 |
| 2 | `--migrate-docsync` | `MigrationOptions.migrateDocsync` | boolean | ⚠️ 重命名 | CLI 参数转为 camelCase 内部字段 |
| 3 | `--migrate-sdd` | `MigrationOptions.migrateSdd` | boolean | ⚠️ 重命名 | CLI 参数转为 camelCase 内部字段 |
| 4 | `--migrate-review` | `MigrationOptions.migrateReview` | boolean | ⚠️ 重命名 | CLI 参数转为 camelCase 内部字段 |
| 5 | `--dry-run` | `WorkspaceRequest.dryRun` | boolean | ⚠️ 重命名 | 全局 dry-run 语义进入 workspace 写入与迁移计划 |
| 6 | `--json` | `WorkspaceRequest.json` | boolean | ✅ 保留 | 控制 status/config/doctor 的 JSON 输出 |
| 7 | `workspace` | `WorkspaceStatus.workspace` | string | ✅ 保留 | 对外报告 `.harness` 工作区路径 |
| 8 | `schemaVersion` | `HarnessConfig.schemaVersion` | number | ✅ 保留 | 主配置版本和迁移判断字段 |
| 9 | `initialized` | `WorkspaceStatus.initialized` | boolean | ✅ 保留 | 判断是否已初始化 |
| 10 | `capabilities` | `HarnessConfig.capabilities` | object | ✅ 保留 | 记录 inspect/sync/develop/review/knowledge 等能力开关 |
| 11 | `project` | `HarnessConfig.project` | object | ✅ 保留 | 记录项目名称和项目类型 |
| 12 | `aiTools` | `HarnessConfig.aiTools` | object | ✅ 保留 | 记录 Claude、Codex、Copilot、Cursor 选择 |
| 13 | `documents` | `HarnessConfig.documents` | object | ✅ 保留 | 记录 managed 文档和 generated block 前缀 |
| 14 | `orchestration` | `HarnessConfig.orchestration` | object | ✅ 保留 | 记录 subagent 与 validator 策略 |
| 15 | `safety` | `HarnessConfig.safety` | object | ✅ 保留 | 记录危险命令和敏感文件模式 |
| 16 | `path` | `ConfigValidationError.path` | string | ✅ 保留 | 配置错误响应中的问题文件路径 |
| 17 | `missing` | `ConfigValidationError.missing` | string[] | ✅ 保留 | 配置错误响应中的缺失字段列表 |

**状态说明**：
- ✅ 保留：字段名和类型与用户输入一致
- ⚠️ 重命名：字段重命名（必须说明理由）
- 🔀 合并：多字段合并为一个（必须说明理由）
- ❌ 移除：字段被移除（必须有充分理由且经用户确认）

### 1.2 完整性自检

- **用户输入字段总数**：17 个
- **设计输出字段总数**：17 个
- **差异说明**：CLI flag 使用 camelCase 内部字段；对外 JSON 仍保持 spec 中的字段语义
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

> **⚠️ 重要**：大多数需求是在已有系统上改造/扩展，不是从零开始。
> AI 无法知道“要改哪里”，如果本 Capability 涉及对现有代码的修改，**请用户补充完整**。
> 纯新建项目可跳过此章节。

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无 | 无 | 无 | 纯新建 | 当前工作区未发现 `package.json`、`src/`、`bin/`、`lib/` 或 `dist`，本 Capability 不修改现有代码 |

**修改类型说明**：
- 扩展逻辑：在现有方法中添加新逻辑分支
- 新增参数：修改方法签名或请求/响应结构
- 重构抽取：抽取公共逻辑为新方法
- 替换实现：用新实现替换原有逻辑

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/core/paths.ts` | `resolveProjectRoot()` / `resolveWorkspacePaths()` | 解析 `--cwd`、规范化 `.harness/**` 与投影允许路径 | Path utility | 必须防止路径越界 |
| `src/core/workspace.ts` | `ensureWorkspace()` / `readWorkspaceStatus()` | 创建和检查 `.harness/` 目录结构 | Workspace service | 支持 dry-run 计划 |
| `src/core/config.ts` | `loadHarnessConfig()` / `writeHarnessConfig()` / `mergeLocalConfig()` | 读取、校验、写入主配置和本地覆盖配置 | Config service | 禁止把 `*.local.json` 纳入报告内容 |
| `src/core/config-schema.ts` | `validateHarnessConfig()` | 校验 `schemaVersion`、`project`、`aiTools` 等必填字段 | Schema validator | 第一版使用内置最小校验，不依赖复杂外部框架 |
| `src/core/state.ts` | `readStateFile()` / `writeStateFile()` | 管理 `.harness/state/*.json` | State repository | 所有状态文件必须带 `schemaVersion` |
| `src/core/transaction.ts` | `beginTransaction()` / `stageWrite()` / `commitTransaction()` / `rollbackTransaction()` | dry-run、backup、原子写入、回滚 | Transaction service | 写文件能力的公共基础 |
| `src/core/legacy-sources.ts` | `detectLegacySources()` / `buildMigrationPlan()` | 识别 `.docsync/`、`openspec/changes/**`、`.kld-review/`、`skywalk-sdd/` | Legacy source scanner | 默认只读，迁移需显式参数 |
| `src/commands/config.ts` | `runConfigCommand()` | 处理 `harness config --migrate-*` 与 repair 类请求 | Command handler | 仅负责 workspace/config 范围 |
| `src/commands/status.ts` | `runStatusCommand()` | 输出 initialized、workspace、schemaVersion、capabilities | Command handler | 只读 |
| `src/commands/doctor.ts` | `runDoctorCommand()` | 检查工作区完整性、配置有效性、legacy source 状态 | Command handler | 只读，报告修复建议 |
| `test/core/workspace-config.test.ts` | workspace/config tests | 验证初始化、配置校验、dry-run、rollback、legacy detection | Node test suite | TDD 阶段先写红灯测试 |

### 2.3 现有逻辑约束

> 影响本次设计的现有系统约束（如：已有事务边界、线程模型、日志规范、已有设计模式等）

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 当前仓库是 SDD 文档工作区 | 已存在 `.agents/`、`.claude/`、`.codex/`、`.docsync/`、`openspec/`、`skywalk-sdd/`，未发现源码包 | workspace/config 属于纯新建模块，但必须兼容旧目录 | 默认只读识别旧目录，不自动迁移 |
| 根目录最小化 | proposal 要求 Harness 自有产物进入 `.harness/` | 设计必须限制根目录写入 | `resolveWorkspacePaths()` 只允许 `.harness/**` 与平台必需投影路径 |
| 本地私有配置不可泄露 | spec 明确 `*.local.json` 不进入报告/cache/发布包 | 配置读取需要区分有效运行值和可报告值 | `mergeLocalConfig()` 返回 `effectiveConfig` 与 `reportableConfig` |
| 所有写入走 transaction | spec 要求 dry-run、backup、rollback | 不能直接使用零散 fs write | 所有写入通过 `Transaction` 对象 |
| 旧来源目录可读取不可默认迁移 | spec 要求 `.docsync/` 等兼容读取 | 迁移必须显式且可 dry-run | `buildMigrationPlan()` 只生成计划，commit 需非 dry-run 且用户确认 |

---

## 3. 局部前端设计

> 仅针对当前 Capability 的前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `WorkspaceStatusView` | 终端展示 | 展示 initialized、workspace path、schemaVersion、capabilities 摘要 | `WorkspaceStatus` |
| `ConfigValidationView` | 终端展示 | 展示配置缺失字段、类型错误和修复建议 | `ConfigValidationResult` |
| `MigrationPlanView` | 终端展示 | 展示 legacy source、目标路径、冲突和 dry-run 写入计划 | `MigrationPlan` |
| `DoctorWorkspaceView` | 终端展示 | 展示工作区目录完整性、ignored 状态和 transaction 健康状态 | `DoctorResult` |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `workspaceStatus.initialized` | boolean | `false` | `readWorkspaceStatus()` 检测主配置后更新 |
| `workspaceStatus.schemaVersion` | number/null | `null` | 成功读取配置后更新 |
| `configValidation.errors` | string[] | `[]` | `validateHarnessConfig()` 执行后更新 |
| `migrationPlan.conflicts` | object[] | `[]` | `buildMigrationPlan()` 检测目标冲突后更新 |
| `transaction.status` | `"pending" \| "committed" \| "rolled_back" \| "failed"` | `"pending"` | transaction 生命周期变化时更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness status` | `WorkspaceStatusView` | 本地读权限 | 只读输出工作区状态 |
| `CLI: harness doctor` | `DoctorWorkspaceView` / `ConfigValidationView` | 本地读权限 | 检查目录、配置、legacy source、ignored 状态 |
| `CLI: harness config --migrate-* --dry-run` | `MigrationPlanView` | 本地读权限 | 只输出迁移计划 |
| `CLI: harness config --migrate-*` | `MigrationPlanView` | 本地读写权限 | 执行显式迁移并记录 transaction |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 查看状态 | `readWorkspaceStatus(request)` | `--cwd`、`--json` | 展示 `.harness` 是否初始化、schemaVersion、capabilities |
| 初始化工作区 | `ensureWorkspace(request, initialConfig)` | `cwd`、`dryRun`、初始化答案 | dry-run 输出目录/文件计划；非 dry-run 写入并返回 transaction |
| 校验配置 | `loadHarnessConfig(cwd)` + `validateHarnessConfig(config)` | `cwd` | 成功返回有效配置；失败返回 2101 |
| 预览迁移 | `buildMigrationPlan(cwd, options)` | migrate flags、dryRun | 输出来源、目标、冲突、预计写入 |
| 执行迁移 | `applyMigrationPlan(plan, transaction)` | migration plan | 成功提交 transaction；失败 rollback |

---

## 4. 局部后端接口设计

> 仅针对当前 Capability 的接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 状态查询 | `CLI: harness status` | 本地进程调用 | 读取 `.harness/` 初始化状态和能力摘要 |
| 工作区诊断 | `CLI: harness doctor` | 本地进程调用 | 校验目录、配置、legacy source、ignored 策略 |
| 配置迁移 | `CLI: harness config --migrate-*` | 本地进程调用 | 预览或执行旧来源目录迁移 |
| 工作区服务 | `ensureWorkspace()` | 函数调用 | 创建 `.harness/` 目录和主配置 |
| Transaction 服务 | `beginTransaction()` | 函数调用 | 管理写入、备份、提交和回滚 |

### 4.2 接口详细设计

#### 接口 1：工作区状态查询

**基本信息**：
- 路径：`CLI: harness status`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--cwd` | path/string | 否 | 目标项目根目录 | 必须是存在目录 |
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "workspace": ".harness",
    "schemaVersion": 1,
    "initialized": true,
    "capabilities": {
      "inspect": true,
      "sync": true,
      "develop": true,
      "review": true,
      "knowledge": false
    }
  }
}
```

**业务逻辑**：
1. `runStatusCommand()` 从 `CommandContext` 获取 `cwd`。
2. 调用 `resolveWorkspacePaths(cwd)` 获取 `.harness`、config、state、reports 等路径。
3. 调用 `readWorkspaceStatus(paths)` 判断主配置是否存在。
4. 若存在主配置，调用 `loadHarnessConfig()` 和 `validateHarnessConfig()`。
5. 输出 `WorkspaceStatus`，不得包含 `*.local.json` 的具体内容。

#### 接口 2：工作区创建

**基本信息**：
- 路径：`Function: ensureWorkspace(request, initialConfig)`
- 方法：函数调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | path/string | 是 | 目标项目根目录 | 必须存在且可写 |
| `dryRun` | boolean | 是 | 是否只预览 | 为 true 时写入文件数量必须为 0 |
| `initialConfig` | HarnessConfig | 是 | 初始主配置 | 必须通过 schemaVersion=1 校验 |

**响应结构**：
```json
{
  "workspace": ".harness",
  "created": [
    ".harness/config/harness.config.json",
    ".harness/state/install.json"
  ],
  "transactionId": "txn_20260528_001",
  "dryRun": false
}
```

**业务逻辑**：
1. 调用 `resolveWorkspacePaths()` 得到目录清单。
2. 创建 transaction，并将目录创建和文件写入作为 staged operations。
3. 写入 `.harness/config/harness.config.json`、`.harness/state/install.json`、必要 `.gitignore` 建议。
4. `dryRun=true` 时只返回 planned operations。
5. 任一写入失败时调用 rollback，并返回 2103 或 5101。

#### 接口 3：迁移计划与执行

**基本信息**：
- 路径：`CLI: harness config --migrate-docsync|--migrate-sdd|--migrate-review`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--migrate-docsync` | boolean | 否 | 迁移 `.docsync/` | 至少一个 migrate flag 为 true |
| `--migrate-sdd` | boolean | 否 | 迁移旧 SDD 文档 | 至少一个 migrate flag 为 true |
| `--migrate-review` | boolean | 否 | 迁移旧 review 报告 | 至少一个 migrate flag 为 true |
| `--dry-run` | boolean | 否 | 只预览迁移 | 建议首次必须使用 |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "dryRun": true,
    "sources": [".docsync"],
    "operations": [
      {
        "type": "copy",
        "from": ".docsync/rules",
        "to": ".harness/rules/imported/docsync"
      }
    ],
    "conflicts": []
  }
}
```

**业务逻辑**：
1. 调用 `detectLegacySources()` 识别存在的旧来源。
2. 根据 migrate flags 调用 `buildMigrationPlan()`。
3. 检测目标路径冲突；存在不可自动合并冲突时返回 2104。
4. `dryRun=true` 时只输出计划。
5. 非 dry-run 时通过 transaction 执行 copy/write，并记录报告。

---

## 5. 局部数据模型

> 仅针对当前 Capability 的数据设计，遵循 overview.md 的全局约定

### 5.1 数据表设计

#### 表名：无

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| 无 | 无 | 否 | 无 | 本 Capability 不新增数据库表 | 无 |

**索引设计**：
- 主键索引：无
- 唯一索引：无
- 普通索引：无

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 无 | 无 | 无 | 无 | workspace/config 不引入缓存；只读写配置、状态和报告文件 |

### 5.3 数据流转图

```
[cwd + command options]
  --> [resolveWorkspacePaths]
  --> [load/validate/merge config]
  --> [status or doctor or migration plan]
  --> [transaction if write is needed]
  --> [CliResponse + reportable summary]
```

**文件数据模型**：

| 文件路径 | 数据类型 | 必填 | 默认值 | 说明 |
|---------|---------|------|--------|------|
| `.harness/config/harness.config.json` | JSON object | 是 | schemaVersion 1 | 主配置 source of truth |
| `.harness/config/*.local.json` | JSON object | 否 | 无 | 本机覆盖配置，禁止进入报告和发布包 |
| `.harness/state/install.json` | JSON object | 是 | `{ "schemaVersion": 1 }` | 安装版本、时间、adapter 状态 |
| `.harness/state/facts.json` | JSON object | 否 | `{ "schemaVersion": 1 }` | facts 生成状态摘要 |
| `.harness/state/active-change.json` | JSON object | 否 | `{ "schemaVersion": 1 }` | 当前 develop change |
| `.harness/state/capabilities.json` | JSON object | 否 | `{ "schemaVersion": 1 }` | capability 健康状态 |
| `.harness/reports/**` | Markdown/JSON | 否 | 无 | 命令报告，不含 sensitive/local 配置正文 |

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[runStatusCommand / runDoctorCommand / runConfigCommand]
  --> [resolveProjectRoot]
  --> [resolveWorkspacePaths]
  --> [readWorkspaceStatus]
  --> [loadHarnessConfig + mergeLocalConfig + validateHarnessConfig]
  --> [read state / detect legacy sources / build migration plan]
  --> [optional transaction write]
  --> [CliResponse]
```

**Spec 需求项覆盖表**：

| Spec 需求项 | 设计覆盖位置 | 覆盖说明 |
|------------|-------------|---------|
| 工作区创建与根目录最小化 | `ensureWorkspace()`、`resolveWorkspacePaths()`、文件数据模型 | 覆盖 `.harness/` 目录创建、平台投影路径限制、根目录最小化 |
| 配置模型与能力开关 | `HarnessConfig`、`loadHarnessConfig()`、`validateHarnessConfig()` | 覆盖 `schemaVersion`、`project`、`aiTools`、`capabilities`、`documents`、`orchestration`、`safety` |
| 事务写入与兼容读取 | `Transaction`、`detectLegacySources()`、`buildMigrationPlan()` | 覆盖 dry-run、backup、rollback、旧来源只读识别和显式迁移 |

### 6.2 状态机（如有）

```
[UNINITIALIZED]
  -- ensureWorkspace dry-run --> [PLAN_READY]
  -- ensureWorkspace commit success --> [INITIALIZED]
  -- ensureWorkspace write failure --> [ROLLBACK]

[INITIALIZED]
  -- validate config success --> [VALID]
  -- validate config failure --> [INVALID_CONFIG]
  -- migrate dry-run --> [MIGRATION_PLAN_READY]
  -- migrate commit success --> [MIGRATED]
  -- migrate conflict --> [MIGRATION_CONFLICT]
```

### 6.3 关键算法（如有）

**Transaction 写入算法**
1. `beginTransaction(cwd)` 生成 transaction id 和内存 staged operations。
2. `stageWrite(path, content)` 校验 path 位于允许写入边界内。
3. 若目标文件存在，先创建 backup operation；若不存在，记录 create operation。
4. `dryRun=true` 时不执行 fs 写入，只返回 operations。
5. `commitTransaction()` 按目录创建、备份、写入的顺序执行。
6. 任一步失败，执行 `rollbackTransaction()`，按相反顺序恢复 backup 或删除本次新建文件。
7. rollback 失败时返回 5101，并保留可人工恢复的 backup 路径。

**Local config 合并算法**
1. 读取主配置，校验必填字段。
2. 查找 `.harness/config/*.local.json`。
3. 只允许覆盖预先声明的本机运行字段，禁止覆盖 `schemaVersion` 和安全忽略规则。
4. 产出 `effectiveConfig` 供运行使用，产出 `reportableConfig` 供报告使用。
5. `reportableConfig` 只保留 local 文件存在状态和覆盖字段名，不包含 local 值。

---

## 7. 外部依赖与集成

> **⚠️ 必填**：列出本 Capability 依赖的所有外部系统、服务和基础设施，确保上下游关系透明、可追踪。
> AI 无法自动推断项目的外部依赖，**请用户补充完整**。

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | workspace/config 不调用远程服务 | 无 | 0 毫秒连接超时 | 无 | 无 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | >= 20.0.0 | 文件系统读写、路径解析、JSON 处理 | 无 | 无 | 低于版本时阻断写入 |
| npm | >= 10.0.0 | 初始化命令分发和 package scripts | 无 | 无 | 本 Capability 不执行 npm publish |
| JSON Schema | draft-07 | 配置结构校验语义 | 无 | 无 | 第一版可用内置校验实现 |
| Git | >= 2.30.0 | 检测 ignored 文件、工作区状态和 legacy 迁移影响 | 本地 Git 权限 | 无 | 非 Git 项目仅跳过 Git 检测 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | `.harness/`、配置、状态、报告写入 | Node fs API | `--cwd` 解析后的项目根目录 | 所有写入走 transaction |
| `.gitignore` | 防止 local config/cache 进入版本控制 | 追加建议或 managed block | `.harness/config/*.local.json`、`.harness/cache/**` | 非 Git 项目跳过 |

### 7.4 内部跨模块依赖

> 本 Capability 需要调用项目内其他模块的能力（注意：仅声明依赖，不设计对方逻辑）

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `harness-cli-entrypoint` | `CommandContext.globalOptions` | `cwd`、`dryRun`、`json` | 统一命令上下文 | 待建 |
| `harness-adapter-skill-runtime` | adapter 源目录读取 | `.harness/adapters/**` | 投影状态供 doctor 展示 | 待建 |
| `harness-develop` | develop storage path | `.harness/develop/changes/**` | canonical storage 路径 | 待建 |
| `harness-safety-orchestration` | safety config 读取 | `HarnessConfig.safety` | dangerous commands 和 secret patterns | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | `CI` 可影响 doctor 严格度；不需要业务密钥 | 从 `process.env` 读取 |
| 密钥/证书 | 本 Capability 不需要密钥或证书 | 无 |
| 网络策略 | 本地运行不需要网络 | 无 |
| 权限/角色 | 需要读取项目目录；初始化、迁移和 transaction 需要写 `.harness/**` 权限 | 本地用户权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 参数校验异常 | `--cwd` 不存在、migrate flags 缺失或组合非法 | 返回 1002 或 2104；不写文件 | 用户看到路径或迁移参数问题 |
| 配置校验异常 | `harness.config.json` 缺少 `schemaVersion`、`project` 等必填字段 | 返回 2101，列出 `missing` 字段 | 用户看到配置文件路径和缺失字段 |
| 工作区不完整 | `.harness/` 存在但必要目录或主配置缺失 | 返回 2102，doctor 给出修复建议 | 用户看到缺失目录/文件 |
| 事务异常 | staged write、backup、commit 失败 | 返回 2103，自动 rollback | 用户看到 transaction id 和 rollback 状态 |
| 回滚异常 | rollback 无法恢复 backup 或删除新建文件 | 返回 5101，保留人工恢复提示 | 用户看到 backup 路径和人工处理建议 |
| 迁移冲突 | 旧来源目标路径已存在且无法自动合并 | 返回 2104，要求用户确认冲突策略 | 用户看到冲突来源和目标 |

### 8.2 重试与降级

- 重试次数：0 次；文件系统写入错误不自动重试，避免重复破坏现场
- 重试间隔：0 毫秒
- 降级策略：Git 不可用时跳过 ignored 和 dirty-check；config/status 仍可工作并返回 warning

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 配置版本 | `schemaVersion` | `1` | 主配置 schema 版本 |
| 项目名称 | `project.name` | `""` | 初始化时可由目录名或用户输入填充 |
| 项目类型 | `project.type` | `"auto"` | 支持自动检测 |
| AI 工具 | `aiTools` | 全 false | 记录 Claude/Codex/Copilot/Cursor 是否启用 |
| 能力开关 | `capabilities` | inspect/sync/develop/review true，knowledge false | 控制 capability 是否可用 |
| Managed 文档 | `documents.managed` | `["README.md","AGENTS.md","CLAUDE.md"]` | sync 使用的文档集合 |
| Generated block 前缀 | `documents.generatedBlockPrefix` | `"harness"` | 文档同步 block 标记 |
| Subagent 策略 | `orchestration.subagents` | `"auto"` | 大范围任务自动启用 |
| 最大并行 agent | `orchestration.maxParallelAgents` | `6` | 并行编排上限 |
| Validator 要求 | `orchestration.validatorRequired` | `true` | review/design 合并等关键流程需要复核 |
| 危险命令阻断 | `safety.dangerousCommandsBlocked` | `true` | 默认启用 |
| 敏感文件模式 | `safety.secretPatterns` | `.env`、key、token、secret 等 | inspect/sync/review/knowledge 共享 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--dry-run` | 预览工作区创建、迁移和写入计划 | 关闭 |
| `--json` | 输出机器可读 status/config/doctor 响应 | 关闭 |
| `--migrate-docsync` | 显式迁移 `.docsync/` 旧数据源 | 关闭 |
| `--migrate-sdd` | 显式迁移旧 SDD/OpenSpec 文档 | 关闭 |
| `--migrate-review` | 显式迁移旧 review 报告 | 关闭 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：需修改的文件、类、方法已明确（或确认为纯新建）
> - [x] **现有约束已识别**：影响设计的现有系统约束已列出并有应对策略
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的逻辑
> - [x] **全局遵守**：遵循 overview.md 的数据字典和接口规范
> - [x] 前端设计已完成（组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（表结构、索引、缓存）
> - [x] **外部依赖已明确**：所有外部服务、第三方 API、中间件、跨模块依赖已列出
> - [x] **环境权限已确认**：所需环境变量、密钥、网络策略已说明
> - [x] 异常处理策略已定义（含外部依赖失败的降级方案）
> - [x] 包含足够的局部细节支持任务拆解
