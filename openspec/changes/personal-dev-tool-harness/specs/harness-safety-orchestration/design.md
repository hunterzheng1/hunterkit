# 局部技术实现方案 - harness-safety-orchestration

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-safety-orchestration`，负责确定性安全策略、Hook 路由、subagent 编排边界、push 门禁和事件审计，不设计 inspect、sync、develop、review、adapter 等其他能力的内部实现。
>
> **质量红线**：安全判断必须确定性、可审计、默认保守；阻断类 Hook 不得修改源码；事件和报告不得包含敏感文件内容。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `hook` | `SafetyHookRequest.hook` | enum | ✅ 保留 | Hook 名称，限定为 spec 中枚举 |
| 2 | `commandLine` | `SafetyHookRequest.commandLine` | string | ✅ 保留 | 待执行命令，dangerous-command 和 review-before-push 必需 |
| 3 | `files` | `SafetyHookRequest.files` | string[] | ✅ 保留 | 本次涉及文件，必须位于项目根目录内 |
| 4 | `activeChange` | `SafetyHookRequest.activeChange` | string | ✅ 保留 | 当前变更名，kebab-case |
| 5 | `--json` | `SafetyHookRequest.json` | boolean | ⚠️ 重命名 | 转为 camelCase `json`，语义不变 |
| 6 | `allowed` | `SafetyDecision.allowed` | boolean | ✅ 保留 | 是否允许继续执行 |
| 7 | `data.hook` | `SafetyDecision.hook` | enum | ✅ 保留 | 决策关联的 Hook 名称 |
| 8 | `eventsPath` | `SafetyDecision.eventsPath` | path | ✅ 保留 | `.harness/events/<timestamp>-<event>.json` |
| 9 | `error.data.commandLine` | `SafetyErrorData.commandLine` | string | ✅ 保留 | 被阻断的命令 |
| 10 | `matchedRule` | `SafetyErrorData.matchedRule` | string | ✅ 保留 | 命中的安全规则 |
| 11 | `dangerousCommands` | `SafetyPolicy.dangerousCommands` | string[] | ✅ 保留 | 默认危险命令规则集合 |
| 12 | `rm -rf` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 13 | `git reset --hard` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 14 | `git clean -fdx` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 15 | `Remove-Item -Recurse -Force` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 16 | `npm publish` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 17 | `git push --force` | `DangerousCommandRule.pattern` | string | ✅ 保留 | 默认阻断规则 |
| 18 | `secretPatterns` | `SafetyPolicy.secretPatterns` | string[] | ✅ 保留 | 敏感文件与内容过滤规则 |
| 19 | `.env` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 20 | `.env.*` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 21 | `*.pem` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 22 | `*.key` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 23 | `*.p12` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 24 | `*.jks` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 25 | `*token*` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 26 | `*secret*` | `SecretPattern.pattern` | glob | ✅ 保留 | 默认敏感文件规则 |
| 27 | `agent id` | `SubagentTask.agentId` | string | ✅ 保留 | 并行任务审计字段 |
| 28 | `文件范围` | `SubagentTask.fileScope` | path[] | ✅ 保留 | 并行冲突检查依据 |
| 29 | `依赖关系` | `SubagentTask.dependencies` | string[] | ✅ 保留 | DAG 无依赖组判断依据 |
| 30 | `完成状态` | `SubagentTask.status` | enum | ✅ 保留 | 并行任务审计字段 |
| 31 | `schemaVersion` | `SafetyEvent.schemaVersion` | string | ✅ 保留 | Hook 输入输出与事件兼容字段 |
| 32 | `.harness/events/` | `SafetyEventStore.eventsRoot` | path | ✅ 保留 | 默认事件写入目录 |
| 33 | `.harness/reports/` | `SafetyEventStore.reportsRoot` | path | ✅ 保留 | 门禁或总结报告目录 |
| 34 | `.harness/state/active-change.json` | `SafetyState.activeChangePath` | path | ✅ 保留 | active change 读取来源 |
| 35 | `.harness/state/capabilities.json` | `SafetyState.capabilitiesPath` | path | ✅ 保留 | capability 状态读取来源 |

### 1.2 完整性自检

- **用户输入字段总数**：35 个
- **设计输出字段总数**：35 个
- **差异说明**：仅 `--json` 转换为 `json` 以适配 TypeScript/JSON 命名，语义不变。
- **完整性确认**：[x] 已确认所有字段都有对应处理

### 1.3 Spec 需求项覆盖表

| Spec 需求项 | 设计落点 | 覆盖方式 |
|------------|---------|---------|
| 危险命令与敏感文件防护 | `policy-engine.ts`、`command-normalizer.ts`、`dangerous-command-guard.ts`、`secret-patterns.ts`、`sensitive-file-filter.ts` | 对命令和文件进行确定性匹配，命中后阻断并返回规则与修复建议 |
| Subagent 编排边界 | `subagent-planner.ts`、`dag-analyzer.ts`、`file-scope-conflict-checker.ts`、`serial-handoff.ts` | 仅并行无依赖且文件范围不重叠的任务，共享文件修改回到主流程串行 |
| Hook 与事件审计 | `hook-router.ts`、`review-gate.ts`、`event-writer.ts`、`session-summary.ts`、`compact-state.ts` | 支持指定 Hook，写入 `.harness/events/` 或 `.harness/reports/`，记录 active change、pending checks 和关键产物路径 |

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无现有实现文件 | 无 | 无 | 纯新建 | 当前仓库未发现 `src/`、`bin/`、`lib/`、`test/` 等实现目录；本 Capability 以新建模块设计 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/safety-orchestration/types.ts` | `SafetyHookRequest`、`SafetyDecision`、`SafetyEvent` | 定义 Hook 请求、决策、策略、事件、subagent 任务类型 | 无 | 所有安全编排子模块共享类型 |
| `src/capabilities/safety-orchestration/command.ts` | `registerSafetyCommands()`、`runDoctorSafetyCheck()` | 挂载 `harness doctor` 的安全检查入口 | CLI command handler | 只读检查配置与 Hook 状态 |
| `src/capabilities/safety-orchestration/policy-engine.ts` | `evaluateSafetyPolicy()` | 汇总命令、文件、push 门禁、subagent 冲突决策 | 无 | 返回 allow/deny 和 matchedRule |
| `src/capabilities/safety-orchestration/command-normalizer.ts` | `normalizeCommandLine()` | 跨 shell 规范化命令字符串 | 无 | 支持 PowerShell、cmd、bash 基础形态 |
| `src/capabilities/safety-orchestration/dangerous-command-guard.ts` | `checkDangerousCommand()` | 匹配 dangerousCommands 并给出修复建议 | policy adapter | 命中返回 `2801` |
| `src/capabilities/safety-orchestration/secret-patterns.ts` | `getDefaultSecretPatterns()` | 提供 `.env`、key、token、secret 等默认敏感规则 | 无 | 可从配置扩展但不能移除默认规则 |
| `src/capabilities/safety-orchestration/sensitive-file-filter.ts` | `filterSensitiveFiles()`、`assertNoSensitiveOutput()` | 跳过敏感文件并阻断输出内容 | path/glob adapter | 命中读取或输出内容返回 `2802` |
| `src/capabilities/safety-orchestration/path-guard.ts` | `assertFilesInsideProject()` | 校验 files 均位于项目根目录内 | 无 | 越界文件按敏感/无效输入阻断 |
| `src/capabilities/safety-orchestration/subagent-planner.ts` | `planSubagentExecution()` | 判断何时启用 subagent 与任务分发 | 无 | 仅复杂、范围大、可独立拆分时启用 |
| `src/capabilities/safety-orchestration/dag-analyzer.ts` | `findIndependentTaskGroups()` | 分析任务 DAG 的无依赖任务组 | 无 | 支持 apply 阶段并行候选 |
| `src/capabilities/safety-orchestration/file-scope-conflict-checker.ts` | `checkFileScopeConflicts()` | 检测多 agent 写入文件范围是否重叠 | 无 | 重叠返回 `2804` |
| `src/capabilities/safety-orchestration/serial-handoff.ts` | `buildSerialHandoffPlan()` | 将共享文件修改回交主流程串行处理 | 无 | 生成串行处理摘要 |
| `src/capabilities/safety-orchestration/hook-router.ts` | `routeSafetyHook()` | 分派 dangerous-command、review-before-push 等 Hook | Hook dispatcher | 校验 Hook 名称，非法返回 `2805` |
| `src/capabilities/safety-orchestration/hooks/dangerous-command.ts` | `handleDangerousCommandHook()` | Hook 入口：危险命令阻断 | Hook handler | 默认只读 |
| `src/capabilities/safety-orchestration/hooks/sync-after-doc-change.ts` | `handleSyncAfterDocChangeHook()` | Hook 入口：文档变更后同步建议/事件 | Hook handler | 不直接越权执行 sync 写入 |
| `src/capabilities/safety-orchestration/hooks/review-before-push.ts` | `handleReviewBeforePushHook()` | Hook 入口：push 前审查门禁 | Hook handler | 未 review 或 P0 时返回 `2803` |
| `src/capabilities/safety-orchestration/hooks/session-summary.ts` | `handleSessionSummaryHook()` | Hook 入口：会话结束摘要 | Hook handler | 写 active change、pending checks、artifact paths |
| `src/capabilities/safety-orchestration/hooks/compact-state.ts` | `handleCompactStateHook()` | Hook 入口：压缩状态记录 | Hook handler | 写可恢复状态，不包含敏感内容 |
| `src/capabilities/safety-orchestration/review-gate.ts` | `checkReviewBeforePush()` | 读取最近 review 状态并判定 push 是否允许 | review status adapter | 未 review 或 P0 返回 `2803` |
| `src/capabilities/safety-orchestration/active-state-reader.ts` | `readActiveChangeState()`、`readCapabilityState()` | 读取 active change 与 capability 状态 | workspace state adapter | session-summary/compact-state 使用 |
| `src/capabilities/safety-orchestration/event-writer.ts` | `writeSafetyEvent()` | 写入 `.harness/events/**` JSON 事件 | workspace transaction adapter | 失败返回 `5801`，不得破坏主输出 |
| `src/capabilities/safety-orchestration/event-redactor.ts` | `redactSafetyEvent()` | 写事件前脱敏命令、路径和摘要 | secret pattern adapter | 防止泄漏 token/key |
| `src/capabilities/safety-orchestration/adapter-projection.ts` | `buildHookProjection()` | 为 Claude/Codex 生成 Hook 投影配置 | adapter transaction adapter | Hook 安装失败可回滚 |
| `src/capabilities/safety-orchestration/retention.ts` | `pruneOldEvents()` | 控制 `.harness/events/**` 保留量 | 无 | 默认 < 100 MB/月 |
| `test/safety-orchestration/safety-orchestration.test.ts` | safety tests | 覆盖命令阻断、敏感文件、并行冲突、push 门禁、事件写入 | Test runner | tasks 阶段按 TDD 继续细拆 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 代码基线 | 当前仓库没有 Harness CLI 实现源码 | 不能锚定已有类/方法 | 所有代码锚点标注为纯新建 |
| 安全默认保守 | spec 要求危险命令默认阻断 | 不能把危险命令交给下游确认后再执行 | `dangerous-command-guard` 在 Hook 入口最先执行 |
| 敏感文件不泄露 | 事件文件不加密 | 不能记录敏感文件内容或凭据正文 | `event-redactor` 和 `sensitive-file-filter` 双层保护 |
| Hook 超时 | 总超时 10000 毫秒，超时按失败处理 | Hook 逻辑必须短路径、无网络 | 本 Capability 不联网，读状态与规则优先 |
| subagent 写入冲突 | 多 agent 不得同时修改共享文件 | 并行前必须声明 fileScope 并做重叠检查 | 重叠任务进入 `serial-handoff` |
| push 门禁 | git push 前必须检查 review 状态 | 需要读取最近审查摘要 | `review-gate` 仅读取 review 状态，不设计 review 逻辑 |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `SafetyHookTextView` | 终端展示 | Hook 环境不支持 JSON 时输出 allow/deny 摘要 | 无 |
| `SafetyJsonView` | JSON 输出 | 输出统一响应体和 Hook 决策 | 无 |
| `DoctorSafetyView` | 终端展示 | 展示 Hook 配置、危险规则、敏感规则、最近事件状态 | `PolicySummaryTable` |
| `PolicySummaryTable` | 终端展示 | 展示 dangerousCommands、secretPatterns 和启用状态 | 无 |
| `SubagentPlanView` | 终端展示 | 展示并行任务组、文件范围冲突和串行回交计划 | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `policy` | `SafetyPolicy` | 默认策略 | 配置加载后合并默认规则 |
| `hookRequest` | `SafetyHookRequest | null` | `null` | Hook 或 CLI 参数解析完成后更新 |
| `decision` | `SafetyDecision | null` | `null` | policy engine 评估后更新 |
| `matchedRules` | `MatchedSafetyRule[]` | `[]` | 命令、文件或 push 门禁命中时更新 |
| `subagentPlan` | `SubagentExecutionPlan | null` | `null` | DAG 和 fileScope 分析后更新 |
| `eventWriteResult` | `SafetyEventWriteResult | null` | `null` | 事件写入成功或失败后更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness doctor` | `DoctorSafetyView` / `SafetyJsonView` | 本地文件系统读权限 | 检查 safety 配置和 Hook 投影状态 |
| `Hook: dangerous-command` | `SafetyHookTextView` / `SafetyJsonView` | AI 工具 Hook 调用权限 | 阻断危险命令 |
| `Hook: review-before-push` | `SafetyHookTextView` / `SafetyJsonView` | Git 与本地状态读取权限 | git push 前门禁 |
| `Hook: session-summary` | `SafetyHookTextView` / `SafetyJsonView` | `.harness/events` 写权限 | 会话结束摘要 |
| `Hook: compact-state` | `SafetyHookTextView` / `SafetyJsonView` | `.harness/events` 写权限 | 压缩恢复状态 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| AI 工具请求执行命令 | `routeSafetyHook()` | `hook=dangerous-command`、`commandLine` | 返回 allow/deny、matchedRule、修复建议 |
| AI 工具请求 push | `handleReviewBeforePushHook()` | `commandLine=git push` | 检查最近 review，阻断或允许 |
| apply 阶段请求并行 | `planSubagentExecution()` | DAG task list、fileScope | 返回可并行组和串行回交项 |
| 会话结束 | `handleSessionSummaryHook()` | activeChange、files | 写入 session event |
| 用户执行 doctor | `runDoctorSafetyCheck()` | `--json` 可选 | 输出 Hook 配置和策略摘要 |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Safety Doctor CLI | `CLI: harness doctor` | 本地进程调用 | 检查安全配置、Hook 投影、事件目录与策略状态 |
| Safety Hook Dispatcher | `Hook: dangerous-command / sync-after-doc-change / review-before-push / session-summary / compact-state` | AI 工具 Hook 调用 | 执行确定性安全决策并写审计事件 |

### 4.2 接口详细设计

#### 接口 1：Safety Hook Dispatcher

**基本信息**：
- 路径：`Hook: dangerous-command / sync-after-doc-change / review-before-push / session-summary / compact-state`
- 方法：本地进程调用
- 认证：依赖 AI 工具 Hook 权限和本地文件系统权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `hook` | string | 否 | Hook 名称 | 枚举：`dangerous-command`、`sync-after-doc-change`、`review-before-push`、`session-summary`、`compact-state` |
| `commandLine` | string | 否 | 待执行命令 | dangerous-command/review-before-push 调用时必填 |
| `files` | string[] | 否 | 本次涉及文件 | 每个路径必须位于项目根目录内 |
| `activeChange` | string | 否 | 当前变更名 | kebab-case |
| `json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "allowed": true,
    "hook": "review-before-push",
    "eventsPath": ".harness/events/20260528-session.json"
  }
}
```

**业务逻辑**：
1. `routeSafetyHook()` 校验 Hook 名称，未知或缺参数返回 `2805`。
2. `loadSafetyPolicy()` 加载默认策略与项目配置，默认 dangerousCommands 和 secretPatterns 不可被移除。
3. `assertFilesInsideProject()` 校验 files 路径，越界直接阻断。
4. 对 `commandLine` 调用 `normalizeCommandLine()`，再执行 `checkDangerousCommand()`。
5. 对 files 调用 `filterSensitiveFiles()`；若请求读取或输出敏感内容，返回 `2802`。
6. `review-before-push` 调用 `checkReviewBeforePush()`，未 review 或存在 P0 返回 `2803`。
7. `session-summary` 与 `compact-state` 读取 active state，构造可恢复摘要。
8. 所有 Hook 决策经 `redactSafetyEvent()` 后调用 `writeSafetyEvent()`。
9. 事件写入失败返回 `5801` 或 warning，但不得让主命令输出混入敏感内容。

#### 接口 2：Safety Doctor CLI

**基本信息**：
- 路径：`CLI: harness doctor`
- 方法：本地进程调用
- 认证：本地文件系统读权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "allowed": true,
    "hook": "doctor",
    "eventsPath": ".harness/events/20260528-doctor.json"
  }
}
```

**业务逻辑**：
1. 读取 workspace safety 配置。
2. 校验 dangerousCommands、secretPatterns、Hook 投影路径和 events 目录。
3. 检查 Node/Git/Hook schema 兼容状态。
4. 输出安全配置摘要，不执行任何修复写入。

---

## 5. 局部数据模型

### 5.1 数据表设计

本 Capability 不新增服务端数据库表。数据以本地 JSON 配置、状态和事件文件存储。

#### 模型名：`SafetyEvent`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `schemaVersion` | string | 是 | `safety-event.v1` | 事件 schema 版本 | 无 |
| `eventId` | string | 是 | UUID v4 | 事件唯一标识 | 文件名索引 |
| `hook` | enum | 是 | 无 | Hook 名称 | 无 |
| `allowed` | boolean | 是 | false | 是否允许继续执行 | 无 |
| `matchedRule` | string | 否 | null | 命中的规则 | 无 |
| `commandLine` | string | 否 | null | 脱敏后的命令 | 无 |
| `files` | string[] | 否 | `[]` | 脱敏后的项目内相对路径 | 无 |
| `activeChange` | string | 否 | null | 当前变更名 | 无 |
| `reviewStatus` | object | 否 | null | 最近 review 摘要，不含 finding 正文 | 无 |
| `subagentPlan` | object | 否 | null | agent id、fileScope、dependencies、status 摘要 | 无 |
| `created_at` | 时间戳 | 是 | 当前时间 | 创建时间，遵循 overview.md 通用字段 | 无 |

**索引设计**：
- 主键索引：无数据库表；文件名使用 `<timestamp>-<event>.json` 便于时间排序。
- 唯一索引：`eventId` 由 UUID v4 保证唯一。
- 普通索引：无。

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| `.harness/events/<timestamp>-<event>.json` | JSON | 默认按月保留，容量上限 100 MB/月 | 每次关键 Hook 写入 | 安全审计事件 |
| `.harness/reports/safety/<timestamp>-gate.json` | JSON | 用户清理或保留策略清理 | push 门禁或 doctor 生成 | 门禁/诊断报告 |
| `.harness/state/active-change.json` | JSON | 被 develop 状态更新覆盖 | session-summary 读取 | 当前活动 change |
| `.harness/state/capabilities.json` | JSON | 被能力状态更新覆盖 | session-summary/compact-state 读取 | capability 状态 |

### 5.3 数据流转图

```text
[Hook request / doctor command]
  --> [load safety policy]
  --> [normalize command + guard files]
  --> [dangerous command / sensitive file / push gate / subagent conflict checks]
  --> [allow or deny decision]
  --> [redact event]
  --> [.harness/events or .harness/reports]
  --> [JSON or text response]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[parse hook request]
  --> [validate hook and paths]
  --> [load deterministic policy]
  --> [evaluate command and files]
  --> [evaluate hook-specific gate]
  --> [redact decision event]
  --> [write event]
  --> [return allow/deny]
```

### 6.2 状态机（如有）

```text
[received]
  --valid request--> [policy_loaded]
  --dangerous command matched--> [denied_2801]
  --secret pattern matched--> [denied_2802]
  --push review missing or P0--> [denied_2803]
  --subagent file overlap--> [denied_2804]
  --hook invalid--> [failed_2805]
  --checks passed--> [allowed]
  --event write success--> [audited]
  --event write failure--> [failed_5801]
```

### 6.3 关键算法（如有）

#### 6.3.1 危险命令匹配算法

1. `normalizeCommandLine()` 去除多余空白、统一路径分隔符、保留引号语义。
2. 将命令按 shell 片段解析为主命令和参数数组。
3. 对 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force` 执行确定性匹配。
4. 命中时返回 `allowed=false`、`code=2801`、`matchedRule` 和修复建议。
5. 未命中时继续执行敏感文件和 Hook 专属检查。

#### 6.3.2 敏感文件过滤算法

1. 将 files 转为项目内相对路径，绝对路径必须落在项目根目录内。
2. 使用默认 `secretPatterns` 匹配 `.env`、`.env.*`、`*.pem`、`*.key`、`*.p12`、`*.jks`、`*token*`、`*secret*`。
3. inspect、sync、review、knowledge 扫描时命中文件进入 skip 列表。
4. Hook 请求读取、输出或发布命中文件内容时返回 `2802`。
5. 写事件前再次脱敏 path、commandLine 和摘要内容。

#### 6.3.3 Subagent 并行边界算法

1. `planSubagentExecution()` 接收任务 DAG、任务复杂度、fileScope 和读写模式。
2. 仅当任务复杂、范围较大或任务可独立拆分时进入 subagent 计划。
3. `findIndependentTaskGroups()` 找出无依赖任务组。
4. `checkFileScopeConflicts()` 对每个候选并行组做 fileScope 交集检测。
5. 读-only reviewer 可并行；写任务 fileScope 重叠时返回 `2804` 或转入 `serial-handoff`。
6. 共享文件修改必须由主流程串行处理，并在事件中记录 handoff plan。

#### 6.3.4 Push 前审查门禁算法

1. `review-before-push` 只处理 `git push` 及等价命令。
2. `checkReviewBeforePush()` 读取最近 review 状态摘要。
3. 若没有最近 review 记录，返回 `2803`，提示运行 `harness review`。
4. 若最近 review 存在 P0 finding，返回 `2803`，提示先处理阻断问题。
5. 若 review 状态通过，返回 allowed=true 并写入 gate 事件。

#### 6.3.5 Session Summary 与 Compact State 算法

1. 读取 active change、pending checks、能力状态和关键产物路径。
2. 丢弃敏感文件内容，仅保留相对路径和状态摘要。
3. 写入 `.harness/events/<timestamp>-session-summary.json` 或 compact-state 事件。
4. 写入失败返回 `5801`，不得污染源代码或已有状态文件。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无远程服务 | 本地 Hook、安全策略和事件审计不建立网络连接 | 无 | 0 毫秒连接超时 | 无 | 不适用 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>= 20.0.0` | Hook 执行、CLI doctor、事件写入 | 无 | 无 | 缺失时阻断 Hook 安装 |
| Git | `>= 2.30.0` | push 门禁与变更状态读取 | 无 | 无 | 非 Git 项目禁用 push Hook |
| Claude settings hook schema | v1 | Claude Hook 投影 | 本地工具配置 | 无 | 不可用时仅生成文档提示 |
| Codex hooks schema | v1 | Codex Hook 投影 | 本地工具配置 | 无 | 不可用时仅生成文档提示 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读取配置、状态、review 摘要，写事件 | Node fs API | 项目根目录内路径 | 禁止越界读取 |
| 事务写入适配器 | 写事件、报告、Hook 投影 | 临时文件 + rename + rollback | `.harness/events`、adapter paths | 事件写入失败不得破坏主命令输出 |
| Hook 运行环境 | AI 工具命令前/会话结束触发 | 本地进程调用 | hook schema v1 | 不支持 JSON 时输出纯文本摘要 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-workspace-config | `resolveWorkspace()`、`readHarnessConfig()`、`transactionalWrite()` | 项目根目录、事件写入计划 | safety 配置、state 路径、事务结果 | 待建 |
| harness-adapter-skill-runtime | `projectHookAdapters()` | Hook 投影计划 | Claude/Codex Hook 投影文件 | 待建 |
| harness-review | `readLatestReviewStatus()` | 项目根目录 | 最近 review 状态、P0/P1/P2 摘要 | 待建 |
| harness-develop | `readActiveChange()`、`readTaskDag()` | activeChange | active change、pending checks、任务 DAG | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 第一版不要求额外环境变量 | 无 |
| 密钥/证书 | 不需要密钥；事件和报告不得包含 token、key、证书正文 | 无 |
| 网络策略 | 不建立网络连接 | 无 |
| 权限/角色 | Hook 默认只读；session-summary 只写 `.harness/events/**`；Hook 投影安装写 adapter 配置 | 本地文件系统与 AI 工具 Hook 权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 危险命令阻断 | commandLine 命中 dangerousCommands | 返回 `2801` 并写阻断事件 | 展示 matchedRule 与修复建议 |
| 敏感文件阻断 | 文件命中 secretPatterns 且命令试图读取或输出内容 | 返回 `2802` 并跳过内容 | 展示命中模式，不展示文件内容 |
| push 门禁失败 | 未运行 review 或存在 P0 finding | 返回 `2803` | 提示运行 `harness review` 或处理 P0 |
| 并行冲突 | 多 agent 任务声明重叠写入文件 | 返回 `2804` 或生成串行回交计划 | 展示冲突文件与 agent id |
| Hook 配置无效 | Hook 名称、脚本或参数缺失 | 返回 `2805` | 展示缺失字段和支持的 Hook 名称 |
| 事件写入失败 | `.harness/events/**` 写入失败 | 返回 `5801` 或附加 warning | 展示事件路径和文件系统错误 |

### 8.2 重试与降级

- 重试次数：事件写入 0 次；Hook 决策不重试。
- 重试间隔：不适用。
- 降级策略：
  - Claude/Codex Hook 投影 schema 不可用时，仅生成文档提示，不安装 Hook。
  - 非 Git 项目禁用 `review-before-push`，但保留 dangerous-command 与 session-summary。
  - 事件写入失败时返回 `5801`，不得继续假装审计成功。
  - Hook 环境不支持 JSON 时输出纯文本摘要，但内部仍按统一 `SafetyDecision` 构造。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 危险命令规则 | `safety.dangerousCommands` | `rm -rf,git reset --hard,git clean -fdx,Remove-Item -Recurse -Force,npm publish,git push --force` | 默认阻断规则，不允许移除，只允许追加 |
| 敏感文件规则 | `safety.secretPatterns` | `.env,.env.*,*.pem,*.key,*.p12,*.jks,*token*,*secret*` | 默认敏感模式，不允许移除，只允许追加 |
| 事件目录 | `safety.eventsRoot` | `.harness/events` | Hook 事件写入目录 |
| 安全报告目录 | `safety.reportsRoot` | `.harness/reports/safety` | doctor 和 gate 报告目录 |
| Hook 总超时 | `safety.hookTimeoutMs` | `10000` | Hook 超时必须按失败处理 |
| 事件保留上限 | `safety.eventsRetentionBytesPerMonth` | `104857600` | 每月默认 100 MB |
| subagent 文件冲突策略 | `orchestration.fileConflictPolicy` | `serial-handoff` | 写范围重叠时回到主流程串行 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `safety.enableDangerousCommandGuard` | 启用危险命令阻断 | 开启 |
| `safety.enableSensitiveFileGuard` | 启用敏感文件过滤和输出阻断 | 开启 |
| `safety.enableReviewBeforePush` | 启用 push 前审查门禁 | 开启，非 Git 项目自动禁用 |
| `safety.enableSessionSummary` | 启用会话结束摘要事件 | 开启 |
| `safety.enableCompactState` | 启用 compact-state 可恢复状态事件 | 开启 |
| `orchestration.enableSubagents` | 允许符合条件的 subagent 并行 | 开启，但受 DAG 和 fileScope 检查限制 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：当前确认为纯新建，并列出拟建文件、模块和函数
> - [x] **现有约束已识别**：危险命令阻断、敏感文件过滤、Hook 超时、push 门禁和 subagent 写入冲突均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的内部逻辑，仅声明必要依赖
> - [x] **全局遵守**：遵循 overview.md 的统一返回体、错误码和时间戳约定
> - [x] 前端设计已完成（CLI/Hook 展示组件、状态、路由、交互）
> - [x] 后端接口已完成（Hook dispatcher、doctor CLI、参数、响应、逻辑）
> - [x] 数据模型已完成（SafetyEvent、本地事件/报告/state 文件、缓存保留策略）
> - [x] **外部依赖已明确**：Node.js、Git、Claude/Codex Hook schema 和本地文件系统已列出
> - [x] **环境权限已确认**：本地 Hook 权限、文件系统权限、无密钥、无网络策略已说明
> - [x] 异常处理策略已定义（含 Hook 投影降级、非 Git 降级、事件写入失败策略）
> - [x] 包含足够的局部细节支持任务拆解
