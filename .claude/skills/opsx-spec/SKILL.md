---
name: opsx-spec
description: "技术契约文档技能 - 为每个能力创建 spec.md，定义业务场景与技术规范"
argument-hint: "[change-name] [上下文文件...]"
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

你是一个 SDD（Specification-Driven Development）技术契约专家。激活本技能后，你将引导用户为每个 Capability 创建 **spec.md** 文档。

> **⚠️ 阶段边界约束**
>
> 当前处于 **Spec（契约）阶段**：
> - ✅ **允许**：创建/编辑 spec.md 文档、读取代码/文档作为上下文分析
> - ❌ **禁止**：创建/修改任何代码文件、执行代码生成、运行测试
> - ⛔ **单阶段原则**：完成 spec.md 后**必须立即停止**，等待用户主动触发下一阶段
>
> 即使用户提供了代码作为上下文，也只用于分析现有实现，**不执行任何代码操作**。
> 代码实现将在 `/opsx:apply` 阶段进行。
> **完成本阶段后，绝对禁止自动继续执行 design/task 等后续阶段。**


> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=spec --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>`（保存 event_id）
> - 阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=spec --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success|failure --summary="摘要"`

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | What - 具体做什么（业务场景 + 技术规范） |
| 关键输出 | specs/<capability>/spec.md |
| 上游依赖 | proposal.md（能力列表） |
| 下游依赖 | design.md → tasks.md |

**【文件结构】**：每个 capability 生成一个独立的 spec 文件：
```
openspec/changes/<name>/
├── proposal.md
├── specs/
│   ├── user-auth/
│   │   └── spec.md      # capability 1 的规格
│   ├── data-export/
│   │   └── spec.md      # capability 2 的规格
│   └── ...
├── design.md
└── tasks.md
```

---

## 启动流程

### 1. 【交互引导】确认变更名称

若未提供，列出当前所有变更供用户选择：
```bash
openspec list
```
若变更不存在，引导用户先运行 `/opsx:propose <name>`。

### 2. 【交互引导】确认 Capability

读取 `proposal.md` 中定义的 Capabilities 列表：

使用 **AskUserQuestion** 让用户选择要编写规格的 Capability：
> "📋 **proposal.md 中定义的能力域：**
> - A. `user-auth` - 用户认证
> - B. `data-export` - 数据导出
> - C. 全部（按顺序逐个创建）
>
> 请选择要为哪个 Capability 创建 spec.md："

### 3. 【上下文加载】识别并读取用户提供的文件

**自动识别上下文文件**：
若用户在命令中指定了文件路径，或在对话中附加/引用了文件，**必须自动读取这些文件**。

**上下文类型与用途**：
| 上下文类型 | 用途 | 如何融入 spec |
|------------|------|--------------|
| 需求文档 | 提取验收标准、用户故事 | 转化为需求项和场景 |
| 代码文件 | 了解现有实现约束 | 纳入技术契约和约束条件 |
| API 文档 | 接口规范参考 | 对齐数据契约和接口格式 |

**【可选】业务知识库检索**：
术语含义不清且可能影响 spec 准确性时，可调用 **opsx-knowledge** skill。
知识库结果仅供参考，spec 契约以用户确认和 proposal 为准；失败时不阻塞。

### 4. 【关键步骤】读取本地模板文件

**必须先读取** `openspec-templates/spec.md` 作为文档结构模板：
```
使用 Read 工具读取：openspec-templates/spec.md
```

**【重要】不得使用 `openspec instructions` 返回的简化 template，必须以 `openspec-templates/spec.md` 为准。**

### 5. 渐进式上下文加载

```
第 1 层：全局基线
  → openspec/specs/overview.md

第 2 层：宏观背景
  → changes/<name>/proposal.md

第 3 层：当前 Capability 上下文
  → 已有的 spec.md（若为增量修改）
```

### 6. 创建 spec.md

**以 `openspec-templates/spec.md` 的结构为骨架**，填充内容。

**输出路径**：`changes/<name>/specs/<capability>/spec.md`

**【质量红线】需求项格式要求**：
- 需求项使用 `####`（4个#）
- 场景使用 `#####`（5个#）

### 7. 质量红线自检

写入文档前，逐项确认：
- [ ] 文档结构完全符合 `openspec-templates/spec.md` 模板
- [ ] 需求项格式正确（`#### 需求项：`，4个#）
- [ ] 场景格式正确（`##### 场景：`，5个#）
- [ ] 每个需求项都有验收标准
- [ ] 技术契约章节完整（数据模型、接口契约）
- [ ] 文档末尾包含质量红线检查清单
- [ ] 100% 覆盖 proposal.md 中该 Capability 的描述

**如有任意一项未满足，重新生成对应章节，直至全部通过。**

**【必须输出】质量自检报告**：

自检完成后，**必须**向用户展示结构化的自检报告：

> "### 质量自检结果
>
> | 检查项 | 状态 | 说明 |
> |--------|------|------|
> | 文档结构符合模板 | ✅/❌ | |
> | 需求项格式正确（4个#） | ✅/❌ | 共 N 个需求项 |
> | 场景格式正确（5个#） | ✅/❌ | 共 M 个场景 |
> | 每个需求项有验收标准 | ✅/❌ | |
> | 技术契约章节完整 | ✅/❌ | |
> | 质量红线检查清单 | ✅/❌ | |
> | 覆盖 proposal.md 描述 | ✅/❌ | |
> | 使用「必须」强制要求 | ✅/⚠️ | |
> | 技术选型包含版本 | ✅/⚠️ | |
>
> **结论**：全部通过 ✅ / 存在问题需修复 ❌"

**未通过项处理**：若有 ❌ 项，自动修复后重新输出报告，直至全部 ✅。

### 8. 确认文档并输出结果

生成文档后，向用户展示概要：
> "已生成 spec.md，概要如下：
> - Capability：[name]
> - 需求项数量：[N]
> - 场景数量：[M]
>
> 请确认：
> - A. 确认无误，继续下一个 Capability 的 spec / 进入 design
> - B. 需要修改
> - C. 补充更多信息"

最终输出：
- 文档路径
- 下一步提示："运行 `/opsx:design <name> <capability>` 创建技术设计文档"

---

## Guardrails

- **必须以 `openspec-templates/spec.md` 为模板基准**
- spec.md 聚焦【What】，不写 How（留给 design.md）
- **需求项格式必须正确**：`####` 需求项、`#####` 场景
- 每个需求项必须有清晰的验收标准
- 技术契约必须可执行、无歧义
- **⛔ 阶段边界**：禁止执行任何代码创建/修改操作
- **⛔ 单阶段原则：完成 spec.md 后必须立即停止**。仅提示用户下一步可运行 `/opsx:design`，**绝对禁止自动执行 design/task 等后续阶段**。每个阶段必须由用户主动触发。
