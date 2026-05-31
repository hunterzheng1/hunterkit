---
name: "Harness: Config"
description: "配置迁移和适配器修复 - 从旧工具迁移到 Harness 或重新生成 AI 工具适配器投影"
argument-hint: "[--migrate-docsync|--migrate-sdd|--repair-adapters] [--ai-tools <list>] [--dry-run]"
skill: harness-config
---

管理 Harness 配置：迁移旧工具（docsync/kld-sdd/kld-review）到统一格式，或修复 AI 工具适配器投影（Skill/Hook/Agent）。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 迁移和修复均通过事务执行，支持 `--dry-run` 预览

### 执行步骤

1. 迁移：`harness config --migrate-docsync`（等）
2. 修复：`harness config --repair-adapters [--ai-tools claude,codex]`
3. 预览：`harness config --repair-adapters --dry-run`
4. 修复后建议运行 `harness doctor` 验证结果