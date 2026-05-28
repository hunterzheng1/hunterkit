# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：危险命令与敏感文件防护

系统必须提供确定性安全策略，默认阻断危险命令，并禁止读取、输出或发布敏感文件内容。

##### 场景：危险命令阻断
- **当** AI 工具或 Hook 请求执行 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force`
- **预期** 系统必须阻断执行，并返回安全策略命中项和修复建议

##### 场景：敏感文件过滤
- **当** inspect、sync、review 或 knowledge 扫描项目文件
- **预期** 系统必须跳过 `.env`、`.env.*`、`*.pem`、`*.key`、`*.p12`、`*.jks`、`*token*`、`*secret*` 等敏感模式

#### 需求项：Subagent 编排边界

系统必须只在需求复杂、范围较大或任务可独立拆分时启用 subagent，并禁止多个 agent 同时修改同一共享文件。

##### 场景：并行审查
- **当** review 范围超过 3 个文件或用户传入 `--full`
- **预期** 系统必须允许多个 reviewer 并行读取相关上下文，并由 validator 复核 finding

##### 场景：并行实现
- **当** apply 阶段任务 DAG 中存在无依赖任务组
- **预期** 系统必须只并行分发互不依赖且文件范围不重叠的任务，共享文件修改必须回到主流程串行处理

#### 需求项：Hook 与事件审计

系统必须支持 dangerous-command、sync-after-doc-change、review-before-push、session-summary、compact-state 等 Hook，并将关键事件写入 `.harness/events/` 或 `.harness/reports/`。

##### 场景：push 前审查门禁
- **当** AI 工具尝试执行 `git push`
- **预期** 系统必须检查最近 review 状态；若未运行 review 或存在 P0 finding，必须阻断 push 并提示运行 `harness review`

##### 场景：会话结束记录
- **当** AI session 结束或触发 compact-state
- **预期** 系统必须记录 active change、pending checks、关键产物路径和未完成事项

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness doctor` / `CLI: harness review` / Hook: `dangerous-command`、`review-before-push`
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

#### 响应结构

**成功响应 (0)**
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

**错误响应**
```json
{
  "code": 2801,
  "msg": "dangerous command blocked",
  "data": {
    "commandLine": "git reset --hard",
    "matchedRule": "git reset --hard"
  }
}
```

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
| subagent DAG 冲突检查 | < 3000 毫秒 (P95) | 任务数小于 500 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 256 MB | Hook 和安全检查 |
| CPU | 平均 < 50% | Hook 单次执行 |
| 存储 | < 100 MB/月 | `.harness/events/**` 默认保留量 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地安全 Hook 不建立网络连接
- 读取超时：5000 毫秒
- 总超时：10000 毫秒，Hook 超时必须按失败处理

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-workspace-config`：读取 safety、orchestration、events 配置
- [ ] `harness-adapter-skill-runtime`：生成 Claude/Codex Hook 投影
- [ ] `harness-review`：提供最近 review 状态和 P0/P1/P2 finding
- [ ] `harness-develop`：提供 active change 和任务 DAG

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

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地 AI 工具 Hook 权限和文件系统权限
- 授权范围：Hook 默认只读；阻断类 Hook 不得修改源码；session-summary 只写 `.harness/events/**`

### 5.2 数据安全
- 敏感字段：secretPatterns 全量覆盖；报告和事件不得包含命中敏感模式文件内容
- 加密要求：事件文件不加密；必须避免写入密钥、token、凭据正文

### 5.3 审计要求
- 日志记录：命令、命中规则、allow/deny、activeChange、review 状态摘要
- 操作追踪：并行任务必须记录 agent id、文件范围、依赖关系、完成状态

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
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
