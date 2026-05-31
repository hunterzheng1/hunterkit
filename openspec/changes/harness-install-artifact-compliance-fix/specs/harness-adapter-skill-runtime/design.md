# 局部技术实现方案 - harness-adapter-skill-runtime

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-adapter-skill-runtime`，聚焦 Skill/Agent 源结构、运行时投影、drift/repair 与安装摘要所需的 adapter artifact 信息；Hook 运行时投影、根文档 managed block、doctor 总体诊断由对应 Capability 负责消费本能力输出。
>
> **质量红线**：运行时只写 AI 工具必须识别的薄投影；完整资料保留在 `.harness/adapters/**`；每个用户项目仍只暴露一个用户可见 `harness` Skill。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `.harness/adapters/shared/skills/harness/SKILL.md` | `AdapterSourceManifest.sharedSkill.sourcePath` | path string | ✅ 保留 | shared Skill 标准源入口，补齐当前缺失文件 |
| 2 | `.harness/adapters/shared/skills/harness/references/` | `SharedSkillSource.references[]` | path[] | ✅ 保留 | 完整资料留在 source tree，不复制到 runtime |
| 3 | `.harness/adapters/shared/skills/harness/scripts/` | `SharedSkillSource.scripts[]` | path[] | ✅ 保留 | Skill 工具脚本源资料，由 source manager 生成 |
| 4 | `.harness/adapters/shared/skills/harness/assets/` | `SharedSkillSource.assets[]` | path[] | ✅ 保留 | 根文档/报告模板资产源资料 |
| 5 | `.harness/adapters/<tool>/skills/harness/` | `AdapterSourceManifest.toolSources[]` | object[] | ✅ 保留 | 每个工具的源模板目录，用于运行时薄投影 |
| 6 | `.claude/skills/harness/SKILL.md` | `RuntimeProjection.projectionPath` | path string | ✅ 保留 | Claude Code 必须识别的项目级 Skill |
| 7 | `.agents/skills/harness/SKILL.md` | `RuntimeProjection.projectionPath` | path string | ✅ 保留 | Codex 必须识别的项目级 Skill |
| 8 | `.agents/skills/harness/agents/openai.yaml` | `RuntimeProjection.projectionPath` | path string | ✅ 保留 | Codex Skill metadata 运行时薄投影 |
| 9 | `.claude/agents/*.md` | `AgentProjection.runtimePath` | path string | ✅ 保留 | 仅当 Claude + agents 启用时写入 |
| 10 | `.codex/agents/*.toml` | `AgentProjection.runtimePath` | path string | ✅ 保留 | 仅当 Codex + agents 启用时写入 |
| 11 | `source-hash` | `ProjectionMetadata.sourceHash` | sha256 short string | ✅ 保留 | drift-detector 已依赖该字段，renderer 必须写入 |
| 12 | `repairCommand` | `ProjectionMetadata.repairCommand` | string | ✅ 保留 | 缺失/漂移时提供 `harness config --repair-adapters` |
| 13 | `aiTools.*` | `SelectedToolSet.tools` | enum[] | ⚠️ 重命名 | 从 config boolean 规整为渲染流程使用的工具枚举 |
| 14 | agent 占位文本 | `AgentDefinitionTemplate` | object | ⚠️ 重命名 | 从散落字符串升级为可校验模板对象 |

### 1.2 完整性自检

- **用户输入字段总数**：14 个
- **设计输出字段总数**：14 个
- **差异说明**：`aiTools.*` 在设计内部转为 `SelectedToolSet.tools`，agent 占位文本转为结构化 `AgentDefinitionTemplate`；运行时路径、源路径、hash 和 repair 指针全部保留。
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/adapters/types.ts` | adapters/types | `AdapterRegistryEntry`、`AdapterProjectionStatus` | 新增参数 | 增加 artifact kind、source kind、required files、metadata、repairCommand、skipped 状态 |
| `src/adapters/registry.ts` | adapters/registry | `createAdapterRegistry()`、`filterByTool()` | 扩展逻辑 | registry 从单文件 entry 升级为 Skill/metadata/agent projection 清单；保留按工具过滤 |
| `src/adapters/source-manager.ts` | adapters/source-manager | `ensureAdapterSources()`、`ensureSharedSkillSources()` | 扩展逻辑 | shared 目录必须生成 `SKILL.md`，tool 目录生成完整或可追溯源模板 |
| `src/adapters/projection-renderer.ts` | adapters/projection-renderer | `renderProjection()`、`sanitizeInternalNames()` | 扩展逻辑 | 渲染 frontmatter、managed marker、source path、source hash、repair command；runtime 保持薄投影 |
| `src/adapters/projection-writer.ts` | adapters/projection-writer | `planProjectionWrites()`、`applyProjectionWrites()` | 扩展逻辑 | 支持 `skipped`、artifact 分类、hash metadata、unselected tool 不写 runtime |
| `src/adapters/drift-detector.ts` | adapters/drift-detector | `checkAdapterDrift()` | 修复逻辑 | 当前 detector 依赖 `source-hash`，renderer 未写入；需统一 hash 算法与 metadata 格式 |
| `src/commands/config.ts` | commands/config | `parseAiTools()`、`handleRepairAdapters()` | 扩展逻辑 | repair 默认读取 config 中选择的工具；支持显式 `--ai-tools` 覆盖；输出 repaired/skipped/conflict |
| `src/cli/main.ts` | cli/main | `executePostWizardIntegration()` | 扩展逻辑 | 初始化后使用 adapter artifact plan，安装摘要区分 source/runtime/workspace/config/report/skipped |
| `src/capabilities/safety/command.ts` | capabilities/safety | `generateSubagentDefs()` | 重构抽取 | agent 定义内容改由 adapter agent renderer 生成；本函数仅保留兼容委托 |
| `test/adapters/adapter-skill-runtime.test.ts` | adapter tests | source/projection/drift/repair 测试 | 扩展测试 | 按 TDD 增加 shared `SKILL.md`、thin runtime、source-hash、agent quality、unselected tool 用例 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/adapters/skill-source-manifest.ts` | skill-source-manifest | 定义 shared/tool Skill 源树清单与 required files | 纯函数模块 | 统一 source tree 合规检查 |
| `src/adapters/agent-templates.ts` | agent-templates | 生成 Claude `.md` 与 Codex `.toml` agent 定义 | 纯函数模块 | 替代 safety 中的占位字符串 |
| `src/adapters/artifact-plan.ts` | artifact-plan | 构建 source/runtime/skipped artifact plan | 纯函数模块 | init、repair、doctor 可复用 |
| `src/adapters/metadata.ts` | metadata | 计算 `source-hash`、managed metadata、repair command | 纯函数模块 | renderer 与 drift-detector 共用 |
| `test/adapters/adapter-artifact-compliance.test.ts` | adapter compliance tests | 安装产物合规回归测试 | vitest | 覆盖本变更新增契约 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| Transaction 写入 | `applyProjectionWrites()` 使用 `stageWrite()` | 运行时投影必须继续走事务写入 | 保持 writer 只 stage，不直接写文件 |
| Managed projection 保护 | `isManagedProjection()` 阻止覆盖非托管文件 | repair 不能覆盖用户自定义 Skill | 保留 conflict 状态并返回修复建议 |
| Drift hash 缺口 | detector 查 `source-hash`，renderer 未写 | 所有投影会被误判 drifted | 在 renderer 写入统一 metadata |
| Registry 结构偏薄 | entry 只有 tool/source/projection/template | 无法表达 source/runtime/skipped/agents | 扩展 entry 字段，保留现有调用兼容 |
| Agent 生成位置偏移 | agent 文本在 safety 模块生成 | adapter runtime 无法校验 agent quality | 抽出 adapter agent renderer，safety 兼容委托 |
| 选择性生成 | `filterByTool()` 只过滤 registry entries | unselected tool 缺少 skipped 证据 | artifact plan 显式记录 skipped reason |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| N/A | N/A | 本 Capability 无浏览器前端 | N/A |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| N/A | N/A | N/A | N/A |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| N/A | N/A | N/A | N/A |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| N/A | N/A | N/A | N/A |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 初始化 adapter 产物 | `CLI: npx @hunterzheng/harness` / `harness init` 内部流程 | 本地进程调用 | 根据向导选择写入 source tree 和 runtime projection |
| 修复 adapter 产物 | `CLI: harness config --repair-adapters [--ai-tools claude,codex]` | 本地进程调用 | 从 `.harness/adapters/**` 重新生成 runtime projection |
| 规划 adapter 产物 | `internal: buildAdapterArtifactPlan(cwd, config, options)` | 内部函数 | 返回 source/runtime/skipped/conflict/drift artifact plan |
| 渲染 runtime projection | `internal: renderProjection(entry, sourceContent)` | 内部函数 | 生成薄投影内容和 metadata |

### 4.2 接口详细设计

#### 接口 1：初始化 adapter 产物

**基本信息**：
- 路径：`CLI: npx @hunterzheng/harness` / `harness init`
- 方法：本地进程调用
- 认证：不需要；依赖本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `answers.aiTools` | `AdapterTool[]` | 是 | 用户选择的 AI 工具 | 枚举：`claude`、`codex`、`copilot`、`cursor`；长度必须 >= 1 |
| `answers.hookStrength` | string | 是 | Hook 强度 | 本能力只使用 agent 是否需要投影；Hook 文件由 safety capability 处理 |
| `cwd` | path string | 是 | 目标项目根目录 | 必须存在且可写 |
| `dryRun` | boolean | 否 | 预览模式 | `true` 时不写文件，只返回计划 |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "adapterArtifacts": [
      {
        "tool": "claude",
        "kind": "runtime",
        "sourcePath": ".harness/adapters/claude/skills/harness/SKILL.md",
        "projectionPath": ".claude/skills/harness/SKILL.md",
        "status": "synced"
      }
    ],
    "skippedArtifacts": [
      {
        "tool": "codex",
        "kind": "runtime",
        "projectionPath": ".agents/skills/harness/SKILL.md",
        "status": "skipped",
        "reason": "tool not selected"
      }
    ]
  },
  "warnings": []
}
```

**业务逻辑**：
1. 将 `aiTools.*` 或 `answers.aiTools` 规整为 `SelectedToolSet.tools`。
2. 调用 `ensureAdapterSources(cwd, allRegistryEntries)` 补齐 shared source tree 和 tool source tree；source tree 可为所有工具生成。
3. 调用 `buildAdapterArtifactPlan(cwd, config, { selectedTools })` 生成 runtime/skipped 计划。
4. 对 selected runtime entries 调用 `applyProjectionWrites()`，通过 transaction 写入。
5. 将 source/runtime/skipped 分类返回给 CLI 安装摘要。

#### 接口 2：修复 adapter 产物

**基本信息**：
- 路径：`CLI: harness config --repair-adapters [--ai-tools claude,codex]`
- 方法：本地进程调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--ai-tools` | string[] | 否 | 指定修复工具 | 未提供时读取 `harness.config.json` 中为 `true` 的工具 |
| `--dry-run` | boolean | 否 | 预览修复 | 写入数量必须为 0 |
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "config",
    "dryRun": false,
    "repaired": [".claude/skills/harness/SKILL.md"],
    "skipped": [],
    "conflicts": [],
    "transactionId": "tx-..."
  },
  "warnings": []
}
```

**业务逻辑**：
1. 如果 `--ai-tools` 未提供，读取配置中的 selected tools，避免修复未选择工具。
2. 补齐 source tree，生成 runtime plan。
3. 对非托管 runtime 文件返回 `conflict`，不得覆盖。
4. 对 drift/missing/synced 目标按 transaction 写入或 dry-run 预览。
5. 返回 repaired/skipped/conflicts，供 doctor 或用户继续处理。

---

## 5. 局部数据模型

### 5.1 数据表设计

本 Capability 不使用数据库表。

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| N/A | N/A | N/A | N/A | N/A | N/A |

**索引设计**：
- 主键索引：N/A
- 唯一索引：N/A
- 普通索引：N/A

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| N/A | N/A | N/A | N/A | 本能力不使用缓存 |

### 5.3 数据流转图

```text
[Wizard answers / harness.config.json]
  --> [SelectedToolSet]
  --> [Adapter registry + source manifest]
  --> [Source tree ensure]
  --> [Runtime projection plan]
  --> [Transaction stageWrite]
  --> [Artifact summary + drift metadata]
```

### 5.4 核心结构

```ts
type AdapterArtifactKind = 'source' | 'runtime' | 'metadata' | 'agent' | 'skipped';

interface ProjectionMetadata {
  managedMarker: string;
  sourcePath: string;
  sourceHash: string;
  repairCommand: string;
}

interface AdapterArtifactPlanItem {
  tool: AdapterTool;
  kind: AdapterArtifactKind;
  sourcePath?: string;
  projectionPath?: string;
  status: 'planned' | 'synced' | 'missing' | 'drifted' | 'conflict' | 'skipped';
  reason?: string;
  metadata?: ProjectionMetadata;
}

interface AgentDefinitionTemplate {
  name: string;
  category: 'requirement' | 'design' | 'implement' | 'review';
  description: string;
  tools: string[];
  responsibilities: string[];
  inputContract: string[];
  outputContract: string[];
  constraints: string[];
}
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[createAdapterRegistry()]
  --> [ensureAdapterSources()]
  --> [ensureSharedSkillSources() creates SKILL.md + references/scripts/assets]
  --> [buildAdapterArtifactPlan(selectedTools)]
  --> [renderProjection() writes frontmatter + marker + source-hash + thin body]
  --> [applyProjectionWrites() stages runtime only for selected tools]
  --> [checkAdapterDrift() compares source-hash]
```

### 6.2 状态机

```text
[missing source] --ensureAdapterSources--> [source ready]
[source ready + selected tool] --plan--> [planned runtime]
[planned runtime] --transaction commit--> [synced]
[synced + source hash changed] --checkAdapterDrift--> [drifted]
[drifted] --repairAdapters--> [synced]
[runtime exists unmanaged] --plan/repair--> [conflict]
[tool not selected] --plan--> [skipped]
```

### 6.3 关键算法

#### 6.3.1 Source tree ensure

1. `ensureAdapterSources(cwd, entries)` 不再只处理传入 entries 的 tool source；它必须先调用 `ensureSharedSkillSources()`。
2. `ensureSharedSkillSources()` 写入：
   - `.harness/adapters/shared/skills/harness/SKILL.md`
   - `references/command-contract.md`
   - `references/document-contract.md`
   - `references/agent-orchestration.md`
   - `references/safety.md`
   - `scripts/validate-workspace.mjs`
   - `scripts/run-harness.mjs`
   - `scripts/parse-result.mjs`
   - `assets/AGENTS.block.md`
   - `assets/CLAUDE.template.md`
   - `assets/review-report.template.md`
3. Tool source `SKILL.md` 使用 shared `SKILL.md` 的薄包装或同源模板，不再出现 Claude source 有 `SKILL.md`、shared source 无 `SKILL.md` 的割裂。

#### 6.3.2 Runtime thin projection

1. `renderProjection()` 根据 `entry.tool` 生成对应 frontmatter。
2. 调用 `sanitizeInternalNames()` 清理用户可见文本。
3. 计算 `sourceHash = sha256(sourceContent).slice(0, 16)`。
4. 写入：
   - managed marker
   - `<!-- source: ... -->`
   - `<!-- source-hash: ... -->`
   - `<!-- repair: harness config --repair-adapters -->`
5. runtime body 只保留 CLI 路由表、AI 工具触发说明和 repair 指针；references/scripts/assets 不复制到 runtime。

#### 6.3.3 Agent definition rendering

1. `agent-templates.ts` 暴露 `listHarnessAgents()`，返回 19 个 agent template。
2. `renderClaudeAgent(template)` 生成带 frontmatter 的 `.md`，包含 `name`、`description`、`tools`、职责边界、输入输出、禁止事项。
3. `renderCodexAgent(template)` 生成 `.toml`，包含 model/effort、职责说明、工具约束和 prompt/body。
4. `harness-finding-validator` 使用专门模板，必须包含 evidence、file/line、severity、confidence、false-positive handling。
5. `generateSubagentDefs()` 兼容委托到 adapter renderer，避免同一 agent 内容有两套来源。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| N/A | 本地文件生成 | N/A | N/A | N/A | N/A |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>=20.0.0` | 文件系统、crypto hash、path 处理 | 无 | 无 | 必需 |
| commander | `^12.1.0` | CLI repair/config 参数入口 | 无 | 无 | 现有依赖 |
| vitest | `^2.0.0` | TDD 回归测试 | 无 | 无 | 测试依赖 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 写入 source/runtime projection | `fs` + transaction | UTF-8 | 不需要数据库 |
| SHA-256 hash | drift 检测 | `node:crypto` | 16 位短 hash | renderer/detector 共用 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| core/transaction | `beginTransaction()`、`stageWrite()`、`commitTransaction()` | cwd、dryRun、projection content | 原子写入或 dry-run | 已有 |
| core/config | `loadHarnessConfig()` | `.harness/config` | selected tools | 已有 |
| cli/main | `executePostWizardIntegration()` | wizard answers | artifact summary | 已有，需接入 artifact plan |
| commands/config | `handleRepairAdapters()` | cwd、dryRun、aiTools | repair result | 已有，需读取 config 默认工具 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 无强制环境变量 | N/A |
| 密钥/证书 | 不需要 | N/A |
| 网络策略 | 不需要网络 | N/A |
| 权限/角色 | 目标项目文件系统写权限 | 当前用户本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 参数校验异常 | `--ai-tools` 包含未知工具 | 返回错误码 `2601` 或参数错误，列出合法枚举 | CLI 显示非法工具名 |
| 源结构异常 | shared/tool source 缺少必需文件 | repair 可补齐；doctor 可报告 `skillSource` | 提示运行 repair |
| 投影缺失异常 | 已选择工具 runtime projection 缺失 | repair 重建；doctor 报 `2602` | 提示缺失路径 |
| 非托管冲突 | runtime 文件存在但无 managed marker | 不覆盖，返回 conflict | 用户需手动处理或备份 |
| 漂移异常 | source hash 与 runtime metadata 不一致 | repair 重写 managed projection | 显示 drifted 路径 |
| Agent 不合规 | agent 模板缺少必填字段 | 生成阶段阻断或测试失败 | 返回 `2603` |

### 8.2 重试与降级

- 重试次数：0；本地文件写入失败不自动重试，避免重复覆盖。
- 重试间隔：N/A。
- 降级策略：
  - source 缺失：repair 补齐 source 后再投影。
  - runtime conflict：跳过该文件并输出 conflict，不覆盖用户内容。
  - 未选择工具：记录 `skipped`，不视为错误。
  - dry-run：返回完整 plan，但写入数量为 0。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| AI 工具选择 | `aiTools.claude/codex/copilot/cursor` | 向导结果 | 决定 runtime projection 写入范围 |
| Agent 策略 | `orchestration.subagents` | `auto` | `auto` 或启用时生成 agent source/runtime |
| 最大并行 agent | `orchestration.maxParallelAgents` | `4` 或现有配置 | 写入 agent 说明，不在本能力调度 |
| Validator 必需 | `orchestration.validatorRequired` | `true` | 影响 finding-validator agent 描述 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--repair-adapters` | 重新生成 adapter runtime projection | 关闭 |
| `--ai-tools` | 限定 repair 工具范围 | 未传时使用 config 中 selected tools |
| `--dry-run` | 预览 source/runtime/skipped/conflict plan | 关闭 |
| `--json` | 输出机器可读 repair 结果 | 关闭 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：需修改的文件、类、方法已明确
> - [x] **现有约束已识别**：transaction、managed marker、hash drift、registry 薄结构、agent 生成偏移均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：未设计其他 Capability 的 Hook、doctor、sync 逻辑，仅输出可被其消费的 adapter artifact 信息
> - [x] **全局遵守**：遵循 overview.md 的 CLI JSON 返回体与错误码分段
> - [x] 前端设计已完成（确认 N/A）
> - [x] 后端接口已完成（初始化、repair、内部 plan、renderer）
> - [x] 数据模型已完成（无数据库，补充核心 TS 结构）
> - [x] **外部依赖已明确**：Node.js、commander、vitest、本地文件系统、crypto
> - [x] **环境权限已确认**：仅需本地文件系统写权限，无密钥/网络
> - [x] 异常处理策略已定义（含 conflict、missing、drift、skipped）
> - [x] 包含足够的局部细节支持任务拆解
