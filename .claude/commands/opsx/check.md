---
name: OPSX: Check
description: "质量检查 - 验证文档完整性、一致性、算法正确性及可执行性"
argument-hint: "[change-name] [上下文文件...]"
---

执行 **质量门禁检查** - 验证 proposal → specs → design → tasks 文档链的完整性、一致性、算法正确性和可执行性。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs start --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>`，记录返回的 event_id。

> **⚠️ 阶段边界提示**
>
> 当前处于 **Check（检查）阶段**，此阶段：
> - ✅ **允许**：读取并检查文档、读取代码作为验证参考
> - ❌ **禁止**：创建/修改任何代码文件、执行代码生成、运行测试
>
> 即使检查发现代码相关问题，也只记录在检查报告中，**不自动修复代码**。
> 代码修复将在 `/opsx:apply` 阶段进行。

---

**执行步骤**

0. **【Telemetry 必做】记录阶段开始**

   在终端执行（若命令失败必须中止本阶段，不得跳过）：
   ```bash
   node skywalk-sdd/log.cjs start --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>
   ```
   保存输出 JSON 中的 `event_id`，供阶段结束使用。

1. **确认变更名称**

   若未提供，列出当前所有变更供用户选择：
   ```bash
   openspec list
   ```
   
   若变更不存在，提示用户先运行 `/opsx:propose <name>` 创建变更。

2. **读取完整文档链**

   按顺序读取以下文档（如存在）：
   - `proposal.md`（或 propose.md，兼容旧格式）（业务意图）
   - `specs/<capability>/spec.md`（技术契约）
   - `design.md`（实现方案）
   - `tasks.md`（或 task.md，兼容旧格式）（任务拆解）

3. **【上下文加载】识别并读取用户提供的文件**

   **自动识别上下文文件**：
   若用户在命令中指定了文件路径（如 `/opsx:check atp-calc ./需求.md`），
   或在对话中附加/引用了文件，**必须自动读取这些文件**。

   **上下文类型与检查维度**：
   | 上下文类型 | 检查用途 | 对应检查维度 |
   |------------|---------|----------|
   | 需求文档 (.md) | 需求追溯检查基线 | 4.6 需求追溯检查 |
   | 算法说明 (.md) | 伪代码正确性参考 | 4.4 算法正确性检查 |
   | 参考实现 (.java/.ts) | 一致性检查参考 | 4.2 一致性检查 |

   **示例**：
   ```
   /opsx:check atp-calc ./ATP引擎算法逻辑.md
   /opsx:check atp-calc ./需求文档.md ./erp-algorithm-atp/
   ```

4. **【交互引导】上下文补充提示**

   **若用户未提供任何上下文文件**，AI 分析文档内容后，**主动提示用户补充**：

   **【关键】具体化建议**：
   AI 必须**引用文档中的具体内容**给出建议：
   ```
   ❌ 错误："建议提供需求文档"
   ✅ 正确："design.md 包含《正差反差计算》伪代码，建议提供该算法的需求文档进行一致性检查"
   ```

   **主动提示模板**：
   > "📌 **建议提供上下文信息以进行更深度的检查**：
   > 
   > 文档中包含：
   > - **《[XX算法]》** - 建议提供算法说明文档进行算法正确性检查
   > - **原始需求** - 建议提供需求文档进行需求追溯检查
   >
   > 您可以：
   > - **在命令后追加文件路径**：`/opsx:check atp-calc ./需求.md`
   > - **在对话中上传文件**或粘贴内容
   >
   > 或者选择：
   > - A. 仅检查内部一致性（跳过需要外部上下文的检查项）
   > - B. 已提供全部信息"

5. **【交互引导】询问用户检查重点**

   使用 **AskUserQuestion** 询问用户：
   > "请选择本次检查的重点（可多选）：
   > - [ ] 完整性检查：文档链是否完整
   > - [ ] 一致性检查：文档间是否存在矛盾
   > - [ ] 可执行性检查：task.md 任务是否可落地
   > - [ ] **算法正确性检查**：design.md 伪代码是否自洽
   > - [ ] **场景完整性检查**：spec.md Scenario 是否完整
   > - [ ] **需求追溯检查**：需求→代码链路是否完整（需要上下文）
   > - [ ] 全量检查：以上全部"
   
   根据用户选择执行对应检查项。

6. **执行质量检查**

   ### 4.1 完整性检查
   
   检查项清单：
   - [ ] proposal.md 存在且非空
   - [ ] specs 目录存在且非空
   - [ ] design.md 存在且非空
   - [ ] tasks.md 存在且非空
   
   **缺失文档处理**：
   - 若发现缺失文档，列出缺失清单
   - 询问用户："是否立即创建缺失文档？"
   - 用户确认后，引导执行对应命令创建

   ### 4.2 一致性检查
   
   **文档间引用一致性**：
   - [ ] proposal.md 的业务目标在 specs 中有对应技术实现
   - [ ] specs 的需求定义在 design.md 中有对应模块设计
   - [ ] design.md 的模块在 tasks.md 中有对应任务
   - [ ] tasks.md 的任务数量与 design.md 模块数量匹配
   
   **数据一致性**：
   - [ ] 接口参数在 specs/design/tasks 中定义一致
   - [ ] 错误码定义在各文档中一致
   - [ ] 模块名称在各文档中一致
   
   **【发现不一致时的澄清机制】**：
   - 列出所有不一致项
   - 对每个不一致项，分析影响范围
   - 询问用户："请选择修复策略：
     - A. 以 proposal.md 为准，同步修改下游文档
     > - B. 以 specs 为准，同步修改上下游文档
     - C. 手动指定正确版本"
   - 根据用户选择，生成修复建议或引导用户澄清

   ### 4.3 可执行性检查
   
   **任务可执行性**：
   - [ ] 每个任务有明确的输入/输出定义
   - [ ] 每个任务有具体的实现步骤
   - [ ] 每个任务有明确的验收标准
   - [ ] 任务依赖关系无循环依赖
   - [ ] 任务颗粒度符合"5分钟可完成"标准
   
   **【不可执行任务的处理】**：
   - 标记不可执行任务
   - 分析原因：颗粒度过大？依赖不明确？验收标准模糊？
   - 询问用户："是否自动拆分/优化这些任务？"
   - 用户确认后，生成优化建议

   ### 4.3.1 任务完成状态检查（实现后 / 归档前）

   `tasks.md` 在 task 阶段天然会包含未完成项，所以**单纯存在 `- [ ]` 不代表 task 阶段错误**。但如果当前变更已经进入 apply 之后，或本次 check 发现了实现代码、测试报告、`build_result/test_result/task_update/conformance_review` 等实施证据，则必须检查任务状态是否与实施结果同步。

   执行：

   ```bash
   node skywalk-sdd/log.cjs tasks-status --project=. --change=<变更名称>
   ```

   判定规则：
   - 若尚未进入 apply，未勾选任务只作为计划状态展示，不计入错误。
   - 若已经进入 apply/test/archive readiness，仍存在 `- [ ]` 或 `状态: [ ]`，至少记为 warning；即使用户准备归档“变更已完成实施”，也不把未勾选项作为归档阻断错误。
   - 检查报告必须写明：这是“任务可能已执行但文档未勾选”或“任务真实未完成”的待确认项，AI 不能在 check 阶段自动勾选。

   ### 4.4 算法正确性检查（新增）
   
   **❗ 此检查针对 design.md 中的伪代码**
   
   #### 4.4.1 伪代码自洽性检查
   
   | 检查项 | 要求 | 未通过处理 |
   |---------|------|------------|
   | 变量声明 | 伪代码中的变量在使用前已赋值 | ❌ 错误 |
   | 循环边界 | for 循环的起始/结束条件明确 | ❌ 错误 |
   | 分支覆盖 | switch 有 default，if 有 else | ⚠️ 警告 |
   | 数据来源 | 关键变量有来源说明 | ⚠️ 警告 |
   
   #### 4.4.2 算法一致性检查（需要 --context 算法文档）
   
   若提供了算法参考文档，检查：
   - [ ] design.md 伪代码与参考算法逻辑一致
   - [ ] 核心计算逻辑（循环、分支、累加顺序）一致
   - [ ] 边界条件处理一致
   
   **【模糊伪代码检测】**：
   - "累加计算数量（需求取负数）" → ❌ 模糊，需要明确 calcQuantity 本身是否已为负数
   - "if (direction == -1) subtract" → ⚠️ 警告，需要说明 calcQuantity 的符号

   ### 4.5 场景完整性检查（新增）
   
   **❗ 此检查针对 spec.md 中的 Scenario**
   
   #### 4.5.1 需求项-场景配比检查
   
   | 检查项 | 要求 | 未通过处理 |
   |---------|------|------------|
   | 场景数量 | 每个需求项至少 1 个场景 | ❌ 错误 |
   | 场景结构 | 每个场景必须有 当/预期 | ❌ 错误 |
   | 预期结果 | 每个场景必须有可验证的预期 | ⚠️ 警告 |
   | 边界条件 | 关键场景应包含边界条件 | ⚠️ 警告 |
   
   #### 4.5.2 场景缺失检测
   
   若发现以下情况，标记为警告：
   - 场景只有需求项声明但无详细描述
   - 场景描述使用 “等”、“之类” 等模糊词汇
   - 场景的预期结果无法量化验证

   ### 4.6 需求追溯检查（新增）
   
   **❗ 此检查需要 --context 提供需求文档基线**
   
   若未提供 --context，跳过此检查并警告：
   > "⚠️ 需求追溯检查已跳过（未提供 --context 需求文档）"
   
   #### 4.6.1 需求追溯矩阵检查
   
   从需求文档中提取需求项，检查：
   - [ ] 每个需求项在 spec.md 中有对应需求项
   - [ ] 每个 spec.md 需求项在 design.md 中有对应实现
   - [ ] 每个 design.md 实现在 tasks.md 中有对应任务
   
   **【追溯矩阵格式】**：
   ```markdown
   | 需求ID | 需求描述 | 规格需求项 | 设计算法 | 测试场景 | 追溯状态 |
   |--------|---------|-----------------|-------------|---------|----------|
   | REQ-001 | 离散 ATP 计算 | RLT-处理 | 5.2 | TASK-CA-05-TEST | ✅ |
   | REQ-002 | 存储地点 ATP | 存储地点级别 ATP | 5.5 | 未覆盖 | ❌ 缺失 |
   ```
   
   #### 4.6.2 缺失需求检测
   
   若发现需求文档中存在但未在 SDD 文档链中覆盖的需求：
   > "⚠️ **需求追溯检查发现以下缺失**：
   > - '存储地点级别 ATP' 在需求文档中存在，但测试场景未覆盖
   > - '工厂日历计算' 在需求文档中存在，但 spec.md 完全缺失
   >
   > 请选择：
   > - A. 返回 spec 阶段补充缺失场景
   > - B. 标记为 '已知风险' 继续
   > - C. 确认缺失需求不在本次范围内"

7. **【交互引导】补充上下文信息**

   若检查过程中发现以下情况，主动询问用户：
   
   **信息缺失时**：
   > "propose.md 中 [具体章节] 缺少 [具体信息]，请补充："
   
   **逻辑矛盾时**：
   > "检查中发现 [文档A] 和 [文档B] 在 [具体点] 存在矛盾：
   > - 文档A描述：...
   > - 文档B描述：...
   > 请澄清正确意图："
   
   **模糊描述时**：
   > "检查中发现 [具体章节] 存在模糊描述 '[原文]'，请明确："

8. **生成检查报告**

   生成 `check-report.md` 到变更目录：

   ```markdown
   # 质量检查报告

   ## 检查概览
   - 变更名称：[name]
   - 检查时间：[timestamp]
   - 检查范围：[完整性/一致性/可执行性/全量]
   - 总体状态：[通过/需修复/严重问题]

   ## 文档完整性
   | 文档 | 状态 | 说明 |
   |-----|------|-----|
   | proposal.md | ✅/❌ | 存在/缺失 |
   | specs/ | ✅/❌ | 存在/缺失 |
   | design.md | ✅/❌ | 存在/缺失 |
   | tasks.md | ✅/❌ | 存在/缺失 |

   ## 一致性检查结果
   ### 通过项
   - [x] [检查项描述]
   
   ### 问题项
   - [ ] [问题描述]
     - 影响：[影响范围]
     - 建议：[修复建议]
     - 优先级：[高/中/低]

   ## 可执行性评估
   ### 任务统计
   - 总任务数：X
   - 可执行任务：X
   - 需优化任务：X
   - 已勾选完成项：X
   - 未勾选项：X
   
   ### 问题任务清单
   | 任务 | 问题 | 优化建议 |
   |-----|------|---------|
   | | | |

   ## 任务完成状态
   - 检查命令：`node skywalk-sdd/log.cjs tasks-status --project=. --change=<name>`
   - 状态口径：task 阶段允许未勾选；apply/test/archive readiness 阶段不得把未勾选项静默视为完成。
   - 未勾选项清单：列出文件、行号、原文。

   ## 修复建议
   1. [优先级：高] [具体建议]
   2. [优先级：中] [具体建议]

   ## 下一步行动
   - [ ] 修复标记为"高优先级"的问题
   - [ ] 运行 `/opsx:check <name>` 重新验证
   - [ ] 通过后运行 `/opsx:apply` 开始实现
   ```

9. **【AI 分析澄清】智能问题诊断**

   若发现严重问题，AI 应主动分析并引导澄清：
   
   **严重问题类型**：
   - 文档链断裂（缺少关键中间文档）
   - 核心逻辑矛盾（业务目标与技术实现冲突）
   - 无法落地的任务（缺少必要依赖或资源）
   
   **澄清流程**：
   1. AI 分析问题根因
   2. 提供 2-3 个可能的解决方案
   3. 询问用户："请确认采用哪种方案，或提供更多信息："
   4. 根据用户反馈，更新文档或调整检查标准

10. **显示检查结果**

   完成后显示：
   - 检查报告路径
   - 问题统计（通过 X 项，警告 Y 项，错误 Z 项）
   - 关键问题摘要（如有）
   - 下一步建议：
     - 检查通过："✅ 质量检查通过！可以运行 `/opsx:apply` 开始实现"
     - 有问题："⚠️  发现 X 个问题，请查看检查报告并修复后重新检查"

11. **【Telemetry 必做】整理结构化检查结果**

   在记录 Telemetry 前，必须将检查结果整理为以下标准 schema：

   ```json
   {
     "check_results": {
       "total": 10,
       "errors": 0,
       "warnings": 1,
       "suggestions": 2,
       "fixed_before_apply": 8,
       "consistency_score": 0.87,
       "categories": {
         "completeness": {"passed": 3, "total": 3},
         "consistency": {"passed": 4, "total": 5},
         "executability": {"passed": 2, "total": 2}
       },
       "task_completion": {
         "completed": 0,
         "incomplete": 0,
         "total": 0,
         "has_incomplete": false,
         "checked_for_archive_readiness": false
       }
     }
   }
   ```

   **字段口径**：
   - `total`: 本次检查项总数。
   - `errors`: 必须修复的问题数。
   - `warnings`: 建议修复的问题数。
   - `suggestions`: 可选优化建议数。
   - `fixed_before_apply`: 在进入 apply 前已修复或已确认满足质量门禁的检查项数，用于 P4。
   - `consistency_score`: 跨文档一致性评分，取值 0-1，用于 Q5；无法评分时填 `null`。
   - `categories`: 分维度通过情况，至少包含 `completeness`、`consistency`、`executability`。
   - `task_completion`: 从 `tasks-status` 输出整理而来；若尚未进入 apply，可填写 `checked_for_archive_readiness=false`。

   **强制落盘规则**：
   - 生成检查报告后，必须先记录 `check_result`，再记录阶段 `end`。
   - 禁止只执行 `stage_end`；若无法精确统计，也必须按下方 schema 填入保守统计值，不能跳过。
   - `result` 口径：存在 error 时填 `failure`；仅 warning/suggestion 时填 `partial`；全部通过时填 `success`。

   在终端执行（必须成功）：
   ```bash
   node skywalk-sdd/log.cjs record --type=check_result --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="检查结果摘要" --details-json="{\"check_results\":{\"total\":0,\"errors\":0,\"warnings\":0,\"suggestions\":0,\"fixed_before_apply\":0,\"consistency_score\":null,\"categories\":{\"completeness\":{\"passed\":0,\"total\":0},\"consistency\":{\"passed\":0,\"total\":0},\"executability\":{\"passed\":0,\"total\":0}},\"task_completion\":{\"completed\":0,\"incomplete\":0,\"total\":0,\"has_incomplete\":false,\"checked_for_archive_readiness\":false}}}"
   ```

12. **【Telemetry 建议】记录规约符合度 Q1**

   若当前变更已有实现代码，必须将 `spec.md` 中的关键需求拆成可验证断言，并进行 LLM-as-Judge 初筛与人工确认：

   ```json
   {
     "conformance_review": {
       "method": "llm-as-judge+manual",
       "manual_confirmed": true,
       "assertions": [
         {
           "id": "ASSERT-001",
           "description": "规约中的可验证断言",
           "judge_status": "matched",
           "human_status": "matched",
           "evidence": "代码、测试或文档证据摘要",
           "files": ["src/example.js"],
           "notes": ""
         }
       ]
     }
   }
   ```

   **状态口径**：
   - `matched`: 代码/测试已满足该断言。
   - `partial`: 部分满足，仍有边界、异常或覆盖缺口。
   - `missed`: 未满足或未发现实现证据。
   - `human_status` 优先于 `judge_status`，Q1 只作为质量洞察，不作为第一期硬门禁。

   在终端执行（若存在实现代码则必须成功）：
   ```bash
   node skywalk-sdd/log.cjs record --type=conformance_review --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=manual --session-id=<会话ID> --result=success --summary="规约符合度人工确认" --details-json="{\"conformance_review\":{\"method\":\"llm-as-judge+manual\",\"manual_confirmed\":true,\"assertions\":[{\"id\":\"ASSERT-001\",\"description\":\"规约中的可验证断言\",\"judge_status\":\"matched\",\"human_status\":\"matched\",\"evidence\":\"代码、测试或文档证据摘要\",\"files\":[],\"notes\":\"\"}]}}"
   ```

   若当前尚未进入实现阶段或无法验证代码，允许跳过 `conformance_review`，但需要在检查报告中说明原因。

---

**护栏规则**

- 检查是**辅助手段**，最终决策权在用户
- 发现问题时**必须提供具体位置和修复建议**，不要只报告"有问题"
- **区分严重程度**：错误（必须修复）vs 警告（建议优化）vs 建议（可选改进）
- 用户选择"忽略"某问题时，记录原因到检查报告
- 检查报告本身也是文档，需保持清晰、可追踪
- **⛔ 阶段边界**：本阶段仅执行检查，禁止自动修复代码。若发现代码问题，记录到检查报告并提示用户：「代码修复请使用 `/opsx:apply` 执行。」

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 生成检查报告后，必须先记录结构化检查结果：`node skywalk-sdd/log.cjs record --type=check_result --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="检查结果摘要" --details-json="{\"check_results\":{\"total\":0,\"errors\":0,\"warnings\":0,\"suggestions\":0,\"fixed_before_apply\":0,\"consistency_score\":null,\"categories\":{\"completeness\":{\"passed\":0,\"total\":0},\"consistency\":{\"passed\":0,\"total\":0},\"executability\":{\"passed\":0,\"total\":0}},\"task_completion\":{\"completed\":0,\"incomplete\":0,\"total\":0,\"has_incomplete\":false,\"checked_for_archive_readiness\":false}}}"`
> `check_result` 记录成功后，才允许执行阶段结束：`node skywalk-sdd/log.cjs end --event-id=<开头记录的event_id> --command=check --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="检查结果摘要" --details-json="{\"check_results\":{\"total\":0,\"errors\":0,\"warnings\":0,\"suggestions\":0,\"fixed_before_apply\":0,\"consistency_score\":null,\"categories\":{\"completeness\":{\"passed\":0,\"total\":0},\"consistency\":{\"passed\":0,\"total\":0},\"executability\":{\"passed\":0,\"total\":0}},\"task_completion\":{\"completed\":0,\"incomplete\":0,\"total\":0,\"has_incomplete\":false,\"checked_for_archive_readiness\":false}}}"`
