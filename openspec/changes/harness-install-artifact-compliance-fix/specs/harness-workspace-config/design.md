# 局部技术实现方案 - harness-workspace-config

> **定位**：单一 Capability 的业务维度技术实现方案  
> **边界声明**：本设计只覆盖安装配置、安装状态、artifact health model、`harness status` 与 `harness doctor --json` 的结构化诊断，不设计 Skill、Hook、Sync 各自的生成细节。  
> **质量红线专注**：让 workspace config 和状态文件能真实反映安装产物健康度，并让 doctor 输出可自动验收、可定位、可修复。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | workspace config 记录安装产物健康信息 | `HarnessConfig.installation` 与 `ArtifactHealthSnapshot` | 配置/状态模型 | 保留 | 配置保存期望状态，状态文件保存实际产物快照 |
| 2 | 状态文件记录安装产物健康信息 | `.harness/state/install.json` 的 `artifacts`、`skippedArtifacts`、`health` | 状态模型 | 保留 | doctor 可基于 install state 复核产物 |
| 3 | Skill、Agent、Hook、文档投影一致性 | `diagnoseArtifactHealth()` | 诊断接口 | 保留 | 聚合 runtime projection、source structure、managed docs |
| 4 | 用户选择的 AI 工具 | `InstallStateSnapshot.selectedTools` | 状态字段 | 保留 | 由向导答案写入 |
| 5 | 能力列表 | `InstallStateSnapshot.capabilities` | 状态字段 | 保留 | 由向导答案写入 |
| 6 | Hook 强度 | `InstallStateSnapshot.hookStrength` | 状态字段 | 保留 | 用于判断 runtime hooks 是否必需 |
| 7 | 写入策略 | `InstallStateSnapshot.writePolicy` | 状态字段 | 保留 | 用于解释 skipped artifacts |
| 8 | 生成的 runtime artifacts | `InstallArtifactRecord[]` | 状态字段 | 保留 | 每个 runtime 文件必须可追踪 |
| 9 | skipped artifacts | `SkippedArtifactRecord[]` | 状态字段 | 保留 | 未选择工具或策略跳过时必须记录 |
| 10 | artifact 路径 | `InstallArtifactRecord.path` | 字段 | 保留 | doctor 报告缺失路径 |
| 11 | artifact 类型 | `InstallArtifactRecord.type` | 字段 | 保留 | `skill/hook/config/doc/agent/source` |
| 12 | artifact tool | `InstallArtifactRecord.tool` | 字段 | 保留 | `claude/codex/copilot/cursor/shared` |
| 13 | managed 标记 | `InstallArtifactRecord.managed` | 字段 | 保留 | 区分可修复投影和用户文件 |
| 14 | doctor 校验 `aiTools.*` 与 runtime artifacts 一致 | `diagnoseRuntimeProjectionConsistency()` | 诊断项 | 保留 | 触发 2110 |
| 15 | `aiTools.claude=true` 但 `.claude/skills/harness/SKILL.md` 缺失 | `projection.runtimeSkills` check | 诊断项 | 保留 | 明确路径缺失 |
| 16 | source hooks 存在但 runtime hooks/config 缺失 | `projection.runtimeHooks` check | 诊断项 | 保留 | 触发 ERROR/WARN，路径进入 `paths[]` |
| 17 | `.claude/hooks/` | runtime hook path | 路径字段 | 保留 | Claude hook runtime |
| 18 | `.claude/settings.json` | runtime hook config path | 路径字段 | 保留 | Claude hook config |
| 19 | `.codex/hooks/` | runtime hook path | 路径字段 | 保留 | Codex hook runtime |
| 20 | `.codex/hooks.json` | runtime hook config path | 路径字段 | 保留 | Codex hook config |
| 21 | shared Skill source `SKILL.md` | `skillSource.requiredPaths[]` | 诊断字段 | 保留 | 缺失时 2111 |
| 22 | shared Skill source `references/` | `skillSource.requiredPaths[]` | 诊断字段 | 保留 | 缺失时 2111 |
| 23 | shared Skill source `scripts/` | `skillSource.requiredPaths[]` | 诊断字段 | 保留 | 缺失时 2111 |
| 24 | shared Skill source `assets/` | `skillSource.requiredPaths[]` | 诊断字段 | 保留 | 缺失时 2111 |
| 25 | `AGENTS.md` 仍包含 DocSync 日常命令 | `managedDocs` check | 诊断项 | 保留 | 触发 2112 |
| 26 | 缺少 Harness managed block | `managedDocs` check | 诊断项 | 保留 | 触发 2112 |
| 27 | `harness sync --repair` 修复建议 | `DoctorCheck.repairCommand` | 输出字段 | 保留 | 每个 check 必须可操作 |
| 28 | `doctor --json` 合法 JSON | `CliResponse.data.checks: DoctorCheck[]` | 输出契约 | 保留 | 自动化验收依赖 |
| 29 | `id` | `DoctorCheck.id` | 输出字段 | 保留 | 稳定检查项 ID |
| 30 | `status` | `DoctorCheck.status` | 输出字段 | 保留 | `OK/WARN/ERROR` |
| 31 | `severity` | `DoctorCheck.severity` | 输出字段 | 保留 | `info/warn/error` |
| 32 | `message` | `DoctorCheck.message` | 输出字段 | 保留 | 用户可读说明 |
| 33 | `paths[]` | `DoctorCheck.paths` | 输出字段 | 保留 | 关联文件路径 |
| 34 | `repairCommand` | `DoctorCheck.repairCommand` | 输出字段 | 保留 | 修复建议 |
| 35 | doctor error 时非 0 | `runDoctorCommand()` 返回错误码 | CLI 行为 | 保留 | ERROR 聚合后退出失败 |
| 36 | 保留所有 warning 和 error | `DoctorResult.checks[]` | 输出结构 | 保留 | 不短路，只最后决定 code |
| 37 | safety secretPatterns 覆盖基线 | `validateSafetyBaseline()` | schema/doctor 校验 | 保留 | 缺失时 2113 |
| 38 | 缺失项 doctor ERROR | `safetyBaseline` check | 诊断项 | 保留 | paths 指向 harness.config.json |
| 39 | `.harness/config/*.local.json` 私有 | `diagnoseLocalConfigPrivacy()` | 诊断项 | 保留 | 防止本地配置进入可提交产物 |
| 40 | local config 不进安装摘要 | `filterReportableArtifacts()` | 输出过滤 | 保留 | install summary 只使用 reportable artifact |
| 41 | local config 不进 sync 报告 | `assertNoLocalConfigInReports()` | 诊断逻辑 | 保留 | doctor 发现泄漏时 ERROR/WARN |
| 42 | local config 不进发布包 | `diagnosePackagePrivacy()` | 诊断逻辑 | 保留 | 检查 package `files` 与 workspace artifact 列表 |
| 43 | CLI path `harness status` | `runStatusCommand()` health summary | CLI 入口 | 保留 | status 展示聚合健康摘要，不替代 doctor 明细 |
| 44 | CLI path `harness doctor --json` | `runDoctorCommand()` structured JSON | CLI 入口 | 保留 | 输出标准 CLI JSON |
| 45 | 标准 CLI JSON | `CliResponse` | 输出契约 | 保留 | 遵循 `code/msg/data/warnings` |
| 46 | Node.js `>=20.0.0` | `nodeVersion` check | 版本依赖 | 保留 | 现有 doctor 检查保留 |
| 47 | Error 2110 | `ARTIFACT_HEALTH_ERROR` | 错误码 | 保留 | runtime projection 与 config 不一致 |
| 48 | Error 2111 | `SKILL_SOURCE_INVALID` | 错误码 | 保留 | Skill 源结构缺失 |
| 49 | Error 2112 | `MANAGED_DOCS_INVALID` | 错误码 | 保留 | 根文档缺少 block 或暴露旧命令 |
| 50 | Error 2113 | `SAFETY_BASELINE_INVALID` | 错误码 | 保留 | safety 配置少于基线 |

### 1.2 完整性自检

- **用户输入字段总数**：50 个
- **设计输出字段总数**：50 个
- **差异说明**：无字段移除；安装健康信息拆分为配置期望模型与状态快照模型，doctor 输出从字符串 map 升级为结构化数组。
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/core/types.ts` | workspace config types | `HarnessConfig` | 新增字段 | 增加 `installation`、`documents` marker、`safety` baseline 相关类型 |
| `src/core/types.ts` | workspace config types | `WorkspaceStatus` | 扩展响应 | 增加 `healthSummary`，供 `harness status` 使用 |
| `src/core/types.ts` | workspace config types | 新增 `InstallStateSnapshot`、`InstallArtifactRecord`、`DoctorCheck` | 新增类型 | 统一 install state 与 doctor JSON 结构 |
| `src/core/config-schema.ts` | config schema | `validateHarnessConfig()` | 扩展逻辑 | 校验 `aiTools.*` 布尔结构、documents marker、safety baseline 覆盖 |
| `src/core/config-schema.ts` | config schema | `createDefaultConfig()` | 替换默认值 | 写入完整 safety baseline 与 documents managed block 默认值 |
| `src/core/config.ts` | config loader | `loadHarnessConfig()` | 扩展逻辑 | validation errors 带 code/path，供 doctor 转换为 check |
| `src/core/config.ts` | config loader | `mergeLocalConfig()` | 扩展逻辑 | 返回 local 文件路径和 ignored keys，确保 reportableConfig 不含 local 信息 |
| `src/core/workspace.ts` | workspace service | `ensureWorkspace()` | 扩展参数 | 支持接收 install metadata 或初始 artifact plan，写入 richer `install.json` |
| `src/core/workspace.ts` | workspace service | `readWorkspaceStatus()` | 扩展逻辑 | 加载 health summary 而不是只返回 initialized/capabilities |
| `src/core/state.ts` | state service | `writeStateFile()`、`readStateFile()` | 扩展逻辑 | 增加 install state typed helper 与 schemaVersion 校验 |
| `src/commands/doctor.ts` | doctor command | `runDoctorCommand()` | 替换实现 | 从 `Record<string,string>` 改为 `DoctorCheck[]` 聚合器 |
| `src/commands/status.ts` | status command | `runStatusCommand()` | 扩展逻辑 | 输出安装健康摘要、selected tools、artifact counts |
| `src/cli/main.ts` | CLI main | `buildConfigFromAnswers()` | 扩展逻辑 | 将 selected tools、hookStrength、writePolicy 写入配置期望 |
| `src/cli/main.ts` | CLI main | `executePostWizardIntegration()` | 扩展逻辑 | 收集 generated/skipped artifacts，最终写入 install state |
| `src/adapters/registry.ts` | adapter registry | `createAdapterRegistry()` | 读取锚点 | doctor 使用 registry 推导 expected runtime Skill artifacts |
| `src/adapters/types.ts` | adapter types | `AdapterRegistryEntry` | 可选扩展 | 增加 artifact type/managed metadata，减少 doctor 推断 |
| `test/core/workspace-config.test.ts` | workspace config tests | config/state/workspace 用例 | 扩展测试 | 覆盖 install state、safety baseline、local config privacy |
| `test/commands/commands.test.ts` | command tests | doctor/status 用例 | 扩展测试 | 覆盖 doctor checks[]、nonzero、all errors preserved |

### 2.2 需新建的文件

| 文件路径（建议） | 模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/core/install-state.ts` | install state service | 构建、读取、更新 `.harness/state/install.json` | 被 workspace/main/doctor 调用 | 避免 install state 结构散落在 CLI main |
| `src/core/artifact-health.ts` | artifact health model | 根据 config、install state、registry 计算 expected/actual artifacts | 被 doctor/status 调用 | 核心健康模型 |
| `src/core/doctor-checks.ts` | doctor checks | 聚合基础、artifact、skillSource、managedDocs、safety、local privacy 检查 | 被 `commands/doctor.ts` 调用 | 让 doctor command 保持薄入口 |
| `src/core/safety-baseline.ts` | safety baseline | 导出 secret pattern 基线和校验函数 | 被 config-schema/doctor/safety 调用 | 与 safety capability 共用 |
| `test/core/artifact-health.test.ts` | artifact health tests | TDD 覆盖 expected/runtime artifact 一致性 | vitest | 重点覆盖 2110 |
| `test/commands/doctor-json.test.ts` | doctor JSON tests | TDD 覆盖 checks[]、nonzero、保留所有问题 | vitest | 避免 doctor 回退为字符串 map |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| install state 太薄 | `ensureWorkspace()` 只写 `installedAt` 和 `nodeVersion` | doctor 缺少安装期选择和 artifact 依据 | 新增 typed install state，并由 post wizard 补写 artifact snapshot |
| doctor checks 是字符串 map | `runDoctorCommand()` 返回 `checks: Record<string,string>` 且永远 code 0 | 无法满足自动化 JSON 与非零退出 | 引入 `DoctorCheck[]` 聚合器，最终按 ERROR 选择 code |
| config schema 只做存在性检查 | `validateHarnessConfig()` 不校验 baseline 覆盖 | safety 缩水不会暴露 | 增加 baseline 校验和结构校验 |
| local config merge 已有但未诊断 | `mergeLocalConfig()` 返回 reportableConfig/localOverrides | 需要保证 local 文件不进入摘要/报告 | 扩展返回 local 文件路径，并在 doctor 做 privacy check |
| adapter registry 有 runtime path | `createAdapterRegistry()` 已列出 projectionPath | doctor 可复用 expected runtime Skill 判断 | artifact health 读取 registry，不重复硬编码 |
| init artifacts 是 string[] | `executePostWizardIntegration()` 只收集字符串 artifact | 无法记录 type/tool/managed | 转换为 `InstallArtifactRecord`，CLI summary 可由该记录渲染 |
| package files 只含 dist/README | `package.json.files` 限制发布包 | local config 默认不进 npm 包，但 doctor 仍应确认 | package privacy check 读取 package files 与 workspace reportable artifacts |

---

## 3. 局部前端设计

本 Capability 不包含 Web 前端。用户可见界面为 CLI 的文本/JSON 输出，具体结构在第 4 节与第 5 节定义。

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| 不适用 | CLI capability | 无浏览器 UI | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| 不适用 | N/A | N/A | N/A |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| 不适用 | N/A | N/A | N/A |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 不适用 | N/A | N/A | N/A |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Config validation | `validateHarnessConfig(config)` | 函数调用 | 校验结构与 safety baseline |
| Install state 写入 | `writeInstallState(paths, snapshot, tx)` | 函数调用 | 写 `.harness/state/install.json` |
| Install state 读取 | `readInstallState(paths)` | 函数调用 | 给 doctor/status 读取安装快照 |
| Artifact health | `evaluateArtifactHealth(cwd, config, installState)` | 函数调用 | 计算 expected/actual artifacts 与缺口 |
| Doctor checks 聚合 | `collectDoctorChecks(cwd, options)` | 函数调用 | 生成 `DoctorCheck[]` |
| Status summary | `readWorkspaceStatus(paths)` | 函数调用 | 返回 health summary |
| CLI doctor | `harness doctor --json` | 命令 | 输出标准 CLI JSON |
| CLI status | `harness status` | 命令 | 输出工作区与健康摘要 |

### 4.2 接口详细设计

#### 接口 1：Install state 写入

**基本信息**：
- 路径：`src/core/install-state.ts`
- 方法：`writeInstallState(paths: WorkspacePaths, snapshot: InstallStateSnapshot, tx: Transaction): void`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `paths` | `WorkspacePaths` | 是 | workspace 路径集合 | 必须由 `resolveWorkspacePaths()` 生成 |
| `snapshot.selectedTools` | `AdapterTool[]` | 是 | 用户选择的 AI 工具 | 与 config.aiTools 一致 |
| `snapshot.capabilities` | string[] | 是 | 用户选择的能力 | 与 config.capabilities 一致 |
| `snapshot.hookStrength` | `none/basic/full` | 是 | Hook 强度 | 来自 wizard answer |
| `snapshot.writePolicy` | string | 是 | 写入策略 | 例如 `project-config` |
| `snapshot.artifacts` | `InstallArtifactRecord[]` | 是 | 已生成 artifact | 每条含 path/type/tool/managed |
| `snapshot.skippedArtifacts` | `SkippedArtifactRecord[]` | 是 | 跳过 artifact | 每条含 path/type/tool/reason |

**响应结构**：

```ts
interface InstallStateSnapshot {
  schemaVersion: 1;
  installedAt: string;
  nodeVersion: string;
  packageVersion?: string;
  selectedTools: AdapterTool[];
  capabilities: string[];
  hookStrength: "none" | "basic" | "full";
  writePolicy: string;
  artifacts: InstallArtifactRecord[];
  skippedArtifacts: SkippedArtifactRecord[];
  health: ArtifactHealthSummary;
}
```

**业务逻辑**：
1. `executePostWizardIntegration()` 在所有 source/runtime/doc 写入完成后构建 snapshot。
2. artifacts 从 adapter projection、hook projection、managed docs、agent definitions、config/state 写入结果统一转换而来。
3. local config 文件不得进入 `artifacts` 或 `skippedArtifacts`。
4. 通过 transaction 写入 `.harness/state/install.json`，保证 schemaVersion 自动存在。

#### 接口 2：Artifact health 评估

**基本信息**：
- 路径：`src/core/artifact-health.ts`
- 方法：`evaluateArtifactHealth(cwd: string, config: HarnessConfig, installState: InstallStateSnapshot | null): ArtifactHealthResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | string | 是 | 目标项目根目录 | 必须存在 |
| `config` | `HarnessConfig` | 是 | 当前配置 | 已通过 schema 校验 |
| `installState` | `InstallStateSnapshot \| null` | 否 | 安装状态 | 缺失时可从 config 推导 expected artifacts |

**响应结构**：

```ts
interface ArtifactHealthResult {
  expected: InstallArtifactRecord[];
  actual: InstallArtifactRecord[];
  missing: InstallArtifactRecord[];
  unexpected: InstallArtifactRecord[];
  stale: InstallArtifactRecord[];
  summary: ArtifactHealthSummary;
}
```

**业务逻辑**：
1. 从 `config.aiTools` 推导 runtime Skill artifacts：
   - Claude：`.claude/skills/harness/SKILL.md`
   - Codex：`.agents/skills/harness/SKILL.md`
   - Copilot：`.github/copilot-instructions.md`
   - Cursor：`.cursor/skills/harness/SKILL.md`
2. 从 `hookStrength` 和 selected tools 推导 runtime hook artifacts。
3. 从 documents 配置推导 `AGENTS.md`、`CLAUDE.md`、README managed block 期望。
4. 对每个 expected artifact 检查文件是否存在、managed marker 是否存在、路径是否与 install state 一致。
5. 不将 `.harness/config/*.local.json` 计入 reportable artifacts。

#### 接口 3：Doctor checks 聚合

**基本信息**：
- 路径：`src/core/doctor-checks.ts`
- 方法：`collectDoctorChecks(cwd: string, options: DoctorCheckOptions): DoctorResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | string | 是 | 目标项目根目录 | 必须存在 |
| `options.json` | boolean | 是 | 是否 JSON 输出 | 来自 global options |
| `options.includeWarnings` | boolean | 否 | 是否保留 WARN | 默认 true |

**响应结构**：

```ts
interface DoctorCheck {
  id: string;
  status: "OK" | "WARN" | "ERROR";
  severity: "info" | "warn" | "error";
  message: string;
  paths: string[];
  repairCommand: string;
  code?: 2110 | 2111 | 2112 | 2113;
}

interface DoctorResult {
  checks: DoctorCheck[];
  warnings: string[];
  errors: DoctorCheck[];
  exitCode: number;
}
```

**业务逻辑**：
1. 所有检查都执行，不因第一个 ERROR 短路。
2. 基础检查：workspace initialized、directory integrity、config validity、node version、legacy sources。
3. artifact 检查：`projection.runtimeSkills`、`projection.runtimeHooks`、`skillSource`、`managedDocs`。
4. config 检查：`safetyBaseline`、`localConfigPrivacy`。
5. 若存在 ERROR，`exitCode` 选择优先级最高的错误码：2111/2110/2112/2113；同时保留所有 warning/error。

#### 接口 4：CLI doctor

**基本信息**：
- 路径：`src/commands/doctor.ts`
- 方法：`runDoctorCommand(context: CommandContext): Promise<CliResponse>`
- 认证：不需要

**响应结构**：

```json
{
  "code": 2110,
  "msg": "Artifact health error",
  "data": {
    "command": "doctor",
    "checks": [
      {
        "id": "projection.runtimeSkills",
        "status": "ERROR",
        "severity": "error",
        "message": "Claude runtime skill is missing",
        "paths": [".claude/skills/harness/SKILL.md"],
        "repairCommand": "harness config --repair-adapters --ai-tools claude",
        "code": 2110
      }
    ]
  },
  "warnings": []
}
```

**业务逻辑**：
1. 调用 `collectDoctorChecks()`。
2. `data.checks` 始终为数组，不再只返回字符串 map。
3. 为兼容旧调用，可在 `data.checksById` 提供派生 map，但不得替代 `checks[]`。
4. 返回 code 为 `DoctorResult.exitCode`，ERROR 时 CLI main 将转为非 0 进程退出码。

---

## 5. 局部数据模型

### 5.1 数据结构设计

#### 模型：InstallArtifactRecord

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| path | string | 是 | 无 | 相对项目根路径 | N/A |
| type | `"config" \| "state" \| "skill" \| "agent" \| "hook" \| "doc" \| "source" \| "report"` | 是 | 无 | artifact 类型 | N/A |
| tool | `AdapterTool \| "shared" \| "workspace"` | 是 | 无 | 归属工具 | N/A |
| managed | boolean | 是 | true | 是否由 Harness 管理 | N/A |
| marker | string | 否 | 无 | managed marker 或 hash | N/A |
| sourcePath | string | 否 | 无 | 对应 source 路径 | N/A |
| generatedAt | string | 否 | 当前时间 | 写入时间 | N/A |

#### 模型：SkippedArtifactRecord

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| path | string | 是 | 无 | 被跳过的相对路径 | N/A |
| type | string | 是 | 无 | artifact 类型 | N/A |
| tool | string | 是 | 无 | 归属工具 | N/A |
| reason | string | 是 | 无 | 跳过原因，如 `tool-not-selected` | N/A |
| managed | boolean | 是 | true | 预期是否 Harness 管理 | N/A |

#### 模型：ArtifactHealthSummary

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| status | `"healthy" \| "warning" \| "error"` | 是 | 无 | 聚合健康状态 | N/A |
| expectedCount | number | 是 | 0 | 期望 artifact 数量 | N/A |
| presentCount | number | 是 | 0 | 实际存在数量 | N/A |
| missingCount | number | 是 | 0 | 缺失数量 | N/A |
| staleCount | number | 是 | 0 | marker/hash 不一致数量 | N/A |

#### 模型：DoctorCheck

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| id | string | 是 | 无 | 稳定检查项 ID | N/A |
| status | `"OK" \| "WARN" \| "ERROR"` | 是 | 无 | 检查状态 | N/A |
| severity | `"info" \| "warn" \| "error"` | 是 | 无 | 严重级别 | N/A |
| message | string | 是 | 无 | 可读信息 | N/A |
| paths | string[] | 是 | `[]` | 相关路径 | N/A |
| repairCommand | string | 是 | `harness doctor` | 修复建议 | N/A |
| code | number | 否 | 无 | 2110/2111/2112/2113 | N/A |

#### 模型：HarnessConfig.installation

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| selectedTools | `AdapterTool[]` | 是 | `[]` | 安装选择的 AI 工具 | N/A |
| hookStrength | `"none" \| "basic" \| "full"` | 是 | `"none"` | Hook 强度 | N/A |
| writePolicy | string | 是 | `"project-config"` | 写入策略 | N/A |
| artifactSchemaVersion | number | 是 | 1 | artifact health 模型版本 | N/A |

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 不使用缓存 | N/A | N/A | 每次 doctor/status 实时读取磁盘 | 安装健康必须反映当前文件状态 |

### 5.3 数据流转图

```text
[WizardAnswers]
  --> [buildConfigFromAnswers]
  --> [ensureWorkspace writes config + thin install state]
  --> [post wizard writes skill/hooks/docs]
  --> [collect generated/skipped artifacts]
  --> [writeInstallState richer snapshot]

[harness doctor --json]
  --> [load config + merge reportable local config]
  --> [read install state]
  --> [evaluate artifact health]
  --> [collect doctor checks]
  --> [CliResponse code/msg/data.checks/warnings]

[harness status]
  --> [read workspace status]
  --> [read install health summary]
  --> [CliResponse data.healthSummary]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

#### 初始化健康快照流程

```text
[interactive wizard answers]
  --> [build config with installation expectation]
  --> [ensureWorkspace creates .harness and base install.json]
  --> [projection writers return structured artifact records]
  --> [filter reportable artifacts, exclude *.local.json]
  --> [evaluate initial health summary]
  --> [writeInstallState updates .harness/state/install.json]
```

关键规则：
- `install.json` 必须记录 selected tools、capabilities、hookStrength、writePolicy。
- runtime artifacts 和 skipped artifacts 都要记录，便于 doctor 区分“缺失”和“按选择跳过”。
- artifact 记录必须包含 `path/type/tool/managed`。

#### doctor 流程

```text
[runDoctorCommand]
  --> [collect base checks]
  --> [load config]
  --> [read install state]
  --> [artifact health checks]
  --> [skill source structure check]
  --> [managed docs check]
  --> [safety baseline check]
  --> [local config privacy check]
  --> [aggregate all checks, choose exit code]
```

关键规则：
- 所有 check 执行完再返回。
- ERROR 不覆盖 WARN；两者都保留在 `data.checks[]`。
- `warnings` 顶层只放简短摘要，详细问题在 `data.checks[]`。

### 6.2 状态机

```text
[uninitialized] --ensureWorkspace--> [initialized-no-artifact-snapshot]
[initialized-no-artifact-snapshot] --postWizardSnapshot--> [healthy-or-warning]
[healthy-or-warning] --runtime missing--> [artifact-error:2110]
[healthy-or-warning] --skill source missing--> [skill-source-error:2111]
[healthy-or-warning] --docs invalid--> [managed-docs-error:2112]
[healthy-or-warning] --safety baseline missing--> [safety-baseline-error:2113]
[any] --local config leaked into reportable artifacts--> [privacy-error-or-warn]
```

### 6.3 关键算法

#### expected artifacts 推导

```text
expected = []
for each enabled aiTool:
  add registry projection paths for runtime skills
if hookStrength != "none":
  add runtime hook configs/scripts for selected hook-capable tools
if sync enabled:
  add AGENTS.md and selected-tool short entry docs
always:
  add .harness/config/harness.config.json
  add .harness/state/install.json

compare expected with filesystem and installState.artifacts
```

#### doctor exit code 选择

```text
errors = checks where status == ERROR
if errors empty:
  exitCode = 0
else:
  exitCode = first code by priority [2111, 2110, 2112, 2113]
  if no priority match, exitCode = first error.code ?? 1
```

理由：
- Skill source 缺失会影响后续 repair 和 projection 判断，所以优先于 runtime 缺失。
- 仍保留所有 checks，不因优先级丢失信息。

#### safety baseline 校验

```text
missing = BASELINE_SECRET_PATTERNS - config.safety.secretPatterns
if missing.length > 0:
  emit DoctorCheck {
    id: "safetyBaseline.secretPatterns",
    status: "ERROR",
    code: 2113,
    paths: [".harness/config/harness.config.json"],
    repairCommand: "harness config --repair-safety"
  }
```

基线至少包含：
- `.env`
- `.env.*`
- `.env*`
- `*.pem`
- `*.key`
- `*.p12`
- `*.jks`
- `*token*`
- `*secret*`

#### local config privacy 校验

```text
localFiles = .harness/config/*.local.json
reportableArtifacts = installState.artifacts + latest sync report references + package files
if any reportable artifact path includes localFiles:
  emit privacy check ERROR/WARN
else:
  emit OK with localFiles in non-reportable metadata only
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | 本 Capability 完全本地执行 | N/A | N/A | N/A | N/A |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js `node:fs`、`node:path` | Node.js `>=20.0.0` | 读取配置、状态、artifact 文件 | 无 | 无 | 沿用现有运行时 |
| package metadata | `package.json.files` | 判断本地私有配置不会进入发布包 | 无 | 无 | 仅本地文件读取 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读取 `.harness/config`、`.harness/state`、runtime projections | `readFileSync`、`existsSync` | 目标项目 cwd | doctor 不应修改文件 |
| Harness transaction | 写入 install state | `stageWrite` | `dryRun` | 初始化阶段复用 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| Adapter registry | `createAdapterRegistry()` | 无 | runtime skill expected paths | 已有 |
| Adapter projection writer | projection statuses | selected tools | generated runtime skill records | 已有，需转换 artifact record |
| Safety defaults | `BASELINE_SECRET_PATTERNS` | 无 | safety baseline | 待抽取 |
| Sync managed docs | managed doc markers/exposure check | cwd/config | managed docs health | 待由 sync capability 提供或本地轻量检查 |
| Hook projection | runtime hook expected paths | selected tools/hookStrength | hook health | 待由 safety capability 提供或本地轻量检查 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 读权限 | doctor/status 需要读取目标项目 `.harness/**` 与 runtime projections | 用户在目标项目运行 CLI |
| 写权限 | init 需要写 `.harness/state/install.json` | 用户初始化时已有项目写权限 |
| 环境变量/密钥 | 无 | N/A |
| 网络策略 | 无网络依赖 | N/A |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| Artifact health error | config 选择的 tool 与 runtime artifact 不一致 | doctor check `projection.*` 返回 ERROR，code 2110 | 显示缺失路径和 repair command |
| Skill source invalid | shared skill source 缺 `SKILL.md`、`references/`、`scripts/`、`assets/` | doctor check `skillSource` 返回 ERROR，code 2111 | 提示 `harness config --repair-adapters` |
| Managed docs invalid | 根文档缺 Harness block 或暴露旧命令 | doctor check `managedDocs` 返回 ERROR，code 2112 | 提示 `harness sync --repair` |
| Safety baseline invalid | `secretPatterns` 缺 baseline 项 | config validation 与 doctor check 返回 2113 | 列出缺失 patterns |
| Install state missing | `.harness/state/install.json` 不存在或 schemaVersion 缺失 | WARN 或 ERROR，依据 config 是否已初始化 | 提示重新运行 init/doctor repair |
| Local config privacy leak | `.local.json` 出现在 artifacts/report/package 列表 | doctor privacy check 返回 WARN/ERROR | 提示移除报告引用或更新过滤 |
| Config invalid JSON | `harness.config.json` 无法解析 | doctor 保留 configValidity ERROR，不短路其他可执行检查 | 显示 config 路径 |

### 8.2 重试与降级

- **重试次数**：文件读取和 JSON 解析不自动重试。
- **重试间隔**：不适用。
- **降级策略**：
  - install state 缺失时，doctor 从 config 和 adapter registry 推导 expected artifacts，并输出 install state warning。
  - local config 解析失败时，忽略其覆盖值但报告 privacy/parse warning。
  - package metadata 缺失时，跳过 package privacy 检查并返回 WARN。
  - status 只输出摘要，不替代 doctor 明细；异常时提示运行 `harness doctor --json`。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 安装选择工具 | `installation.selectedTools` | `[]` | 与 `aiTools.*` 同步保存 |
| Hook 强度 | `installation.hookStrength` | `"none"` | 用于 artifact expected 推导 |
| 写入策略 | `installation.writePolicy` | `"project-config"` | 解释 skipped artifacts |
| Artifact schema | `installation.artifactSchemaVersion` | `1` | install state 与 doctor 模型版本 |
| Managed 文档列表 | `documents.managed` | `["README.md", "AGENTS.md", "CLAUDE.md"]` | 供 managed docs check 使用 |
| Managed block 起止 | `documents.managedBlockStart/End` | `<!-- harness:start -->` / `<!-- harness:end -->` | 供 doctor 判断根文档 |
| Safety baseline | `safety.secretPatterns` | 完整实施方案基线 | schema 和 doctor 必须校验覆盖 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `aiTools.claude` | 期望 Claude runtime Skill 与 hooks | 用户选择决定 |
| `aiTools.codex` | 期望 Codex runtime Skill 与 hooks | 用户选择决定 |
| `aiTools.copilot` | 期望 Copilot instructions | 用户选择决定 |
| `aiTools.cursor` | 期望 Cursor runtime Skill | 用户选择决定 |
| `capabilities.sync` | 是否检查 managed root docs | 用户选择决定 |
| `doctor --json` | 输出结构化 checks | 用户命令决定 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：`core/types.ts`、`config-schema.ts`、`workspace.ts`、`state.ts`、`doctor.ts`、`status.ts`、`main.ts` 等修改点已明确。
> - [x] **现有约束已识别**：install state 太薄、doctor 字符串 map、schema 只校验存在性、local config 未诊断等约束已列出。
> - [x] **字段完整性**：字段追溯表覆盖 spec 的所有场景、输出字段和错误码。
> - [x] **边界遵守**：未设计 Skill、Hook、Sync 的具体生成逻辑，仅声明 workspace-config 对其产物进行健康判断。
> - [x] **全局遵守**：CLI 输出遵循 `code/msg/data/warnings`，错误码使用 2110/2111/2112/2113。
> - [x] 前端设计已完成：确认本 Capability 无浏览器 UI。
> - [x] 后端接口已完成：定义 install state、artifact health、doctor checks、status summary。
> - [x] 数据模型已完成：定义 InstallArtifactRecord、SkippedArtifactRecord、ArtifactHealthSummary、DoctorCheck、installation config。
> - [x] **外部依赖已明确**：仅依赖 Node.js、本地文件系统和 package metadata。
> - [x] **环境权限已确认**：读写 `.harness` 与读取 runtime projection 的权限已说明。
> - [x] 异常处理策略已定义：包含 2110/2111/2112/2113、install state 缺失、local config privacy 和 config JSON 异常。
> - [x] 包含足够的局部细节支持任务拆解。
