---
mode: "full"
test-strategy: "tdd"
---

# proposal.md - 业务意图与上下文总览

> **定位**：变更的业务意图（Why）与上下文总览
>
> **可选性**：【可跳过，直入spec】若跳过，必须将"影响范围"在 specs 中补齐

---

## 1. 需求背景

### 1.1 现状问题

在 `personal-dev-tool-harness` 变更的首次实施中，虽然完成了 102 个原子任务、109 个测试用例全部通过，但经过与需求文档 `requirements/个人开发工具-harness-实施方案.md` 的系统性对比，发现存在以下严重偏移：

- **核心产品流程断裂**：交互式向导（6 步问题）仅为 stub，无法完成 AI 工具选择、能力集配置、Skill 投影安装等关键初始化流程；已初始化项目中无参数运行未进入操作菜单
- **命令参数解析缺失**：8 个顶层命令中，除全局参数（`--cwd`/`--dry-run`/`--json`/`--no-color`）外，命令级参数（如 `inspect --path`、`sync --check`、`develop --spec`、`review --local`、`knowledge --search`、`config --migrate-*`）全部未解析
- **命令功能不完整**：
  - `inspect`：缺少 `--full` 全量扫描、`--path` 限定扫描、`--rules` 条件生成
  - `sync`：缺少 `--check` 漂移检测、`--fast` 快速判断、`--docs` 文档限定
  - `develop`：仅实现 propose 阶段，缺少 spec/design/tasks/check/apply/archive；缺少默认自动阶段检测（检测已有阶段→询问下一步→自动进入缺失阶段）；缺少 `--capability` 限定单能力域、`--no-parallel` 强制串行；阶段文件未写入 `.harness/develop/changes/` canonical storage 路径，缺少旧 `openspec/changes/**` 兼容读取；design 阶段未读取 repo facts；apply 阶段未按任务 DAG 并行执行无依赖任务
  - `review`：缺少范围参数（`--local`/`--staged`/`--scan`）、`--full` 强制满 agent、`--lite` 轻量检查、`--comment` MR/PR 评论、JSON 报告、多 agent 编排；缺少交互式范围选择；缺少置信度过滤（confidence < 80 丢弃）和去重；报告未写入 `.harness/reports/review/<timestamp>-<branch>.md/.json`
  - `knowledge`：使用 JSON 文件替代 SQLite FTS5，缺少 `--index` 索引构建/刷新、`--search` 搜索功能
  - `config`：`--migrate-docsync`/`--migrate-sdd`/`--migrate-review`/`--migrate-docs` 四个迁移参数硬编码，缺少 `--repair-adapters`
- **Skill 投影内容不完整**：Claude/Codex 投影文件缺少 frontmatter、references/scripts/assets 目录、Copilot/Cursor adapter 未实现；缺少 `.agents/skills/harness/agents/openai.yaml`（Codex agent 定义）；缺少 `.github/copilot-instructions.md`（Copilot 指令）
- **Hook/Subagent 完全未实现**：5 个 Hook（dangerous-command、sync-after-doc-change、review-before-push、session-summary、compact-state）和 Subagent 定义文件均未生成；缺少 Hook 配置文件（Claude `settings.json`、Codex `hooks.json`）；Subagent 缺少具体 agent 清单（需求分析 4 个、设计 4 个、代码生成 4 个、review 7 个）
- **工作区目录缺失**：`.harness/docs/`、`.harness/rules/`、`.harness/events/` 三个子目录未创建；同时缺少 `develop/archive/`、`develop/templates/`、`reports/sync/`、`reports/develop/`、`reports/review/` 等子目录
- **配置模型不完整**：缺少 `review.config.json`、`knowledge.config.json`、`*.local.json` 配置文件；`harness.config.json` 缺少 `documents.generatedBlockPrefix` 等字段
- **安全规则不完整**：dangerous-command 阻断列表缺少 `git clean -fdx`、`Remove-Item -Recurse -Force`、`git push --force`
- **打包安全未验证**：未验证 `npm pack --dry-run` 不包含 cache、secrets、巨大 context 文件

这些偏移导致 M1 里程碑验收标准中"无参数 npx 进入向导"、"sync 能发现漂移"、"review 输出 Markdown + JSON"等核心验收项无法通过。

### 1.2 业务诉求

- 修复所有命令级参数解析，使每个命令能够正确响应用户意图
- 实现完整的交互式初始化流程，包括 AI 工具选择、能力集配置、文档生成、Skill 投影安装
- 补全各命令的核心功能，使其达到需求文档定义的最小可用状态
- 实现 Hook 和 Subagent 基础设施，支持安全编排和并行执行
- 补全工作区目录结构，确保所有产物有正确的存储位置
- 确保 M1 里程碑验收标准全部通过

---

## 2. 业务目标

| 目标维度 | 具体描述 | 验收标准 |
|---------|---------|---------|
| 功能目标 | 修复命令参数解析，使 8 个命令能够正确响应各自参数 | `inspect --full/--path/--rules`、`sync --check/--fast/--docs`、`develop --spec/--capability/--no-parallel`、`review --local/--staged/--scan/--full/--lite/--comment`、`knowledge --index/--search`、`config --migrate-docsync/--migrate-sdd/--migrate-review/--migrate-docs/--repair-adapters` 等参数能够正确解析并影响命令行为 |
| 功能目标 | 实现完整的交互式初始化向导和操作菜单 | 无参数运行 `npx @hunterzheng/harness`：未初始化项目进入 6 步向导，完成后生成 AGENTS.md、CLAUDE.md、Skill 投影；已初始化项目进入操作菜单 |
| 功能目标 | 补全各命令核心功能 | `sync --check` 能检测漂移、`review` 输出 Markdown + JSON 报告、`knowledge --index` 能构建索引、`knowledge --search` 能搜索、`develop` 支持多阶段且文件写入 canonical storage |
| 功能目标 | 实现 Hook 和 Subagent 基础设施 | 5 个 Hook 脚本生成到 `.claude/hooks/` 和 `.codex/hooks/`，Subagent 定义文件生成到 `.harness/adapters/` |
| 性能目标 | 命令参数解析不影响现有性能 | 参数解析耗时 < 100ms（P95） |
| 体验目标 | 初始化流程完整且用户友好 | 向导问题清晰、默认值合理、错误提示明确 |
| 质量目标 | 所有修复均有测试覆盖 | 新增测试用例覆盖所有修复功能，测试通过率 100% |

---

## 3. 能力分解

### 3.1 新增能力

无。本次变更仅修改已有能力。

### 3.2 修改能力

- `harness-cli-entrypoint`：实现交互式向导（6 步问题）、已初始化项目无参数运行进入操作菜单、命令级参数解析框架（含各命令 `--json` 格式化输出）、初始化时生成 AGENTS.md/CLAUDE.md/Skill 投影
- `harness-workspace-config`：补全 `.harness/docs/`、`.harness/rules/`、`.harness/events/`、`develop/archive/`、`develop/templates/`、`reports/sync/`、`reports/develop/`、`reports/review/` 目录创建；补全 `review.config.json`、`knowledge.config.json`、`*.local.json` 配置文件；确保 `harness.config.json` 包含 `documents.generatedBlockPrefix` 等完整字段
- `harness-adapter-skill-runtime`：完善 Claude/Codex 投影内容（frontmatter、references/scripts/assets）、实现 Copilot/Cursor adapter、实现 `--repair-adapters`；生成 `.agents/skills/harness/agents/openai.yaml`（Codex agent 定义）；生成 `.github/copilot-instructions.md`（Copilot 指令）
- `harness-inspect`：实现 `--full` 全量扫描、`--path` 限定扫描、`--rules` 条件生成、facts 大小控制
- `harness-sync`：实现 `--check` 漂移检测、`--fast` 快速判断、`--docs` 文档限定、`REVIEW_REQUIRED` 标注；高风险变更自动从 `--fast` 升级为完整检查；报告写入 `.harness/reports/sync/*.md`
- `harness-develop`：实现 spec/design/tasks/check/apply/archive 多阶段支持；实现默认自动阶段检测（检测已有阶段→询问下一步→自动进入缺失阶段）；`--from` 从需求文档生成、`--parallel` 并行、`--capability` 限定单能力域、`--no-parallel` 强制串行；阶段文件写入 `.harness/develop/changes/<change>/` canonical storage 路径；兼容读取旧 `openspec/changes/**`；design 阶段读取 repo facts；apply 阶段按任务 DAG 并行执行无依赖任务
- `harness-review`：实现 `--local`/`--staged`/`--scan` 范围参数、`--full` 强制满 agent、`--lite` 轻量检查、`--comment` MR/PR 评论、`--fix`/`--no-fix`、JSON 报告输出、P0/P1/P2 严重度分级；实现交互式范围选择；实现 6 个并行 review agent + N 个 finding validator（对每条 finding 独立复核）；实现置信度过滤（confidence < 80 丢弃）和去重；报告写入 `.harness/reports/review/<timestamp>-<branch>.md/.json`
- `harness-knowledge`：迁移到 SQLite FTS5、实现 `--index` 索引构建/刷新（索引 openspec archive、ADR、rules、reports）、实现 `--search` 搜索、搜索结果带 source path/snippet/score、增量索引
- `harness-safety-orchestration`：实现 5 个 Hook 脚本生成（含 Hook 配置文件 Claude `settings.json`、Codex `hooks.json`）；Subagent 定义文件生成（需求分析 4 个、设计 4 个、代码生成 4 个、review 7 个）；dangerous-command 阻断集成到 CLI 流程（在 `src/cli/main.ts` 命令执行前拦截危险命令）；阻断列表包含 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force`

---

## 4. 影响范围

### 4.1 涉及模块

- [ ] `src/cli/interactive.ts`：实现 `runInitWizard()` 6 步问题、`runOperationMenu()` 可选择执行
- [ ] `src/cli/global-options.ts`：扩展为支持命令级参数解析框架（含各命令 `--json` 格式化输出）
- [ ] `src/cli/main.ts`：初始化时调用文档生成和 Skill 投影安装；集成 dangerous-command 阻断拦截点
- [ ] `src/core/workspace.ts`：补全 `.harness/docs/`、`.harness/rules/`、`.harness/events/`、`develop/archive/`、`develop/templates/`、`reports/sync/`、`reports/develop/`、`reports/review/` 目录
- [ ] `src/core/paths.ts`：确保 develop canonical storage 路径 `.harness/develop/changes/<change>/` 正确定义
- [ ] `src/core/config-schema.ts`：确保 `harness.config.json` 包含 `documents.generatedBlockPrefix` 等完整字段；补全 `review.config.json`、`knowledge.config.json`、`*.local.json` 配置 schema
- [ ] `src/adapters/projection-renderer.ts`：完善 Claude/Codex 投影内容（frontmatter）
- [ ] `src/adapters/registry.ts`：添加 Copilot/Cursor adapter 定义
- [ ] `src/adapters/projection-writer.ts`：生成 `.agents/skills/harness/agents/openai.yaml`（Codex agent 定义）；生成 `.github/copilot-instructions.md`（Copilot 指令）
- [ ] `src/commands/config.ts`：实现 `--repair-adapters`；逐一实现 `--migrate-docsync`、`--migrate-sdd`、`--migrate-review`、`--migrate-docs` 四个迁移参数，消除硬编码
- [ ] `src/capabilities/inspect/command.ts`：实现 `--full`、`--path`、`--rules` 参数解析
- [ ] `src/capabilities/sync/command.ts`：实现 `--check`、`--fast`、`--docs` 参数解析和漂移检测逻辑；高风险变更自动从 `--fast` 升级为完整检查；报告写入 `.harness/reports/sync/*.md`
- [ ] `src/capabilities/develop/command.ts`：实现 spec/design/tasks/check/apply/archive 多阶段；实现默认自动阶段检测；实现 `--capability`、`--no-parallel` 参数；阶段文件写入 `.harness/develop/changes/` canonical storage；兼容读取旧 `openspec/changes/**`；design 阶段读取 repo facts；apply 阶段按任务 DAG 并行执行无依赖任务
- [ ] `src/capabilities/review/command.ts`：实现 `--local`/`--staged`/`--scan` 范围参数、`--full`、`--lite`、`--comment`、JSON 报告、严重度分级；实现交互式范围选择；实现置信度过滤（confidence < 80 丢弃）和去重；报告写入 `.harness/reports/review/<timestamp>-<branch>.md/.json`
- [ ] `src/capabilities/knowledge/command.ts`：迁移到 SQLite FTS5、实现 `--index` 索引构建/刷新、实现 `--search`
- [ ] `src/capabilities/safety/command.ts`：实现 Hook 脚本生成（含 `settings.json`/`hooks.json` 配置文件）、Subagent 定义文件生成（需求分析 4 个、设计 4 个、代码生成 4 个、review 7 个）；阻断列表包含 `rm -rf`、`git reset --hard`、`git clean -fdx`、`Remove-Item -Recurse -Force`、`npm publish`、`git push --force`
- [ ] `test/cli/interactive.test.ts`：新增向导测试
- [ ] `test/capabilities/*.test.ts`：扩展各命令测试覆盖新功能
- [ ] `test/pack.test.ts`：新增 `npm pack --dry-run` 打包安全测试，确保不包含 cache、secrets、巨大 context 文件

### 4.2 依赖关系

```
[需求文档 requirements/个人开发工具-harness-实施方案.md]
  --> [本变更 harness-impl-gap-fix]
  --> [M1 里程碑验收]
```

### 4.3 数据影响

- 数据库表变更：`knowledge` 命令从 JSON 文件迁移到 SQLite FTS5（`.harness/cache/knowledge.sqlite`）
- 接口变更：各命令新增参数解析，响应结构可能扩展（如 `review` 新增 JSON 报告路径）
- 配置变更：`harness.config.json` 可能新增 Hook/Subagent 相关配置项

---

## 5. 约束与假设

### 5.1 业务约束

- 所有修复必须保持向后兼容，不破坏已有 109 个测试用例
- 命令参数设计必须遵循需求文档 §4 的定义，不新增未定义的参数
- 交互式向导问题必须遵循需求文档 §3.1 的 6 步设计
- Hook 和 Subagent 实现必须遵循需求文档 §9-§10 的规范

### 5.2 技术约束

- 命令级参数解析使用 `commander` 库的子命令或 `program.args` 机制
- SQLite FTS5 使用 `better-sqlite3` 或 `sqlite3` npm 包
- Hook 脚本生成必须适配 Claude/Codex 的 Hook schema
- Subagent 定义文件格式必须适配 Claude（`.md`）和 Codex（`.toml`）

### 5.3 前置依赖

- [x] `personal-dev-tool-harness` 变更已完成实施并归档
- [x] 9 个 Capability 的 spec.md 已同步到 `openspec/specs/`
- [ ] 确认 SQLite FTS5 npm 包选择（`better-sqlite3` vs `sqlite3`）
- [ ] 确认 Claude/Codex Hook schema 版本

---

## 6. 风险评估

| 风险项 | 概率 | 影响 | 应对策略 |
|-------|------|------|---------|
| 命令级参数解析框架设计不当，导致参数冲突或解析错误 | 中 | 高 | 先设计统一的参数解析框架，再逐个命令实现；充分测试参数组合 |
| SQLite FTS5 迁移导致现有 knowledge 索引数据丢失 | 低 | 中 | 迁移时保留旧 JSON 文件作为备份，提供回滚机制 |
| Hook 脚本生成不符合 Claude/Codex schema，导致 Hook 无法安装 | 中 | 高 | 先研究 Claude/Codex Hook schema，生成后手动验证安装 |
| 交互式向导问题设计不合理，导致用户体验差 | 低 | 中 | 遵循需求文档 §3.1 的 6 步设计，提供合理的默认值 |
| 多阶段 develop 实现复杂，导致阶段检测错误 | 中 | 中 | 先实现单阶段（spec/design/tasks），再逐步扩展到 check/apply/archive |

---

## 7. 相关文档

- 需求文档：`requirements/个人开发工具-harness-实施方案.md`
- 原型链接：无
- 参考文档：
  - `openspec/changes/archive/2026-05-28-personal-dev-tool-harness/check-report.md`（偏移分析报告）
  - `openspec/specs/` 下 9 个 Capability 的 spec.md（已有规格定义）

---

> **质量红线检查清单**
> - [x] 逻辑链路已闭环
> - [x] 受影响模块已明确
> - [x] 依赖关系已梳理
> - [x] 若跳过本文档，影响范围已在 specs 中补齐
> - [x] 能力分解章节已明确列出所有能力
