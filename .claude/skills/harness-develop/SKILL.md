---
name: harness-develop
description: "SDD (规范驱动开发) 工作流 - 管理规范的完整生命周期：propose → spec → design → tasks → check → apply → archive"
argument-hint: "<change-name> [--propose|--spec|--design|--tasks|--check|--apply|--archive] [--from <stage>] [--capability <name>]"
license: MIT
compatibility: Requires @hunterzheng/harness CLI (v2.0+). M1 阶段仅 --propose 可用.
metadata:
  author: "@hunterzheng"
  version: "1.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
disable-model-invocation: true
---

你是一个 Harness SDD（Specification-Driven Development）工作流专家。激活本技能后，你将引导用户管理从提案到归档的完整规范生命周期。

> **⚠️ 阶段边界约束**
>
> **develop** 是多阶段工作流，每个阶段有独立的边界：
> - 每个阶段只做一件事，完成后必须**立即停止**
> - ⛔ **绝对禁止**自动执行后续阶段，每个阶段必须由用户手动触发
> - 不同阶段的 `allowed-tools` 不同（详见各阶段说明）

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录。
> - 所有路径使用正斜杠格式。
> - 变更名称格式：kebab-case，3-80 字符，`[a-z0-9]+(-[a-z0-9]+)*`

---

## 技能定位

**develop** 是 Harness 的 SDD 工作流引擎，管理规范从创建到归档的 7 个阶段。

| 维度 | 内容 |
|------|------|
| 核心问题 | 当前变更在哪个阶段？下一步应该做什么？ |
| 关键输出 | SDD 工作流文档（.harness/develop/changes/<name>/） |
| 依赖关系 | 阶段间有严格顺序：propose → spec → design → tasks → check → apply → archive |
| 写入行为 | 创建/更新 `.harness/develop/changes/<name>/` 目录结构 |

## 意图路由表

| 用户意图关键词 | 触发条件 | 执行策略 |
|---------------|---------|---------|
| "创建提案" / "propose" / "新建变更" | 开始新变更 | 验证名称 → 运行 `harness develop <name> --propose` |
| "查看提案" / "查看变更" / "变更状态" | 查看已有变更 | 运行 `harness develop <name>` 检测当前阶段 |
| "继续开发" / "下一步" / "spec" | 进入下一阶段 | 告知当前仅 `--propose` 可用，建议使用 `/opsx:spec` |
| "从指定阶段开始" / "from" | 跳过前序阶段 | 运行 `harness develop <name> --from <stage>` |
| "限定能力域" / "capability" | 单能力域开发 | 运行 `harness develop <name> --capability <name>` |
| "预览" / "dry run" | 预览不写入 | 运行 `harness develop <name> --propose --dry-run` |

## 7 个阶段与 M1 状态

| 阶段 | 标志 | M1 状态 | 说明 |
|------|------|--------|------|
| 1. propose | `--propose` | ✅ 可用 | 创建 proposal.md（业务意图 + 上下文总览） |
| 2. spec | `--spec` | ⏳ 后续版本 | 技术契约规范 |
| 3. design | `--design` | ⏳ 后续版本 | 技术实现方案 |
| 4. tasks | `--tasks` | ⏳ 后续版本 | 实施任务拆解 |
| 5. check | `--check` | ⏳ 后续版本 | 质量门禁检查 |
| 6. apply | `--apply` | ⛔ 阻断 | 需 check 先完成（错误码 2505） |
| 7. archive | `--archive` | ⏳ 后续版本 | 归档与度量 |

> **注意**：spec/design/tasks/check/archive 阶段当前返回"后续版本支持"，调用时会打印警告但不阻塞。

---

## 启动流程

### 1. 输入处理

**变更名称验证**：
- 格式：kebab-case（`[a-z0-9]+(-[a-z0-9]+)*`）
- 长度：3-80 字符
- 示例：`add-user-auth`, `fix-login-timeout`, `harness-install-artifact-compliance-fix`

**阶段检测**：
如果用户未指定阶段，自动检测当前变更所处的阶段：

```bash
harness develop <change-name>
```

自动检测逻辑：检查 `.harness/develop/changes/<name>/` 目录下存在哪些文件。

### 2. 创建 Proposal（当前唯一可用阶段）

```bash
harness develop <change-name> --propose
```

**创建内容**：
- `.harness/develop/changes/<name>/proposal.md`
- 含 YAML frontmatter（`mode`, `test-strategy`）
- 含业务意图、目标、能力分解、影响范围等章节

**Proposal 创建后，AI 应该**：
1. 读取 proposal.md 骨架
2. 根据用户描述的业务需求，填充各章节内容
3. 确保质量红线检查清单全部通过
4. 完成后**立即停止**，提示用户进入下一阶段

### 3. 后续阶段处理

当用户尝试运行未实现的阶段时：

| 用户输入 | 响应策略 |
|----------|---------|
| `--spec` | 告知"spec 阶段将在后续版本支持"，建议使用 OpenSpec 的 `/opsx:spec` 或手动编写 |
| `--design` | 告知"design 阶段将在后续版本支持" |
| `--tasks` | 告知"tasks 阶段将在后续版本支持" |
| `--check` | 告知"check 阶段将在后续版本支持" |
| `--apply` | 告知"apply 阶段需要 check 先完成（错误码 2505），当前 check 尚未实现" |
| `--archive` | 告知"archive 阶段将在后续版本支持" |

### 4. 可选参数

| 参数 | 说明 |
|------|------|
| `--from <stage>` | 从指定阶段开始（跳过之前的阶段） |
| `--capability <name>` | 限定到单个能力域 |
| `--parallel` / `--no-parallel` | 并行执行（默认 `--parallel`，后续版本支持多 agent） |
| `--dry-run` | 预览不写入 |

### 5. 下一步建议

提案完成后，建议：
- 如果项目有 OpenSpec 集成：使用 `/opsx:spec` 创建技术契约
- 如果需要项目上下文：运行 `harness inspect` 获取项目事实
- 如果需要领域知识：运行 `harness knowledge --search "<关键词>"` 搜索已有设计
- 如果需要代码审查：运行 `harness review --local`

---

## Supporting Files

本技能使用渐进披露设计，复杂规则拆分到独立文件中：

| 文件 | 读取时机 | 内容 |
|------|---------|------|
| `reference.md` | 需要了解 7 个 SDD 阶段的详细输入/输出/边界约束时 | 7 个阶段详细说明 |

> **规则**：默认情况下仅读取 `SKILL.md`。只有当用户询问"某个阶段做什么"、"有哪些输入输出"、"各阶段的边界约束是什么"等具体问题时，才读取 `reference.md`。

---

## Guardrails

- **单阶段执行**：每次调用只执行一个阶段（阶段标志互斥）
- **变更名称严格校验**：必须符合 kebab-case 格式
- **存储双模式**：优先 `.harness/develop/changes/`，兼容 `openspec/changes/` 旧格式
- **Propose 阶段边界**：完成后绝对禁止自动执行 spec/design/tasks 等后续阶段
- **Apply 阻断**：`--apply` 需要 `--check` 先完成，当前返回 2505
- **M1 限制透明**：应明确告知用户当前仅 `--propose` 可用，避免用户期望完整工作流
- **不跨能力**：`--capability` 限定后不操作其他能力域的文件