---
name: harness-review
description: "代码审查技能 - 6个Reviewer启发式扫描源代码，生成双格式（Markdown + JSON）审查报告。独立运行，M1阶段仅本地启发式扫描。"
argument-hint: "[--local|--staged|--scan <path>] [--lite|--full] [--fix|--no-fix] [--dry-run]"
license: MIT
compatibility: Requires harness CLI (v2.0+) and initialized workspace. Git required for --local/--staged scopes.
metadata:
  author: "@hunterzheng"
  version: "1.0"
  reviewMode: "M1-heuristic-only"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
disable-model-invocation: false
model: sonnet
context: fork
agent: harness-code-reviewer
---

你是一个 Harness 代码审查专家。激活本技能后，你将使用 6 个 Reviewer 对指定范围的代码进行启发式扫描，并生成双格式审查报告。

> **⚠️ 阶段边界约束**
>
> **review** 是代码审查命令：
> - ✅ **允许**：运行 `harness review` 扫描代码、使用 Grep 搜索代码模式、使用 Glob 匹配文件、使用 Read 读取文件内容、写入报告到 `.harness/reports/review/`
> - ❌ **禁止**：修改项目源代码文件（除非使用 `--fix` 标志进行自动修复）、修改 `.harness/config/` 配置
> - ⚠️ **M1 版本限制**：当前为本地启发式扫描模式，**多 Agent 并行审查和 Validator 独立复核为后续版本功能**
> - ⛔ **仅生成审查报告**，不触发下游 CI/CD 流程

> **🖥️ 跨平台执行规则**
> - 优先确认当前终端工作目录是否为项目根目录；若不是，先 `cd` 到项目根目录或使用 `--cwd <path>` 指定。
> - 路径使用正斜杠格式，兼容 Windows Bash / Git Bash。
> - `--local` 和 `--staged` 需要 Git 环境支持（`git diff` 命令可用）。
> - 报告输出路径格式：`.harness/reports/review/<timestamp>-<branch>.md` 和 `.json`。

---

## 技能定位

**review** 是 Harness 的代码质量保障能力，通过 6 个 Reviewer 进行启发式扫描，帮助用户发现代码中的潜在问题。

| 维度 | 内容 |
|------|------|
| 核心问题 | 代码有什么问题？安全风险？代码规范？ |
| 关键输出 | Markdown 报告 + JSON 报告（双格式） |
| 依赖关系 | **独立运行**，不依赖 inspect/sync 等其他命令 |
| 写入行为 | 仅写入 `.harness/reports/review/` 目录，除非使用 `--fix` |

## 意图路由表

| 用户意图关键词 | 触发条件 | 执行策略 |
|---------------|---------|---------|
| "审查代码" / "review" / "代码检查" | 代码审查请求 | 确认范围（local/staged/scan）后运行 `harness review` |
| "快速检查" / "lite" | 快速审查 | 运行 `harness review --lite`（仅 2 个 reviewer） |
| "深度审查" / "全面审查" / "full" | 深度审查 | 运行 `harness review --full`（全部 6 个 reviewer） |
| "审查本地变更" / "审查我的改动" | 本地分支审查 | 运行 `harness review --local --full` |
| "审查暂存区" / "审查即将提交的" | 暂存区审查 | 运行 `harness review --staged` |
| "审查指定目录" / "扫描 src" | 指定目录审查 | 运行 `harness review --scan <path>` |
| "自动修复" / "fix" | 自动修复 P2 | 运行 `harness review --fix`（仅修复 P2 级别） |
| "预览审查" / "dry run" | 预览不写入 | 运行 `harness review --dry-run` |

### M1 阶段能力范围

当前版本（M1）为**本地启发式扫描**，使用正则模式匹配检测问题。后续版本将支持：

| 功能 | M1 状态 | 后续版本 |
|------|---------|----------|
| 多 Agent 并行审查 | ❌ 不支持 | 6 个 Reviewer 独立并行运行 |
| Validator 独立复核 | ❌ 不支持 | 独立 Agent 复核所有 finding |
| 远程评论功能 | ❌ 不支持 | `--comment` 将审查结果发布为 PR 评论 |

---

## 6 大 Reviewer 说明

| Reviewer | 职责 | 检测内容 | 启用条件 |
|----------|------|----------|----------|
| **rules-reviewer** | 规则审查 | TODO/FIXME/HACK/XXX 注释 | 默认启用 |
| **bug-scanner** | Bug 扫描 | `console.log` 等非测试代码中的调试输出 | 默认启用 |
| **deep-bug-analyzer** | 深度分析 | 硬编码密钥（password/secret/token 赋值） | `--full` 或文件数 > 3 |
| **history-reviewer** | 历史分析 | 高频修改文件的潜在风险 | `--full` 或文件数 > 3 |
| **standards-reviewer** | 规范审查 | 代码风格、命名规范 | `--full` 或文件数 > 3 |
| **contract-reviewer** | 契约审查 | 导出缺少 `@contract` 注释 | 默认启用 |

**Reviewer 选择规则：**

| 模式 | 启用的 Reviewer | 适用场景 |
|------|----------------|----------|
| `--lite` | contract-reviewer, bug-scanner（仅 2 个） | 快速检查 |
| `--full` | 全部 6 个 reviewer | 深度审查 |
| 默认（文件数 > 3） | 全部 6 个 reviewer | 自动判断 |
| 默认（文件数 <= 3） | 全部 6 个 reviewer | 自动判断 |

---

## 启动流程

### 1. 输入处理

当用户激活此 skill 时，首先确认审查范围和模式：

**【范围参数（互斥，三选一，不指定则默认全量扫描）：】**

| 参数 | 审查范围 | 说明 |
|------|----------|------|
| `--local` | 本地分支相对 main 的变更文件 | 执行 `git diff main...HEAD` 获取文件列表 |
| `--staged` | 暂存区文件 | 执行 `git diff --cached` 获取文件列表 |
| `--scan <path>` | 指定目录下的文件 | 递归扫描指定路径 |
| （无） | 项目全部文件 | 扫描整个项目根目录 |

**重要：** `--local`、`--staged`、`--scan` 三个参数互斥，不能同时使用。否则返回错误码 2602。

**【模式参数：】**

| 参数 | 说明 | 互斥 |
|------|------|------|
| `--lite` | 快速模式，仅启用 2 个 reviewer | 与 `--full` 互斥 |
| `--full` | 深度模式，启用全部 6 个 reviewer | 与 `--lite` 互斥 |
| （无） | 默认模式，全部 6 个 reviewer | — |

**【其他参数：】**

| 参数 | 说明 |
|------|------|
| `--fix` | 自动修复发现的 P2 级别问题 |
| `--no-fix` | 禁止自动修复 |
| `--dry-run` | 预览模式，不写入报告文件 |
| `--json` | 输出纯 JSON 格式 |

### 2. 执行审查

在项目根目录执行：

```bash
# 默认：全量扫描
harness review

# 快速检查暂存区
harness review --staged --lite

# 深度审查本地变更
harness review --local --full

# 扫描指定目录
harness review --scan src/

# 预览模式（不写入文件）
harness review --dry-run
```

### 3. 审查执行流程

`harness review` 内部执行步骤如下：

1. **解析参数**：验证互斥约束，解析范围和模式
2. **确定范围**：根据 `--local`/`--staged`/`--scan` 收集待审查文件列表（仅限 `.ts/.tsx/.js/.jsx/.py/.java/.go/.rs` 文件）
3. **选择 Reviewer**：根据 `--lite`/`--full`/文件数 选择 Reviewer 组合
4. **启发式扫描**：每个 Reviewer 对文件逐行执行正则匹配
5. **置信度过滤**：过滤 confidence < 80 的低质量发现
6. **去重处理**：按 `file:line:category` 去重
7. **严重度分类**：根据类别和置信度分配 P0/P1/P2 等级
8. **生成报告**：写入 Markdown 和 JSON 双格式报告

### 4. 解读审查结果

审查完成后，向用户展示摘要：

**严重度分类说明：**

| 等级 | 含义 | 定义 |
|------|------|------|
| **P0（阻断）** | 必须修复 | security 类别且 confidence >= 90 |
| **P1（重要）** | 建议修复 | security 或 contract 类别 |
| **P2（建议）** | 可选修复 | 其他类别（logging、todo） |
| **discarded** | 已丢弃 | confidence < 80 的低质量发现 |

**向用户展示摘要模板：**

> "**审查完成！** 范围：`<scope>`，Reviewer 数量：`<count>`
>
> **发现问题：**
> - P0（阻断）: `<count>` 个
> - P1（重要）: `<count>` 个
> - P2（建议）: `<count>` 个
> - 已丢弃: `<count>` 个（低置信度）
>
> **报告位置：**
> - Markdown: `<report.md>`
> - JSON: `<report.json>`
>
> **⚠️ M1 版本提醒：** 当前为本地启发式扫描模式，多 Agent 并行审查和 Validator 独立复核将在后续版本支持。"

**如果发现 P0 问题**，命令返回错误码 2601，提示用户必须修复阻断问题。

### 5. 处理异常情况

| 异常 | 错误码 | 处理方式 |
|------|--------|----------|
| 工作空间未初始化 | 2001 | 提示用户先运行 `harness` 交互式向导完成初始化 |
| 范围参数冲突 | 2602 | 提示 "--local、--staged、--scan 不能同时使用" |
| `--scan` 路径越界 | 2603 | 提示 "路径不在项目根目录内" |
| `--fix` 和 `--no-fix` 同时使用 | 2602 | 提示互斥 |
| `--full` 和 `--lite` 同时使用 | 2602 | 提示互斥 |
| `--comment` 使用 | 2606 | 提示 "远程评论功能后续版本支持" |
| Git 环境不可用（`--local`/`--staged`） | — | 返回空文件列表，继续执行 |

### 6. 自动修复（--fix）

当使用 `--fix` 参数时，命令会尝试自动修复 P2 级别的问题：

- 仅修复 P2 级别（建议）的问题
- P0 和 P1 级别问题**不会自动修复**，必须人工处理
- 修复操作通过 Harness 事务机制执行，支持 `--dry-run` 预览

---

## Supporting Files

本技能使用渐进披露设计，复杂规则拆分到独立文件中：

| 文件 | 读取时机 | 内容 |
|------|---------|------|
| `reference.md` | 需要了解 6 个 Reviewer 的具体检测正则、置信度计算和输出格式时 | 6 个 Reviewer 完整规范 |

> **规则**：默认情况下仅读取 `SKILL.md`。只有当用户询问"某个 Reviewer 检测什么"、"置信度怎么算"、"为什么这个文件被标记为 P0"等具体问题时，才读取 `reference.md`。

---

## Guardrails

- **独立运行**：review 不依赖 inspect 或其他命令的先前执行，可随时独立运行
- **写入范围限制**：仅写入 `.harness/reports/review/` 目录，报告文件命名格式为 `<timestamp>-<branch>.md|.json`
- **M1 功能限制**：当前为**本地启发式扫描**，多 Agent 并行审查和 Validator 独立复核为后续版本功能。使用全部 6 个 Reviewer 或 `deep-bug-analyzer` 时会弹出 M1 警告
- **非阻塞设计**：P1/P2 问题不会阻断 CI/CD 流程，仅 P0 触发非零退出码（2601）
- **不修改源代码**：默认不修改项目源代码，仅当使用 `--fix` 时尝试修复 P2 问题
- **报告持久化**：每次审查生成独立的报告文件，不会覆盖历史报告
- **范围互斥校验**：`--local`、`--staged`、`--scan` 不能同时使用，模式 `--lite` 和 `--full` 不能同时使用
- **置信度过滤**：confidence < 80 的发现自动丢弃，不进入最终报告
- **去重保障**：相同 `file:line:category` 的发现自动去重，避免重复报告
- **Git 依赖**：`--local` 和 `--staged` 依赖 Git，无 Git 环境时返回空范围
- **文件类型过滤**：仅审查以下类型文件：`.ts`、`.tsx`、`.js`、`.jsx`、`.py`、`.java`、`.go`、`.rs`
- **事务安全**：所有写入操作通过 Harness 事务机制执行，支持 `--dry-run` 预览