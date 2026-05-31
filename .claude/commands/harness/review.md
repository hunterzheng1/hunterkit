---
name: "Harness: Review"
description: "启发式代码审查 - 6 个 reviewer 扫描代码查找安全漏洞、TODO、硬编码密钥等问题"
argument-hint: "[--local|--staged|--scan <path>] [--lite|--full] [--fix] [--dry-run] [--json]"
skill: harness-review
---

对项目代码进行启发式扫描，生成双格式审查报告（Markdown + JSON），支持 6 个 reviewer 覆盖安全、契约、标准、历史等维度。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 范围参数互斥：`--local` / `--staged` / `--scan` 只能选一个
> - M1 阶段：本地启发式扫描，多 agent 并行审查后续版本

### 执行步骤

1. 运行 `harness review [--local|--staged|--scan <path>] [--lite|--full]`
2. 解读报告：P0（阻断）/ P1（重要）/ P2（建议）
3. 如有 P0 问题，建议修复后再继续
4. 完成后建议运行 `harness develop <name> --propose` 开始开发