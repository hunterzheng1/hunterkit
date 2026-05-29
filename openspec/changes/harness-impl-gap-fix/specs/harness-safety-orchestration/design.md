# 局部技术实现方案 - harness-safety-orchestration

> **⚠️ 边界声明**：本设计仅服务于 `harness-safety-orchestration` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | dangerous-command Hook | hooks.dangerousCommand | HookDef | ✅ 保留 | |
| 2 | sync-after-doc-change Hook | hooks.syncAfterDocChange | HookDef | ✅ 保留 | |
| 3 | review-before-push Hook | hooks.reviewBeforePush | HookDef | ✅ 保留 | |
| 4 | session-summary Hook | hooks.sessionSummary | HookDef | ✅ 保留 | |
| 5 | compact-state Hook | hooks.compactState | HookDef | ✅ 保留 | |
| 6 | Claude settings.json | claudeSettings | object | ✅ 保留 | |
| 7 | Codex hooks.json | codexHooks | object | ✅ 保留 | |
| 8 | Subagent 定义文件（22 个） | subagentDefs | SubagentDef[] | ✅ 保留 | |
| 9 | 阻断列表（6 个命令） | blockedCommands | string[] | ✅ 保留 | |
| 10 | hook 输出结构化 | hookOutput | HookOutput | ✅ 保留 | 四条原则之一 |
| 11 | hook 不直接修代码 | hookNoCodeModify | boolean | ✅ 保留 | 四条原则之一 |
| 12 | hook 只调用 harness CLI | hookOnlyHarnessCli | boolean | ✅ 保留 | 四条原则之一 |

### 1.2 完整性自检
- **Spec 输入字段总数**：12 个
- **设计输出字段总数**：12 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/safety/command.ts` | capabilities/safety/command | 新增 `generateHooks()` | 新增方法 | 生成 5 个 Hook 脚本 |
| `src/capabilities/safety/command.ts` | capabilities/safety/command | 新增 `generateSubagentDefs()` | 新增方法 | 生成 22 个 Subagent 定义文件 |
| `src/capabilities/safety/command.ts` | capabilities/safety/command | 新增 `generateHookConfigs()` | 新增方法 | 生成 Claude settings.json 和 Codex hooks.json |
| `src/capabilities/safety/command.ts` | capabilities/safety/command | `DEFAULT_DANGEROUS_COMMANDS` | 替换实现 | 替换为需求文档定义的 6 个命令 |
| `src/cli/main.ts` | cli/main | `main()` | 扩展逻辑 | 在命令执行前添加 dangerous-command 拦截 |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| `DEFAULT_DANGEROUS_COMMANDS` 不正确 | 包含 `rm -rf /`、`format` 等 | 需替换为需求文档定义的 6 个命令 | 替换常量数组 |
| 无 Hook 脚本生成 | 只有命令检查逻辑 | 需添加脚本生成 | 新增 `generateHooks()` |
| 无 Subagent 定义文件生成 | 不存在 | 需添加 | 新增 `generateSubagentDefs()` |
| 无 CLI 拦截点 | main.ts 不检查危险命令 | 需添加拦截 | 在 handler.run() 前添加检查 |
| 无 Hook 配置文件生成 | 不存在 | 需添加 | 新增 `generateHookConfigs()` |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Hook/Subagent 生成 | `CLI: harness` 初始化流程 | 内部调用 | 生成 Hook 脚本和 Subagent 定义 |
| 危险命令拦截 | `src/cli/main.ts` 命令执行前 | 内部拦截 | 阻断危险命令 |

### 4.2 接口详细设计

#### 接口 1：Hook 脚本生成

**生成文件清单**：

| Hook 名称 | Claude 路径 | Codex 路径 | 触发时机 |
|-----------|------------|-----------|---------|
| dangerous-command | `.harness/adapters/claude/hooks/dangerous-command.sh` | `.harness/adapters/codex/hooks/dangerous-command.sh` | PreToolUse Bash |
| sync-after-doc-change | `.harness/adapters/claude/hooks/sync-after-doc-change.sh` | `.harness/adapters/codex/hooks/sync-after-doc-change.sh` | PostToolUse Edit/Write |
| review-before-push | `.harness/adapters/claude/hooks/review-before-push.sh` | `.harness/adapters/codex/hooks/review-before-push.sh` | PreToolUse Bash(git push) |
| session-summary | `.harness/adapters/claude/hooks/session-summary.sh` | `.harness/adapters/codex/hooks/session-summary.sh` | SessionEnd |
| compact-state | `.harness/adapters/claude/hooks/compact-state.sh` | `.harness/adapters/codex/hooks/compact-state.sh` | PreCompact |

**dangerous-command.sh 伪代码**：
```bash
#!/bin/bash
# Hook: dangerous-command
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI
BLOCKED_COMMANDS=("rm -rf" "git reset --hard" "git clean -fdx" "Remove-Item -Recurse -Force" "npm publish" "git push --force")
INPUT_COMMAND="$1"
for blocked in "${BLOCKED_COMMANDS[@]}"; do
  if echo "$INPUT_COMMAND" | grep -qF "$blocked"; then
    echo '{"allowed": false, "hook": "dangerous-command", "matchedRule": "'"$blocked"'", "message": "Blocked by harness safety policy"}'
    exit 1
  fi
done
echo '{"allowed": true, "hook": "dangerous-command"}'
exit 0
```

#### 接口 2：Hook 配置文件生成

**Claude settings.json**：
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": ".claude/hooks/dangerous-command.sh $TOOL_INPUT" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": ".claude/hooks/sync-after-doc-change.sh $TOOL_INPUT" }] }
    ]
  }
}
```

**Codex hooks.json**：
```json
{
  "hooks": [
    { "name": "dangerous-command", "trigger": "PreToolUse", "matcher": "Bash", "command": ".codex/hooks/dangerous-command.sh" },
    { "name": "sync-after-doc-change", "trigger": "PostToolUse", "matcher": "Edit|Write", "command": ".codex/hooks/sync-after-doc-change.sh" },
    { "name": "review-before-push", "trigger": "PreToolUse", "matcher": "Bash(git push)", "command": ".codex/hooks/review-before-push.sh" },
    { "name": "session-summary", "trigger": "SessionEnd", "command": ".codex/hooks/session-summary.sh" },
    { "name": "compact-state", "trigger": "PreCompact", "command": ".codex/hooks/compact-state.sh" }
  ]
}
```

#### 接口 3：Subagent 定义文件生成

**Claude agent 文件清单**（22 个）：

| 类别 | Agent 名称 | 文件路径 |
|------|-----------|---------|
| 需求分析 (4) | harness-requirement-clarifier | `.harness/adapters/claude/agents/harness-requirement-clarifier.md` |
| | harness-repo-context-mapper | `.harness/adapters/claude/agents/harness-repo-context-mapper.md` |
| | harness-risk-reviewer | `.harness/adapters/claude/agents/harness-risk-reviewer.md` |
| | harness-scope-validator | `.harness/adapters/claude/agents/harness-scope-validator.md` |
| 设计 (4) | harness-design-writer | `.harness/adapters/claude/agents/harness-design-writer.md` |
| | harness-contract-validator | `.harness/adapters/claude/agents/harness-contract-validator.md` |
| | harness-cross-module-validator | `.harness/adapters/claude/agents/harness-cross-module-validator.md` |
| | harness-task-planner | `.harness/adapters/claude/agents/harness-task-planner.md` |
| 代码生成 (4) | harness-implementer | `.harness/adapters/claude/agents/harness-implementer.md` |
| | harness-test-reviewer | `.harness/adapters/claude/agents/harness-test-reviewer.md` |
| | harness-impl-contract-validator | `.harness/adapters/claude/agents/harness-impl-contract-validator.md` |
| | harness-doc-sync-reviewer | `.harness/adapters/claude/agents/harness-doc-sync-reviewer.md` |
| Review (7) | harness-rules-reviewer | `.harness/adapters/claude/agents/harness-rules-reviewer.md` |
| | harness-bug-scanner | `.harness/adapters/claude/agents/harness-bug-scanner.md` |
| | harness-deep-bug-analyzer | `.harness/adapters/claude/agents/harness-deep-bug-analyzer.md` |
| | harness-history-reviewer | `.harness/adapters/claude/agents/harness-history-reviewer.md` |
| | harness-standards-reviewer | `.harness/adapters/claude/agents/harness-standards-reviewer.md` |
| | harness-contract-reviewer | `.harness/adapters/claude/agents/harness-contract-reviewer.md` |
| | harness-finding-validator | `.harness/adapters/claude/agents/harness-finding-validator.md` |

**Codex agent 文件**：对应 `.harness/adapters/codex/agents/*.toml` 格式。

#### 接口 4：dangerous-command CLI 拦截

**拦截点**（在 `src/cli/main.ts` 的 `handler.run()` 前）：

```typescript
// 在 main() 中，handler.run() 之前添加：
if (handler.requiresInitializedWorkspace) {
  const config = loadHarnessConfig(paths.config);
  if (config.safety.dangerousCommandsBlocked) {
    const commandLine = [parsedCommand.command, ...parsedCommand.args].join(' ');
    const safetyResult = checkCommandLineSafety(commandLine, config);
    if (!safetyResult.passed) {
      response = {
        code: 2801,
        msg: `Dangerous command blocked: ${safetyResult.violations[0]?.pattern}`,
        data: { command: parsedCommand.command, matchedRule: safetyResult.violations[0]?.pattern },
        warnings: [],
      };
      // 跳过 handler.run()
    }
  }
}
```

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
初始化流程:
  generateHooks(cwd, config) → HookFile[]
  → generateHookConfigs(cwd, config) → ConfigFile[]
  → generateSubagentDefs(cwd, config) → SubagentFile[]
  → transaction write all

CLI 拦截:
  main() → parseGlobalOptions()
  → resolve handler
  → checkCommandLineSafety(commandLine, config)
    → if blocked: return error 2801
    → if allowed: handler.run()
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
generateHooks(cwd, config):
  hooks = [
    { name: 'dangerous-command', trigger: 'PreToolUse Bash', content: generateDangerousCommandHook() },
    { name: 'sync-after-doc-change', trigger: 'PostToolUse Edit/Write', content: generateSyncAfterDocChangeHook() },
    { name: 'review-before-push', trigger: 'PreToolUse Bash(git push)', content: generateReviewBeforePushHook() },
    { name: 'session-summary', trigger: 'SessionEnd', content: generateSessionSummaryHook() },
    { name: 'compact-state', trigger: 'PreCompact', content: generateCompactStateHook() },
  ]
  for hook in hooks:
    // Claude
    claudePath = `.harness/adapters/claude/hooks/${hook.name}.sh`
    stageWrite(tx, claudePath, hook.content)
    // Codex
    codexPath = `.harness/adapters/codex/hooks/${hook.name}.sh`
    stageWrite(tx, codexPath, hook.content)

generateHookConfigs(cwd, config):
  // Claude settings.json
  claudeSettings = buildClaudeSettings(hooks)
  stageWrite(tx, '.harness/adapters/claude/settings.json', JSON.stringify(claudeSettings))
  // Codex hooks.json
  codexHooks = buildCodexHooksConfig(hooks)
  stageWrite(tx, '.harness/adapters/codex/hooks.json', JSON.stringify(codexHooks))

generateSubagentDefs(cwd, config):
  agents = [
    // 需求分析 4 个
    { name: 'harness-requirement-clarifier', category: 'requirement' },
    { name: 'harness-repo-context-mapper', category: 'requirement' },
    { name: 'harness-risk-reviewer', category: 'requirement' },
    { name: 'harness-scope-validator', category: 'requirement' },
    // 设计 4 个
    { name: 'harness-design-writer', category: 'design' },
    { name: 'harness-contract-validator', category: 'design' },
    { name: 'harness-cross-module-validator', category: 'design' },
    { name: 'harness-task-planner', category: 'design' },
    // 代码生成 4 个
    { name: 'harness-implementer', category: 'implement' },
    { name: 'harness-test-reviewer', category: 'implement' },
    { name: 'harness-contract-validator', category: 'implement' },
    { name: 'harness-doc-sync-reviewer', category: 'implement' },
    // Review 7 个
    { name: 'harness-rules-reviewer', category: 'review' },
    { name: 'harness-bug-scanner', category: 'review' },
    { name: 'harness-deep-bug-analyzer', category: 'review' },
    { name: 'harness-history-reviewer', category: 'review' },
    { name: 'harness-standards-reviewer', category: 'review' },
    { name: 'harness-contract-reviewer', category: 'review' },
    { name: 'harness-finding-validator', category: 'review' },
  ]
  for agent in agents:
    // Claude .md
    claudePath = `.harness/adapters/claude/agents/${agent.name}.md`
    stageWrite(tx, claudePath, generateAgentMarkdown(agent))
    // Codex .toml
    codexPath = `.harness/adapters/codex/agents/${toSnakeCase(agent.name)}.toml`
    stageWrite(tx, codexPath, generateAgentToml(agent))
```

### 6.2 阻断列表

```typescript
const BLOCKED_COMMANDS = [
  'rm -rf',
  'git reset --hard',
  'git clean -fdx',
  'Remove-Item -Recurse -Force',
  'npm publish',
  'git push --force',
];
```

### 6.3 Hook 四条原则校验

```typescript
// 所有生成的 Hook 脚本必须满足：
// 1. 不做复杂 AI 判断 → 只做字符串匹配和简单逻辑
// 2. 输出必须结构化 → 输出 JSON 格式
// 3. 不直接修代码 → 只输出 allowed/blocked 状态
// 4. 只调用 harness CLI 或小脚本 → 不调用外部 AI 服务
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

无新增。

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-workspace-config | `loadHarnessConfig()` | configPath | HarnessConfig | 已有 |
| harness-review | 读取最近 review 状态 | reviewReportPath | ReviewSummary | 已有 |
| harness-develop | 读取 active change | activeChangePath | ChangeInfo | 已有 |
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Git >= 2.30.0 | push 门禁和变更状态 | 非 Git 项目禁用 push Hook |
| 文件系统写权限 | `.harness/adapters/` 和 `.harness/events/` | 本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 危险命令阻断 | commandLine 命中阻断列表 | 返回错误码 2801 | "危险命令已阻断: {pattern}" |
| 敏感文件阻断 | 文件命中 secretPatterns | 返回错误码 2802 | "敏感文件已阻断" |
| push 门禁失败 | 未运行 review 或存在 P0 | 返回错误码 2803 | "请先运行 harness review" |
| 并行冲突 | 多 agent 任务重叠写入文件 | 返回错误码 2804 | "并行任务冲突" |
| Hook 配置无效 | Hook 名称/脚本/参数缺失 | 返回错误码 2805 | "Hook 配置无效" |
| 事件写入失败 | .harness/events/ 写入失败 | 返回错误码 5801 | "事件写入失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：Hook 超时时按失败处理（不阻断主命令）；事件写入失败不破坏主命令输出

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 阻断命令列表 | safety.dangerousCommandsBlocked | true | 从 harness.config.json 读取 |
| 敏感文件模式 | safety.secretPatterns | [".env", "*.key", ...] | 从 harness.config.json 读取 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| safety.dangerousCommandsBlocked | 是否启用危险命令阻断 | true |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：5 个需修改文件已明确
> - [x] **现有约束已识别**：5 个约束已列出
> - [x] **字段完整性**：12 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：Git >= 2.30.0
> - [x] **环境权限已确认**：Git、文件系统写权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
