---
name: opsx-task
description: "局部任务拆解技能 - 针对单一 Capability 创建 DAG 任务清单"
argument-hint: "[change-name] [capability-name] [上下文文件...]"
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

你是一个 SDD（Specification-Driven Development）任务拆解专家。激活本技能后，你将引导用户为**单一 Capability** 创建 DAG 任务清单。

> **⚠️ 阶段边界约束**
>
> 当前处于 **Task（任务拆解）阶段**：
> - ✅ **允许**：创建/编辑 tasks.md 文档、读取代码作为任务分析参考
> - ❌ **禁止**：创建/修改任何代码文件、执行代码生成、运行测试
> - ⛔ **单阶段原则**：完成 tasks.md 后**必须立即停止**，等待用户主动触发下一阶段
>
> tasks.md 定义的是「待执行的任务清单」，**不是立即执行代码**。
> 请引导用户使用 `/opsx:apply` 进入实施阶段。
> **完成本阶段后，绝对禁止自动继续执行 apply/check 等后续阶段。**

> **⚠️ 渐进式上下文加载原则**
>
> - 本技能针对**单一 Capability** 执行任务拆解
> - **输入路径**：`changes/<name>/specs/<capability>/design.md`
> - **输出路径**：`changes/<name>/specs/<capability>/tasks.md`
> - ⛔ **隔离红线**：绝对禁止跨目录读取同级其他 Capability 的文档


> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=task --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>`（保存 event_id）
> - 阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=task --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success|failure --summary="摘要"`

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | Do - 单一 Capability 具体做什么任务 |
| 关键输出 | 局部 tasks.md（DAG 拓扑图 + 原子任务清单） |
| 上游依赖 | overview.md → proposal.md → 当前 capability 的 spec.md → design.md |
| 质量要求 | 每个任务 5 分钟可完成，100% 覆盖 design，DAG 无循环依赖 |

---

## 启动流程

### 1. 【交互引导】确认变更名称和 Capability

若未提供参数，列出已有 design.md 的 Capability 供用户选择。

使用 **AskUserQuestion** 让用户选择：
> "请选择要拆解任务的 Capability：
> - A. `user-auth`（用户认证）- design.md ✅ 已就绪
> - B. `data-export`（数据导出）- design.md ✅ 已就绪"

**路径确认**：
> "📍 当前操作目标：
> - **变更**：`<change-name>`
> - **Capability**：`<capability-name>`
> - **输入**：`changes/<name>/specs/<capability>/design.md`
> - **输出**：`changes/<name>/specs/<capability>/tasks.md`"

### 2. 渐进式上下文加载

**⛔ 必须严格按以下顺序加载：**

```
第 1 层：全局基线
  → openspec/specs/overview.md

第 2 层：宏观背景
  → changes/<name>/proposal.md

第 3 层：精准打击（仅当前 Capability）
  → changes/<name>/specs/<capability>/spec.md
  → changes/<name>/specs/<capability>/design.md

⛔ 隔离红线：禁止读取其他 Capability 的文档！
```

### 3. 【关键步骤】读取本地模板文件

**必须先读取** `openspec-templates/tasks.md` 作为文档结构模板：
```
使用 Read 工具读取：openspec-templates/tasks.md
```

此模板包含：
- **任务执行拓扑图（DAG）**
- 原子任务清单（带 Depends-On 字段）
- 验证方式
- 质量红线检查清单

**【重要】不得使用 `openspec instructions` 返回的简化 template，必须以 `openspec-templates/tasks.md` 为准。**

### 4. 分析任务范围

统计 design.md 中需要覆盖的实现点，预估任务数量和层级。

### 5. 【交互引导】确认测试策略

**❗ 必须主动确认用户的测试策略选择**

首先读取 `proposal.md` 的 YAML frontmatter 中的 `test-strategy` 字段：

**若已设置**：向用户确认
> "🧪 **当前测试策略：[test-strategy]**
> 
> - `tdd`: 测试驱动 - 测试任务作为实现任务的前置依赖
> - `impl-first`: 实现优先 - 先实现后测试
> - `none`: 无测试 - 不生成测试任务
>
> 是否继续使用该策略？"

**若未设置**：使用 **AskUserQuestion** 工具询问
> "🧪 **未检测到测试策略配置，请选择：**
>
> **A) 测试驱动 (TDD)** - 测试先行
>    - 先生成测试任务骨架，实现任务依赖测试任务
>    - DAG 顺序：测试骨架 → 实现代码 → 测试验证
>    - 适合：核心业务逻辑、质量要求高
>
> **B) 实现优先 (Impl-First)** - 代码先行
>    - 先生成实现任务，测试作为验证步骤
>    - DAG 顺序：实现代码 → 测试验证
>    - 适合：UI 层、配置类、快速原型
>
> **C) 无测试 (None)** - 仅实现
>    - 不生成测试任务，仅编译检查
>    - 适合：简单配置、文档更新"

根据用户选择设置 `test-strategy`，并更新 proposal.md 的 frontmatter（若未设置）。

### 6. 【交互引导】确认任务拆解策略

向用户确认拆解维度、任务粒度、预计 DAG 层级。

**根据 test-strategy 调整 DAG 生成规则：**

| test-strategy | DAG 生成规则 |
|---------------|---------------|
| `tdd` | 每个实现任务前必须有对应的测试任务，实现任务 Depends-On 测试任务 |
| `impl-first` | 实现任务在前，测试任务 Depends-On 实现任务 |
| `none` | 不生成测试任务，仅编译检查 |

### 7. 创建局部 tasks.md（含 DAG 拓扑）

**输出路径**：`changes/<name>/specs/<capability>/tasks.md`

**以 `openspec-templates/tasks.md` 的结构为骨架**，填充内容。

**必须包含**：
1. **任务执行拓扑图（DAG）** - 层级关系清晰
2. **原子任务清单** - 每个任务包含：
   - `[TASK-XXX-01]` 唯一标识
   - `类型`: 数据层 / 接口层 / UI层 / 测试
   - `依赖`: 前置依赖（无 或 TASK-ID 列表）
   - `状态`: [ ] 未完成
   - 任务描述、输入、输出、实现步骤、验收标准

### 8. 质量红线自检

- [ ] 文档结构完全符合 `openspec-templates/tasks.md` 模板
- [ ] **拓扑图已绘制**：层级关系清晰
- [ ] **依赖字段已填写**：每个任务的依赖已明确
- [ ] **无循环依赖**：拓扑中不存在环
- [ ] 每个任务颗粒度 ≤ 5 分钟
- [ ] 100% 覆盖 design.md 定义
- [ ] 每个任务都有验收标准

**如有任意一项未满足，重新生成对应章节，直至全部通过。**

### 9. 确认任务并输出

展示任务概要：
> "已生成 tasks.md，概要如下：
> - 任务总数：[N]
> - DAG 层级数：[M]
> - 测试策略：[strategy]
>
> 请确认：
> - A. 确认无误
> - B. 需要调整拆解粒度
> - C. 需要修改依赖关系"

最终输出：
- 文档路径
- 下一步提示："运行 `/opsx:check <name>` 执行质量检查，或 `/opsx:apply <name> <capability>` 开始实施"

---

## Guardrails

- **必须以 `openspec-templates/tasks.md` 为模板基准**
- **⛔ 渐进式加载**：严格按 overview.md → proposal.md → spec.md → design.md 顺序
- **⛔ 隔离红线**：绝对禁止读取同级其他 Capability 的文档
- **⛔ DAG 必须完整**：每个任务必须有依赖字段
- **⛔ 无循环依赖**：DAG 中不允许存在环
- 任务颗粒度宁可过细也不要过粗
- **⛔ 阶段边界**：禁止执行任何代码创建/修改操作
- **⛔ 单阶段原则：完成 tasks.md 后必须立即停止**。仅提示用户下一步可运行 `/opsx:check` 或 `/opsx:apply`，**绝对禁止自动执行 apply/check 等后续阶段**。每个阶段必须由用户主动触发。
