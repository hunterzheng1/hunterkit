# 实施任务拆解 - harness-cli-entrypoint

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-cli-entrypoint` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-cli-entrypoint/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-cli-entrypoint/design.md` | 当前能力设计 |

### 1.2 实现范围

- 实现 `runInitWizard()` 6 步交互式向导
- 实现 `runOperationMenu()` 已初始化项目操作菜单
- 扩展 `parseGlobalOptions()` 支持命令级参数透传（含 `--json`）
- 扩展 `main()` 初始化时调用文档生成和 Skill 投影安装

### 1.3 技术栈

- 语言：TypeScript (ESM)
- 框架：commander
- 依赖：@inquirer/prompts >= 5.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

| 策略 | 说明 | 拓扑结构 |
|--------|------|------------|
| 测试驱动 | 测试先行 | 测试骨架 → 实现代码 → 测试验证 |

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1 (测试骨架，可并行)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TASK-CE-01   │  │ TASK-CE-02   │  │ TASK-CE-03   │       │
│  │ 向导测试骨架  │  │ 菜单测试骨架  │  │ 参数透传测试  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码，可并行)                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-CE-04   │  │ TASK-CE-05   │  │ TASK-CE-06   │  ││
│  │  │ 实现6步向导   │  │ 实现操作菜单  │  │ 参数透传框架  │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 03    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │         v                 v                 v           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (集成 + 测试验证)                            │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-CE-07   │  │ TASK-CE-08   │                │││
│  │  │  │ main集成     │  │ 测试验证     │                │││
│  │  │  │ 依赖: 04,05 │  │ 依赖: 07    │                │││
│  │  │  └──────────────┘  └──────────────┘                │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-CE-01, TASK-CE-02, TASK-CE-03 | ✅ 是 | 无 |
| 层级 2 | TASK-CE-04, TASK-CE-05, TASK-CE-06 | ✅ 是 | 层级 1 对应任务 |
| 层级 3 | TASK-CE-07 | - | TASK-CE-04, TASK-CE-05 |
| 层级 3 | TASK-CE-08 | - | TASK-CE-07 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 测试-骨架 | 测试类结构、Mock设置 | 测试驱动模式下的测试前置任务 |
| 接口层 | Service、Controller、API | 业务逻辑和接口 |
| 测试-验证 | 测试用例实现、断言 | 实现后的测试验证任务 |

---

### [TASK-CE-01] 编写 runInitWizard 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `runInitWizard()` 创建测试文件骨架，覆盖 6 步向导的每个步骤和异常场景。

#### 输入
- `src/cli/interactive.ts` 中 `runInitWizard()` 的函数签名

#### 输出
- `test/cli/interactive.test.ts` 测试文件骨架

#### 实现步骤
1. 创建 `test/cli/interactive.test.ts`
2. Mock `@inquirer/prompts` 的 `select` 和 `checkbox`
3. 编写 6 个测试用例骨架（每步一个）+ 向导中断测试 + 无效输入测试
4. 所有断言暂时标记为 `TODO`

#### 验收标准
- [ ] 测试文件可被 vitest 识别
- [ ] 包含 8 个测试用例骨架（6 步 + 中断 + 无效输入）
- [ ] Mock 设置正确

#### 关联设计
- spec.md 章节：需求项「6 步交互式向导」
- design.md 章节：§4.2 接口 1、§6.1 核心流程

---

### [TASK-CE-02] 编写 runOperationMenu 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `runOperationMenu()` 创建测试文件骨架，覆盖菜单展示、命令选择和未知命令场景。

#### 输入
- `src/cli/interactive.ts` 中 `runOperationMenu()` 的函数签名

#### 输出
- `test/cli/interactive.test.ts` 中追加测试用例

#### 实现步骤
1. 在 `test/cli/interactive.test.ts` 中追加 `describe('runOperationMenu')` 块
2. Mock `@inquirer/prompts` 的 `select`
3. 编写 3 个测试用例骨架（正常选择、取消选择、未知命令）

#### 验收标准
- [ ] 包含 3 个测试用例骨架
- [ ] Mock 设置正确

#### 关联设计
- spec.md 章节：需求项「已初始化项目操作菜单」
- design.md 章节：§4.2 接口 2

---

### [TASK-CE-03] 编写命令级参数透传单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `parseGlobalOptions()` 的命令级参数透传创建测试骨架，覆盖 `--json` 等参数透传场景。

#### 输入
- `src/cli/global-options.ts` 中 `parseGlobalOptions()` 的函数签名

#### 输出
- `test/cli/global-options.test.ts` 中追加测试用例

#### 实现步骤
1. 在测试文件中追加 `describe('命令级参数透传')` 块
2. 编写测试用例：全局参数解析后剩余参数透传给命令 handler
3. 编写 `--json` 格式化输出测试

#### 验收标准
- [ ] 包含 2 个测试用例骨架
- [ ] 覆盖 `--json` 透传场景

#### 关联设计
- spec.md 章节：需求项「命令级参数解析框架」
- design.md 章节：§2.1 需修改文件

---

### [TASK-CE-04] 实现 runInitWizard 6 步向导

- **类型**: 接口层
- **依赖**: TASK-CE-01
- **状态**: [ ] 未完成

#### 任务描述
替换 `src/cli/interactive.ts` 中 `runInitWizard()` 的 stub 实现，使用 `@inquirer/prompts` 实现完整 6 步交互式向导。

#### 输入
- 现有 stub 函数签名
- 6 步向导定义（projectPath, aiTools, capabilities, projectType, writeStrategy, hookStrength）

#### 输出
- 完整的 `runInitWizard()` 实现

#### 实现步骤
1. 导入 `@inquirer/prompts` 的 `select` 和 `checkbox`
2. 实现步骤 1：`select` 确认目标项目路径
3. 实现步骤 2：`checkbox` 选择 AI 工具（Claude Code, Codex, 两者, 暂不安装）
4. 实现步骤 3：`checkbox` 选择工作流能力
5. 实现步骤 4：`select` 选择项目类型（自动检测, Node, Java, 混合）
6. 实现步骤 5：`select` 选择写入策略（只预览, 写入项目配置）
7. 实现步骤 6：`select` 选择 Hook 强度
8. 处理 Ctrl+C 中断返回错误码 1003
9. 处理无效输入返回错误码 1004

#### 验收标准
- [ ] 6 步向导可完整执行
- [ ] 返回 `wizardAnswers` 包含全部 6 个字段
- [ ] Ctrl+C 返回错误码 1003
- [ ] TASK-CE-01 测试全部通过

#### 关联设计
- spec.md 章节：需求项「6 步交互式向导」
- design.md 章节：§4.2 接口 1、§6.1

---

### [TASK-CE-05] 实现 runOperationMenu 操作菜单

- **类型**: 接口层
- **依赖**: TASK-CE-02
- **状态**: [ ] 未完成

#### 任务描述
扩展 `runOperationMenu()` 实现交互式命令选择菜单，用户选择后构造 `CommandContext` 并调用对应 handler。

#### 输入
- 现有 `runOperationMenu()` 函数

#### 输出
- 完整的操作菜单实现

#### 实现步骤
1. 从 `registry.list()` 获取可用命令列表
2. 使用 `@inquirer/prompts` 的 `select` 展示命令菜单
3. 用户选择后构造 `CommandContext`
4. 调用对应 handler 的 `run()` 方法
5. 未知命令返回错误码 2002

#### 验收标准
- [ ] 菜单展示所有已注册命令
- [ ] 选择后正确调用对应 handler
- [ ] 未知命令返回错误码 2002
- [ ] TASK-CE-02 测试全部通过

#### 关联设计
- spec.md 章节：需求项「已初始化项目操作菜单」
- design.md 章节：§4.2 接口 2

---

### [TASK-CE-06] 实现命令级参数透传框架

- **类型**: 接口层
- **依赖**: TASK-CE-03
- **状态**: [ ] 未完成

#### 任务描述
扩展 `parseGlobalOptions()` 支持命令级参数透传，确保 `--json` 等参数能正确传递给各命令 handler。

#### 输入
- 现有 `parseGlobalOptions()` 函数

#### 输出
- 扩展后的参数解析函数

#### 实现步骤
1. 解析全局参数（`--cwd`/`--dry-run`/`--json`/`--no-color`）
2. 将剩余参数作为 `commandArgs` 透传给命令 handler
3. 确保 `--json` 同时影响全局输出格式

#### 验收标准
- [ ] 全局参数正确解析
- [ ] 剩余参数完整透传
- [ ] TASK-CE-03 测试全部通过

#### 关联设计
- spec.md 章节：需求项「命令级参数解析框架」
- design.md 章节：§2.1

---

### [TASK-CE-07] main.ts 集成文档生成和 Skill 投影

- **类型**: 接口层
- **依赖**: TASK-CE-04, TASK-CE-05
- **状态**: [ ] 未完成

#### 任务描述
扩展 `src/cli/main.ts` 的 `main()` 函数，在向导完成后调用 `ensureWorkspace()`、文档生成和 Skill 投影安装；已初始化项目无参数运行时进入操作菜单。

#### 输入
- `runInitWizard()` 返回的 `wizardAnswers`
- `ensureWorkspace()`、`generateDocuments()`、`generateSkillProjections()` 接口

#### 输出
- 完整的 `main()` 集成逻辑

#### 实现步骤
1. 检测 `.harness/config/harness.config.json` 是否存在
2. 不存在 → 调用 `runInitWizard()` → `ensureWorkspace()` → `generateDocuments()` → `generateSkillProjections()`
3. 存在且无参数 → 调用 `runOperationMenu()`
4. 存在且有参数 → 正常命令分发
5. `writeStrategy === 'preview'` 时设置 `dryRun = true`

#### 验收标准
- [ ] 未初始化项目进入向导并生成全部产物
- [ ] 已初始化项目无参数进入操作菜单
- [ ] dry-run 模式不写入文件
- [ ] 产物列表包含 AGENTS.md、CLAUDE.md、Skill 投影

#### 关联设计
- spec.md 章节：需求项「初始化产物生成」
- design.md 章节：§5.3 数据流转图、§6.2 状态机

---

### [TASK-CE-08] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-CE-07
- **状态**: [ ] 未完成

#### 任务描述
运行 `test/cli/interactive.test.ts` 和 `test/cli/global-options.test.ts` 的全部测试用例，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全 TASK-CE-01/02/03 中标记为 `TODO` 的断言
2. 运行 `npx vitest run test/cli/`
3. 修复失败用例
4. 确保覆盖率达标

#### 验收标准
- [ ] 全部 13 个测试用例通过
- [ ] 无 TypeScript 编译错误
- [ ] 错误码 1003/1004/2002 正确返回

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-CE-01 | 向导测试 | 6 步问答、中断、无效输入 | wizardAnswers 字段完整、错误码正确 |
| TASK-CE-02 | 菜单测试 | 正常选择、取消、未知命令 | handler 调用、错误码 2002 |
| TASK-CE-03 | 参数测试 | 全局参数、命令级透传 | commandArgs 完整、json 标志传递 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 未初始化→向导 | 无 harness.config.json | 无参数运行 | 6 步向导→产物生成 |
| 已初始化→菜单 | 有 harness.config.json | 无参数运行 | 展示命令菜单 |
| dry-run 向导 | writeStrategy=preview | 完成向导 | 不写入文件 |

### 4.3 手动验证清单

- [ ] `npx @hunterzheng/harness` 无参数运行进入向导或菜单
- [ ] 向导 6 步问题清晰、默认值合理
- [ ] Ctrl+C 中断提示"向导已取消"

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| @inquirer/prompts >= 5.0.0 | 第三方包 | npm | ✅ 就绪 | 降级为非交互模式 |
| harness-workspace-config | 其他能力 | ensureWorkspace() | ⏳ 等待 | 已有 stub |
| harness-adapter-skill-runtime | 其他能力 | ensureAdapterSources() | ⏳ 等待 | 已有 stub |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（如 `WizardStep`）
- 方法名：camelCase（如 `runInitWizard`）
- 变量名：camelCase（如 `wizardAnswers`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释
- 异常处理：使用 `HarnessCliError` 类，携带错误码

### 6.3 日志规范

- 日志级别：debug/info/warn/error
- 日志格式：`[harness:cli] message`
- 敏感信息处理：不输出用户路径到日志

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/cli/interactive.ts` | 向导和菜单实现 | TASK-CE-04, TASK-CE-05 |
| `src/cli/global-options.ts` | 参数透传扩展 | TASK-CE-06 |
| `src/cli/main.ts` | 集成逻辑 | TASK-CE-07 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/cli/interactive.test.ts` | 向导和菜单测试 | TASK-CE-01, TASK-CE-02, TASK-CE-08 |
| `test/cli/global-options.test.ts` | 参数透传测试 | TASK-CE-03, TASK-CE-08 |

### 7.3 文档更新

- [ ] 变更日志更新

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**（依赖字段已填写）
> - [x] **任务执行拓扑图已绘制**（层级关系清晰）
> - [x] 无循环依赖
