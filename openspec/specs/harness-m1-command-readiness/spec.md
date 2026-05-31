# spec.md - 能力规格定义

> **定位**：`harness-m1-command-readiness` — 聚焦 M1 命令 inspect、sync、review、status、doctor、adapter/skill 的可运行验收与限制说明
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：`harness inspect` M1 验收就绪

系统必须确保 `harness inspect` 在小型 fixture 项目上可运行并输出结构化事实数据。

##### 场景：inspect 基本运行
- **当** 用户在已初始化项目中执行 `harness inspect`
- **预期** 系统必须扫描项目结构，生成 `.harness/facts/repo-map.json`（模块依赖映射）和 `.harness/facts/module-map.json`（文件到模块映射），返回 code 0

##### 场景：inspect JSON 输出
- **当** 用户执行 `harness inspect --json`
- **预期** stdout 必须输出合法 JSON，包含 `code`、`msg`、`data`（含 `factsPath`、`moduleMapPath`、`scope`）

##### 场景：inspect dry-run 零写入
- **当** 用户执行 `harness inspect --dry-run`
- **预期** 系统必须展示将生成的文件列表但不写入任何文件，返回的 `artifacts` 字段为实际将写入的路径

##### 场景：inspect 性能约束
- **当** 在文件数 < 200 的小型 fixture 上运行
- **预期** inspect 必须在 30 秒内完成

#### 需求项：`harness sync` M1 验收就绪

系统必须确保 `harness sync` 在小型 fixture 项目上可运行并输出同步状态。

##### 场景：sync --check 运行
- **当** 用户在已初始化项目中执行 `harness sync --check`
- **预期** 系统必须检查 `.harness/docs/` 与 AI 工具 CLI 参考文档的同步状态，返回 `data.mode` 和 `data.drift` 状态

##### 场景：sync JSON 输出
- **当** 用户执行 `harness sync --check --json`
- **预期** stdout 必须输出合法 JSON，包含 `code`、`msg`、`data`（含 `mode`、`drift`、`documents`、`reportPath`）

##### 场景：sync dry-run 零写入
- **当** 用户执行 `harness sync --check --dry-run`
- **预期** 系统必须展示同步检查结果但不写入任何文件

#### 需求项：`harness review` M1 验收就绪

系统必须确保 `harness review` 在小型 fixture 项目上可运行并输出 Markdown + JSON 双报告。

##### 场景：review --local 运行
- **当** 用户在已初始化项目中执行 `harness review --local`
- **预期** 系统必须解析当前分支变更范围，扫描可审查文件，生成 Markdown 报告和 JSON 报告，返回 findings 数组

##### 场景：review 报告写入
- **当** review 完成（非 dry-run）
- **预期** 系统必须写入 `.harness/reports/review/<timestamp>-<branch>.md` 和 `.harness/reports/review/<timestamp>-<branch>.json` 双报告

##### 场景：review dry-run 零写入
- **当** 用户执行 `harness review --local --dry-run`
- **预期** 系统必须展示审查计划（审查文件列表、reviewer 选择）但不得写入任何文件

##### 场景：review 报告语言为中文
- **当** review 生成 Markdown 或 JSON 报告
- **预期** 报告中的用户可见内容（摘要、建议、问题描述）必须使用简体中文

#### 需求项：`harness status` M1 验收就绪

系统必须确保 `harness status` 正确展示工作空间和项目状态。

##### 场景：status 基本运行
- **当** 用户在初始化后的项目中执行 `harness status`
- **预期** 系统必须输出：项目名称和类型、工作空间路径、能力启用状态（inspect/sync/review/develop/knowledge）、Hook 安装状态（Claude/Codex）、最近变更摘要

##### 场景：status JSON 输出
- **当** 用户执行 `harness status --json`
- **预期** stdout 必须输出合法 JSON，包含以上所有状态字段

#### 需求项：`harness doctor` M1 验收就绪

系统必须确保 `harness doctor` 正确诊断环境和依赖状态。

##### 场景：doctor 基本运行
- **当** 用户执行 `harness doctor`
- **预期** 系统必须输出：Node.js 版本检查、Git 可用性检查、`.harness/` 工作空间完整性检查、依赖版本检查

##### 场景：doctor JSON 输出
- **当** 用户执行 `harness doctor --json`
- **预期** stdout 必须输出合法 JSON，包含 `environment`（node、git、platform）、`workspace`（完整性）、`dependencies`（版本状态）

##### 场景：doctor 发现问题
- **当** 环境存在配置问题
- **预期** 系统必须输出问题列表，每个问题包含 `severity`（error/warning/info）、`message`、`suggestion`

#### 需求项：M1 adapter/skill 验证就绪

系统必须确保 adapter/skill 投影文件可在 fixture 项目上生成和验证。

##### 场景：Claude Skill 文件生成
- **当** 用户完成初始化并选择 Claude
- **预期** `.claude/skills/harness/SKILL.md` 必须存在且包含完整的 frontmatter

##### 场景：Codex Skill 文件生成
- **当** 用户完成初始化并选择 Codex
- **预期** `.agents/skills/harness/SKILL.md` 必须存在且包含 frontmatter

##### 场景：`--repair-adapters` 可运行
- **当** 用户执行 `harness config --repair-adapters`
- **预期** 系统必须根据 `.harness/adapters/**` 重新生成运行时投影文件

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### M1 验收命令一览

| 命令 | 参数 | 预期退出码 | 预期产物 | 性能约束 |
|------|------|-----------|---------|---------|
| inspect | (无) | 0 | `.harness/facts/repo-map.json` | < 30s |
| inspect | --json | 0 | stdout JSON | < 30s |
| inspect | --dry-run | 0 | 无文件写入 | < 30s |
| sync | --check | 0 | 同步状态输出 | < 30s |
| sync | --check --json | 0 | stdout JSON | < 30s |
| review | --local | 0 | MD + JSON 报告 | < 60s |
| review | --local --dry-run | 0 | 无文件写入 | < 60s |
| status | (无) | 0 | 工作空间状态 | < 10s |
| status | --json | 0 | stdout JSON | < 10s |
| doctor | (无) | 0 | 环境诊断 | < 10s |
| doctor | --json | 0 | stdout JSON | < 10s |
| config | --repair-adapters | 0 | 投影文件重新生成 | < 30s |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 3101 | M1 验收命令失败 | 任意 M1 验收命令返回非零 |
| 3102 | 必需产物缺失 | 命令声称成功但产物文件不存在 |
| 3103 | 性能超时 | 命令执行超过对应性能约束 |
| 3104 | dry-run 写入 | dry-run 模式下产生了文件写入 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| inspect 时间 | < 30000 毫秒 | 小型 fixture（< 200 文件） |
| sync --check 时间 | < 30000 毫秒 | 文档数 < 50 |
| review --local 时间 | < 60000 毫秒 | 变更文件 < 20 |
| status 时间 | < 10000 毫秒 | 状态查询 |
| doctor 时间 | < 10000 毫秒 | 环境诊断 |
| config --repair-adapters 时间 | < 30000 毫秒 | 投影文件数 < 50 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 512 MB | M1 命令单次执行 |
| 存储 | < 10 MB/命令 | 产物（不含已有缓存） |

### 3.3 超时配置
- 单命令总超时：60000 毫秒（review 可延长至 120000 毫秒）

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/inspect/command.ts`：确保 inspect 在 fixture 上可运行
- [ ] `src/capabilities/sync/command.ts`：确保 sync 在 fixture 上可运行
- [ ] `src/capabilities/review/command.ts`：确保 review 输出 MD + JSON 双报告
- [ ] `src/commands/status.ts`：确保 status 输出工作空间完整状态
- [ ] `src/commands/doctor.ts`：确保 doctor 诊断环境依赖
- [ ] `src/commands/config.ts`：确保 `--repair-adapters` 可运行
- [ ] `src/adapters/projection-writer.ts`：确保 Skill 文件有完整 frontmatter

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 所有 M1 命令 | 阻断 |
| 版本控制 | Git | >= 2.30.0 | review diff、status 分支 | 非 Git 项目降级输出 |
| 数据格式 | JSON | ECMA-404 | 结构化输出 | N/A |

### 4.3 数据存储
- [ ] 事实数据：`.harness/facts/repo-map.json`、`.harness/facts/module-map.json`
- [ ] 报告：`.harness/reports/review/*.md`、`.harness/reports/review/*.json`
- [ ] 配置：`.harness/config/harness.config.json`
- [ ] 投影文件：`.claude/skills/harness/SKILL.md`、`.agents/skills/harness/SKILL.md`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：dry-run 零写入；非 dry-run 只能写入 `.harness/` 和投影路径

### 5.2 数据安全
- 报告不得包含敏感文件内容（.env、.pem、密钥）
- fixture 项目不包含真实的密钥或凭证

### 5.3 审计要求
- 每次 M1 验收运行必须记录：命令、参数、退出码、执行时间、产物路径

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：M1 验收命令清单和预期行为为契约基准

### 6.2 数据兼容性
- 数据迁移方案：无
- 回滚策略：Git 版本控制回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（6 个需求项，14 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
> - [x] 若跳过 proposal.md，影响范围已在此补齐（proposal.md 已存在）