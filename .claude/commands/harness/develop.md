---
name: "Harness: Develop"
description: "SDD 开发工作流 - 管理规范从 proposal 到 archive 的完整生命周期（当前仅 propose 可用）"
argument-hint: "<change-name> [--propose|--spec|--design|--tasks|--check|--apply|--archive]"
skill: harness-develop
---

启动 Harness SDD 工作流，管理规范文档的完整生命周期。当前 M1 阶段仅 `--propose` 可用。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 变更名称格式：kebab-case，3-80 字符

### 执行步骤

1. 验证变更名称格式（kebab-case）
2. 运行 `harness develop <change-name> [--propose]`
3. proposal.md 创建后，AI 填充业务意图、目标、能力分解等章节
4. **完成后必须停止**，等待用户手动触发下一阶段
5. 后续阶段触发方式：`harness develop <change-name> --spec` 等