---
name: OPSX: Task
description: "创建任务拆解文档 - 针对单一 Capability 的 DAG 任务清单"
argument-hint: "[change-name] [capability-name] [上下文文件...]"
---

创建 **tasks.md** - 针对单一 Capability 的 AI 编码引擎执行单元（支持拓扑依赖管理）。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs start --command=task --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>`，记录返回的 event_id。

> **⚠️ 阶段边界提示**
>
> 当前处于 **Task（任务拆解）阶段**，此阶段：
> - ✅ **允许**：创建/编辑 tasks.md 文档、读取代码作为任务分析参考
> - ❌ **禁止**：创建/修改任何代码文件、执行代码生成、运行测试
> - ⛔ **单阶段原则**：完成 tasks.md 后**必须立即停止**，等待用户主动触发下一阶段
>
> tasks.md 定义的是「待执行的任务清单」，**不是立即执行代码**。
> 用户确认任务后，使用 `/opsx:apply` 进入实施阶段执行代码操作。
> **完成本阶段后，绝对禁止自动继续执行 apply/check 等后续阶段。**

> **⚠️ 渐进式上下文加载原则**
>
> - 本命令针对**单一 Capability** 执行任务拆解
> - **输入路径**：`changes/<name>/specs/<capability>/design.md`
> - **输出路径**：`changes/<name>/specs/<capability>/tasks.md`
> - ⛔ **隔离红线**：绝对禁止跨目录读取同级其他 Capability 的文档

---

**前置要求**: 已运行 `/opsx:design` 或对应 capability 的 design.md 已存在

**执行步骤**

0. **【Telemetry 必做】记录阶段开始**

   在终端执行（若命令失败必须中止本阶段，不得跳过）：
   ```bash
   node skywalk-sdd/log.cjs start --command=task --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>
   ```
   保存输出 JSON 中的 `event_id`，供阶段结束使用。

1. **【交互引导】确认变更名称和 Capability**

   **步骤 1a - 确认变更名称**：
   若未提供 change-name，列出当前所有变更供用户选择：
   ```bash
   openspec list
   ```

   **步骤 1b - 确认 Capability**：
   若未提供 capability-name，读取已存在 design.md 的 Capability 列表，使用 **AskUserQuestion** 让用户选择：
   > "请选择要拆解任务的 Capability：
   > - A. user-auth（用户认证）- design.md ✅ 已存在
   > - B. user-profile（用户资料）- design.md ✅ 已存在
   > - C. data-export（数据导出）- design.md ❌ 未设计"

   **【路径确认】**：
   > "📍 当前操作目标：
   > - **变更**：`<change-name>`
   > - **Capability**：`<capability-name>`
   > - **输入**：`changes/<name>/specs/<capability>/design.md`
   > - **输出**：`changes/<name>/specs/<capability>/tasks.md`"

2. **【渐进式上下文加载】严格按顺序读取文档**

   > **⛔ 上下文加载红线**：必须严格按以下顺序加载，禁止一次性加载所有 Capability！

   **加载顺序**（由全局到局部）：

   ```
   ┌─────────────────────────────────────────────────────────┐
   │ 第 1 层：全局基线（必读）                                  │
   │   → openspec/specs/overview.md                          │
   │   （全局数据字典、接口规范、共享实体）                       │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 第 2 层：宏观背景（必读）                                  │
   │   → changes/<name>/proposal.md                          │
   │   （业务意图、影响范围）                                   │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 第 3 层：精准打击（仅读当前 Capability）                    │
   │   → changes/<name>/specs/<capability>/spec.md           │
   │   → changes/<name>/specs/<capability>/design.md         │
   │                                                         │
   │ ⛔ 隔离红线：禁止读取其他 Capability 的文档！              │
   └─────────────────────────────────────────────────────────┘
   ```

   **执行加载**：
   ```
   使用 Read 工具依次读取：
   1. openspec/specs/overview.md（若不存在则跳过，记录警告）
   2. changes/<name>/proposal.md
   3. changes/<name>/specs/<capability>/spec.md
   4. changes/<name>/specs/<capability>/design.md（必须存在）
   ```

   **若 design.md 不存在**：
   > "❌ 当前 Capability 的 design.md 不存在，请先运行：
   > `/opsx:design <change-name> <capability-name>`"

3. **【关键步骤】读取本地模板文件**

   **必须先读取** `openspec-templates/tasks.md` 作为文档结构模板：
   ```
   使用 Read 工具读取：openspec-templates/tasks.md
   ```

   此模板定义了局部任务文档的完整结构：
   - **任务执行拓扑图**
   - 原子任务清单（带依赖字段）
   - 验证方式
   - 质量红线检查清单

4. **【任务范围分析】统计需要覆盖的实现点**

   分析 design.md 内容，统计：
   - 前端组件数量：[X] 个
   - 后端接口数量：[X] 个
   - 数据表数量：[X] 张
   - 外部集成点：[X] 个

   **【预估任务数量】**：
   基于设计复杂度，预估任务数量：
   > "基于 `<capability>` 的 design.md，预计需要 [X] 个原子任务：
   > - 数据层任务：[数量]
   > - 接口层任务：[数量]
   > - UI 层任务：[数量]
   > - 测试任务：[数量]
   >
   > 请确认任务粒度是否合适，或调整拆分策略："

5. **【交互引导】确认测试策略**

   **❗ 必须主动确认用户的测试策略选择**

   首先读取 `proposal.md` 的 YAML frontmatter 中的 `test-strategy` 字段：

   **若已设置**：向用户确认
   > "🧪 **当前测试策略：[test-strategy]**
   > 
   > - `tdd`: 测试驱动 - 测试任务作为实现任务的前置依赖
   > - `impl-first`: 实现优先 - 先实现后测试
   > - `none`: 无测试 - 不生成测试任务
   >
   > 是否继续使用该策略？"

   **若未设置**：使用 **AskUserQuestion** 询问
   > "🧪 **未检测到测试策略配置，请选择：**
   >
   > **A) 测试驱动 (TDD)** - 测试先行
   >    - 先生成测试任务骨架，实现任务依赖测试任务
   >    - DAG 顺序：测试骨架 → 实现代码 → 测试验证
   >    - 适合：核心业务逻辑、质量要求高
   >
   > **B) 实现优先** - 代码先行
   >    - 先生成实现任务，测试作为验证步骤
   >    - DAG 顺序：实现代码 → 测试验证
   >    - 适合：UI 层、配置类、快速原型
   >
   > **C) 无测试** - 仅实现
   >    - 不生成测试任务，仅编译检查
   >    - 适合：简单配置、文档更新"

   根据用户选择设置 `test-strategy`，并更新 proposal.md 的 frontmatter（若未设置）。

6. **【交互引导】确认任务拆解策略**

   在开始拆解前，向用户确认策略：
   > "基于 design.md，本次 tasks.md 拆解策略：
   > - **Capability**：`<capability-name>`
   > - 拆解维度：按 [数据层→接口层→UI层→测试] 顺序
   > - 任务粒度：每个任务约 5 分钟完成
   > - 预计任务数：[X] 个
   > - DAG 层级：预计 [X] 层
   >
   > 请确认：
   > - A. 确认策略，开始拆解
   > - B. 调整任务粒度（更细/更粗）
   > - C. 优先处理特定模块"

   **根据 test-strategy 调整 DAG 生成规则：**

   | test-strategy | DAG 生成规则 |
   |---------------|---------------|
   | `tdd` | 每个实现任务前必须有对应的测试任务，实现任务 Depends-On 测试任务 |
   | `impl-first` | 实现任务在前，测试任务 Depends-On 实现任务 |
   | `none` | 不生成测试任务，仅编译检查 |

6. **【AI 分析澄清】识别任务风险**

   分析 design.md，识别任务拆解中的风险点：

   **常见风险点**：
   - 任务间循环依赖
   - 复杂算法实现难度
   - 第三方集成不确定性
   - 测试覆盖盲区

   **【主动询问机制】**：
   发现潜在风险时：
   > "design.md 中 [模块/功能] 存在实现风险：
   > - 风险描述：[具体描述]
   > - 影响范围：[影响的任务]
   > - 建议方案：[应对方案]
   >
   > 请确认如何处理，或提供更多信息："

8. **创建局部 tasks.md（含 DAG 拓扑）**

   **输出路径**：`changes/<name>/specs/<capability>/tasks.md`

   **以 `openspec-templates/tasks.md` 的结构为骨架**，填充内容：

   **【质量红线】生成的 tasks.md 必须：**
   - 标题包含 Capability 名称
   - 包含**任务执行拓扑图（DAG）**
   - 每个任务包含 **Depends-On** 字段
   - 每个任务颗粒度 ≤ 5 分钟
   - 100% 覆盖 design.md 的设计内容

   ```markdown
   # 实施任务拆解 - [Capability 名称]

   > **⚠️ 边界声明**：本任务清单仅服务于当前 Capability。

   ## 1. 任务总览

   ### 1.1 关联文档
   | 文档 | 路径 | 说明 |
   |-----|------|------|
   | 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
   | 业务意图 | `proposal.md` | 变更背景 |
   | 技术契约 | `specs/[capability]/spec.md` | 当前能力规格 |
   | 技术方案 | `specs/[capability]/design.md` | 当前能力设计 |

   ### 1.2 实现范围
   <!-- 本次编码要覆盖的功能范围 -->

   ### 1.3 技术栈
   - 语言：
   - 框架：
   - 依赖：

   ---

   ## 2. 任务执行拓扑图

   ### 2.0 测试策略
   **当前测试策略**：`[测试驱动 | 实现优先 | 无测试]`

   ### 2.1 拓扑图
   ```
   层级 1 (无依赖): TASK-XXX-01, TASK-XXX-02
   层级 2 (依赖 L1): TASK-XXX-03
   层级 3 (依赖 L2): TASK-XXX-04
   ```

   ### 2.2 层级汇总
   | 层级 | 任务列表 | 可并行 | 前置依赖 |
   |-----|---------|-------|--------|
   | 层级 1 | TASK-XXX-01, TASK-XXX-02 | ✅ 是 | 无 |
   | 层级 2 | TASK-XXX-03 | - | 层级 1 |

   ---

   ## 3. 原子任务清单

   ### 3.0 任务类型说明
   | 类型 | 说明 | 适用场景 |
   |------|------|----------|
   | 数据层 | 实体、DTO、Mapper、数据访问 | 数据库操作相关 |
   | 接口层 | Service、Controller、API | 业务逻辑和接口 |
   | UI层 | 组件、页面、样式 | 前端展示相关 |
   | 测试-骨架 | 测试类结构、Mock设置 | 测试驱动模式下的前置任务 |
   | 测试-验证 | 测试用例实现、断言 | 实现后的验证任务 |
   | 配置 | 配置文件、依赖添加 | 项目配置相关 |

   ---

   ### [TASK-XXX-01] 任务名称
   - **类型**: 数据层 / 接口层 / UI层 / 测试
   - **依赖**: 无
   - **状态**: [ ] 未完成（勾选格式统一使用 GitHub 标准的 `- [ ]` / `- [x]`）

   #### 任务描述
   <!-- 一句话描述本任务要做什么 -->
   #### 输入
   #### 输出
   #### 实现步骤
   1. 
   2. 
   #### 验收标准
   - [ ] 验收标准 1
   #### 关联设计
   - spec.md 章节：
   - design.md 章节：

   ---

   ## 4. 验证方式

   ### 4.1 单元测试要求
   | 任务 ID | 测试类型 | 测试场景 | 断言内容 |
   |--------|---------|---------|--------|

   ### 4.2 集成测试场景
   | 场景 | 前置条件 | 操作步骤 | 预期结果 |
   |-----|---------|---------|--------|

   ### 4.3 手动验证清单
   - [ ] 验证项 1

   ---

   ## 5. 外部依赖
   | 依赖项 | 类型 | 提供方 | 状态 | 备注 |
   |-------|------|-------|------|------|
   | | 其他能力 / 第三方 | | ✅ 就绪 / ⏳ 等待 | |

   ---

   ## 6. 代码规范
   ### 6.1 命名规范
   - 类名：
   - 方法名：
   - 变量名：
   ### 6.2 代码风格
   - 缩进：
   - 注释：
   - 异常处理：
   ### 6.3 日志规范
   - 日志级别：
   - 日志格式：

   ---

   ## 7. 交付物
   ### 7.1 代码文件
   | 文件路径 | 说明 | 对应任务 |
   |---------|------|--------|

   ### 7.2 测试文件
   | 文件路径 | 说明 | 对应任务 |
   |---------|------|--------|

   ### 7.3 文档更新
   - [ ] README 更新
   - [ ] 接口文档更新
   - [ ] 变更日志更新

   ---

   > **质量红线检查清单**
   > - [ ] 每个任务颗粒度符合“5分钟可实现”标准
   > - [ ] 任务清单 100% 覆盖 spec.md 定义
   > - [ ] 任务清单 100% 覆盖 design.md 定义
   > - [ ] 每个任务都有明确的验收标准
   > - [ ] 每个任务都有对应的单元测试要求
   > - [ ] **依赖拓扑已明确**（依赖字段已填写）
   > - [ ] **任务执行拓扑图已绘制**（层级关系清晰）
   > - [ ] 无循环依赖
   ```

9. **质量红线自检【100% 覆盖检查】**

   写入文档前，逐项确认：
   - [ ] 文档结构完全符合 `openspec-templates/tasks.md` 模板
   - [ ] **拓扑图已绘制**：层级关系清晰
   - [ ] **依赖字段已填写**：每个任务的依赖已明确
   - [ ] **无循环依赖**：拓扑中不存在环
   - [ ] 每个任务颗粒度符合"5 分钟可实现"标准
   - [ ] 任务清单 100% 覆盖 spec.md 定义
   - [ ] 任务清单 100% 覆盖 design.md 定义
   - [ ] 每个任务都有明确的验收标准

   **如有任意一项未满足，重新生成对应章节，直至全部通过。**

10. **【交互引导】确认任务并输出结果**

    生成文档后，向用户展示概要：
    > "已生成 `<capability>` 的 tasks.md，概要如下：
    > - **Capability**：`<capability-name>`
    > - **输出路径**：`changes/<name>/specs/<capability>/tasks.md`
    > - **总任务数**：[X] 个
    > - **DAG 层级**：[X] 层
    > - **层级 1（可并行）**：[X] 个任务
    > - 数据层：[X] 个 / 接口层：[X] 个 / UI层：[X] 个
    >
    > 请确认：
    > - A. 确认无误，准备执行
    > - B. 需要调整任务
    > - C. 继续拆解下一个 Capability"

    **下一步提示**：
    - 若还有其他 Capability 未拆解：
      > "运行 `/opsx:task <name> <next-capability>` 继续拆解下一个 Capability"
    - 若所有 Capability 已拆解完成：
      > "运行 `/opsx:check` 验证后，执行 `/opsx:apply <name> <capability>` 开始实现"

---

**护栏规则**

- **必须以 `openspec-templates/tasks.md` 为模板基准**
- **⛔ 渐进式加载**：严格按 overview.md → proposal.md → 当前 spec.md → design.md 顺序加载
- **⛔ 隔离红线**：绝对禁止读取同级其他 Capability 的文档
- **⛔ 拓扑必须完整**：每个任务必须有依赖字段，任务拓扑图必须绘制
- **⛔ 无循环依赖**：拓扑中不允许存在环
- 任务颗粒度宁可过细也不要过粗，复杂任务继续拆分为子任务
- 验收标准必须是可验证的（能通过测试或人工检查确认）
- `context` 和 `rules` 是你的约束条件，**不得出现在生成的文档中**
- 文档写入后验证文件确实存在于输出路径
- **⛔ 阶段边界**：本阶段只创建任务清单，禁止直接执行代码操作
- **⛔ 单阶段原则：完成 tasks.md 后必须立即停止**。仅提示用户下一步可运行 `/opsx:check` 或 `/opsx:apply`，**绝对禁止自动执行 apply/check 等后续阶段**。每个阶段必须由用户主动触发。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs end --event-id=<开头记录的event_id> --command=task --project=. --change=<变更名称> --capability=<capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="一句话摘要"`
