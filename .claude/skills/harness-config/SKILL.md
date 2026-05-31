---
name: harness-config
description: "配置迁移和适配器修复 - 从旧工具迁移到 Harness 或重新生成 AI 工具适配器投影"
argument-hint: "[--migrate-docsync|--migrate-sdd|--migrate-review|--migrate-docs] [--repair-adapters] [--ai-tools <list>]"
license: MIT
compatibility: Requires @hunterzheng/harness CLI (v2.0+).
metadata:
  author: "@hunterzheng"
  version: "1.0"
allowed-tools:
  - Bash
  - Read
  - Glob
---

你是一个 Harness 配置管理专家。激活本技能后，你将帮助用户进行配置迁移（从旧工具迁移到 Harness）或适配器修复（重新生成 Skill/Hook/Agent 运行时投影）。

> **⚠️ 阶段边界约束**
>
> **config** 是配置操作命令：
> - ✅ **允许**：运行 `harness config`、检测旧来源、生成迁移计划、执行修复
> - ❌ **禁止**：修改项目源代码文件、删除非迁移范围内的文件
> - ⛔ **迁移和修复均通过事务（transaction）执行**，支持 `--dry-run` 预览

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录。
> - 所有路径使用正斜杠格式。

---

## 技能定位

**config** 有两大职责：**迁移**（从旧工具迁移到 unified Harness 格式）和**修复**（从 `.harness/adapters/**` 源重新生成运行时投影）。

| 维度 | 内容 |
|------|------|
| 核心问题 | 旧工具如何迁移？适配器投影是否漂移？ |
| 关键输出 | 迁移计划 + 事务执行结果 / 修复状态（repaired/skipped/conflict） |
| 依赖关系 | 零依赖，独立运行 |
| 写入行为 | 写入 `.harness/` 配置和 AI 工具运行时投影目录 |

## 两大模式

### 模式一：迁移（Migration）

| 标志 | 用途 |
|------|------|
| `--migrate-docsync` | 从旧 `.docsync/` 迁移到 Harness |
| `--migrate-sdd` | 从旧 `kld-sdd/` 迁移到 Harness |
| `--migrate-review` | 从旧 `kld-review/` 迁移到 Harness |
| `--migrate-docs` | 迁移项目文档中的 managed block |

### 模式二：适配器修复（Repair）

| 标志 | 用途 |
|------|------|
| `--repair-adapters` | 从 `.harness/adapters/**` 源重新生成所有运行时投影 |
| `--ai-tools <list>` | 指定要修复的工具（`claude,codex,copilot,cursor`），逗号分隔 |

---

## 启动流程

### 1. 输入处理

**迁移场景**：

| 用户意图 | 执行策略 |
|----------|----------|
| "从 docsync 迁移" | 运行 `harness config --migrate-docsync` |
| "从旧 SDD 迁移" | 运行 `harness config --migrate-sdd` |
| "迁移所有旧工具" | 依次运行所有迁移标志 |

**修复场景**：

| 用户意图 | 执行策略 |
|----------|----------|
| "修复适配器" | 运行 `harness config --repair-adapters` |
| "只修复 Claude" | 运行 `harness config --repair-adapters --ai-tools claude` |
| "预览修复" | 运行 `harness config --repair-adapters --dry-run` |

### 2. 执行命令

**迁移**：
```bash
harness config --migrate-docsync
```

**修复**：
```bash
harness config --repair-adapters
```

**修复指定工具**：
```bash
harness config --repair-adapters --ai-tools claude,codex
```

**预览（不写入）**：
```bash
harness config --repair-adapters --dry-run
```

### 3. 解读结果

**迁移结果**：
- ✅ 成功：旧工具数据已迁移到 `.harness/`，旧目录可选删除
- ⚠️ 冲突：检测到冲突，需要用户手动处理
- ❌ 失败：迁移失败，检查错误信息

**修复结果**：
- `repaired`：已重新生成的投影文件列表
- `skipped`：跳过的文件（未选择工具或无需修复）
- `conflict`：存在冲突的文件（非托管投影，手动内容被保留）

### 4. 下一步建议

- 修复完成后建议运行 `harness doctor` 验证修复结果
- 迁移完成后建议运行 `harness inspect` 重新扫描项目
- 如果存在 conflict，建议手动检查指定文件

---

## Guardrails

- **事务安全**：所有写入通过 `beginTransaction`/`commitTransaction` 执行
- **冲突保护**：非托管文件不会被覆盖，标记为 `conflict` 并提示用户
- **预览模式**：`--dry-run` 不写入任何文件，仅展示计划
- **AI 工具过滤**：`--ai-tools` 参数严格校验（仅 `claude/codex/copilot/cursor` 有效）
- **不删除源文件**：迁移默认保留旧目录，除非用户明确要求删除
- **修复幂等**：多次运行 `--repair-adapters` 结果一致