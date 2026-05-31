---
name: OPSX: Apply
description: "执行变更实施 - 针对单一 Capability 按 DAG 依赖顺序实现代码"
argument-hint: "[change-name] [capability-name] [上下文文件...]"
---

执行变更实施 - 针对单一 Capability，按 DAG 依赖顺序逐任务实现代码。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs start --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --git-sha=<base_git_sha_or_none>`，记录返回的 event_id。

> **🔒 Git 策略（只读增强，不改变开发流）**
> - Git 只作为可选度量数据源，不是 apply 前置条件。
> - 禁止自动执行 `git init`、`git add`、`git commit`、`git checkout -b`、`git switch -c`。
> - 若项目已有 Git，仅允许读取 `git rev-parse HEAD`、`git diff --numstat` 等只读信息。
> - 若项目不是 Git 仓库，进入 `vcs_mode=no-git`，`base_git_sha=none`，继续实施，不得中断。
> - 只有用户明确要求时，才允许提交或创建分支；SDD 度量本身不得主动提交。

> **⚠️ 渐进式上下文加载原则**
>
> - 本命令针对**单一 Capability** 执行实施
> - **上下文路径**：overview.md → proposal.md → 当前 capability 的 spec/design/tasks
> - ⛔ **隔离红线**：绝对禁止加载同级其他 Capability 的文档

---

**前置要求**: 已完成 `/opsx:task` 或对应 capability 的 tasks.md 已存在；建议先运行 `/opsx:check` 通过质量检查

**执行步骤**

0. **【Telemetry 必做】记录阶段开始**

   先以只读方式探测版本控制状态。Git 只是增强数据源，失败不得中断 apply。

   **禁止事项**：
   - 禁止自动执行 `git init`
   - 禁止自动执行 `git add`
   - 禁止自动执行 `git commit`
   - 禁止自动创建或切换分支

   **探测流程**：
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

   在终端执行（若命令失败必须中止本阶段，不得跳过）：
   ```bash
   node skywalk-sdd/log.cjs start --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --git-sha=<base_git_sha_or_none>
   ```
   保存输出 JSON 中的 `event_id`，供阶段结束使用。

1. **【交互引导】确认变更名称和 Capability**

   **步骤 1a - 确认变更名称**：
   若未提供 change-name，列出当前所有变更供用户选择：
   ```bash
   openspec list --json
   ```

   **步骤 1b - 确认 Capability**：
   若未提供 capability-name，读取已存在 tasks.md 的 Capability 列表，使用 **AskUserQuestion** 让用户选择：
   > "请选择要实施的 Capability：
   > - A. user-auth（用户认证）- tasks.md ✅ 已就绪
   > - B. user-profile（用户资料）- tasks.md ✅ 已就绪
   > - C. data-export（数据导出）- tasks.md ❌ 未拆解"

   **【路径确认】**：
   > "📍 当前操作目标：
   > - **变更**：`<change-name>`
   > - **Capability**：`<capability-name>`
   > - **任务文件**：`changes/<name>/specs/<capability>/tasks.md`"

2. **【渐进式上下文加载】严格按顺序读取文档**

   > **⛔ 上下文加载红线**：只加载当前 Capability 的四文档链，禁止加载其他 Capability！

   **加载顺序**：

   ```
   ┌─────────────────────────────────────────────────────────┐
   │ 第 1 层：全局基线（必读）                                  │
   │   → openspec/specs/overview.md                          │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 第 2 层：宏观背景（必读）                                  │
   │   → changes/<name>/proposal.md                          │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 第 3 层：当前 Capability 四文档（精准打击）                 │
   │   → changes/<name>/specs/<capability>/spec.md           │
   │   → changes/<name>/specs/<capability>/design.md         │
   │   → changes/<name>/specs/<capability>/tasks.md          │
   │                                                         │
   │ ⛔ 隔离红线：禁止加载其他 Capability 的文档！             │
   └─────────────────────────────────────────────────────────┘
   ```

   **执行加载**：
   ```
   使用 Read 工具依次读取：
   1. openspec/specs/overview.md（若不存在则跳过）
   2. changes/<name>/proposal.md
   3. changes/<name>/specs/<capability>/spec.md
   4. changes/<name>/specs/<capability>/design.md
   5. changes/<name>/specs/<capability>/tasks.md（必须存在）
   ```

   **若 tasks.md 不存在**：
   > "❌ 当前 Capability 的 tasks.md 不存在，请先运行：
   > `/opsx:task <change-name> <capability-name>`"

3. **【上下文加载】识别并读取用户提供的文件**

   **自动识别上下文文件**：
   若用户在命令中指定了文件路径（如 `/opsx:apply atp-calc ./算法.md`），
   或在对话中附加/引用了文件，**必须自动读取这些文件**。

   **上下文类型与用途**：
   | 上下文类型 | 检查用途 | 用法 |
   |------------|---------|------|
   | 算法文档 (.md) | 算法一致性检查基线 | 对比实现与算法逻辑 |
   | 参考实现 (.java/.ts) | 代码风格参考 | 保持代码风格一致 |
   | 测试数据 (.xml/.json) | 测试用例设计 | 理解边界条件 |

   **示例**：
   ```
   /opsx:apply atp-calc atp-calculation ./ATP引擎算法逻辑.md
   /opsx:apply atp-calc atp-calculation ./erp-algorithm-atp/src/main/java/
   ```

4. **【交互引导】上下文补充提示**

   **若用户未提供任何上下文文件**，AI 分析 design.md 后，**主动提示用户补充**：

   **【关键】具体化建议**：
   AI 必须**引用 design.md 中的具体内容**给出建议：
   ```
   ❌ 错误："建议提供算法参考"
   ✅ 正确："design.md 包含《正差反差计算》伪代码，建议提供该算法的详细逻辑说明"
   ```

   **主动提示模板**：
   > "📌 **建议提供更丰富的上下文信息**：
   > 
   > design.md 中包含：
   > - **《[XX算法]》伪代码** - 建议提供算法参考文档进行一致性检查
   > - **《[XX现有项目]》** - 建议提供参考实现保持代码风格一致
   >
   > 您可以：
   > - **在命令后追加文件路径**：`/opsx:apply atp-calc ./算法.md ./src/`
   > - **在对话中上传文件**或粘贴内容
   >
   > 或者选择：
   > - A. 仅依据 design.md 实现（跳过额外上下文检查）
   > - B. 已提供全部信息"

5. **解析 DAG 任务拓扑**

   从 tasks.md 中解析任务依赖关系：
   - 提取所有任务的 `[TASK-ID]` 和依赖字段
   - 构建拓扑图
   - 计算执行层级

   **拓扑解析示例**：
   ```
   TASK-AUTH-01 (依赖: 无)       → 层级 1
   TASK-AUTH-02 (依赖: 无)       → 层级 1
   TASK-AUTH-03 (依赖: 01, 02)   → 层级 2
   TASK-AUTH-04 (依赖: 03)       → 层级 3
   ```

   **循环依赖检测**：
   若检测到循环依赖，立即中止并报告：
   > "❌ 检测到循环依赖：TASK-A → TASK-B → TASK-C → TASK-A
   > 请修正 tasks.md 中的 Depends-On 字段后重试。"

6. **显示当前进度和拓扑**

   向用户展示：
   > "## 实施进度
   > **变更**: `<change-name>`
   > **Capability**: `<capability-name>`
   > **进度**: N/M 任务已完成
   >
   > ### 拓扑任务状态
   > ```
   > 层级 1 (可并行): [TASK-01] ✅, [TASK-02] ⏳
   > 层级 2 (等待 L1): [TASK-03] ⏳
   > 层级 3 (等待 L2): [TASK-04] ⏳
   > ```
   >
   > ### 下一个可执行任务
   > - [ ] [TASK-02] 创建用户表
   >
   > 开始实施？"

7. **逐任务实施（按拓扑顺序执行）**

   **⛔ 拓扑依赖拦截机制**：
   
   在执行每个任务前，必须检查其依赖字段：

   ```
   对于每个待处理任务：
   
   1. 读取任务的依赖字段
   2. 检查所有前置任务的状态是否为 [x]（已完成）
   3. 若前置任务未完成 → 拦截并跳过
   4. 若前置任务已完成 → 允许执行
   ```

   **执行循环**：

   a. **【拓扑依赖检查】**
      
      > **⛔ 在执行当前任务前，必须检查前置依赖！**
      
      解析当前任务的依赖字段，检查所有依赖任务是否已完成：
      - 若依赖任务未完成，**必须暂停**并明确提示：
        > "⏸ **依赖拦截**：任务 [TASK-XXX-03] 的前置依赖未满足
        > - 依赖任务：[TASK-XXX-01] - ❌ 未完成
        > - 依赖任务：[TASK-XXX-02] - ✅ 已完成
        >
        > 必须先完成 [TASK-XXX-01] 才能执行当前任务。
        > 
        > 请选择：
        > - A. 执行 [TASK-XXX-01]
        > - B. 查看任务详情
        > - C. 暂停实施"
      - 若所有依赖已完成，继续执行

   b. **显示当前任务**
      > "📍 **[N/M]** 正在处理任务: [TASK-ID] <任务描述>
      > - **类型**: 数据层
      > - **依赖**: [依赖列表] ✅ 已满足
      > - **层级**: 2"

   c. **实现代码**
      - 根据 tasks.md 中的任务描述实现代码
      - 遵循 design.md 中的设计约定
      - 遵循 overview.md 中的全局规范
      - 保持变更最小化、聚焦单一任务

   c2. **❗【新增】算法一致性门禁**
      
      > **对于包含算法逻辑的 TASK-XX-IMPL 任务，必须检查实现与 design.md 伪代码的一致性**
      
      **触发条件**：
      - 任务类型为 IMPL（实现任务）
      - design.md 中包含对应的伪代码章节
      
      **检查内容**：
      | 检查项 | 要求 | 未通过处理 |
      |---------|------|------------|
      | 方法签名 | 参数类型、返回值类型一致 | ⚠️ 警告 |
      | 核心算法逻辑 | 循环、分支、累加顺序一致 | ❌ 拦截 |
      | 边界条件处理 | 空值、零值、极值处理一致 | ⚠️ 警告 |
      
      **检查流程**：
      1. 读取 design.md 中对应的伪代码章节
      2. 对比实现代码与伪代码的关键逻辑
      3. 若提供了 --context 算法文档，进一步对比原始算法
      
      **【拦截示例】**：
      > "⚠️ **算法一致性检查未通过**
      > 
      > **问题**：calcZhengchaFucha 方法逻辑不一致
      > 
      > **design.md 伪代码**：
      > ```
      > if (direction == -1) {
      >     remaining = remaining.subtract(data.getCalcQuantity());
      > }
      > ```
      > 
      > **实际实现**：
      > ```
      > remaining = remaining.add(data.getCalcQuantity());
      > ```
      > 
      > **原因分析**：
      > - 伪代码假设 calcQuantity 为正数
      > - 实际实现中 calcQuantity 对需求已是负数
      > 
      > 请选择：
      > - A. 修复 design.md 伪代码（实现正确）
      > - B. 修复实现代码（伪代码正确）
      > - C. 标记为 '设计变更'，继续执行"
      
      **【通过后显示】**：
      > "✅ **算法一致性检查通过**
      > - 方法签名: ✅ 一致
      > - 核心逻辑: ✅ 一致
      > - 边界处理: ✅ 一致"

   d. **⛔【必须】编译检查门禁**
      
      > **⛔ 红线：每完成一个任务后，必须确保代码可以编译通过！**
      
      **检查流程**：
      
      1. **检测项目类型并执行编译**：
         - **TypeScript/JavaScript**: `npm run build` 或 `tsc --noEmit` 或 `npx tsc --noEmit`
         - **Java/Maven**: `mvn compile -q`
         - **Java/Gradle**: `./gradlew compileJava --quiet`
         - **Python**: `python -m py_compile <file>` 或 `mypy <file>`
         - **Go**: `go build ./...`
         - **Rust**: `cargo check`
         - **其他**: 根据项目配置执行相应编译命令
      
      2. **检查编译结果**：
         - ✅ 编译成功 → 继续下一步
         - ❌ 编译失败 → **必须立即修复**
      
      3. **编译失败处理流程**：
         ```
         a. 分析错误信息，定位问题根因
         b. 修复代码错误
         c. 重新执行编译检查
         d. 重复直到编译通过
         ```
      
      4. **显示检查结果**：
         > "🛠️ **编译检查**
         > - 执行: `npm run build`
         > - 结果: ✅ 编译成功 / ❌ 编译失败
         > - 耗时: 2.3s"
      
      5. **记录构建 Telemetry**：
         ```bash
         node skywalk-sdd/log.cjs record --type=build_result --command=apply --project=. --change=<变更名称> --capability=<capability-name> --task-id=<TASK-ID> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="编译检查结果" --details-json="{\"build_results\":{\"command\":\"<实际编译命令>\",\"success\":true,\"duration_ms\":0,\"error_count\":0}}"
         ```
         `build_results` 字段口径：
         - `command`: 实际执行的编译/构建命令。
         - `success`: 构建是否成功，用于 Q3。
         - `duration_ms`: 构建耗时，无法获取时填 `null`。
         - `error_count`: 编译错误数，无法统计时填 `null`。
      
      > **⚠️ 注意：编译失败的任务禁止标记为已完成！**

   e. **⛔【必须】测试执行门禁**
      
      > **根据 proposal.md 的 `test-strategy` 字段决定测试门禁行为**
      
      **首先读取 proposal.md 的 YAML frontmatter 中的 `test-strategy` 字段：**
      
      | test-strategy | 门禁行为 |
      |---------------|----------|
      | `tdd` | **⛔ 强制执行**：运行相关测试，测试失败禁止继续，必须修复 |
      | `impl-first` | **⚠️ 警告模式**：运行测试，失败时显示警告但允许继续 |
      | `none` | **跳过**：不执行测试门禁 |
      
      **TDD 模式执行流程**：
      1. 检测当前任务是否有对应的测试文件
      2. 执行相关测试用例
      3. 测试通过 → 继续下一步
      4. **测试失败 → 必须修复，禁止标记为已完成！**
      
      **Impl-First 模式执行流程**：
      1. 执行相关测试用例
      2. 测试通过 → 继续下一步
      3. 测试失败 → 显示警告信息，询问用户是否继续
      
      > **⚠️ 注意：TDD 模式下测试失败的任务禁止标记为已完成！**

   f. **⛔【必须】立即更新任务状态**
      
      每完成一个任务后，必须立即：
      
      1. **修改 tasks.md 文件**：
         - 将该任务对应的 `- [ ]` 替换为 `- [x]`（包括任务执行拓扑图中的复选框和任务详情中的状态行）
         - 将 `- **状态**: [ ] 未完成` 替换为 `- **状态**: [x] 已完成`
         - **两种格式必须同步更新**，不可遗漏
      2. **验证修改成功**：读取文件确认两种格式的复选框均已勾选
      3. **显示进度提示**：
         > "✅ **[TASK-XXX-01] 已完成** [N/M]
         > - 编译检查: ✅ 通过
         > - 已更新 tasks.md 状态: `[ ]` → `[x]`
         > - 下一层任务已解锁：[TASK-XXX-03]"

      4. **记录任务级 Telemetry**：
         ```bash
         node skywalk-sdd/log.cjs record --type=task_update --command=apply --project=. --change=<变更名称> --capability=<capability-name> --task-id=<TASK-ID> --agent=claude-code --source=opsx-command --session-id=<会话ID> --status=completed --result=success --summary="<TASK-ID> 完成" --details-json="{\"files_changed\":[],\"build_results\":{\"command\":\"<实际编译命令>\",\"success\":true,\"duration_ms\":0,\"error_count\":0},\"test_results\":{\"command\":\"<实际测试命令>\",\"passed\":0,\"failed\":0,\"skipped\":0,\"coverage\":null,\"duration_ms\":0}}"
         ```
         **⚠️ 注意**：`--task-id=<TASK-ID>` 中的 `<TASK-ID>` 必须替换为当前任务的实际 ID（如 `TASK-USER-AUTH-01`），不得保留占位符，否则 E4 指标无法计算。

         若任务失败或暂停，`--status` 使用 `failed` / `blocked`，`--result` 使用 `failure` / `partial`，并在 details 中记录失败原因。

   g. **继续下一个可执行任务**
      - 重新检查 DAG，找出所有依赖已满足的任务
      - 若同层有多个可执行任务，按顺序执行

   **【暂停条件】**：
   - **拓扑依赖未满足** → 拦截并提示
   - **⛔ 编译失败** → 必须修复后才能继续
   - 任务描述不清晰 → 询问用户澄清
   - 实施中发现设计问题 → 建议更新 design.md
   - 遇到错误或阻塞 → 报告问题并等待指导

8. **完成或暂停时显示状态**

   **全部完成时**：
   > "## ✅ 实施完成
   > 
   > **变更**: `<change-name>`
   > **Capability**: `<capability-name>`
   > **进度**: 7/7 任务已完成
   >
   > ### 拓扑执行摘要
   > - Layer 1: [TASK-01] ✅, [TASK-02] ✅
   > - Layer 2: [TASK-03] ✅
   > - Layer 3: [TASK-04] ✅
   >
   > 当前 Capability 所有任务已完成！
   > 
   > **下一步**：
   > - 若还有其他 Capability：运行 `/opsx:apply <name> <next-capability>`
   > - 若所有 Capability 已完成：运行 `/opsx:archive` 归档变更"

   **暂停时**：
   > "## ⏸ 实施暂停
   >
   > **变更**: `<change-name>`
   > **Capability**: `<capability-name>`
   > **进度**: 4/7 任务已完成
   >
   > ### 暂停原因
   > <问题描述>
   >
   > ### 拓扑当前状态
   > - Layer 1: [TASK-01] ✅, [TASK-02] ✅
   > - Layer 2: [TASK-03] ⏸ 暂停
   > - Layer 3: [TASK-04] ⏳ 等待
   >
   > **选项**：
   > 1. <选项1>
   > 2. <选项2>
   > 3. 其他方案"

---

**护栏规则**

- **⛔ 渐进式加载**：只加载当前 Capability 的四文档链（overview + proposal + spec + design + tasks）
- **⛔ 隔离红线**：绝对禁止加载同级其他 Capability 的文档
- **⛔ 拓扑依赖拦截**：执行任务前必须检查依赖，前置未完成必须拦截
- **⛔ 必须实时更新任务状态**：每完成一个任务，**立即**修改 tasks.md 中的 `- [ ]` 为 `- [x]`，**同时修改** `**状态**: [ ] 未完成` 为 `**状态**: [x] 已完成`，两种格式不可遗漏，禁止批量更新
- **⛔ 算法一致性门禁**：对于 IMPL 任务，检查实现代码与 design.md 伪代码的一致性，核心逻辑不一致时拦截
- **⛔ 编译检查门禁**：每完成一个任务后，**必须运行编译检查**，编译失败禁止标记已完成
- **⛔ 测试执行门禁**：根据 `test-strategy` 决定测试门禁行为（tdd=强制, impl-first=警告, none=跳过）
- **显示进度反馈**：每完成一个任务，显示「✅ [TASK-ID] 已完成 [N/M]」
- **保持任务聚焦**：每次只处理一个任务，完成后再继续下一个
- **代码变更最小化**：每个任务只做必要的代码修改，不要超出任务范围
- **遇到问题时暂停**：如果任务描述模糊、编译失败、测试失败或发现设计问题，暂停并询问
- **Git 只读策略**：禁止为了度量自动初始化 Git、创建分支或提交 commit；非 Git 项目使用 `vcs_mode=no-git` 继续执行
- 若变更状态已是 `ARCHIVED`，提示用户该变更已归档，无法继续实施

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 每次编译检查后，必须记录构建事件：`node skywalk-sdd/log.cjs record --type=build_result --command=apply --project=. --change=<变更名称> --capability=<capability-name> --task-id=<TASK-ID> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="编译检查结果" --details-json="{\"build_results\":{\"command\":\"<实际编译命令>\",\"success\":true,\"duration_ms\":0,\"error_count\":0}}"`
> 每完成一个任务，必须记录任务级结构化事件：`node skywalk-sdd/log.cjs record --type=task_update --command=apply --project=. --change=<变更名称> --capability=<capability-name> --task-id=<TASK-ID> --agent=claude-code --source=opsx-command --session-id=<会话ID> --status=completed --result=success --summary="<TASK-ID> 完成" --details-json="{\"files_changed\":[],\"build_results\":{\"command\":\"<实际编译命令>\",\"success\":true,\"duration_ms\":0,\"error_count\":0},\"test_results\":{\"command\":\"<实际测试命令>\",\"passed\":0,\"failed\":0,\"skipped\":0,\"coverage\":null,\"duration_ms\":0}}"`
> AI 代码产出完成后，必须记录采纳率快照，但不得为了采集快照自动提交 commit。Git 可用时只读统计 SHA/diff；Git 不可用时使用 `vcs_mode=no-git` 和 `base_git_sha=null`：`node skywalk-sdd/log.cjs record --type=ai_adoption_review --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --status=ai_snapshot --result=success --summary="AI 代码产出快照" --details-json="{\"ai_adoption\":{\"review_status\":\"ai_snapshot\",\"vcs_mode\":\"<readonly|no-git>\",\"base_git_sha\":\"<base_git_sha_or_null>\",\"ai_git_sha\":\"<ai_git_sha_or_null>\",\"ai_diff\":{\"files_changed\":0,\"added_lines\":null,\"deleted_lines\":null},\"notes\":\"未自动创建 Git 仓库，未自动提交 commit；仅记录可用统计\"}}"`
> 若后续发生人工修改并完成采纳确认，必须补录最终采纳统计；若非 Git 项目，SHA 可填 `null`，采纳行数由人工或工具统计补录：`node skywalk-sdd/log.cjs record --type=ai_adoption_review --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=manual --session-id=<会话ID> --status=final --result=success --summary="AI 代码采纳率人工确认" --details-json="{\"ai_adoption\":{\"review_status\":\"final\",\"vcs_mode\":\"<readonly|no-git>\",\"base_git_sha\":\"<base_git_sha_or_null>\",\"ai_git_sha\":\"<ai_git_sha_or_null>\",\"final_git_sha\":\"<final_git_sha_or_null>\",\"retained_lines\":0,\"rewritten_lines\":0,\"deleted_lines\":0,\"ai_diff\":{\"files_changed\":0,\"added_lines\":null,\"deleted_lines\":null},\"final_diff\":{\"files_changed\":0,\"added_lines\":null,\"deleted_lines\":null},\"notes\":\"只记录行数统计，不记录源码；非 Git 项目允许 SHA 为 null\"}}"`
> 阶段结束时执行（必须成功）：`node skywalk-sdd/log.cjs end --event-id=<开头记录的event_id> --command=apply --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="实施结果摘要"`
