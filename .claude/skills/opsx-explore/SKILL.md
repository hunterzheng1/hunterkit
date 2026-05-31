---
name: opsx-explore
description: "浏览变更技能 - 查看所有变更状态和 SDD 文档完整性概览"
argument-hint: "[change-name]"
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: sdd-team
  version: "3.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

你是一个 SDD（Specification-Driven Development）变更浏览专家。激活本技能后，你将展示项目中所有变更的状态概览，并引导用户执行下一步操作。


> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=explore --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>`（保存 event_id）
> - 阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=explore --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success|failure --summary="摘要"`

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | 项目中所有变更的进度如何 |
| 关键输出 | 变更概览表（文档完整性 + 状态 + 建议操作） |
| 操作类型 | 只读浏览，不修改任何文件 |

---

## 启动流程

### 1. 获取所有变更列表

```bash
openspec list
```

若没有任何变更，提示：
> "当前项目还没有任何变更。运行 `/opsx:propose <变更描述>` 开始第一个变更。"

### 2. 检查每个变更的 SDD 文档完整性

对每个变更，检查以下文件是否存在：
- `openspec/changes/<name>/proposal.md`（P）
- `openspec/changes/<name>/specs/<capability>/spec.md`（S）
- `openspec/changes/<name>/specs/<capability>/design.md`（D）
- `openspec/changes/<name>/specs/<capability>/tasks.md`（T）

同时获取每个变更状态：
```bash
openspec status --change "<name>" --json
```

### 3. 展示变更概览表

> "📋 **项目变更概览**（P=提案 S=规格 D=设计 T=任务）：
>
> | 变更名称 | P | S | D | T | openspec状态 | 建议下一步 |
> |---------|---|---|---|---|------------|---------|
> | add-user-auth | ✅ | ✅ | ✅ | ❌ | PENDING | `/opsx:task add-user-auth` |
> | payment-refund | ✅ | ❌ | ❌ | ❌ | PENDING | `/opsx:spec payment-refund` |
> | points-exchange | ✅ | ✅ | ✅ | ✅ | IMPLEMENTING | `/opsx:check points-exchange` |"

### 4. 【交互引导】选择操作

使用 **AskUserQuestion** 让用户选择：
> "请选择操作：
> - A. 查看变更详情：输入变更名称
> - B. 创建新变更：运行 `/opsx:propose`
> - C. 执行质量检查：运行 `/opsx:check <name>`
> - D. 申请实施：运行 `/opsx:apply <name>`
> - E. 退出浏览"

### 5. 若用户选择查看详情

展示选定变更的详细信息：
```bash
openspec status --change "<name>" --json
```

展示：
- 变更描述和创建时间
- 各文档状态（存在/缺失/文件大小）
- openspec 内部状态（`applyRequires` 列表）
- 建议下一步操作和对应命令

---

## Guardrails

- explore 是**只读操作**，不修改任何文件
- 发现文档缺失时，推荐对应命令但不自动执行
- 若某变更 applyRequires 中有未完成项，在概览表中以 ⚠️ 标注
