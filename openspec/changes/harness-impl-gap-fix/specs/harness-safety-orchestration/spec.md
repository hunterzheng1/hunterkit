# spec.md - 能力规格定义（增量）

> **定位**：`harness-safety-orchestration` 的实施偏移修复规格
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

无。

### 修改需求

#### 需求项：5 个 Hook 脚本生成

系统必须生成 5 个 Hook 脚本：dangerous-command、sync-after-doc-change、review-before-push、session-summary、compact-state。

##### 场景：生成 dangerous-command Hook
- **当** 用户选择安装 Hook（向导步骤 6 选择"仅危险命令阻断"或"完整质量门"）
- **预期** 系统必须生成 `.harness/adapters/claude/hooks/dangerous-command.sh` 和 `.harness/adapters/codex/hooks/dangerous-command.sh`，阻断 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force`

##### 场景：生成 sync-after-doc-change Hook
- **当** 用户选择"完整质量门"
- **预期** 系统必须生成 `.harness/adapters/claude/hooks/sync-after-doc-change.sh` 和 `.harness/adapters/codex/hooks/sync-after-doc-change.sh`，修改核心 docs 后提示或运行 `harness sync --check`

##### 场景：生成 review-before-push Hook
- **当** 用户选择"完整质量门"
- **预期** 系统必须生成 `.harness/adapters/claude/hooks/review-before-push.sh` 和 `.harness/adapters/codex/hooks/review-before-push.sh`，若未运行 review 或存在 P0，阻断 AI push

##### 场景：生成 session-summary Hook
- **当** 用户选择"完整质量门"
- **预期** 系统必须生成 `.harness/adapters/claude/hooks/session-summary.sh` 和 `.harness/adapters/codex/hooks/session-summary.sh`，记录本次 session 摘要到 `.harness/events/`

##### 场景：生成 compact-state Hook
- **当** 用户选择"完整质量门"
- **预期** 系统必须生成 `.harness/adapters/claude/hooks/compact-state.sh` 和 `.harness/adapters/codex/hooks/compact-state.sh`，保存 active change / pending checks

#### 需求项：Hook 配置文件生成

系统必须生成 Hook 配置文件 Claude `settings.json` 和 Codex `hooks.json`。

##### 场景：生成 Claude settings.json
- **当** 用户选择 Claude 并安装 Hook
- **预期** 系统必须生成 `.harness/adapters/claude/settings.json`，包含 Hook 名称、触发时机、脚本路径

##### 场景：生成 Codex hooks.json
- **当** 用户选择 Codex 并安装 Hook
- **预期** 系统必须生成 `.harness/adapters/codex/hooks.json`，包含 Hook 名称、触发时机、脚本路径

#### 需求项：Subagent 定义文件生成

系统必须生成 Subagent 定义文件：需求分析 4 个、设计 4 个、代码生成 4 个、review 7 个。

##### 场景：生成需求分析 agent
- **当** 用户选择安装 Subagent
- **预期** 系统必须生成 `.harness/adapters/claude/agents/harness-requirement-clarifier.md`、`harness-repo-context-mapper.md`、`harness-risk-reviewer.md`、`harness-scope-validator.md` 四个需求分析 agent

##### 场景：生成设计 agent
- **当** 用户选择安装 Subagent
- **预期** 系统必须生成 `.harness/adapters/claude/agents/harness-design-writer.md`、`harness-contract-validator.md`、`harness-cross-module-validator.md`、`harness-task-planner.md` 四个设计 agent

##### 场景：生成代码生成 agent
- **当** 用户选择安装 Subagent
- **预期** 系统必须生成 `.harness/adapters/claude/agents/harness-implementer.md`、`harness-test-reviewer.md`、`harness-contract-validator.md`、`harness-doc-sync-reviewer.md` 四个代码生成 agent

##### 场景：生成 review agent
- **当** 用户选择安装 Subagent
- **预期** 系统必须生成 `.harness/adapters/claude/agents/harness-rules-reviewer.md`、`harness-bug-scanner.md`、`harness-deep-bug-analyzer.md`、`harness-history-reviewer.md`、`harness-standards-reviewer.md`、`harness-contract-reviewer.md`、`harness-finding-validator.md` 七个 review agent

##### 场景：生成 Codex agent
- **当** 用户选择 Codex 并安装 Subagent
- **预期** 系统必须生成 `.harness/adapters/codex/agents/*.toml` 格式的 agent 定义文件

#### 需求项：dangerous-command 阻断集成到 CLI 流程

系统必须将 dangerous-command 阻断集成到 CLI 流程，在 `src/cli/main.ts` 命令执行前拦截危险命令。

##### 场景：CLI 执行前拦截
- **当** 用户执行 `harness` 命令
- **预期** 系统必须在 `src/cli/main.ts` 中检查命令是否命中 dangerous-command 列表，命中时必须阻断执行并返回错误码 2801

##### 场景：阻断列表
- **当** 检查危险命令
- **预期** 阻断列表必须包含 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force`

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness doctor` / Hook: `dangerous-command`、`sync-after-doc-change`、`review-before-push`、`session-summary`、`compact-state`
- **方法**：本地进程调用或 AI 工具 Hook 调用
- **内容类型**：`application/json` 优先；Hook 环境不支持 JSON 时输出纯文本摘要

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| hook | string | 否 | Hook 名称 | `review-before-push` | 枚举：`dangerous-command`、`sync-after-doc-change`、`review-before-push`、`session-summary`、`compact-state` |
| commandLine | string | 否 | 待执行命令 | `git push` | Hook 调用时必填 |
| files | string[] | 否 | 本次涉及文件 | `["AGENTS.md"]` | 路径必须位于项目根目录内 |
| activeChange | string | 否 | 当前变更名 | `personal-dev-tool-harness` | kebab-case |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2801 | 危险命令阻断 | commandLine 命中 dangerousCommands |
| 2802 | 敏感文件阻断 | 文件命中 secretPatterns 且命令试图读取或输出内容 |
| 2803 | push 门禁失败 | 未运行 review 或存在 P0 finding |
| 2804 | 并行冲突 | 多 agent 任务声明重叠写入文件 |
| 2805 | Hook 配置无效 | Hook 名称、脚本或参数缺失 |
| 5801 | 事件写入失败 | `.harness/events/**` 写入失败 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| dangerous-command 判断 | < 100 毫秒 (P99) | 单条命令 |
| review-before-push 判断 | < 1000 毫秒 (P95) | 读取最近 review 状态 |
| subagent DAG 冲突检查 | < 3000 毫秒 (P95) | 任务数 < 500 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 256 MB | Hook 和安全检查 |
| CPU | 平均 < 50% | Hook 单次执行 |
| 存储 | < 100 MB/月 | `.harness/events/**` 默认保留量 |

### 3.3 超时配置
- 总超时：10000 毫秒，Hook 超时必须按失败处理

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/safety/command.ts`：实现 Hook 脚本生成（含 `settings.json`/`hooks.json` 配置文件）、Subagent 定义文件生成（需求分析 4 个、设计 4 个、代码生成 4 个、review 7 个）；阻断列表包含 6 个危险命令
- [ ] `src/cli/main.ts`：集成 dangerous-command 阻断拦截点

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | Hook 执行和事件写入 | 阻断 Hook 安装 |
| 版本控制 | Git | >= 2.30.0 | push 门禁和变更状态 | 非 Git 项目禁用 push Hook |
| Hook 协议 | Claude settings hook schema | v1 | Claude Hook 投影 | 仅生成文档提示 |
| Hook 协议 | Codex hooks schema | v1 | Codex Hook 投影 | 仅生成文档提示 |

### 4.3 数据存储
- [ ] JSON 安全配置：`.harness/config/harness.config.json` 中的 `safety`
- [ ] JSON 事件：`.harness/events/<timestamp>-<event>.json`
- [ ] JSON 状态：`.harness/state/active-change.json`、`.harness/state/capabilities.json`
- [ ] Shell 脚本：`.harness/adapters/claude/hooks/*.sh`
- [ ] Shell 脚本：`.harness/adapters/codex/hooks/*.sh`
- [ ] JSON 配置：`.harness/adapters/claude/settings.json`
- [ ] JSON 配置：`.harness/adapters/codex/hooks.json`
- [ ] Markdown：`.harness/adapters/claude/agents/harness-*.md`
- [ ] TOML：`.harness/adapters/codex/agents/*.toml`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地 AI 工具 Hook 权限和文件系统权限
- 授权范围：Hook 默认只读；阻断类 Hook 不得修改源码；session-summary 只写 `.harness/events/**`

### 5.2 数据安全
- 敏感字段：报告和事件不得包含命中敏感模式文件内容

### 5.3 审计要求
- 日志记录：命令、命中规则、allow/deny、activeChange、review 状态摘要

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：Hook 输入输出必须包含 schemaVersion；未知字段必须忽略

### 6.2 数据兼容性
- 数据迁移方案：旧 `skywalk-sdd/` 事件可作为只读历史来源，新事件默认写入 `.harness/events/`
- 回滚策略：Hook 安装通过 adapter transaction 回滚；事件写入失败不得破坏主命令输出

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（4 个需求项，14 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
