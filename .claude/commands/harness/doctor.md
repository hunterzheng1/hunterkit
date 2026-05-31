---
name: "Harness: Doctor"
description: "诊断环境健康 - 检查 Node.js 版本、Hook 投影、Skill 源、安全基线等 8 大类诊断"
argument-hint: "[--json]"
skill: harness-doctor
---

对当前项目进行全面健康诊断，覆盖 base 基础检查、runtime 投影一致性、Hook 配置、Skill 源结构、根文档 managed block 和安全基线。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 只读诊断，不执行任何修复

### 执行步骤

1. 运行 `harness doctor [--json]`
2. 按严重级别分类展示结果（OK / WARN / ERROR）
3. 对每个 ERROR/WARN 项给出修复建议（`repairCommand`）
4. 存在 ERROR 时退出码为 1
5. 建议：如有 adapter 问题运行 `harness config --repair-adapters`