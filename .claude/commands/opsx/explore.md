---
name: OPSX: Explore
description: "浏览变更 - 查看所有变更状态和 SDD 文档完整性概览"
argument-hint: "[change-name]"
---

浏览变更状态和文档链进度 - 快速掌握项目中所有变更的 SDD 文档完整性，并引导下一步操作。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs start --command=explore --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>`，记录返回的 event_id。

---

**输入**: `/opsx:explore`（可选：后跟变更名称查看详情）

**执行步骤**

0. **【Telemetry 必做】记录阶段开始**

   在终端执行（若命令失败必须中止本阶段，不得跳过）：
   ```bash
   node skywalk-sdd/log.cjs start --command=explore --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>
   ```
   保存输出 JSON 中的 `event_id`，供阶段结束使用。

1. **获取所有变更列表**

   ```bash
   openspec list
   ```

   若没有任何变更，提示：
   > "当前项目还没有任何变更。运行 `/opsx:propose <变更描述>` 开始第一个变更。"

2. **检查每个变更的 SDD 文档完整性**

   对每个变更，检查以下文件是否存在：
   - `openspec/changes/<name>/propose.md` 或 `proposal.md`（P）
   - `openspec/changes/<name>/spec.md` 或 `specs.md`（S）
   - `openspec/changes/<name>/design.md`（D）
   - `openspec/changes/<name>/task.md` 或 `tasks.md`（T）

   同时获取每个变更状态：
   ```bash
   openspec status --change "<name>" --json
   ```

3. **展示变更概览表**

   > "📋 项目变更概览（P=提案 S=规格 D=设计 T=任务）：
   >
   > | 变更名称 | P | S | D | T | openspec状态 | 建议下一步 |
   > |---------|---|---|---|---|------------|---------|
   > | add-user-auth | ✅ | ✅ | ✅ | ❌ | PENDING | `/opsx:task add-user-auth` |
   > | payment-refund | ✅ | ❌ | ❌ | ❌ | PENDING | `/opsx:spec payment-refund` |
   > | points-exchange | ✅ | ✅ | ✅ | ✅ | IMPLEMENTING | `/opsx:check points-exchange` |"

4. **【交互引导】选择操作**

   > "请选择操作：
   > - A. 查看变更详情：输入变更名称
   > - B. 创建新变更：运行 `/opsx:propose`
   > - C. 执行质量检查：运行 `/opsx:check <name>`
   > - D. 申请实施：运行 `/opsx:apply <name>`
   > - E. 退出浏览"

5. **若用户选择查看详情（选 A）**

   展示选定变更的详细信息：
   ```bash
   openspec status --change "<name>" --json
   ```

   展示：
   - 变更描述和创建时间
   - 各文档状态（存在/缺失/文件大小）
   - openspec 内部状态（`applyRequires` 列表）
   - 建议下一步操作和对应命令

---

**护栏规则**

- explore 是只读操作，不修改任何文件
- 发现文档缺失时，推荐对应命令但不自动执行
- 若某变更 applyRequires 中有未完成项，在概览表中以 ⚠️ 标注

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs end --event-id=<开头记录的event_id> --command=explore --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success --summary="浏览结果摘要"`
