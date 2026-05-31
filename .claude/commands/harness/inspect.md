---
name: "Harness: Inspect"
description: "扫描项目结构生成事实数据 - 创建 repo-map.json、module-map.md 和可选规则文件"
argument-hint: "[--full] [--path <dir>] [--rules] [--dry-run] [--json]"
skill: harness-inspect
---

扫描项目目录结构，生成结构化事实数据，为后续 sync、review、develop 等命令提供基础。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 输出文件位于 `.harness/facts/` 和 `.harness/generated/`

### 执行步骤

1. 运行 `harness inspect [--full] [--rules]`
2. 检查输出：`repo-map.json`（文件清单）、`module-map.md`（模块关系）、`rules.generated.md`（可选）
3. 首次运行时自动启用 `--full` 模式
4. 完成后建议运行 `harness sync` 同步到根文档