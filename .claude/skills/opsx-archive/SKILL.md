---
name: opsx-archive
description: "归档变更技能 - 将已结束的 SDD 变更真实移入 archive，并生成最终中文度量报告"
argument-hint: "[change-name]"
license: MIT
compatibility: Requires skywalk-sdd/log.cjs.
metadata:
  author: sdd-team
  version: "3.2"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

你是一个 SDD（Specification-Driven Development）变更归档专家。激活本技能后，你要安全地结束变更生命周期：真实归档文档、同步正式 specs、记录 archive telemetry，并生成最终中文度量报告。

> **跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 不要裸写 Windows 反斜杠绝对路径；如必须使用绝对路径，请加引号或改成正斜杠。
> - 不要省略 `--source=opsx-command` 和 `--session-id=<会话ID>`。
> - 本技能不调用 OpenSpec 自带归档命令；统一使用 SkyWalk-SDD 的 `archive-docs`。

---

## 技能定位

| 维度 | 内容 |
|---|---|
| 核心问题 | 变更生命周期结束与度量收口 |
| 关键输出 | `openspec/changes/archive/<日期>-<change>/`、`openspec/specs/`、`skywalk-sdd/reports/<change>-report.md` |
| 触发时机 | 任务完成、变更取消、变更搁置、或用户要求归档 |

---

## 启动流程

### 1. 确认变更名称并记录阶段开始

如果未提供变更名，运行：

```bash
openspec list
```

让用户选择现有变更。确认后记录阶段开始：

```bash
node skywalk-sdd/log.cjs start --command=archive --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>
```

保存 `event_id`。

### 2. 询问归档原因

使用交互问题让用户选择：

> 请选择归档原因：
> - A. 变更已完成实施
> - B. 变更已取消
> - C. 变更已搁置
> - D. 其他原因

记录为 `<归档原因>`，它会进入 `archive-manifest.json`、archive telemetry 和最终报告。

### 3. 运行 telemetry doctor

```bash
node skywalk-sdd/log.cjs doctor --project=. --change=<变更名称>
```

如果存在 `severe_issues`，暂停归档并说明必须先修复。`superseded_open_stages` 和 `rework_summary` 只作为返工/重复执行展示，不要求用户人工区分测试回滚或真实研发返工。

### 4. 扫描 tasks 完成状态

```bash
node skywalk-sdd/log.cjs tasks-status --project=. --change=<变更名称>
```

即使用户选择“变更已完成实施”，未勾选项也不阻断归档。它可能代表任务真实未完成，也可能代表代码已完成但文档未同步；不要猜测，也不要静默忽略。最终必须让 `archive-docs` 将其写入 `archive_result.task_completion` 和报告。

### 5. 一步执行真实归档

执行唯一归档命令：

```bash
node skywalk-sdd/log.cjs archive-docs --project=. --change=<变更名称> --reason="<归档原因>" --event-id=<event_id> --agent=claude-code --source=opsx-command --session-id=<会话ID> --report-output=skywalk-sdd/reports/<变更名称>-report.md
```

该命令成功后必须已经完成：
- 活动目录 `openspec/changes/<name>/` 被移入 `openspec/changes/archive/<日期>-<name>/`。
- 归档目录写入 `archive-manifest.json`。
- Full Spec 的 `specs/<capability>/spec.md` 同步到 `openspec/specs/<capability>/spec.md`。
- archive 阶段写入 `stage_end`。
- 未勾选 tasks 被写入 `archive_result.task_completion`。
- 最终中文报告生成到 `skywalk-sdd/reports/<name>-report.md`。

如果该命令失败，以失败状态结束 telemetry：

```bash
node skywalk-sdd/log.cjs end --event-id=<event_id> --command=archive --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=failure --summary="归档失败：<失败原因>"
```

失败时不要输出“归档完成”。

### 6. 输出给用户

成功时只输出真实产物路径：

> 变更 `<name>` 已真实归档。
> - 归档目录：`openspec/changes/archive/<日期>-<name>/`
> - 最终报告：`skywalk-sdd/reports/<name>-report.md`
> - 未勾选任务：X 项，已记录到报告，不阻断归档
> - 正式 specs：`openspec/specs/`

被 doctor 阻断、真实归档失败或报告生成失败时，不要说“归档完成”。

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

## Guardrails

- 归档操作执行前必须让用户确认归档原因。
- 不要调用 OpenSpec 自带归档命令；统一由 `archive-docs` 负责真实归档、阶段结束和报告生成。
- “完成实施”归档允许 tasks 未全部勾选；未勾选项必须进入 archive details 和最终报告。
- 最终报告必须由 `archive-docs --report-output=...` 自动生成。
- 已归档变更不要重复移动；展示已有 archive 目录和 report 路径。
