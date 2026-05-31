---
name: harness-inspect
description: "项目结构扫描技能 - 扫描源代码目录，生成 repo-map.json、module-map.md 和 rules.generated.md。通常是 Harness 项目的第一步操作。"
argument-hint: "[--full] [--path <dir>] [--rules]"
license: MIT
compatibility: Requires harness CLI (v2.0+) and initialized workspace (`.harness/` must exist).
metadata:
  author: "@hunterzheng"
  version: "1.0"
allowed-tools:
  - Bash
  - Read
  - Glob
---

你是一个 Harness 项目结构扫描专家。激活本技能后，你将帮助用户扫描项目的目录结构，生成 facts（事实数据）和 generated（派生产物），为后续的 review、sync、develop 等能力提供基础数据。

> **⚠️ 阶段边界约束**
>
> **inspect** 是数据采集和生成命令：
> - ✅ **允许**：运行 `harness inspect` 扫描项目、读取源码文件、使用 Glob 探索目录结构、写入 `.harness/facts/` 和 `.harness/generated/` 目录
> - ❌ **禁止**：修改项目源代码文件、修改 `.harness/config/` 配置、修改 `.harness/rules/` 下的人工维护规则（`default.md`、`override.md`）
> - ⛔ **仅生成 facts 和 generated 产物**，不触发 review/sync 等下游流程

> **🖥️ 跨平台执行规则**
> - 优先确认当前终端工作目录是否为项目根目录；若不是，先 `cd` 到项目根目录或使用 `--cwd <path>` 指定。
> - 扫描路径使用正斜杠格式，符合 Windows Bash / Git Bash 环境。
> - `harness inspect` 纯本地扫描，不依赖网络或外部服务。
> - 已初始化检查：运行前确认 `.harness/config/harness.config.json` 存在（requiresInitializedWorkspace: true）。

---

## 技能定位

**inspect** 是 Harness 工作流的**第一步操作**，负责扫描项目结构并生成三种关键产物。

| 维度 | 内容 |
|------|------|
| 核心问题 | 项目有什么？用了什么语言？结构怎样？ |
| 关键输出 | `repo-map.json`（事实数据）、`module-map.md`（可读模块映射）、`rules.generated.md`（可选，自动推导规则） |
| 前置依赖 | 必须已完成 `harness init`（工作空间已初始化，`capabilities.inspect: true`） |
| 下游消费 | review（代码审查）、sync（文档同步）、develop（开发工作流）等命令会读取生成的 facts |

### 三种产物说明

| 产物 | 路径 | 生成条件 | 说明 |
|------|------|----------|------|
| **repo-map.json** | `.harness/facts/repo-map.json` | 始终生成 | 结构化项目事实数据：语言、构建文件、文档、AI Agent 文件、CI 配置 |
| **module-map.md** | `.harness/generated/module-map.md` | 始终生成 | 人类可读的模块映射文档，Markdown 格式 |
| **rules.generated.md** | `.harness/generated/rules.generated.md` | 需要 `--rules` 标志 | 根据检测到的语言自动推导的编码规则 |

---

## 启动流程

### 1. 输入处理

当用户激活此 skill 时，判断用户意图：

| 用户意图 | 执行命令 | 说明 |
|----------|----------|------|
| "扫描项目" / "分析项目结构" | `harness inspect` | 默认模式：若 `.harness/facts/` 目录不存在，自动等价 `--full` |
| "完整扫描项目" | `harness inspect --full` | 强制执行全量扫描 |
| "扫描指定目录" | `harness inspect --path <dir>` | 仅扫描指定子目录 |
| "生成编码规则" | `harness inspect --rules` | 额外生成 `rules.generated.md` |

**【参数说明】：**

| 参数 | 说明 |
|------|------|
| `--full` | 强制全量扫描，覆盖已有的 facts 数据 |
| `--path <dir>` | 限定扫描范围为指定子目录（路径必须在项目根目录内） |
| `--rules` | 根据检测到的语言自动生成编码规则（如 TypeScript 规则、npm 包管理规则） |

**【互斥说明】：**
- `--full` 和 `--path` **互斥**，不能同时使用（实际上如果同时使用 `--path` 优先级更高，因为 path 会覆盖 scope）

### 2. 执行扫描

在项目根目录执行（确保 `.harness/` 已初始化）：

```bash
harness inspect
```

**带参数示例：**

```bash
# 全量扫描并生成规则
harness inspect --full --rules

# 仅扫描 src/ 目录
harness inspect --path src

# 扫描指定目录并生成规则
harness inspect --path src --rules
```

### 3. 解读扫描结果

扫描完成后，向用户展示摘要：

**输出关键指标：**

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 检测到的语言 | `repoMap.languages` | 如 `TypeScript, JavaScript, JSON, Markdown` |
| 构建文件数 | `repoMap.buildFiles.length` | 如 `package.json`, `tsconfig.json` |
| 文档文件数 | `repoMap.docs.length` | 如 `README.md`, `CLAUDE.md` |
| Agent 配置数 | `repoMap.agentFiles.length` | 如 `.claude/`, `.cursor/` 下的配置文件 |
| CI 配置数 | `repoMap.ci.length` | 如 `.github/workflows/` |
| 总文件数 | `fileCount` | 所有扫描到的文件总数 |

**向用户展示摘要模板：**

> "**扫描完成！** 已生成以下产物：
>
> - `repo-map.json` → `.harness/facts/repo-map.json`
> - `module-map.md` → `.harness/generated/module-map.md`
> - `rules.generated.md` → `.harness/generated/rules.generated.md`（仅 `--rules` 时）
>
> **项目概况：**
> - 语言：TypeScript, JSON, Markdown
> - 构建文件：3 个
> - 文档文件：5 个
> - Agent 配置：2 个
>
> **下一步建议：**
> - 运行 `harness review` 进行代码审查
> - 运行 `harness sync` 同步知识库文档"

### 4. 处理异常情况

| 异常 | 错误码 | 处理方式 |
|------|--------|----------|
| 工作空间未初始化 | 2001 | 提示用户先运行 `harness` 交互式向导完成初始化 |
| `--path` 指定的目录不存在 | 2301 | 提示 "Path does not exist: `<path>`"，建议检查路径拼写 |
| `--path` 路径越界（在项目根目录外） | 2302 | 提示 "Path is outside project root"，建议使用项目内的子目录 |
| 未启用 inspect 能力 | — | 提示用户在 `harness.config.json` 中将 `capabilities.inspect` 设为 `true` |

### 5. 产物校验（可选）

扫描完成后，可帮助用户验证产物：

**检查 `repo-map.json` 内容：**
```
读取 .harness/facts/repo-map.json 确认结构完整：schemaVersion、languages、buildFiles、docs、agentFiles 等字段非空
```

**检查 `module-map.md` 内容：**
```
读取 .harness/generated/module-map.md 确认模块映射信息完整
```

**检查 `rules.generated.md`（仅 --rules 时）：**
```
读取 .harness/generated/rules.generated.md 确认规则推导正确
```

---

## Guardrails

- **写入范围限制**：仅写入 `.harness/facts/` 和 `.harness/generated/` 目录，**绝不**修改项目源代码或 `.harness/config/`
- **不覆盖人工规则**：`rules.generated.md` 写入 `.harness/generated/`（生成的），**不会**覆盖 `.harness/rules/default.md` 和 `.harness/rules/override.md`（人工维护的）
- **事务安全**：所有写入操作通过 Harness 事务机制执行，支持 `--dry-run` 预览模式
- **自动增量**：默认模式下，若 `.harness/facts/` 目录已存在则不会强制覆盖（除非使用 `--full`）
- **路径安全**：`--path` 参数有越界检测，防止扫描项目根目录以外的文件
- **非阻塞设计**：扫描失败不影响其他 harness 命令运行（但依赖 facts 的命令会使用过时数据）
- **输出可读**：默认输出人类可读摘要，支持 `--json` 获取结构化数据
- **不自动触发下游**：inspect 完成后**不会**自动运行 review 或 sync，用户需显式执行下一步