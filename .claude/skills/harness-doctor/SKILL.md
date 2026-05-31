---
name: harness-doctor
description: "诊断 Harness 环境健康 - 检查 Node.js 版本、工作空间结构、Hook 投影一致性、Skill 源合规和安全基线"
argument-hint: "[--json]"
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

你是一个 Harness 环境健康诊断专家。激活本技能后，你将运行 `harness doctor` 对当前项目进行全面诊断，并给出可操作的修复建议。

> **⚠️ 阶段边界约束**
>
> **doctor** 是只读诊断命令：
> - ✅ **允许**：运行 `harness doctor`、读取配置文件、检查文件存在性、验证目录结构
> - ❌ **禁止**：修改任何文件、写入配置、自动修复（修复需用户明确确认后触发）
> - ⛔ **本命令仅用于诊断**，不触发变更；发现错误后给出修复建议，但不自动执行修复

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到根目录。
> - 所有路径使用正斜杠格式。
> - 不使用 Windows 反斜杠绝对路径。

---

## 技能定位

**doctor** 是 Harness 的环境健康检查命令，覆盖 8 大类诊断，确保安装的 harness 产物完整可用。

| 维度 | 内容 |
|------|------|
| 核心问题 | 当前项目的 Harness 安装是否健康、完整、可用？ |
| 关键输出 | 结构化诊断列表（每项含 id/status/severity/message/paths/repairCommand） |
| 依赖关系 | **零依赖**，未初始化的项目也能运行基础检查（base 类） |
| 写入行为 | **无**，纯只读诊断 |

## 诊断类别

`harness doctor` 运行以下 8 大类诊断：

| 类别 | 检查内容 | 触发条件 |
|------|---------|---------|
| `base.nodeVersion` | Node.js ≥ 20.0.0 | 始终运行 |
| `base.harnessDir` | `.harness/` 目录存在 | 始终运行 |
| `projection.runtimeSkills` | 已选工具的 runtime Skill 投影 | 已初始化时 |
| `projection.runtimeHooks` | Hook source 存在但 runtime 缺失 | 已选完整质量门时 |
| `skillSource` | shared Skill 源结构完整 | 已初始化时 |
| `managedDocs` | 根文档包含 Harness managed block | 已初始化时 |
| `safetyBaseline` | secret patterns + dangerous commands 覆盖基线 | 已初始化时 |
| `localConfigPrivacy` | `.harness/config/*.local.json` 不泄露 | 存在本地配置时 |

---

## 启动流程

### 1. 输入处理

用户可能附带以下意图：

| 用户意图 | 执行策略 |
|----------|----------|
| "诊断环境" / "检查健康" | 运行 `harness doctor` 并解读结果 |
| "检查 hooks 是否生效" | 运行 `harness doctor`，聚焦 `projection.runtimeHooks` 检查项 |
| "查看所有问题的修复建议" | 运行 `harness doctor`，逐项展示 `repairCommand` |
| "JSON 输出" | 运行 `harness doctor --json` 获取结构化诊断数据 |

### 2. 执行诊断

```bash
harness doctor
```

若需要结构化输出：

```bash
harness doctor --json
```

### 3. 解读结果

`harness doctor` 输出结构化检查列表，每项包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一检查项 ID（如 `base.harnessDir`、`projection.runtimeHooks`） |
| `status` | `OK` / `WARN` / `ERROR` | 检查结果状态 |
| `severity` | `info` / `warn` / `error` | 严重级别 |
| `message` | string | 人类可读说明 |
| `paths` | string[] | 关联文件路径 |
| `repairCommand` | string | 修复建议命令 |

### 4. 解读策略

**按严重级别处理：**

| 状态 | 策略 |
|------|------|
| `OK` | 无需处理，仅摘要报告 |
| `WARN` | 提示用户注意，建议运行修复命令 |
| `ERROR` | 明确告知风险，列出 `repairCommand` |

**常见错误及修复映射：**

| 错误 ID | 含义 | 修复命令 |
|---------|------|---------|
| `base.nodeVersion` | Node.js 版本过低 | 升级到 Node.js ≥ 20.0.0 |
| `projection.runtimeSkills` | runtime Skill 缺失 | `harness config --repair-adapters` |
| `projection.runtimeHooks` | runtime Hook 缺失 | `harness config --repair-adapters` |
| `skillSource` | Skill 源结构不完整 | `harness config --repair-adapters` |
| `managedDocs` | 根文档缺少 managed block | `harness sync` |
| `safetyBaseline` | 安全基线不足 | 检查 `.harness/config/harness.config.json` 中的 `safety.secretPatterns` |
| `localConfigPrivacy` | 本地配置可能泄露 | 确认 `.gitignore` 包含 `.harness/config/*.local.json` |

### 5. 下一步建议

根据诊断结果引导：

- 如果全部 `OK`：无需操作，可继续使用 harness
- 如果有 adapter 相关问题：建议运行 `harness config --repair-adapters`
- 如果有 managed docs 问题：建议运行 `harness sync`
- 如果有配置问题：建议检查并更新 `.harness/config/harness.config.json`
- 如果有 Hook 一致性问题：建议运行 `harness config --repair-adapters`

---

## Guardrails

- **只读约束**：本技能**绝不**自动执行修复，只给出修复建议
- **非阻塞**：即使 `ERROR` 级别的问题也不阻止其他操作
- **零依赖运行**：未初始化的项目也能运行基础检查（base 类）
- **结构化输出**：`--json` 模式下所有检查项可被程序化解析
- **退出码**：存在 `ERROR` 时退出码为 1，`WARN` 时为 0
- **不重复执行**：诊断结果已包含所有检查项，无需多次运行
- **路径跨平台**：诊断中涉及的路径展示使用正斜杠