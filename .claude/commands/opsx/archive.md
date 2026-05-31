---
name: OPSX: Archive
description: "归档变更 - 将已结束的 SDD 变更真实移入 archive，并自动生成最终度量报告"
argument-hint: "[change-name]"
---

归档变更 - 将已结束的 SDD 变更真实移动到 `openspec/changes/archive/`，同步正式 specs，并自动生成最终 SDD 效果度量报告。

> **跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 不要裸写 Windows 反斜杠绝对路径；如必须使用绝对路径，请加引号或改成正斜杠。
> - 不要省略 `--source=opsx-command` 和 `--session-id=<会话ID>`。
> - 本命令已经集成 SkyWalk-SDD 归档逻辑，不要调用 OpenSpec 自带归档命令。

---

**输入**: `/opsx:archive` 后跟变更名称（kebab-case）

**核心原则**

- `archive` 必须产生真实归档结果：活动目录 `openspec/changes/<name>/` 应被移出，归档目录位于 `openspec/changes/archive/<日期>-<name>/`。
- 归档统一使用 `node skywalk-sdd/log.cjs archive-docs`，同时兼容 Simple 与 Full 两种文档结构。
- 最终报告必须随着 `archive` 阶段成功结束自动生成，不再作为可选手工步骤。
- 即使归档原因是“变更已完成实施”，未勾选的 `tasks.md/task.md` 项也不阻断归档；但必须写入 archive 详情和最终报告。

---

## 执行步骤

### 0. 记录阶段开始

```bash
node skywalk-sdd/log.cjs start --command=archive --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>
```

保存输出 JSON 中的 `event_id`。

### 1. 确认变更名称

如未提供变更名称，列出当前变更供用户选择：

```bash
openspec list
```

如果 `openspec/changes/<name>/` 不存在，先确认是否已归档；不要创建新的空变更。

### 2. 引导确认归档原因

向用户确认归档原因：

> 请选择归档原因：
> - A. 变更已完成实施
> - B. 变更已取消
> - C. 变更已搁置
> - D. 其他原因

记录为 `<归档原因>`。

### 3. 执行数据质量检查

归档前执行 doctor：

```bash
node skywalk-sdd/log.cjs doctor --project=. --change=<变更名称>
```

处理规则：
- doctor 返回 0：允许继续。
- doctor 返回 1 且存在 `severe_issues`：暂停归档，先处理严重问题。
- `superseded_open_stages` 和 `rework_summary` 仅作为返工/重复执行展示，不要求用户区分测试回滚还是真实返工。

### 4. 扫描 tasks 完成状态

始终扫描 Simple 和 Full 两种布局下的所有 `tasks.md/task.md`：

```bash
node skywalk-sdd/log.cjs tasks-status --project=. --change=<变更名称>
```

处理规则：
- 无论归档原因是什么，都允许继续归档。
- 如存在 `- [ ]` 未勾选项，必须在最终输出中展示数量与摘要。
- `archive-docs` 会在归档成功后强制补齐 `stage_end.details.archive_result.task_completion`，并写入最终报告。

### 5. 一步执行真实归档、结束阶段并生成报告

执行：

```bash
node skywalk-sdd/log.cjs archive-docs --project=. --change=<变更名称> --reason="<归档原因>" --event-id=<event_id> --agent=claude-code --source=opsx-command --session-id=<会话ID> --report-output=skywalk-sdd/reports/<变更名称>-report.md
```

该命令必须一次完成：
- 移动活动变更目录到 `openspec/changes/archive/<日期>-<变更名称>/`。
- 写入 `archive-manifest.json`。
- 将 Full 模式的 `specs/<capability>/spec.md` 同步到 `openspec/specs/<capability>/spec.md`。
- 结束 archive 阶段并写入 `stage_end`。
- 补齐 `archive_result.task_completion`。
- 生成中文最终报告 `skywalk-sdd/reports/<变更名称>-report.md`。

如果命令失败，必须以失败状态结束 telemetry：

```bash
node skywalk-sdd/log.cjs end --event-id=<event_id> --command=archive --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=failure --summary="归档失败：<失败原因>"
```

失败时不要输出“归档完成”。

### 6. 输出结果

成功时输出：

> 变更 `<name>` 已真实归档。
> - 归档原因：`<归档原因>`
> - 归档目录：`openspec/changes/archive/<日期>-<name>/`
> - 最终报告：`skywalk-sdd/reports/<name>-report.md`
> - 未勾选任务：X 项，已记录到报告，不阻断归档
> - 正式 specs：`openspec/specs/`

---

## 可选补录

如用户愿意提供反馈，可补录问卷结果：

```bash
node skywalk-sdd/log.cjs record --type=survey_result --command=archive --project=. --change=<变更名称> --agent=claude-code --source=manual --session-id=<会话ID> --result=success --summary="SDD 人工反馈" --details-json="{\"survey_result\":{\"nps\":9,\"cognitive_load\":3,\"spec_fatigue_index\":2,\"satisfaction\":8,\"respondent_role\":\"developer\",\"collected_at\":\"<ISO时间>\",\"notes\":\"\"}}"
```

如团队有传统方式工时基线，可补录 baseline：

```bash
node skywalk-sdd/log.cjs record --type=baseline_record --command=archive --project=. --change=<变更名称> --agent=claude-code --source=manual --session-id=<会话ID> --result=success --summary="传统工时基线" --details-json="{\"baseline_record\":{\"traditional_hours\":10,\"sdd_hours\":6,\"task_type\":\"feature\",\"baseline_source\":\"manual-estimate\",\"collected_at\":\"<ISO时间>\",\"notes\":\"\"}}"
```

---

## 护栏规则

- 归档操作执行前必须让用户确认归档原因。
- 不要调用 OpenSpec 自带归档命令；归档统一由 `archive-docs` 负责。
- “完成实施”归档允许 tasks 未全部勾选，但未勾选项必须进入 archive details 和最终报告。
- 真实归档或报告生成失败时，不得输出成功文案。
- 已归档变更不要重复移动；展示已有归档目录和报告路径即可。
