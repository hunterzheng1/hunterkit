---
# 【用户选择配置 - 由 /opsx:propose 引导填写】
mode: "full"           # full=每个能力域独立文档(specs/<capability>/*), simple=单一文档(spec.md/design.md/tasks.md)
test-strategy: "tdd" # tdd=测试先行, impl-first=实现优先, none=无测试
---

# proposal.md - 业务意图与上下文总览

> **定位**：变更的业务意图（Why）与上下文总览
>
> **可选性**：【可跳过，直入spec】若跳过，必须将"影响范围"在 specs 中补齐

---

## 1. 需求背景

个人开发工作流中已经存在 DocSync、GSD 思路、kld-sdd、kld-review 等可复用能力，但它们以来源项目或内部流程为中心暴露给用户，导致日常使用需要记住多个入口、多个目录约定和多套 agent/skill 规则。本次变更希望把这些能力收敛为一个统一 CLI 驱动的个人轻量开发工具 Harness，让用户只按 `inspect / sync / develop / review / knowledge` 等意图操作。

### 1.1 现状问题
- 现有能力分散在多个来源项目中，命令、目录、报告和安装体验不统一。
- 用户需要理解 DocSync、kld-sdd、kld-review 等内部来源名，学习成本偏高。
- Skill、Agent、Hook 的职责边界容易混在文档里，强约束缺少统一落点。
- SDD 文档、同步报告、审查报告、知识索引等产物分散，长期容易污染目标项目根目录。
- 部分来源项目仍有接入前清理项，例如 kld-sdd 测试脚本缺失文件、知识库连接配置硬编码等。

### 1.2 业务诉求
- 对外只保留 `npx @hunterzheng/harness` 和 `harness <command>` 这一套用户入口。
- 用户按功能意图选择命令，不感知内部来源项目名称。
- Harness 生成的配置、事实、报告、开发文档和知识库默认收纳到 `.harness/`。
- Claude Code、Codex、CI 等调用同一个 CLI，Skill 只做薄路由和安全约束。
- 文档同步、规格驱动开发、代码审查、知识检索都能产出结构化、可追踪、可验证的结果。

---

## 2. 业务目标

| 目标维度 | 具体描述 | 验收标准 |
|---------|---------|---------|
| 功能目标 | 提供统一 Harness CLI 和初始化向导，覆盖 inspect、sync、develop、review、knowledge、status、doctor、config 等用户意图 | 用户可通过 `npx @hunterzheng/harness` 初始化，通过 `harness <command>` 完成核心工作流；用户文档不暴露 DocSync、GSD、kld-sdd、kld-review 作为日常命令 |
| 功能目标 | 安装单一用户可见 `harness` Skill，并为 Claude/Codex 生成必要轻量投影 | 初始化后只出现一个 Harness Skill；运行时投影可路由到同一个 CLI；完整模板和资料保留在 `.harness/adapters/**` |
| 功能目标 | 将 Harness 产物默认集中到 `.harness/` 工作区，并兼容读取旧来源目录 | 新建配置、facts、reports、develop 文档、knowledge cache 默认进入 `.harness/`；已有 `.docsync/`、`openspec/changes/**`、`.kld-review/`、`skywalk-sdd/` 可作为兼容来源读取 |
| 功能目标 | 提供 inspect、sync、develop、review、knowledge 的结构化输出 | inspect 生成 facts/rules；sync 生成漂移检查和报告；develop 生成 SDD 文档链；review 生成 Markdown + JSON；knowledge 支持本地索引和检索 |
| 性能目标 | 常用命令支持快速路径和范围限定，避免每次全量扫描 | `inspect --path`、`sync --fast`、`review --lite`、`review --scan` 等命令能限定范围；大范围任务可使用 subagent 并行 |
| 体验目标 | 初次使用由交互式向导承接复杂选择，日常使用保持少量稳定命令 | 无参数 npx 首次进入向导；已初始化项目进入操作菜单；常用工作流可以自然语言或 CLI 触发 |
| 质量目标 | 关键流程具备测试优先任务规划和完成前验证 | 后续 tasks 阶段按 TDD 策略生成测试骨架、实现、验证的依赖关系；M1 至少要求 lint、test、dry-run、inspect/sync/review 验收命令通过 |

---

## 3. 能力分解

### 3.1 新增能力
- `harness-cli-entrypoint`: 统一 npx 入口、顶层命令、交互式初始化、状态与诊断入口。
- `harness-workspace-config`: `.harness/` 工作区契约、配置模型、状态文件、事务写入和兼容读取规则。
- `harness-adapter-skill-runtime`: 单一 Harness Skill、Claude/Codex/Copilot/Cursor adapter、轻量运行时投影和 Hook 投影。
- `harness-inspect`: 项目扫描、repo facts、module map、rules.generated 等项目事实输出。
- `harness-sync`: README、AGENTS、CLAUDE、Copilot instructions 等文档同步与漂移检查。
- `harness-develop`: proposal/spec/design/tasks/check/apply/archive 的规格驱动开发流程管理。
- `harness-review`: 本地 diff、暂存区、全量扫描、PR/MR 场景的多 agent 审查与报告输出。
- `harness-knowledge`: 本地知识索引与检索，覆盖历史 specs、ADR、rules、reports。
- `harness-safety-orchestration`: subagent 编排边界、危险命令阻断、review-before-push、结构化事件与报告约束。

### 3.2 修改能力
- 无。当前仓库仅存在全局 `overview` 规格，本次变更以新增 Harness 能力域为主。

---

## 4. 影响范围

### 4.1 涉及模块
- [ ] CLI 入口：影响 `npx @hunterzheng/harness`、无参数向导、`harness <command>` 命令面。
- [ ] Core 工作区：影响 `.harness/` 创建、配置、状态、facts、reports、cache、transaction、generated block。
- [ ] Adapter/Skill：影响 Claude、Codex、Copilot、Cursor 的 skill、agent、hook、instructions 投影。
- [ ] Inspect 能力：影响项目结构扫描、构建/CI/文档识别、规则建议生成。
- [ ] Sync 能力：影响 README、AGENTS、CLAUDE、Copilot instructions 的同步策略和报告。
- [ ] Develop 能力：影响 SDD 文档链、OpenSpec 兼容读取、change 状态推进、阶段检查。
- [ ] Review 能力：影响审查范围解析、多 reviewer/validator 编排、Markdown + JSON 报告。
- [ ] Knowledge 能力：影响本地 SQLite FTS5 索引、搜索结果和 source path 追踪。
- [ ] Safety/Hook 能力：影响危险命令阻断、push 前审查门禁、session/event 记录。
- [ ] 来源项目迁移：影响 DocSync、kld-sdd、kld-review、Skills/Agents/Hooks 指南中的可复用能力抽取。

### 4.2 依赖关系
```
[DocSync / kld-sdd / kld-review / Skills-Agents-Hooks 指南]
        --> [Harness Core: CLI + workspace + config + transaction]
        --> [inspect / sync / develop / review / knowledge capabilities]
        --> [Claude / Codex / CI / user CLI workflows]
```

### 4.3 数据影响
- 数据库表变更：无服务端数据库表变更；知识库第一版使用本地 `.harness/cache/knowledge.sqlite`。
- 接口变更：新增用户 CLI 命令契约 `harness inspect/sync/develop/review/knowledge/status/doctor/config`；新增 JSON 输出契约供 Skill、Hook、CI 消费。
- 配置变更：新增 `.harness/config/harness.config.json`、能力配置、`*.local.json` 本地私有配置；生成 Claude/Codex 等工具必需的轻量投影文件。

---

## 5. 约束与假设

### 5.1 业务约束
- 用户可见命令必须按意图命名，不暴露 DocSync、GSD、kld-sdd、kld-review 等来源名。
- 默认只安装一个用户可见 `harness` Skill。
- 根目录保持最小化，Harness 自有产物默认进入 `.harness/`。
- Skill 只负责识别意图、调用 CLI、展示摘要，不承载大段业务逻辑。
- 文档同步和代码审查必须输出结构化报告，便于后续追踪和自动化使用。

### 5.2 技术约束
- CLI、Skill、Hook、CI 必须共享同一套 Harness 命令契约。
- 写文件流程需要支持 dry-run、transaction、rollback 和 protected content。
- 会写文件或有副作用的能力默认需要明确触发和确认。
- 大范围需求分析、设计拆分、代码审查、实现批次可使用 subagent，但共享文件修改需要主流程串行协调。
- Secret、token、证书和本地私有配置不得进入报告、cache 或 npm 发布包。

### 5.3 前置依赖
- [ ] 记录 DocSync 当前 npm test / lint 基线：已在需求文档中给出 57 项测试通过、lint 通过。
- [ ] 修复 kld-sdd 测试脚本缺失 `test/validate-skills-bundle.cjs` 的问题：待处理。
- [ ] 移除 `opsx-knowledge` 中硬编码 RAGFlow 连接信息和密钥：待处理。
- [ ] 梳理 kld-review agent 编排模型为 Harness review 能力设计输入：待处理。
- [ ] 明确 npm 包名、发布范围和本地 dogfood 项目：默认采用 `@hunterzheng/harness`，发布细节待后续 spec/design 确认。

---

## 6. 风险评估

| 风险项 | 概率 | 影响 | 应对策略 |
|-------|------|------|---------|
| 能力范围过大导致首版不可控 | 中 | 高 | 以 M1 锁定 npx、inspect、sync、review、统一 skill；develop apply、知识库增强、Java 深分析后置 |
| 来源项目迁移时把内部历史复杂度带给用户 | 中 | 高 | 对外只保留意图命令；来源名仅出现在开发者文档和迁移说明中 |
| 根目录投影过多，违背最小化原则 | 中 | 中 | 以 `.harness/adapters/**` 为 source of truth，根目录工具目录只放平台必须识别的薄投影 |
| 自动写文档破坏用户内容 | 中 | 高 | 默认只写 generated block 或确认区域，保留 dry-run、backup、transaction、protected content |
| Review finding 噪声过高 | 中 | 中 | 使用 validator、confidence 门槛、严重度分级和 Markdown + JSON 双报告 |
| Secret 或本地配置泄露 | 低 | 高 | 默认忽略 `.env`、key、token、`*.local.json`、cache；npm pack dry-run 检查发布内容 |
| 多 agent 并行修改冲突 | 中 | 中 | 仅并行无依赖任务；共享文件由主流程串行处理；agent 输出必须包含文件列表和验证命令 |

---

## 7. 相关文档

- 需求文档：`requirements/个人开发工具-harness-实施方案.md`
- 原型链接：无
- 参考文档：`E:\MyProject\AI Related\DocSync\requirements\CLAUDE_CODE_CODEX_SKILLS_AGENTS_HOOKS_GUIDE.md`
- 参考来源：`E:\MyProject\AI Related\DocSync`
- 参考来源：`E:\WorkProject\kld-sdd\kld-sdd`
- 参考来源：`E:\WorkProject\Research\harness\kld-review`

---

> **质量红线检查清单**
> - [x] 逻辑链路已闭环
> - [x] 受影响模块已明确
> - [x] 依赖关系已梳理
> - [x] 若跳过本文档，影响范围已在 specs 中补齐
> - [x] 能力分解章节已明确列出所有能力
