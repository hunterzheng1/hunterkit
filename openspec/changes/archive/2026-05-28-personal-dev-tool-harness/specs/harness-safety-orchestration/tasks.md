# 实施任务拆解 - harness-safety-orchestration

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-safety-orchestration` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-safety-orchestration/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-safety-orchestration/design.md` | 当前能力设计 |

### 1.2 实现范围

- Safety 类型定义（`SafetyHookRequest`、`SafetyDecision`、`SafetyEvent`、`SafetyPolicy`、`SubagentTask`）
- 策略引擎（`evaluateSafetyPolicy()`，汇总命令/文件/push/并行决策）
- 命令规范化器（`normalizeCommandLine()`，跨 shell 规范化）
- 危险命令守卫（`checkDangerousCommand()`，匹配 6 个默认阻断规则）
- 默认敏感规则（`getDefaultSecretPatterns()`，8 个默认敏感模式）
- 敏感文件过滤器（`filterSensitiveFiles()`、`assertNoSensitiveOutput()`）
- 路径守卫（`assertFilesInsideProject()`）
- Subagent 规划器（`planSubagentExecution()`）
- DAG 分析器（`findIndependentTaskGroups()`）
- 文件范围冲突检查器（`checkFileScopeConflicts()`）
- 串行回交规划器（`buildSerialHandoffPlan()`）
- Hook 路由器（`routeSafetyHook()`，分派 5 个 Hook）
- 5 个 Hook handler（dangerous-command、sync-after-doc-change、review-before-push、session-summary、compact-state）
- Push 门禁（`checkReviewBeforePush()`）
- 活跃状态读取器（`readActiveChangeState()`、`readCapabilityState()`）
- 事件写入器（`writeSafetyEvent()`，写入 `.harness/events/`）
- 事件脱敏器（`redactSafetyEvent()`）
- Hook 投影构建器（`buildHookProjection()`）
- 事件保留管理器（`pruneOldEvents()`）
- Doctor 安全检查（`runDoctorSafetyCheck()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path`、`crypto` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`
- 版本控制：Git >= 2.30.0（push 门禁）
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与规则基础                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ TASK-SO-01   │  │ TASK-SO-02   │  │ TASK-SO-03   │                    │
│  │ 类型定义      │  │ 命令规范化    │  │ 默认规则      │                    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                 │                             │
│         v                 v                 v                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-SO-04  单元测试骨架（依赖: 01, 02, 03）                   │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心守卫（可并行）                           │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-SO-05   │  │ TASK-SO-06   │  │ TASK-SO-07   │        │   │ │
│  │  │  │ 危险命令守卫  │  │ 敏感文件过滤  │  │ 路径守卫      │        │   │ │
│  │  │  │ 依赖: 04     │  │ 依赖: 04     │  │ 依赖: 04     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 编排与 Hook（可并行）                 │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │   │ │
│  │  │  │  │ TASK-SO-08   │  │ TASK-SO-09   │  │ TASK-SO-10   │  │   │   │ │
│  │  │  │  │ Subagent编排  │  │ Hook路由+门禁 │  │ 事件写入+脱敏 │  │   │   │ │
│  │  │  │  │ 依赖: 05~07  │  │ 依赖: 05~07  │  │ 依赖: 05~07  │  │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │   │ │
│  │  │  │         │                 │                 │           │   │   │ │
│  │  │  │         v                 v                 v           │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 策略引擎 + Doctor              │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-SO-11   │  │ TASK-SO-12   │              │   │   │   │ │
│  │  │  │  │  │ 策略引擎      │  │ Doctor检查    │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 08~10  │  │ 依赖: 08~10  │              │   │   │   │ │
│  │  │  │  │  └──────┬───────┘  └──────┬───────┘              │   │   │   │ │
│  │  │  │  │         │                 │                       │   │   │   │ │
│  │  │  │  │         v                 v                       │   │   │   │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │   │   │   │ │
│  │  │  │  │  │  层级 6 (依赖 L5) - 集成验证                   │ │   │   │   │ │
│  │  │  │  │  │  ┌──────────────┐                            │ │   │   │   │ │
│  │  │  │  │  │  │ TASK-SO-13   │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 集成测试      │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 依赖: 11,12  │                            │ │   │   │   │ │
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
| 层级 1 | TASK-SO-01, TASK-SO-02, TASK-SO-03 | ✅ 是 | 无 |
| 层级 2 | TASK-SO-04 | - | 层级 1 |
| 层级 3 | TASK-SO-05, TASK-SO-06, TASK-SO-07 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-SO-08, TASK-SO-09, TASK-SO-10 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-SO-11, TASK-SO-12 | ✅ 是 | 层级 4 |
| 层级 6 | TASK-SO-13 | - | 层级 5 |

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

### [TASK-SO-01] Safety 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
定义 safety-orchestration 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（35 个字段）、§5.1 SafetyEvent 模型

#### 输出
- `src/capabilities/safety-orchestration/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/types.ts`
2. 定义 `SafetyHookName` 枚举：`"dangerous-command" | "sync-after-doc-change" | "review-before-push" | "session-summary" | "compact-state"`
3. 定义 `SafetyHookRequest`：`{ hook, commandLine?, files?, activeChange?, json }`
4. 定义 `SafetyDecision`：`{ allowed, hook, eventsPath?, matchedRule?, suggestion? }`
5. 定义 `SafetyPolicy`：`{ dangerousCommands: DangerousCommandRule[], secretPatterns: SecretPattern[] }`
6. 定义 `DangerousCommandRule`：`{ pattern, suggestion }`
7. 定义 `SecretPattern`：`{ pattern, description }`
8. 定义 `SafetyEvent`：`{ schemaVersion, eventId, hook, allowed, matchedRule?, commandLine?, files?, activeChange?, reviewStatus?, subagentPlan?, createdAt }`
9. 定义 `SubagentTask`：`{ agentId, fileScope, dependencies, status }`，status 枚举 `"pending" | "running" | "completed" | "failed"`
10. 定义 `SubagentExecutionPlan`：`{ parallelGroups, serialHandoff, conflicts }`
11. 定义 `MatchedSafetyRule`：`{ type, pattern, suggestion }`

#### 验收标准
- [x] 所有类型与 design.md §1.1 字段追溯表一致
- [x] `SafetyHookName` 包含 5 个枚举值
- [x] `SafetyEvent` 包含 `schemaVersion: "safety-event.v1"`
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表、§5.1 数据模型

---

### [TASK-SO-02] 命令规范化器

- **类型**: 接口层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
实现 `normalizeCommandLine()` 函数，跨 shell 规范化命令字符串。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- design.md §6.3.1 危险命令匹配算法

#### 输出
- `src/capabilities/safety-orchestration/command-normalizer.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/command-normalizer.ts`
2. 实现 `normalizeCommandLine(raw: string): NormalizedCommand`：
   - 去除多余空白
   - 统一路径分隔符（`\` → `/`）
   - 保留引号语义
   - 按 shell 片段解析为主命令和参数数组
   - 支持 PowerShell、cmd、bash 基础形态
3. 返回 `{ raw, normalized, command, args[] }`

#### 验收标准
- [x] 正确规范化 bash 命令
- [x] 正确规范化 PowerShell 命令（`Remove-Item -Recurse -Force`）
- [x] 正确规范化 cmd 命令
- [x] 多余空白被去除
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（危险命令阻断）
- design.md 章节：§6.3.1 危险命令匹配算法

---

### [TASK-SO-03] 默认安全规则

- **类型**: 接口层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
实现 `getDefaultSecretPatterns()` 和默认 `dangerousCommands` 规则集。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- design.md §9.1 业务配置

#### 输出
- `src/capabilities/safety-orchestration/secret-patterns.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/secret-patterns.ts`
2. 实现 `getDefaultDangerousCommands(): DangerousCommandRule[]`：
   - `rm -rf`（建议：使用 `rm -i` 或指定具体文件）
   - `git reset --hard`（建议：使用 `git stash` 保存变更后重试）
   - `git clean -fdx`（建议：使用 `git clean -n` 预览后重试）
   - `Remove-Item -Recurse -Force`（建议：使用 `-Confirm` 参数）
   - `npm publish`（建议：使用 `npm pack --dry-run` 预览后重试）
   - `git push --force`（建议：使用 `git push --force-with-lease`）
3. 实现 `getDefaultSecretPatterns(): SecretPattern[]`：
   - `.env`、`.env.*`、`*.pem`、`*.key`、`*.p12`、`*.jks`、`*token*`、`*secret*`
4. 默认规则不可被移除，只允许追加

#### 验收标准
- [x] 6 个默认危险命令规则
- [x] 8 个默认敏感文件模式
- [x] 每个规则包含 suggestion
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（危险命令阻断、敏感文件过滤）
- design.md 章节：§9.1 业务配置

---

### [TASK-SO-04] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-SO-01, TASK-SO-02, TASK-SO-03
- **状态**: [x] 已完成

#### 任务描述
编写 safety-orchestration 模块完整单元测试骨架（红灯状态）。

#### 输入
- 已实现的类型、命令规范化、默认规则模块
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 实现步骤
1. 创建 `test/safety-orchestration/safety-orchestration.test.ts`
2. 编写 `normalizeCommandLine` 测试骨架（集成 TASK-SO-02）
3. 编写 `checkDangerousCommand` 测试骨架：
   - `should block rm -rf`
   - `should block git reset --hard`
   - `should block git clean -fdx`
   - `should block Remove-Item -Recurse -Force`
   - `should block npm publish`
   - `should block git push --force`
   - `should allow safe commands`
   - `should return 2801 with matchedRule and suggestion`
4. 编写 `filterSensitiveFiles` 测试骨架：
   - `should skip .env files`
   - `should skip *.pem, *.key files`
   - `should skip *token*, *secret* files`
   - `should return 2802 when reading sensitive content`
   - `should allow non-sensitive files`
5. 编写 `assertFilesInsideProject` 测试骨架：
   - `should reject paths outside project root`
   - `should accept paths inside project root`
6. 编写 `planSubagentExecution` 测试骨架：
   - `should find independent task groups`
   - `should detect file scope conflicts (2804)`
   - `should generate serial handoff for shared files`
   - `should allow parallel read-only reviewers`
7. 编写 `checkReviewBeforePush` 测试骨架：
   - `should block push when no review exists (2803)`
   - `should block push when P0 findings exist (2803)`
   - `should allow push when review passed`
8. 编写 `routeSafetyHook` 测试骨架：
   - `should route to correct hook handler`
   - `should return 2805 for unknown hook`
   - `should return 2805 for missing required params`
9. 编写 `writeSafetyEvent` 测试骨架：
   - `should write event to .harness/events/`
   - `should return 5801 on write failure`
   - `should not corrupt main command output`
10. 编写 `redactSafetyEvent` 测试骨架：
    - `should redact token/key in command line`
    - `should redact sensitive file paths`
11. 编写 `handleSessionSummaryHook` / `handleCompactStateHook` 测试骨架
12. 编写 `runDoctorSafetyCheck` 测试骨架
13. 编写 `evaluateSafetyPolicy` 测试骨架
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

### [TASK-SO-05] 危险命令守卫

- **类型**: 接口层
- **依赖**: TASK-SO-04
- **状态**: [x] 已完成

#### 任务描述
实现 `checkDangerousCommand()` 函数，匹配 dangerousCommands 并给出修复建议。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`、`command-normalizer.ts`、`secret-patterns.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/dangerous-command-guard.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/dangerous-command-guard.ts`
2. 实现 `checkDangerousCommand(normalized: NormalizedCommand, policy: SafetyPolicy): SafetyCheckResult`：
   - 对 normalized 命令执行确定性匹配
   - 匹配 6 个默认危险命令规则
   - 命中时返回 `{ allowed: false, code: 2801, matchedRule, suggestion }`
   - 未命中时返回 `{ allowed: true }`
3. 匹配必须确定性，不依赖模糊判断

#### 验收标准
- [x] 6 个默认危险命令全部被阻断
- [x] 安全命令被允许
- [x] 返回 matchedRule 和 suggestion
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（危险命令阻断）
- design.md 章节：§6.3.1 危险命令匹配算法

---

### [TASK-SO-06] 敏感文件过滤器

- **类型**: 接口层
- **依赖**: TASK-SO-04
- **状态**: [x] 已完成

#### 任务描述
实现 `filterSensitiveFiles()` 和 `assertNoSensitiveOutput()` 函数。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`、`secret-patterns.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/sensitive-file-filter.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/sensitive-file-filter.ts`
2. 实现 `filterSensitiveFiles(files: string[], secretPatterns: SecretPattern[]): { allowed: string[], skipped: string[] }`：
   - 将 files 转为项目内相对路径
   - 使用 secretPatterns 匹配
   - 命中文件进入 skip 列表
3. 实现 `assertNoSensitiveOutput(content: string, secretPatterns: SecretPattern[]): void`：
   - 检测输出内容是否包含敏感模式
   - 命中时抛出 2802

#### 验收标准
- [x] 敏感文件被正确跳过
- [x] 非敏感文件被允许
- [x] 输出内容包含敏感模式时返回 2802
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（敏感文件过滤）
- design.md 章节：§6.3.2 敏感文件过滤算法

---

### [TASK-SO-07] 路径守卫

- **类型**: 接口层
- **依赖**: TASK-SO-04
- **状态**: [x] 已完成

#### 任务描述
实现 `assertFilesInsideProject()` 函数，校验 files 均位于项目根目录内。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/path-guard.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/path-guard.ts`
2. 实现 `assertFilesInsideProject(files: string[], projectRoot: string): void`：
   - 对每个文件路径 normalize、resolve
   - 检查是否以 projectRoot 为前缀
   - 越界文件按敏感/无效输入阻断

#### 验收标准
- [x] 项目内路径通过
- [x] 越界路径被阻断
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§2.1 请求参数（files 约束）
- design.md 章节：§2.2 `path-guard.ts`

---

### [TASK-SO-08] Subagent 编排

- **类型**: 接口层
- **依赖**: TASK-SO-05, TASK-SO-06, TASK-SO-07
- **状态**: [x] 已完成

#### 任务描述
实现 `planSubagentExecution()`、`findIndependentTaskGroups()`、`checkFileScopeConflicts()` 和 `buildSerialHandoffPlan()` 函数。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/subagent-planner.ts`
- `src/capabilities/safety-orchestration/dag-analyzer.ts`
- `src/capabilities/safety-orchestration/file-scope-conflict-checker.ts`
- `src/capabilities/safety-orchestration/serial-handoff.ts`

#### 实现步骤
1. 创建 `dag-analyzer.ts`
2. 实现 `findIndependentTaskGroups(tasks: SubagentTask[]): SubagentTask[][]`：
   - 分析任务 DAG 的无依赖任务组
   - 返回可并行的任务组列表
3. 创建 `file-scope-conflict-checker.ts`
4. 实现 `checkFileScopeConflicts(tasks: SubagentTask[]): FileScopeConflict[]`：
   - 检测多 agent 写入文件范围是否重叠
   - 重叠返回冲突列表（含 agent id 和冲突文件）
5. 创建 `serial-handoff.ts`
6. 实现 `buildSerialHandoffPlan(conflicts: FileScopeConflict[]): SerialHandoffPlan`：
   - 将共享文件修改回交主流程串行处理
   - 生成串行处理摘要
7. 创建 `subagent-planner.ts`
8. 实现 `planSubagentExecution(tasks, options): SubagentExecutionPlan`：
   - 仅当任务复杂、范围大、可独立拆分时启用 subagent
   - 读-only reviewer 可并行
   - 写任务 fileScope 重叠时返回 2804 或转入 serial-handoff

#### 验收标准
- [x] 正确找出无依赖任务组
- [x] 正确检测文件范围冲突
- [x] 共享文件修改生成串行回交计划
- [x] 读-only 任务可并行
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（并行审查、并行实现）
- design.md 章节：§6.3.3 Subagent 并行边界算法

---

### [TASK-SO-09] Hook 路由与门禁

- **类型**: 接口层
- **依赖**: TASK-SO-05, TASK-SO-06, TASK-SO-07
- **状态**: [x] 已完成

#### 任务描述
实现 `routeSafetyHook()` 和 5 个 Hook handler，以及 `checkReviewBeforePush()`。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/hook-router.ts`
- `src/capabilities/safety-orchestration/hooks/dangerous-command.ts`
- `src/capabilities/safety-orchestration/hooks/sync-after-doc-change.ts`
- `src/capabilities/safety-orchestration/hooks/review-before-push.ts`
- `src/capabilities/safety-orchestration/hooks/session-summary.ts`
- `src/capabilities/safety-orchestration/hooks/compact-state.ts`
- `src/capabilities/safety-orchestration/review-gate.ts`
- `src/capabilities/safety-orchestration/active-state-reader.ts`

#### 实现步骤
1. 创建 `hook-router.ts`
2. 实现 `routeSafetyHook(request: SafetyHookRequest, policy: SafetyPolicy): SafetyDecision`：
   - 校验 Hook 名称，未知返回 2805
   - 校验必填参数（commandLine 等）
   - 分派到对应 Hook handler
3. 创建 5 个 Hook handler：
   - `handleDangerousCommandHook()`：调用 `checkDangerousCommand()`
   - `handleSyncAfterDocChangeHook()`：记录文档变更事件，不越权执行 sync
   - `handleReviewBeforePushHook()`：调用 `checkReviewBeforePush()`
   - `handleSessionSummaryHook()`：读取 active state，写入 session event
   - `handleCompactStateHook()`：写入可恢复状态，不含敏感内容
4. 创建 `review-gate.ts`
5. 实现 `checkReviewBeforePush(projectRoot): ReviewGateResult`：
   - 读取最近 review 状态摘要
   - 无 review 记录返回 2803
   - P0 finding 存在返回 2803
   - 通过返回 allowed=true
6. 创建 `active-state-reader.ts`
7. 实现 `readActiveChangeState()` 和 `readCapabilityState()`

#### 验收标准
- [x] Hook 路由正确分派
- [x] 未知 Hook 返回 2805
- [x] push 门禁正确检查 review 状态
- [x] session-summary 写入事件
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（push 前审查门禁、会话结束记录）
- design.md 章节：§6.3.4 Push 前审查门禁算法、§6.3.5 Session Summary 算法

---

### [TASK-SO-10] 事件写入与脱敏

- **类型**: 接口层
- **依赖**: TASK-SO-05, TASK-SO-06, TASK-SO-07
- **状态**: [x] 已完成

#### 任务描述
实现 `writeSafetyEvent()`、`redactSafetyEvent()`、`buildHookProjection()` 和 `pruneOldEvents()` 函数。

#### 输入
- `src/capabilities/safety-orchestration/types.ts`
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/event-writer.ts`
- `src/capabilities/safety-orchestration/event-redactor.ts`
- `src/capabilities/safety-orchestration/adapter-projection.ts`
- `src/capabilities/safety-orchestration/retention.ts`

#### 实现步骤
1. 创建 `event-writer.ts`
2. 实现 `writeSafetyEvent(event: SafetyEvent, eventsRoot: string): string`：
   - 写入 `.harness/events/<timestamp>-<event>.json`
   - 失败返回 5801
   - 不得破坏主命令输出
3. 创建 `event-redactor.ts`
4. 实现 `redactSafetyEvent(event: SafetyEvent, secretPatterns: SecretPattern[]): SafetyEvent`：
   - 脱敏 commandLine 中的 token/key
   - 脱敏文件路径中的敏感部分
   - 替换为 `[REDACTED]`
5. 创建 `adapter-projection.ts`
6. 实现 `buildHookProjection(hooks, tool): HookProjection`：
   - 为 Claude/Codex 生成 Hook 投影配置
   - schema 不可用时仅生成文档提示
7. 创建 `retention.ts`
8. 实现 `pruneOldEvents(eventsRoot, maxBytesPerMonth): PruneResult`：
   - 控制 `.harness/events/` 保留量 < 100 MB/月

#### 验收标准
- [x] 事件正确写入 `.harness/events/`
- [x] 写入失败返回 5801
- [x] 事件内容正确脱敏
- [x] Hook 投影正确生成
- [x] 旧事件正确清理
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（Hook 与事件审计）
- design.md 章节：§2.2 `event-writer.ts`、`event-redactor.ts`

---

### [TASK-SO-11] 策略引擎

- **类型**: 接口层
- **依赖**: TASK-SO-08, TASK-SO-09, TASK-SO-10
- **状态**: [x] 已完成

#### 任务描述
实现 `evaluateSafetyPolicy()` 函数，汇总命令、文件、push 门禁、subagent 冲突决策。

#### 输入
- 所有已实现的安全模块
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/policy-engine.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/policy-engine.ts`
2. 实现 `evaluateSafetyPolicy(request: SafetyHookRequest, policy: SafetyPolicy, projectRoot: string): SafetyDecision`：
   - 加载默认策略与项目配置
   - 默认 dangerousCommands 和 secretPatterns 不可被移除
   - `assertFilesInsideProject()` 校验路径
   - `normalizeCommandLine()` + `checkDangerousCommand()` 检查命令
   - `filterSensitiveFiles()` 检查文件
   - Hook 专属检查（review-before-push 等）
   - 返回 allow/deny 决策

#### 验收标准
- [x] 正确汇总所有安全检查
- [x] 默认规则不可被移除
- [x] 返回正确的 allow/deny 决策
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Safety Hook Dispatcher - 业务逻辑）

---

### [TASK-SO-12] Doctor 安全检查

- **类型**: 接口层
- **依赖**: TASK-SO-08, TASK-SO-09, TASK-SO-10
- **状态**: [x] 已完成

#### 任务描述
实现 `runDoctorSafetyCheck()` 函数，检查安全配置、Hook 投影、事件目录与策略状态。

#### 输入
- 所有已实现的安全模块
- `test/safety-orchestration/safety-orchestration.test.ts`

#### 输出
- `src/capabilities/safety-orchestration/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/safety-orchestration/command.ts`
2. 实现 `runDoctorSafetyCheck(context: CommandContext): Promise<CliResponse>`：
   - 读取 workspace safety 配置
   - 校验 dangerousCommands、secretPatterns
   - 检查 Hook 投影路径和 events 目录
   - 检查 Node/Git/Hook schema 兼容状态
   - 输出安全配置摘要
   - 不执行任何修复写入

#### 验收标准
- [x] 正确检查安全配置
- [x] 正确检查 Hook 投影状态
- [x] 输出配置摘要
- [x] 不执行写入
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§2.1 接口定义（Safety Doctor CLI）
- design.md 章节：§4.2 接口 2（Safety Doctor CLI）

---

### [TASK-SO-13] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-SO-11, TASK-SO-12
- **状态**: [x] 已完成

#### 任务描述
编写并运行集成测试，验证 safety-orchestration 端到端流程。

#### 输入
- 所有已实现的 safety-orchestration 模块

#### 输出
- `test/safety-orchestration/safety-integration.test.ts`

#### 实现步骤
1. 创建 `test/safety-orchestration/safety-integration.test.ts`
2. 编写端到端场景：
   - 危险命令阻断 → 验证 2801 + matchedRule
   - 敏感文件过滤 → 验证跳过 + 2802
   - push 门禁（无 review）→ 验证 2803
   - push 门禁（P0 finding）→ 验证 2803
   - push 门禁（review 通过）→ 验证 allowed
   - 并行冲突 → 验证 2804 或 serial-handoff
   - 未知 Hook → 验证 2805
   - 事件写入 → 验证 `.harness/events/` 文件
   - 事件脱敏 → 验证无敏感内容
   - session-summary → 验证事件内容
   - doctor 检查 → 验证配置摘要
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
| TASK-SO-02 | 单元测试 | 命令规范化（bash/PowerShell/cmd） | 正确解析 |
| TASK-SO-05 | 单元测试 | 危险命令（6 个规则 + 安全命令） | 正确阻断/允许 |
| TASK-SO-06 | 单元测试 | 敏感文件过滤（8 个模式） | 正确跳过/允许 |
| TASK-SO-07 | 单元测试 | 路径守卫（越界/正常） | 正确阻断/通过 |
| TASK-SO-08 | 单元测试 | Subagent 编排（并行/冲突/串行） | 正确计划 |
| TASK-SO-09 | 单元测试 | Hook 路由（5 个 Hook + 未知） | 正确分派 |
| TASK-SO-09 | 单元测试 | Push 门禁（无 review/P0/通过） | 正确阻断/允许 |
| TASK-SO-10 | 单元测试 | 事件写入/脱敏/保留 | 正确行为 |
| TASK-SO-11 | 单元测试 | 策略引擎全流程 | 正确决策 |
| TASK-SO-12 | 单元测试 | Doctor 检查 | 正确摘要 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 危险命令 | 任意 | Hook dangerous-command `rm -rf` | 返回 2801 |
| 敏感文件 | 含 .env | Hook 读取 .env | 返回 2802 |
| Push 无 review | 无 review 记录 | Hook review-before-push | 返回 2803 |
| Push P0 | P0 finding | Hook review-before-push | 返回 2803 |
| 并行冲突 | 重叠 fileScope | planSubagentExecution | 返回 2804 或 serial |
| 未知 Hook | 任意 | routeSafetyHook("unknown") | 返回 2805 |
| 事件写入 | 任意 | writeSafetyEvent | 文件存在于 events/ |
| Session summary | active change | Hook session-summary | 事件含 change 摘要 |

### 4.3 手动验证清单

- [x] `harness doctor --json` 输出安全配置摘要
- [x] 危险命令被正确阻断
- [x] 敏感文件被正确跳过
- [x] 事件文件存在于 `.harness/events/`
- [x] 事件文件不含敏感内容

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | safety 配置、state 路径、事务 |
| `harness-adapter-skill-runtime` | 其他能力 | 本变更 | ⏳ 待建 | Hook 投影 |
| `harness-review` | 其他能力 | 本变更 | ⏳ 待建 | 最近 review 状态 |
| `harness-develop` | 其他能力 | 本变更 | ⏳ 待建 | active change、任务 DAG |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path/crypto |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | push 门禁 |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`PolicyEngine`、`DangerousCommandGuard`）
- 方法名：camelCase（`checkDangerousCommand`、`filterSensitiveFiles`）
- 文件名：kebab-case（`dangerous-command-guard.ts`、`event-writer.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2801-2805、5801）

### 6.3 日志规范

- 敏感信息处理：事件和报告不得包含 token、key、证书正文

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/safety-orchestration/types.ts` | 共享类型定义 | TASK-SO-01 |
| `src/capabilities/safety-orchestration/command-normalizer.ts` | 命令规范化 | TASK-SO-02 |
| `src/capabilities/safety-orchestration/secret-patterns.ts` | 默认安全规则 | TASK-SO-03 |
| `src/capabilities/safety-orchestration/dangerous-command-guard.ts` | 危险命令守卫 | TASK-SO-05 |
| `src/capabilities/safety-orchestration/sensitive-file-filter.ts` | 敏感文件过滤 | TASK-SO-06 |
| `src/capabilities/safety-orchestration/path-guard.ts` | 路径守卫 | TASK-SO-07 |
| `src/capabilities/safety-orchestration/subagent-planner.ts` | Subagent 规划 | TASK-SO-08 |
| `src/capabilities/safety-orchestration/dag-analyzer.ts` | DAG 分析 | TASK-SO-08 |
| `src/capabilities/safety-orchestration/file-scope-conflict-checker.ts` | 文件冲突检查 | TASK-SO-08 |
| `src/capabilities/safety-orchestration/serial-handoff.ts` | 串行回交 | TASK-SO-08 |
| `src/capabilities/safety-orchestration/hook-router.ts` | Hook 路由 | TASK-SO-09 |
| `src/capabilities/safety-orchestration/hooks/dangerous-command.ts` | 危险命令 Hook | TASK-SO-09 |
| `src/capabilities/safety-orchestration/hooks/sync-after-doc-change.ts` | 文档同步 Hook | TASK-SO-09 |
| `src/capabilities/safety-orchestration/hooks/review-before-push.ts` | Push 门禁 Hook | TASK-SO-09 |
| `src/capabilities/safety-orchestration/hooks/session-summary.ts` | 会话摘要 Hook | TASK-SO-09 |
| `src/capabilities/safety-orchestration/hooks/compact-state.ts` | 压缩状态 Hook | TASK-SO-09 |
| `src/capabilities/safety-orchestration/review-gate.ts` | Push 门禁检查 | TASK-SO-09 |
| `src/capabilities/safety-orchestration/active-state-reader.ts` | 活跃状态读取 | TASK-SO-09 |
| `src/capabilities/safety-orchestration/event-writer.ts` | 事件写入 | TASK-SO-10 |
| `src/capabilities/safety-orchestration/event-redactor.ts` | 事件脱敏 | TASK-SO-10 |
| `src/capabilities/safety-orchestration/adapter-projection.ts` | Hook 投影 | TASK-SO-10 |
| `src/capabilities/safety-orchestration/retention.ts` | 事件保留 | TASK-SO-10 |
| `src/capabilities/safety-orchestration/policy-engine.ts` | 策略引擎 | TASK-SO-11 |
| `src/capabilities/safety-orchestration/command.ts` | Doctor 安全检查 | TASK-SO-12 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/safety-orchestration/safety-orchestration.test.ts` | 单元测试 | TASK-SO-04~12 |
| `test/safety-orchestration/safety-integration.test.ts` | 集成测试 | TASK-SO-13 |

### 7.3 文档更新

- [x] README 更新（safety 配置说明）
- [x] 接口文档更新（Hook 协议）
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
