# 局部技术实现方案 - harness-adapter-skill-runtime

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
| 1 | `--repair-adapters` | `AdapterRepairOptions.repairAdapters` | boolean | ⚠️ 重命名 | CLI flag 转为 camelCase 内部字段 |
| 2 | `--ai-tools` | `AdapterRepairOptions.aiTools` | string[] | ✅ 保留 | 限定 Claude/Codex/Copilot/Cursor 投影目标 |
| 3 | `--dry-run` | `AdapterRepairOptions.dryRun` | boolean | ⚠️ 重命名 | 全局 dry-run 语义进入 adapter repair 计划 |
| 4 | `--json` | `AdapterRepairOptions.json` | boolean | ✅ 保留 | 控制 doctor/config 输出 |
| 5 | `adapters` | `AdapterRepairResult.adapters` | AdapterProjectionStatus[] | ✅ 保留 | repair/doctor 统一返回 adapter 状态列表 |
| 6 | `tool` | `AdapterProjectionStatus.tool` | enum string | ✅ 保留 | 枚举：`claude`、`codex`、`copilot`、`cursor` |
| 7 | `source` | `AdapterProjectionStatus.sourcePath` | path/string | ⚠️ 重命名 | 内部明确这是 source-of-truth 路径 |
| 8 | `projection` | `AdapterProjectionStatus.projectionPath` | path/string | ⚠️ 重命名 | 内部明确这是运行时投影路径 |
| 9 | `status` | `AdapterProjectionStatus.status` | enum string | ✅ 保留 | 枚举：`synced`、`missing`、`drifted`、`conflict`、`planned` |
| 10 | `msg` | `CliResponse.msg` | string | ✅ 保留 | 统一响应消息 |
| 11 | `code` | `CliResponse.code` | number | ✅ 保留 | 统一响应码 |
| 12 | `data.tool` | `AdapterErrorData.tool` | enum string | ✅ 保留 | 错误对象中的目标工具 |
| 13 | `data.source` | `AdapterErrorData.sourcePath` | path/string | ⚠️ 重命名 | 内部明确源路径语义，对外仍可序列化为 `source` |
| 14 | `.claude/skills/harness/SKILL.md` | `ProjectionTarget.path` | path/string | ✅ 保留 | Claude 运行时 Skill 投影 |
| 15 | `.agents/skills/harness/SKILL.md` | `ProjectionTarget.path` | path/string | ✅ 保留 | Codex 运行时 Skill 投影 |
| 16 | `.agents/skills/harness/agents/openai.yaml` | `ProjectionTarget.path` | path/string | ✅ 保留 | Codex agent metadata 投影 |
| 17 | `.harness/adapters/**` | `AdapterSource.path` | path/string | ✅ 保留 | adapter 源文件 source of truth |

**状态说明**：
- ✅ 保留：字段名和类型与用户输入一致
- ⚠️ 重命名：字段重命名（必须说明理由）
- 🔀 合并：多字段合并为一个（必须说明理由）
- ❌ 移除：字段被移除（必须有充分理由且经用户确认）

### 1.2 完整性自检

- **用户输入字段总数**：17 个
- **设计输出字段总数**：17 个
- **差异说明**：CLI flag 与路径字段在内部使用 camelCase 和语义化后缀；对外响应保留 spec 中的 `tool/source/projection/status` 语义
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
| `src/adapters/types.ts` | `AdapterTool` / `AdapterSource` / `ProjectionTarget` / `AdapterProjectionStatus` | 定义 adapter 源、目标、状态类型 | TypeScript type module | 与字段追溯表保持一致 |
| `src/adapters/registry.ts` | `createAdapterRegistry()` | 注册 Claude、Codex、Copilot、Cursor 的 source/projection 规则 | Adapter registry | 不实现各平台业务，只定义路径和模板 |
| `src/adapters/source-manager.ts` | `ensureAdapterSources()` / `readAdapterSource()` | 确保 `.harness/adapters/**` source-of-truth 模板存在 | Source service | 缺失时返回 2201 |
| `src/adapters/projection-renderer.ts` | `renderProjection()` | 将 source 模板渲染成运行时薄投影 | Projection renderer | 注入 source path 和 repair 命令 |
| `src/adapters/projection-writer.ts` | `planProjectionWrites()` / `applyProjectionWrites()` | dry-run、冲突检测、transaction 写入投影 | Projection writer | 所有写入走 transaction |
| `src/adapters/drift-detector.ts` | `checkAdapterDrift()` | 比较 source hash、projection hash 和 managed marker | Drift detector | doctor 使用 |
| `src/adapters/hook-projection.ts` | `planHookProjection()` | 规划 `.claude/settings.json`、`.codex/hooks.json` 等 Hook 投影 | Hook projection planner | 只做 adapter 侧投影，不设计 Hook 业务逻辑 |
| `src/commands/config-repair-adapters.ts` | `runRepairAdaptersCommand()` | 处理 `harness config --repair-adapters` | Command handler | 支持 `--ai-tools`、`--dry-run`、`--json` |
| `src/commands/doctor-adapters.ts` | `collectAdapterDoctorInfo()` | 为 `harness doctor` 收集 adapter 漂移状态 | Doctor collector | 只读 |
| `.harness/adapters/shared/skills/harness/SKILL.md` | shared Harness Skill template | 跨平台 Skill 源模板 | Markdown template | 完整路由说明 source of truth |
| `.harness/adapters/codex/skills/harness/agents/openai.yaml` | Codex metadata template | Codex agent metadata 源模板 | YAML template | 投影到 `.agents/skills/harness/agents/openai.yaml` |
| `.harness/adapters/claude/skills/harness/SKILL.md` | Claude Skill source | Claude 专用 Skill 源模板 | Markdown template | 投影到 `.claude/skills/harness/SKILL.md` |
| `.harness/adapters/codex/skills/harness/SKILL.md` | Codex Skill source | Codex 专用 Skill 源模板 | Markdown template | 投影到 `.agents/skills/harness/SKILL.md` |
| `test/adapters/adapter-skill-runtime.test.ts` | adapter runtime tests | 验证单一 Skill、投影、dry-run、漂移和冲突 | Node test suite | TDD 阶段先写红灯测试 |

### 2.3 现有逻辑约束

> 影响本次设计的现有系统约束（如：已有事务边界、线程模型、日志规范、已有设计模式等）

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 当前仓库已有 `.agents/`、`.claude/`、`.codex/` | 这些目录可能已有旧投影或当前 SDD 技能 | repair 必须检测冲突，不能盲目覆盖用户内容 | 使用 managed marker 和 hash 判断可覆盖范围 |
| 用户可见只允许一个 `harness` Skill | 旧来源 Skill 名可能存在 | 新安装只生成 `harness`，旧 Skill 不删除 | doctor 报告旧 Skill 存在但不自动移除 |
| adapter 源与运行时投影分离 | source of truth 在 `.harness/adapters/**` | 投影必须可重建、可检测漂移 | 所有投影写入带 source path、hash 和 repair 命令 |
| Skill 不承载业务逻辑 | spec 明确 Skill 只路由 CLI | 模板内容必须短、指向 `harness` CLI | `renderProjection()` 注入最小路由说明 |
| 写文件必须安全 | 投影写入涉及根目录工具目录 | 所有写入走 workspace transaction | `planProjectionWrites()` 先生成 dry-run 计划 |

---

## 3. 局部前端设计

> 仅针对当前 Capability 的前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `AdapterRepairPlanView` | 终端展示 | 展示 source、projection、status、planned writes、conflicts | `AdapterRepairResult` |
| `AdapterDoctorView` | 终端展示 | 展示每个 adapter 的 drift/missing/synced 状态 | `AdapterProjectionStatus[]` |
| `ProjectionConflictView` | 终端展示 | 展示不可自动覆盖的投影文件和原因 | `ProjectionConflict[]` |
| `SkillInstallSummaryView` | 终端展示 | 初始化结束时展示已安装的单一 `harness` Skill 和平台投影路径 | `AdapterProjectionStatus[]` |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `selectedTools` | AdapterTool[] | 来自配置 `aiTools` | 解析 `--ai-tools` 或读取配置后更新 |
| `projectionStatus` | AdapterProjectionStatus[] | `[]` | `checkAdapterDrift()` 完成后更新 |
| `repairPlan.operations` | ProjectionOperation[] | `[]` | `planProjectionWrites()` 生成后更新 |
| `repairPlan.conflicts` | ProjectionConflict[] | `[]` | 检测到 unmanaged 目标文件时更新 |
| `dryRun` | boolean | `false` | 解析 `--dry-run` 后更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness config --repair-adapters` | `AdapterRepairPlanView` | 本地读写权限 | 非 dry-run 时写入运行时投影 |
| `CLI: harness config --repair-adapters --dry-run` | `AdapterRepairPlanView` | 本地读权限 | 只输出投影计划 |
| `CLI: harness doctor --json` | `AdapterDoctorView` | 本地读权限 | 输出 source/projection 漂移状态 |
| 初始化向导完成后的 adapter 安装步骤 | `SkillInstallSummaryView` | 本地读写权限 | 根据 `aiTools` 生成单一 `harness` Skill 投影 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 修复所有 adapter | `runRepairAdaptersCommand()` | `repairAdapters=true`、`aiTools`、`dryRun` | 展示每个 tool 的计划、状态和冲突 |
| doctor 检查 adapter | `collectAdapterDoctorInfo()` | `cwd`、`aiTools` | 展示 `synced/missing/drifted/conflict` |
| 初始化安装 Skill | `ensureAdapterSources()` + `applyProjectionWrites()` | 初始化选择的 `aiTools` | 写入薄投影并输出路径 |
| 发现冲突 | `ProjectionConflictView` | conflict list | 返回 2202，不写入冲突文件 |

---

## 4. 局部后端接口设计

> 仅针对当前 Capability 的接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Adapter 修复 | `CLI: harness config --repair-adapters` | 本地进程调用 | 根据 source 重新生成运行时投影 |
| Adapter 诊断 | `CLI: harness doctor` | 本地进程调用 | 检查 source/projection 是否缺失、漂移、冲突 |
| Source 管理 | `ensureAdapterSources()` | 函数调用 | 创建或确认 `.harness/adapters/**` 源模板 |
| 投影规划 | `planProjectionWrites()` | 函数调用 | 生成 dry-run 计划和冲突列表 |
| 漂移检测 | `checkAdapterDrift()` | 函数调用 | 比较 managed marker、source hash、projection hash |

### 4.2 接口详细设计

#### 接口 1：Adapter 修复命令

**基本信息**：
- 路径：`CLI: harness config --repair-adapters`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--repair-adapters` | boolean | 是 | 触发 adapter 修复 | 仅 `config` 命令有效 |
| `--ai-tools` | string[] | 否 | 限定目标工具 | 枚举：`claude`、`codex`、`copilot`、`cursor` |
| `--dry-run` | boolean | 否 | 只输出投影计划 | 为 true 时写入文件数量必须为 0 |
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "adapters": [
      {
        "tool": "codex",
        "source": ".harness/adapters/codex/skills/harness",
        "projection": ".agents/skills/harness",
        "status": "synced"
      }
    ]
  }
}
```

**业务逻辑**：
1. `runRepairAdaptersCommand()` 读取 `CommandContext` 和 `HarnessConfig.aiTools`。
2. 解析 `--ai-tools`；未传时使用配置中启用的工具。
3. 调用 `ensureAdapterSources()` 检查或创建 `.harness/adapters/**` 源模板。
4. 调用 `checkAdapterDrift()` 判断 projection 是否缺失、漂移、冲突或已同步。
5. 调用 `planProjectionWrites()` 生成投影写入计划。
6. `dryRun=true` 时直接返回计划。
7. 非 dry-run 时通过 transaction 写入投影；冲突文件不写入并返回 2202。

#### 接口 2：Adapter 诊断

**基本信息**：
- 路径：`CLI: harness doctor`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |
| `--ai-tools` | string[] | 否 | 限定诊断工具 | 枚举：`claude`、`codex`、`copilot`、`cursor` |

**响应结构**：
```json
{
  "adapterRuntime": {
    "adapters": [
      {
        "tool": "claude",
        "source": ".harness/adapters/claude/skills/harness",
        "projection": ".claude/skills/harness",
        "status": "drifted"
      }
    ],
    "repairCommand": "harness config --repair-adapters"
  }
}
```

**业务逻辑**：
1. `collectAdapterDoctorInfo()` 读取 adapter registry。
2. 对每个启用工具调用 `checkAdapterDrift()`。
3. 不写文件，只返回诊断状态、冲突路径和 repair 命令。
4. doctor 汇总时将 adapterRuntime 作为一个局部 section。

#### 接口 3：投影渲染

**基本信息**：
- 路径：`Function: renderProjection(source, target, context)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `source` | AdapterSource | 是 | source-of-truth 模板 | 必须位于 `.harness/adapters/**` |
| `target` | ProjectionTarget | 是 | 运行时投影目标 | 必须位于允许的工具固定路径 |
| `context` | ProjectionContext | 是 | 包名、repair 命令、source path、hash | 不得包含 secret/local 配置值 |

**响应结构**：
```json
{
  "targetPath": ".agents/skills/harness/SKILL.md",
  "content": "---\nname: harness\n---\n...",
  "sourceHash": "sha256:abc",
  "managed": true
}
```

**业务逻辑**：
1. 读取 source 模板。
2. 注入 managed marker、source path、source hash、repair 命令。
3. 只渲染最小路由说明：识别意图、调用 `harness` CLI、展示报告摘要。
4. 禁止注入 RAGFlow、API key、token、本地绝对敏感配置值。

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
| 无 | 无 | 无 | 无 | adapter runtime 不引入缓存；使用 source/projection 文件和 hash 状态 |

### 5.3 数据流转图

```
[HarnessConfig.aiTools + --ai-tools]
  --> [createAdapterRegistry]
  --> [ensureAdapterSources]
  --> [checkAdapterDrift]
  --> [renderProjection]
  --> [planProjectionWrites]
  --> [transaction write or dry-run report]
```

**文件数据模型**：

| 文件路径 | 数据类型 | 必填 | 默认值 | 说明 |
|---------|---------|------|--------|------|
| `.harness/adapters/shared/skills/harness/SKILL.md` | Markdown | 是 | Harness Skill source | 共享 Skill 源模板 |
| `.harness/adapters/claude/skills/harness/SKILL.md` | Markdown | 选择 Claude 时是 | Claude Skill source | Claude 专用源模板 |
| `.harness/adapters/codex/skills/harness/SKILL.md` | Markdown | 选择 Codex 时是 | Codex Skill source | Codex 专用源模板 |
| `.harness/adapters/codex/skills/harness/agents/openai.yaml` | YAML 1.2 | 选择 Codex 时是 | Codex metadata source | Codex agent metadata 源模板 |
| `.claude/skills/harness/SKILL.md` | Markdown | 选择 Claude 时是 | 运行时薄投影 | Claude 必须识别路径 |
| `.agents/skills/harness/SKILL.md` | Markdown | 选择 Codex 时是 | 运行时薄投影 | Codex 必须识别路径 |
| `.agents/skills/harness/agents/openai.yaml` | YAML 1.2 | 选择 Codex 时是 | 运行时薄投影 | Codex metadata 投影 |
| `.claude/settings.json` | JSON | 可选 | 无 | Claude Hook 投影配置 |
| `.codex/hooks.json` | JSON | 可选 | 无 | Codex Hook 投影配置 |

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[runRepairAdaptersCommand]
  --> [load HarnessConfig.aiTools]
  --> [select AdapterTool list]
  --> [createAdapterRegistry]
  --> [ensureAdapterSources]
  --> [checkAdapterDrift]
  --> [planProjectionWrites]
  --> [dry-run?]
      --> yes: [return planned AdapterRepairResult]
      --> no:  [write projections via transaction]
  --> [return AdapterRepairResult]
```

**Spec 需求项覆盖表**：

| Spec 需求项 | 设计覆盖位置 | 覆盖说明 |
|------------|-------------|---------|
| 单一 Harness Skill | `createAdapterRegistry()`、source/projection 文件数据模型、Skill 模板约束 | 覆盖只生成用户可见 `harness` Skill，不安装内部来源名 Skill |
| Skill 路由职责边界 | `renderProjection()`、Skill source template、投影渲染算法 | 覆盖 Skill 只识别意图、调用 Harness CLI、展示报告摘要 |
| Adapter 与 Hook 投影修复 | `checkAdapterDrift()`、`planProjectionWrites()`、`runRepairAdaptersCommand()`、`planHookProjection()` | 覆盖 source/projection 同步、漂移检查、repair-adapters 和 Hook 投影规划 |

### 6.2 状态机（如有）

```
[SOURCE_MISSING]
  -- ensureAdapterSources success --> [SOURCE_READY]
  -- missing required template --> [ERROR_2201]

[SOURCE_READY]
  -- projection absent --> [MISSING]
  -- projection managed hash equal --> [SYNCED]
  -- projection managed hash differs --> [DRIFTED]
  -- projection unmanaged exists --> [CONFLICT]

[MISSING or DRIFTED]
  -- dry-run --> [PLANNED]
  -- transaction success --> [SYNCED]
  -- transaction failure --> [ERROR_5201]
```

### 6.3 关键算法（如有）

**Managed projection 判断算法**
1. 读取 projection 文件；不存在时返回 `missing`。
2. 查找 Harness managed marker、source path、source hash。
3. 若 marker 不存在且目标文件存在，返回 `conflict`，禁止覆盖。
4. 若 marker 存在但 source path 不匹配，返回 `conflict`。
5. 计算当前 source hash，与 projection 中记录 hash 比较。
6. hash 相同返回 `synced`，不同返回 `drifted`。

**投影写入算法**
1. registry 根据 tool 生成 `ProjectionTarget[]`。
2. 对每个 target 调用 `renderProjection()`。
3. 对 `missing/drifted` 目标创建 write operation。
4. 对 `conflict` 目标只写入 repair 报告，不写投影文件。
5. 所有 write operation 交给 transaction；失败时 rollback。

**Skill 内容约束算法**
1. 模板只包含 Harness 的意图识别、CLI 调用和报告摘要说明。
2. 模板不得出现 DocSync、GSD、kld-sdd、kld-review 作为用户可见命令名。
3. 模板不得包含 API key、RAGFlow 地址、token、本地私有配置值。
4. 模板必须包含 source path 和 `harness config --repair-adapters` 重新生成命令。

---

## 7. 外部依赖与集成

> **⚠️ 必填**：列出本 Capability 依赖的所有外部系统、服务和基础设施，确保上下游关系透明、可追踪。
> AI 无法自动推断项目的外部依赖，**请用户补充完整**。

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | adapter runtime 不调用远程服务 | 无 | 0 毫秒连接超时 | 无 | 无 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | >= 20.0.0 | 文件读写、hash、JSON/YAML 文本处理 | 无 | 无 | 低于版本阻断 repair |
| YAML | 1.2 | `openai.yaml` 和 agent metadata 生成 | 无 | 无 | 第一版可用模板字符串，后续可接解析器 |
| Claude Skill schema | v1 | `.claude/skills/harness/SKILL.md` 投影 | 无 | 无 | schema 变化通过 doctor 报告漂移 |
| Codex Skill frontmatter | v1 | `.agents/skills/harness/SKILL.md` 投影 | 无 | 无 | 仅保留最小 frontmatter |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | adapter source 与 projection 写入 | Node fs API | `.harness/adapters/**`、`.claude/**`、`.agents/**`、`.codex/**`、`.github/**` | 所有写入走 transaction |
| SHA-256 hash | source/projection 漂移判断 | Node crypto API | `sourceHash` managed marker | 不用于安全加密，仅用于一致性检测 |

### 7.4 内部跨模块依赖

> 本 Capability 需要调用项目内其他模块的能力（注意：仅声明依赖，不设计对方逻辑）

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `harness-cli-entrypoint` | `CommandContext` | `cwd`、`dryRun`、`json` | config/doctor 命令上下文 | 待建 |
| `harness-workspace-config` | `resolveWorkspacePaths()`、transaction | project root、write operations | workspace paths、transaction commit/rollback | 待建 |
| `harness-safety-orchestration` | safety policy read | target paths、secret patterns | 是否允许写入/输出 | 待建 |
| `harness-sync` | managed docs relationship | AGENTS/CLAUDE managed block metadata | 文档指针同步 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 本 Capability 不需要业务环境变量；`CI` 可让 doctor 输出更严格 | 从 `process.env` 读取 |
| 密钥/证书 | 不需要；任何密钥都不得写入 adapter source/projection | 无 |
| 网络策略 | 本地运行不需要网络 | 无 |
| 权限/角色 | 需要读取 `.harness/adapters/**`，repair 时需要写平台投影目录 | 本地用户权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| Adapter 源缺失 | `.harness/adapters/<tool>` 或必要模板不存在 | 返回 2201，并提示运行初始化或 repair source | 用户看到缺失 source path |
| 投影冲突 | 目标投影文件存在且没有 Harness managed marker | 返回 2202，不覆盖文件 | 用户看到冲突路径和手动处理建议 |
| 平台不支持 | `--ai-tools` 包含未知工具 | 返回 2203，列出允许枚举 | 用户看到可用工具列表 |
| Hook 校验失败 | Hook 配置缺少字段或脚本不存在 | 返回 2204，跳过 Hook 投影 | 用户看到 Hook 问题但 Skill 投影可继续 |
| 投影写入失败 | transaction 写入失败 | 返回 5201 并 rollback | 用户看到 transaction id 和 rollback 状态 |
| 敏感内容阻断 | 模板或上下文包含 secret/token/key 模式 | 阻断 projection，返回安全错误摘要 | 用户看到敏感内容过滤提示 |

### 8.2 重试与降级

- 重试次数：0 次；投影冲突和写入失败不自动重试
- 重试间隔：0 毫秒
- 降级策略：平台专用 schema 不可用时生成纯 Markdown 指针；Hook 投影失败不得阻断 Skill 投影，必须在报告中标记 warning

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| Claude 启用 | `aiTools.claude` | `false` | 是否生成 Claude Skill 投影 |
| Codex 启用 | `aiTools.codex` | `false` | 是否生成 Codex Skill 和 metadata 投影 |
| Copilot 启用 | `aiTools.copilot` | `false` | 是否生成 Copilot instructions 相关投影 |
| Cursor 启用 | `aiTools.cursor` | `false` | 是否生成 Cursor 相关投影 |
| Adapter 源根 | `adapters.sourceRoot` | `.harness/adapters` | adapter source-of-truth 根目录 |
| Repair 命令 | `adapters.repairCommand` | `harness config --repair-adapters` | 写入投影 marker 的重建命令 |
| Managed marker 前缀 | `adapters.managedMarkerPrefix` | `harness` | 判断投影是否可覆盖 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--repair-adapters` | 触发 adapter source 到运行时投影的修复 | 关闭 |
| `--ai-tools` | 限定 repair/doctor 目标工具 | 未传时读取配置 |
| `--dry-run` | 只输出投影计划，不写文件 | 关闭 |
| `--json` | 输出机器可读 adapter 状态 | 关闭 |

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
