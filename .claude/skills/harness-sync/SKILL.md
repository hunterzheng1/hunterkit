---
name: harness-sync
description: "同步 managed block 到根文档 - 将 Harness 工作流入口写入 README/AGENTS/CLAUDE 的托管区块"
argument-hint: "[--check] [--fast] [--docs <list>] [--dry-run] [--json]"
license: MIT
compatibility: Requires @hunterzheng/harness CLI (v2.0+). 需要先运行 harness inspect 生成 repo-map.json。
metadata:
  author: "@hunterzheng"
  version: "1.0"
allowed-tools:
  - Bash
  - Read
  - Glob
disable-model-invocation: true
---

你是一个 Harness 文档同步专家。激活本技能后，你将把 Harness 的工作流入口写入目标项目的根文档 managed block，确保 AI 工具能发现和使用 harness 能力。

> **⚠️ 阶段边界约束**
>
> **sync** 操作根文档：
> - ✅ **允许**：运行 `harness sync`、写入 managed block（`<!-- harness:start -->` 到 `<!-- harness:end -->`）、生成同步报告
> - ❌ **禁止**：修改 managed block 之外的用户内容、删除旧工具文件（除非迁移模式）
> - ⛔ **`--check` 模式为只读**，不写入任何文件

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录。
> - `--fast` 模式使用 git diff，需要 Git 可用。
> - 所有路径使用正斜杠格式。

---

## 技能定位

**sync** 将 harness 能力"注入"到 AI 工具的视野中，通过在根文档中写入 managed block 告诉 AI 有哪些 harness 可用。

| 维度 | 内容 |
|------|------|
| 核心问题 | 根文档是否完整反映了项目的 harness 能力？ |
| 关键输出 | 同步报告（`.harness/reports/sync/`）+ 更新的根文档 |
| 前置依赖 | **需要先运行 `harness inspect`**（需要 `repo-map.json`） |
| 写入行为 | 仅 managed block 内写入（`<!-- harness:start -->` 到 `<!-- harness:end -->`） |

## 意图路由表

| 用户意图关键词 | 触发条件 | 执行策略 |
|---------------|---------|---------|
| "同步文档" / "更新 managed block" / "sync" | 根文档更新 | 先检查 `repo-map.json` 存在，再运行 `harness sync` |
| "检查是否漂移" / "drift check" | 漂移检测 | 运行 `harness sync --check`（只读，不写入） |
| "只更新 README" / "更新 AGENTS" | 指定文档同步 | 运行 `harness sync --docs <list>` |
| "快速检查" / "fast sync" | 快速模式 | 运行 `harness sync --fast`（依赖 git diff） |
| "预览同步内容" / "dry run" | 预览不写入 | 运行 `harness sync --dry-run` |

## 目标文档

| 文档 | 路径 | Managed Block 内容 |
|------|------|-------------------|
| README | `README.md` | harness 使用方式表（自然语言 → CLI 命令映射） |
| AGENTS | `AGENTS.md` | harness 工作流入口表 |
| CLAUDE | `CLAUDE.md` | 短入口，指向 `.claude/skills/harness/SKILL.md` |
| Copilot | `.github/copilot-instructions.md` | Copilot 指令 |

## 可选参数

| 参数 | 说明 |
|------|------|
| `--check` | 仅检测漂移（drift），不写入文件。漂移时退出码 2401 |
| `--fast` | 使用 `git diff` 快速检查；高风险变更时自动升级为完整检查 |
| `--docs <list>` | 指定目标文档（`readme,agents,claude,copilot`） |
| `--dry-run` | 预览计划写入内容 |

---

## 启动流程

### 1. 前置检查

运行 sync 之前，**必须先确认 `repo-map.json` 存在**：

```bash
test -f .harness/facts/repo-map.json
```

如果不存在，提示用户：
> "未找到项目事实文件 `.harness/facts/repo-map.json`。请先运行 `harness inspect` 扫描项目，然后再执行 sync。"

### 2. 输入处理

| 用户意图 | 执行策略 |
|----------|----------|
| "同步文档" | 运行 `harness sync` |
| "检查是否漂移" | 运行 `harness sync --check` |
| "只更新 README" | 运行 `harness sync --docs readme` |
| "快速检查" | 运行 `harness sync --fast` |

### 3. 执行同步

```bash
harness sync
```

**漂移检测**：
```bash
harness sync --check
```

**指定文档**：
```bash
harness sync --docs readme,agents
```

### 4. 解读结果

- ✅ 同步成功：文档已更新，列出已同步的文件
- ⚠️ 漂移检测到：文档与事实不一致，列出漂移的文件
- ❌ 前置缺失：`repo-map.json` 不存在（错误码 2404）

### 5. Managed Block 安全规则

sync 使用 managed block 机制保护用户内容：
- **只修改** `<!-- harness:start -->` 到 `<!-- harness:end -->` 之间的内容
- **保留** 标记之外的所有用户手写内容
- **自动迁移** 旧的 `docsync:` 和 `harness-managed:` 标记为标准 `harness:` 标记

### 6. 下一步建议

- 同步完成后建议运行 `harness review` 进行代码审查
- 如果文档漂移，检查是否需要重新运行 `harness inspect`
- 如果需要迁移旧工具，运行 `harness config --migrate-docs`

---

## Guardrails

- **前置依赖**：`harness inspect` 必须先运行（否则返回 2404）
- **不覆盖用户内容**：仅修改 managed block（`<!-- harness:start -->` ... `<!-- harness:end -->`）
- **事务写入**：所有写入通过事务系统原子提交
- **`--check` 只读**：不写入文件，漂移时返回 2401
- **旧标记兼容**：自动检测并迁移 `docsync:` 和 `harness-managed:` 旧标记
- **高风险文件检测**：package.json/config/CI 等文件变更时自动从 `--fast` 升级为完整检查
- **内部名称扫描**：检测旧来源名（docsync/gsd/kld-sdd/kld-review）暴露，防止用户文档泄露