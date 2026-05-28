# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：单一 Harness Skill

系统必须为目标项目安装一个用户可见的 `harness` Skill，并禁止把 DocSync、GSD、kld-sdd、kld-review 等内部来源作为用户可见 Skill 名称安装。

##### 场景：安装 Claude Skill
- **当** 用户在初始化向导中选择 Claude Code
- **预期** 系统必须生成 `.claude/skills/harness/SKILL.md` 薄投影，并将完整源文件保存在 `.harness/adapters/claude/skills/harness/**`

##### 场景：安装 Codex Skill
- **当** 用户在初始化向导中选择 Codex
- **预期** 系统必须生成 `.agents/skills/harness/SKILL.md` 和 `.agents/skills/harness/agents/openai.yaml` 薄投影，并将完整源文件保存在 `.harness/adapters/codex/skills/harness/**`

#### 需求项：Skill 路由职责边界

系统必须让 `harness` Skill 只负责识别用户意图、调用 Harness CLI、展示 CLI 报告摘要，并禁止在 Skill 中复制完整业务流程或硬编码来源项目逻辑。

##### 场景：自然语言触发文档同步
- **当** 用户在 AI 工具中表达“同步项目文档”
- **预期** Skill 必须路由到 `harness sync` 或 `harness sync --check`，并展示 CLI 返回的报告摘要

##### 场景：副作用流程触发
- **当** 用户请求会写文件的流程，例如初始化、同步、开发文档或自动修复
- **预期** Skill 必须依赖 CLI 的 dry-run、confirm、transaction 和报告机制，不得自行绕过安全检查写文件

#### 需求项：Adapter 与 Hook 投影修复

系统必须提供 adapter 源文件与运行时投影的同步、校验和修复能力，确保平台固定路径中的文件可由 `.harness/adapters/**` 重新生成。

##### 场景：修复运行时投影
- **当** 用户执行 `harness config --repair-adapters`
- **预期** 系统必须根据 `.harness/adapters/**` 重新生成 `.claude/`、`.agents/`、`.codex/`、`.github/` 中的必要投影

##### 场景：投影漂移检查
- **当** 用户执行 `harness doctor --json`
- **预期** 系统必须报告 adapter 源文件与运行时投影是否一致，并列出需要修复的文件

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness config --repair-adapters` / `CLI: harness doctor`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --repair-adapters | boolean | 否 | 重新生成运行时投影 | `true` | 仅 `config` 命令有效 |
| --ai-tools | string[] | 否 | 限定生成目标 | `claude,codex` | 枚举：`claude`、`codex`、`copilot`、`cursor` |
| --dry-run | boolean | 否 | 只输出投影计划 | `true` | 为 `true` 时写入文件数量必须为 0 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 响应结构

**成功响应 (0)**
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

**错误响应**
```json
{
  "code": 2201,
  "msg": "adapter source missing",
  "data": {
    "tool": "codex",
    "source": ".harness/adapters/codex/skills/harness"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2201 | Adapter 源缺失 | `.harness/adapters/<tool>` 不存在 |
| 2202 | 投影冲突 | 目标投影文件存在用户内容且不可安全覆盖 |
| 2203 | 平台不支持 | `--ai-tools` 包含未知工具 |
| 2204 | Hook 校验失败 | Hook 配置缺少必填字段或指向不存在脚本 |
| 5201 | 投影写入失败 | 文件系统写入失败且回滚完成 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| adapter drift 检查时间 | < 3000 毫秒 (P95) | 投影文件数小于 200 |
| repair-adapters 写入时间 | < 5000 毫秒 (P95) | 投影文件数小于 200 |
| 单个 Skill 路由启动时间 | < 1000 毫秒 (P95) | 不含下游 CLI 执行时间 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 256 MB | adapter 校验和投影生成 |
| CPU | 平均 < 70% | 5 秒窗口内 |
| 存储 | < 20 MB | `.harness/adapters/**` 模板和根目录投影总量 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地 adapter 不建立网络连接
- 读取超时：30000 毫秒
- 总超时：120000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-cli-entrypoint`：提供统一 CLI 调用入口
- [ ] `harness-workspace-config`：读取 aiTools、adapter 源目录和投影状态
- [ ] `harness-safety-orchestration`：限制 Skill 与 Hook 的副作用边界
- [ ] `harness-sync`：维护 AGENTS、CLAUDE、Copilot instructions 中的 managed block

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 投影生成脚本 | 阻断 repair 并提示安装 |
| AI 工具适配 | Claude Skill schema | v1 | `.claude/skills/harness/SKILL.md` 投影 | 仅生成 AGENTS 指针 |
| AI 工具适配 | Codex Skill frontmatter | v1 | `.agents/skills/harness/SKILL.md` 投影 | 仅生成 AGENTS 指针 |
| 配置格式 | YAML | 1.2 | `agents/openai.yaml` 与 agent 配置 | 回退为纯 Markdown 指令 |

### 4.3 数据存储
- [ ] Markdown 模板：`.harness/adapters/**/skills/harness/SKILL.md`，adapter 源文件
- [ ] YAML 配置：`.agents/skills/harness/agents/openai.yaml`，Codex 运行时投影
- [ ] JSON Hook 配置：`.codex/hooks.json`、`.claude/settings.json`，平台需要时生成

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地工具权限，不引入外部账号认证
- 授权范围：Skill 只允许调用 `harness` 或 `npx @hunterzheng/harness` 相关命令

### 5.2 数据安全
- 敏感字段：RAGFlow 连接、API key、token、本地路径中的密钥文件
- 加密要求：adapter 投影不得包含密钥；本地连接配置必须只写入 `.harness/config/*.local.json`

### 5.3 审计要求
- 日志记录：adapter 修复命令、投影文件路径、hash 变化、冲突处理结果
- 操作追踪：Hook 安装、更新、删除必须出现在 doctor 或 config 报告中

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：adapter 投影必须标注 source path 与重新生成命令；未来投影 schema 变化必须保持旧投影可检测和可修复

### 6.2 数据兼容性
- 数据迁移方案：已有多 Skill 项目必须允许保留旧 Skill，但新安装只生成 `harness`
- 回滚策略：repair-adapters 必须通过 transaction 回滚本次投影写入

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
