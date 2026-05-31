---
name: "Harness: Status"
description: "查询工作空间状态 - 查看初始化状态和已启用能力"
argument-hint: "[--json]"
skill: harness-status
---

查询当前项目的 Harness 工作空间状态：是否初始化、schema 版本、已启用的能力列表。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 使用正斜杠路径格式

### 执行步骤

1. 运行 `harness status [--json]`
2. 解读输出：检查 `initialized` 和 `capabilities` 字段
3. 如果未初始化，建议运行 `harness` 进入交互式向导
4. 如果已初始化，可继续使用其他命令（如 `harness inspect`、`harness doctor`）