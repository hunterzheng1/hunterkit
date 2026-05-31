---
name: opsx-apply
description: "变更实施技能 - 针对单一 Capability 按 DAG 依赖顺序实现代码"
argument-hint: "[change-name] [capability-name] [上下文文件...]"
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: sdd-team
  version: "3.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

你是一个 SDD（Specification-Driven Development）变更实施专家。激活本技能后，你将引导用户按 DAG 依赖顺序逐任务实施代码。


> **⚠️ 渐进式上下文加载原则**
>
> - 本技能针对**单一 Capability** 执行实施
> - **上下文**：overview.md → proposal.md → 当前 capability 的 spec/design/tasks
> - ⛔ **隔离红线**：绝对禁止加载同级其他 Capability 的文档

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --git-sha=<base_git_sha_or_none>`（保存 event_id）
> - 阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success|failure --summary="摘要"`

> **🔒 Git 策略（只读增强，不改变开发流）**
> - Git 只作为可选度量数据源，不是 apply 前置条件。
> - 禁止自动执行 `git init`、`git add`、`git commit`、`git checkout -b`、`git switch -c`。
> - 若项目已有 Git，仅允许读取 `git rev-parse HEAD`、`git diff --numstat` 等只读信息。
> - 若项目不是 Git 仓库，进入 `vcs_mode=no-git`，`base_git_sha=none`，继续实施，不得中断。
> - 只有用户明确要求时，才允许提交或创建分支；SDD 度量本身不得主动提交。

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | Apply - 单一 Capability 代码实施 |
| 输入 | overview.md → proposal.md → spec.md → design.md → tasks.md |
| 输出 | 代码文件、测试文件、任务状态更新 |
| 关键机制 | DAG 依赖拦截、编译门禁、测试门禁、实时状态更新 |

---

## 启动流程

### 0. 【Telemetry 必做】只读探测 Git 基线

先以只读方式探测版本控制状态。Git 只是增强数据源，失败不得中断 apply。

禁止事项：
- 禁止自动执行 `git init`
- 禁止自动执行 `git add`
- 禁止自动执行 `git commit`
- 禁止自动创建或切换分支

探测流程：
```bash
git rev-parse --is-inside-work-tree
```

若命令成功，设置：
- `vcs_mode=readonly`
- `base_git_sha=<git rev-parse HEAD 的输出>`

只读读取基线 SHA：
```bash
git rev-parse HEAD
```

若命令失败，设置：
- `vcs_mode=no-git`
- `base_git_sha=none`

非 Git 项目必须继续实施，不得为了度量自动创建仓库或提交快照。

### 1. 【交互引导】确认变更名称和 Capability

**步骤 1a - 确认变更名称**：
若未提供 change-name，列出当前所有变更供用户选择：
```bash
openspec list --json
```

**步骤 1b - 确认 Capability**：
若未提供 capability-name，读取已存在 tasks.md 的 Capability 列表，使用 **AskUserQuestion** 让用户选择：
> "请选择要实施的 Capability：
> - A. `user-auth`（用户认证）- tasks.md ✅ 已就绪
> - B. `user-profile`（用户资料）- tasks.md ✅ 已就绪
> - C. `data-export`（数据导出）- tasks.md ❌ 未拆解"

**【路径确认】**：
> "📍 当前操作目标：
> - **变更**：`<change-name>`
> - **Capability**：`<capability-name>`
> - **任务文件**：`changes/<name>/specs/<capability>/tasks.md`"

### 2. 渐进式上下文加载

**⛔ 只加载当前 Capability 的四文档链：**

```
第 1 层：全局基线
  → openspec/specs/overview.md

第 2 层：宏观背景
  → changes/<name>/proposal.md

第 3 层：当前 Capability 四文档
  → spec.md → design.md → tasks.md

⛔ 隔离红线：禁止加载其他 Capability 的文档！
```

**【可选】业务知识库检索**：
编码中遇到不明业务名词时，可调用 **opsx-knowledge** skill 辅助理解。
不得因知识库建议偏离 tasks/spec；查询失败时继续实施。

### 3. 解析 DAG 任务拓扑

从 tasks.md 中：
- 提取所有任务的 `[TASK-ID]` 和 `依赖` 字段
- 构建 DAG 拓扑图
- 计算执行层级（Layer）
- **检测循环依赖**，若存在则中止

### 4. 显示进度和 DAG 拓扑

向用户展示当前进度、DAG 状态、下一个可执行任务。

### 5. 按 DAG 顺序逐任务实施

**⛔ DAG 依赖拦截机制**：

```
对于每个待处理任务：

1. 读取任务的依赖字段
2. 检查所有前置任务的状态是否为 [x]
3. 若前置任务未完成 → 拦截并提示
4. 若前置任务已完成 → 允许执行
```

**执行每个任务**：

a. **DAG 依赖检查**
   - 若依赖未满足，暂停并提示用户先完成前置任务

b. **显示当前任务**
   > "📍 **[N/M]** 正在处理: [TASK-ID] <任务描述>
   > - **依赖**: [依赖列表] ✅ 已满足"

c. **实现代码**
   - 遵循 design.md 设计约定
   - 遵循 overview.md 全局规范
   - 保持变更最小化

d. **⛔ 编译检查门禁**
   
   > **⛔ 红线：每完成一个任务后，必须确保代码可以编译通过！**
   
   - 检测项目类型并执行编译命令
   - 编译成功 → 继续下一步
   - **编译失败 → 必须立即修复，禁止标记为已完成！**

e. **⛔ 测试执行门禁**
   
   > **根据 proposal.md 的 `test-strategy` 字段决定测试门禁行为**
   
   | test-strategy | 门禁行为 |
   |---------------|----------|
   | `tdd` | **⛔ 强制执行**：运行相关测试，测试失败禁止继续，必须修复 |
   | `impl-first` | **⚠️ 警告模式**：运行测试，失败时显示警告但允许继续 |
   | `none` | **跳过**：不执行测试门禁 |

f. **⛔ 立即更新任务状态**
   - 修改 tasks.md：将 `- [ ]` 替换为 `- [x]`（包括拓扑图和任务详情中的复选框）
   - 同时修改：`- **状态**: [ ] 未完成` → `- **状态**: [x] 已完成`
   - **两种格式必须同步更新**，不可遗漏
   - 验证修改成功
   - 显示进度：`✅ [TASK-ID] 已完成 [N/M]`
   - 记录任务级 Telemetry：
     ```bash
     node skywalk-sdd/log.cjs record --type=task_update --command=apply --project=. --change=<变更名称> --capability=<capability-name> --task-id=<TASK-ID> --agent=claude-code --source=opsx-command --session-id=<会话ID> --status=completed --result=success --summary="<TASK-ID> 完成" --details-json="{\"files_changed\":[],\"build_results\":{\"command\":\"<实际编译命令>\",\"success\":true,\"duration_ms\":0,\"error_count\":0},\"test_results\":{\"command\":\"<实际测试命令>\",\"passed\":0,\"failed\":0,\"skipped\":0,\"coverage\":null,\"duration_ms\":0}}"
     ```
     **⚠️ 注意**：`--task-id=<TASK-ID>` 必须替换为实际任务 ID，否则 E4 指标无法计算。

g. **继续下一个可执行任务**

### 5.1 【Telemetry 必做】记录 AI 产出快照

当前 Capability 的 AI 代码产出完成后，必须记录 `ai_adoption_review`，但不得为了采集快照自动提交 commit。

- `--status=ai_snapshot` 用于记录 AI 初始产出快照，P2 指标在无 final 事件时会使用此快照数据
- 若用户进行了人工 review 并确认保留率，可补录 `--status=final` 事件（`review_status: "final"`），P2 指标将优先使用 final 数据

Git 可用时只读统计 SHA/diff；Git 不可用时使用 `vcs_mode=no-git` 和 `base_git_sha=null`：
```bash
node skywalk-sdd/log.cjs record --type=ai_adoption_review --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --status=ai_snapshot --result=success --summary="AI 代码产出快照" --details-json="{\"ai_adoption\":{\"review_status\":\"ai_snapshot\",\"vcs_mode\":\"<readonly|no-git>\",\"base_git_sha\":\"<base_git_sha_or_null>\",\"ai_git_sha\":\"<ai_git_sha_or_null>\",\"ai_diff\":{\"files_changed\":0,\"added_lines\":null,\"deleted_lines\":null},\"notes\":\"未自动创建 Git 仓库，未自动提交 commit；仅记录可用统计\"}}"
```

### 6. 完成或暂停时显示状态

展示 DAG 执行摘要，引导下一步：
> "📊 **实施进度摘要**：
> - 已完成：[N/M] 任务
> - 当前层级：Layer [X]
> - 下一步建议：[继续实施 / 运行测试 / 归档]"

---

## Guardrails

- **⛔ 渐进式加载**：只加载当前 Capability 的四文档链
- **⛔ 隔离红线**：绝对禁止加载同级其他 Capability 的文档
- **⛔ DAG 依赖拦截**：执行任务前必须检查依赖，前置未完成必须拦截
- **⛔ 编译检查门禁**：每完成一个任务后，**必须运行编译检查**，编译失败禁止标记已完成
- **⛔ 测试执行门禁**：根据 `test-strategy` 决定测试门禁行为（tdd=强制, impl-first=警告, none=跳过）
- **⛔ 必须实时更新任务状态**：每完成一个任务，**立即**修改 tasks.md 中的 `- [ ]` 为 `- [x]`，**同时修改** `**状态**: [ ] 未完成` 为 `**状态**: [x] 已完成`，两种格式不可遗漏
- **Git 只读策略**：禁止为了度量自动初始化 Git、创建分支或提交 commit；非 Git 项目使用 `vcs_mode=no-git` 继续执行
- **显示进度反馈**：每完成一个任务，显示「✅ [TASK-ID] 已完成 [N/M]」
- **保持任务聚焦**：每次只处理一个任务
- **遇到问题时暂停**：任务描述模糊、编译失败、测试失败或发现设计问题时暂停询问
