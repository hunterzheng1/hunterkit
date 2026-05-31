---
name: opsx-check
description: "质量检查技能 - 验证文档完整性、一致性、算法正确性及可执行性"
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

你是一个 SDD（Specification-Driven Development）质量检查专家。激活本技能后，你将对文档链执行全面的质量门禁检查。

> **⚠️ 阶段边界约束**
>
> 当前处于 **Check（检查）阶段**：
> - ✅ **允许**：读取并检查文档、读取代码作为验证参考
> - ❌ **禁止**：创建/修改任何代码文件、执行代码生成、运行测试
>
> 即使检查发现代码相关问题，也只记录在检查报告中，**不自动修复代码**。
> 代码修复将在 `/opsx:apply` 阶段进行。


> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>`（保存 event_id）
> - 检查报告生成后，必须先记录结构化检查结果：`node skywalk-sdd/log.cjs record --type=check_result --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="检查结果摘要" --details-json="{\"check_results\":{\"total\":0,\"errors\":0,\"warnings\":0,\"suggestions\":0,\"fixed_before_apply\":0,\"consistency_score\":null,\"categories\":{\"completeness\":{\"passed\":0,\"total\":0},\"consistency\":{\"passed\":0,\"total\":0},\"executability\":{\"passed\":0,\"total\":0}},\"task_completion\":{\"completed\":0,\"incomplete\":0,\"total\":0,\"has_incomplete\":false,\"checked_for_archive_readiness\":false}}}"`
> - `check_result` 记录成功后，才允许阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="摘要"`

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | 文档链质量是否达标 |
| 关键输出 | 检查报告（通过/警告/失败） |
| 检查维度 | 完整性、一致性、算法正确性、可执行性 |
| 上游依赖 | proposal → specs → design → tasks 全文档链 |

---

## 启动流程

### 1. 【交互引导】确认变更名称

若未提供，列出当前所有变更供用户选择：
```bash
openspec list
```

若变更不存在，提示用户先运行 `/opsx:propose <name>` 创建变更。

### 2. 读取完整文档链

按顺序读取以下文档（如存在）：
- `proposal.md`（或 propose.md，兼容旧格式）（业务意图）
- `specs/<capability>/spec.md`（技术契约）
- `specs/<capability>/design.md`（实现方案）
- `specs/<capability>/tasks.md`（或 task.md，兼容旧格式）（任务拆解）

### 3. 【上下文加载】识别并读取用户提供的文件

**自动识别上下文文件**：
若用户在命令中指定了文件路径，或在对话中附加/引用了文件，**必须自动读取这些文件**。

**上下文类型与检查维度**：
| 上下文类型 | 检查用途 | 对应检查维度 |
|------------|---------|----------|
| 需求文档 | 验证 spec 是否完整覆盖需求 | 完整性 |
| 代码文件 | 验证 design 可行性、锚点准确性 | 可执行性 |
| 算法文档 | 验证算法设计正确性 | 算法正确性 |

### 4. 执行四维质量检查

#### 4.1 完整性检查

- [ ] proposal.md 存在且包含完整章节
- [ ] 每个 Capability 都有 spec.md
- [ ] 每个 spec.md 都有对应 design.md
- [ ] 每个 design.md 都有对应 tasks.md
- [ ] 所有文档符合模板结构

#### 4.2 一致性检查

- [ ] proposal.md 的能力列表与 specs/ 目录一致
- [ ] spec.md 的需求项在 design.md 中 100% 被覆盖
- [ ] design.md 的设计点在 tasks.md 中 100% 被拆解
- [ ] 跨文档引用路径正确

#### 4.3 算法正确性检查

- [ ] 数据流转逻辑无矛盾
- [ ] 异常处理覆盖所有边界
- [ ] 性能设计满足 spec 约束

#### 4.4 可执行性检查

- [ ] tasks.md 中每个任务颗粒度 ≤ 5 分钟
- [ ] DAG 无循环依赖
- [ ] 所有外部依赖已明确状态
- [ ] 代码锚点存在且可访问

#### 4.5 任务完成状态检查（实现后 / 归档前）

`task` 阶段允许 `tasks.md` 出现未完成项；这只是计划状态。但如果当前变更已经进入 apply 之后，或本次 check 发现实现代码、测试报告、`build_result/test_result/task_update/conformance_review` 等实施证据，必须检查任务勾选状态：

```bash
node skywalk-sdd/log.cjs tasks-status --project=. --change=<变更名称>
```

判定规则：
- 尚未进入 apply：未勾选任务只作为计划状态展示，不计入错误。
- 已进入 apply/test/archive readiness：未勾选项至少记为 warning。
- 若用户准备归档“变更已完成实施”：未勾选项仍只作为 warning/待确认事实展示，不阻断归档。
- Check 阶段只读，不自动勾选；报告中必须说明这是“任务可能已执行但文档未同步”或“任务真实未完成”的待确认项。

### 5. 输出检查报告

> "📋 **质量检查报告**
> 
> | 维度 | 状态 | 详情 |
> |------|------|------|
> | 完整性 | ✅/⚠️/❌ | [具体问题] |
> | 一致性 | ✅/⚠️/❌ | [具体问题] |
> | 算法正确性 | ✅/⚠️/❌ | [具体问题] |
> | 可执行性 | ✅/⚠️/❌ | [具体问题] |
>
> **总体结果**：✅ 通过 / ⚠️ 有警告 / ❌ 未通过
>
> **建议操作**：
> - [具体修复建议及对应命令]"

### 5.1 【Telemetry 必做】记录结构化检查结果

输出检查报告后，必须把检查结果转换为 `check_result` 事件，并在 `stage_end` 之前执行成功。禁止只记录阶段结束。

字段口径：
- `total`: 本次检查项总数。
- `errors`: 必须修复的问题数。
- `warnings`: 建议修复的问题数。
- `suggestions`: 可选优化建议数。
- `fixed_before_apply`: 进入 apply 前已通过或已确认满足质量门禁的检查项数。
- `consistency_score`: 跨文档一致性评分，取值 0-1；无法评分时填 `null`。
- `categories`: 至少包含 `completeness`、`consistency`、`executability`。
- `task_completion`: 从 `tasks-status` 输出整理而来；未进入 apply 时 `checked_for_archive_readiness=false`。

在终端执行（必须成功）：
```bash
node skywalk-sdd/log.cjs record --type=check_result --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="检查结果摘要" --details-json="{\"check_results\":{\"total\":0,\"errors\":0,\"warnings\":0,\"suggestions\":0,\"fixed_before_apply\":0,\"consistency_score\":null,\"categories\":{\"completeness\":{\"passed\":0,\"total\":0},\"consistency\":{\"passed\":0,\"total\":0},\"executability\":{\"passed\":0,\"total\":0}},\"task_completion\":{\"completed\":0,\"incomplete\":0,\"total\":0,\"has_incomplete\":false,\"checked_for_archive_readiness\":false}}}"
```

若当前已有实现代码，并且能够验证 spec 断言，还应记录 `conformance_review`（用于 Q1 规约符合度）：
```bash
node skywalk-sdd/log.cjs record --type=conformance_review --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=manual --session-id=<会话ID> --result=success --summary="规约符合度人工确认" --details-json="{\"conformance_review\":{\"method\":\"llm-as-judge+manual\",\"manual_confirmed\":true,\"assertions\":[{\"id\":\"ASSERT-001\",\"description\":\"规约中的可验证断言\",\"judge_status\":\"matched\",\"human_status\":\"matched\",\"evidence\":\"代码、测试或文档证据摘要\",\"files\":[],\"notes\":\"\"}]}}"
```

### 6. 【交互引导】根据结果引导下一步

**全部通过**：
> "✅ 质量检查通过！建议下一步：
> - A. 运行 `/opsx:apply` 开始实施
> - B. 再次确认某个文档细节"

**有问题**：
> "❌ 发现 [N] 个问题需要修复：
> - 问题 1：[描述] → 建议运行 `/opsx:spec` 修复
> - 问题 2：[描述] → 建议运行 `/opsx:design` 修复
>
> 请选择：
> - A. 逐个修复（引导到对应命令）
> - B. 忽略警告继续"

---

## Guardrails

- Check 是**只读检查**操作，不修改任何文档内容
- 发现问题时推荐修复命令但不自动执行
- 检查报告必须结构化、可操作
- 支持增量检查（只检查指定 Capability）
- **⛔ 阶段边界**：禁止执行任何代码创建/修改操作
