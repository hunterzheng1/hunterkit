# spec.md - 能力规格定义（增量）

> **定位**：`harness-review` 的实施偏移修复规格
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

无。

### 修改需求

#### 需求项：`--local`/`--staged`/`--scan` 范围参数

系统必须实现范围参数，支持本地分支、暂存区、指定目录审查。

##### 场景：本地分支审查
- **当** 用户执行 `harness review --local --no-fix --json`
- **预期** 系统必须解析当前分支相对主分支的变更范围，并输出审查文件列表、基准引用和 head 引用

##### 场景：暂存区审查
- **当** 用户执行 `harness review --staged`
- **预期** 系统必须只审查 Git 暂存区文件，并在报告中标记 scope 为 `staged`

##### 场景：目录扫描审查
- **当** 用户执行 `harness review --scan src/payment`
- **预期** 系统必须扫描指定目录相关源码和必要上下文，并禁止越界读取项目根目录外路径

##### 场景：范围参数冲突
- **当** 用户同时传入 `--local` 和 `--staged`
- **预期** 系统必须返回错误码 2602 并提示范围参数冲突

#### 需求项：`--full` 强制满 agent

系统必须实现 `--full` 参数，支持强制跑满所有 review agent。

##### 场景：强制满 agent
- **当** 用户执行 `harness review --full`
- **预期** 系统必须并行启动所有 6 个 reviewer（rules、bug、deep-bug、history、standards、contract），即使文件数较少

#### 需求项：`--lite` 轻量检查

系统必须实现 `--lite` 参数，支持只跑契约和关键问题轻量检查。

##### 场景：轻量审查
- **当** 用户执行 `harness review --lite`
- **预期** 系统必须只启动 contract reviewer 和关键 bug scanner，跳过 deep-bug、history、standards reviewer

##### 场景：`--lite` 与 `--full` 互斥
- **当** 用户同时传入 `--lite` 和 `--full`
- **预期** 系统必须返回错误并提示参数互斥

#### 需求项：`--comment` MR/PR 评论

系统必须实现 `--comment` 参数，支持远程 MR/PR 模式下发表评论。

##### 场景：远程评论
- **当** 用户执行 `harness review --comment`
- **预期** 系统必须将审查结果以评论形式发表到远程 MR/PR，需要远程上下文配置

##### 场景：缺少远程上下文
- **当** 用户执行 `--comment` 但未配置远程凭据
- **预期** 系统必须返回错误并提示配置远程凭据

#### 需求项：JSON 报告输出

系统必须输出 Markdown + JSON 双报告。

##### 场景：生成双报告
- **当** 用户执行 `harness review --local`
- **预期** 系统必须写入 `.harness/reports/review/<timestamp>-<branch>.md` 和 `.harness/reports/review/<timestamp>-<branch>.json`

##### 场景：JSON 报告结构
- **当** 生成 JSON 报告
- **预期** 报告必须包含 `scope`、`findings`（含 `severity`、`confidence`、`file`、`line`、`message`）、`summary`（含 `p0`、`p1`、`p2`、`discarded`）、`reports`（含 `markdown`、`json` 路径）

#### 需求项：P0/P1/P2 严重度分级

系统必须对 finding 进行 P0/P1/P2 严重度分级。

##### 场景：严重度分级
- **当** review 生成 findings
- **预期** 每条 finding 必须标记 `severity` 为 `P0`（阻断）、`P1`（重要）、`P2`（建议）

##### 场景：P0 阻断
- **当** 存在 P0 finding
- **预期** 系统必须返回错误码 2601 并在报告中标记阻断问题

#### 需求项：交互式范围选择

系统必须支持交互式范围选择。

##### 场景：交互式选择
- **当** 用户执行 `harness review`（无范围参数）
- **预期** 系统必须展示范围选择菜单（local/staged/scan），并允许用户选择

#### 需求项：6 个并行 review agent + N 个 finding validator

系统必须实现 6 个并行 review agent 和 N 个 finding validator。

##### 场景：并行审查
- **当** 审查范围超过 3 个文件或用户传入 `--full`
- **预期** 系统必须并行启动 6 个 reviewer（rules-reviewer、bug-scanner、deep-bug-analyzer、history-reviewer、standards-reviewer、contract-reviewer）

##### 场景：finding validator
- **当** reviewer 生成候选 finding
- **预期** 系统必须对每条 finding 启动 validator 独立复核，validator 拒绝的 finding 必须丢弃

#### 需求项：置信度过滤（confidence < 80 丢弃）和去重

系统必须实现置信度过滤和去重。

##### 场景：低置信 finding
- **当** finding confidence 小于 80
- **预期** 系统必须丢弃该 finding，并在 JSON 报告中记录过滤统计

##### 场景：重复 finding
- **当** 多个 reviewer 生成相同 finding
- **预期** 系统必须去重，只保留一条

#### 需求项：报告写入 `.harness/reports/review/<timestamp>-<branch>.md/.json`

系统必须将报告写入指定路径。

##### 场景：报告路径
- **当** review 完成
- **预期** 系统必须写入 `.harness/reports/review/<timestamp>-<branch>.md` 和 `.harness/reports/review/<timestamp>-<branch>.json`，其中 `<timestamp>` 为 ISO 8601 格式，`<branch>` 为当前分支名

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness review`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --local | boolean | 否 | 当前分支 vs 主分支 | `true` | 与 `--staged`、`--scan` 互斥 |
| --staged | boolean | 否 | 仅暂存区 | `true` | 与 `--local`、`--scan` 互斥 |
| --scan | path | 否 | 全量扫描目录 | `src/payment` | 必须位于项目根目录内 |
| --fix | boolean | 否 | 允许自动修复 | `true` | 与 `--no-fix` 互斥 |
| --no-fix | boolean | 否 | 只报告不修复 | `true` | 默认 `true` |
| --full | boolean | 否 | 跑满所有 reviewer | `true` | 与 `--lite` 互斥 |
| --lite | boolean | 否 | 轻量审查 | `true` | 与 `--full` 互斥 |
| --comment | boolean | 否 | 远程 PR/MR 发表评论 | `true` | 需要远程上下文配置 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2601 | 存在阻断问题 | P0 finding 数量大于 0 |
| 2602 | 范围参数冲突 | `--local`、`--staged`、`--scan` 同时出现 |
| 2603 | 审查路径越界 | `--scan` 指向项目根目录外 |
| 2604 | validator 失败 | finding 验证流程未完成 |
| 2605 | 报告写入失败 | Markdown 或 JSON 报告无法写入 |
| 2606 | 远程凭据缺失 | `--comment` 未配置远程凭据 |
| 5601 | reviewer 执行失败 | reviewer agent 或本地审查器异常 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| lite 审查时间 | < 60000 毫秒 (P95) | 文件数 < 20 |
| full 审查时间 | < 300000 毫秒 (P95) | 文件数 < 100 |
| finding validator 时间 | < 30000 毫秒/条 | 单条 finding 复核 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 1024 MB | 多 reviewer 并行 |
| CPU | 平均 < 90% | reviewer 并行期间 |
| 存储 | < 100 MB/次 | Markdown、JSON、临时上下文和修复摘要 |

### 3.3 超时配置
- 总超时：600000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/review/command.ts`：实现范围参数、`--full`、`--lite`、`--comment`、JSON 报告、严重度分级、交互式范围选择、置信度过滤、去重、报告写入

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | review CLI 和报告生成 | 阻断 review |
| 版本控制 | Git | >= 2.30.0 | diff、staged、branch 范围解析 | 仅允许 `--scan` |
| 数据格式 | JSON | ECMA-404 | review 机器报告 | 仅输出 Markdown 时返回警告 |
| Agent 协议 | Harness reviewer contract | v1 | reviewer/validator 输出结构 | 降级为单进程 lite 审查 |

### 4.3 数据存储
- [ ] Markdown 报告：`.harness/reports/review/<timestamp>-<branch>.md`
- [ ] JSON 报告：`.harness/reports/review/<timestamp>-<branch>.json`
- [ ] 临时上下文：`.harness/cache/review/**`，命令结束后必须清理或标记可忽略

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地 Git 和文件系统权限；远程评论需要用户已配置的远程凭据
- 授权范围：`--no-fix` 禁止写源码；`--fix` 仅允许写审查范围内低风险机械修复

### 5.2 数据安全
- 敏感字段：报告不得包含敏感文件内容；远程评论必须过滤本地绝对私密路径

### 5.3 审计要求
- 日志记录：scope、reviewer 列表、validator 结果、finding 统计、报告路径

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：review JSON 报告必须包含 schemaVersion；新增 finding 字段必须向后兼容

### 6.2 数据兼容性
- 数据迁移方案：旧 `.kld-review/` 报告可作为 knowledge 输入，新报告默认写入 `.harness/reports/review/`
- 回滚策略：`--fix` 修改必须通过 transaction，失败时回滚本次修复

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（10 个需求项，18 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
