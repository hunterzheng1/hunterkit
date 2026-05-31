---
name: "Harness: Sync"
description: "同步 managed block 到根文档 - 更新 README/AGENTS/CLAUDE 中的托管区块"
argument-hint: "[--check] [--fast] [--docs <list>] [--dry-run] [--json]"
skill: harness-sync
---

将 Harness 工作流入口同步到项目根文档的 managed block，确保 AI 工具能发现 harness 能力。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 需要先运行 `harness inspect` 生成 repo-map.json
> - 只修改 managed block 内内容，不覆盖用户手写内容

### 执行步骤

1. 确认 `.harness/facts/repo-map.json` 存在（否则提示先运行 `harness inspect`）
2. 运行 `harness sync [--check] [--fast] [--docs readme,agents]`
3. 解读同步报告，展示漂移状态
4. 完成后建议运行 `harness review` 审查代码