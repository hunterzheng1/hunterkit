# 实施任务拆解 - harness-cli-entrypoint

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-cli-entrypoint` Capability，严禁跨模块任务。

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

- 创建 `@hunterzheng/harness` npm 包基础结构（`package.json`、`tsconfig.json`）
- 实现 CLI 共享类型定义（`ParsedCommand`、`GlobalOptions`、`CliResponse`、`CliArtifact`、`CommandContext`）
- 实现统一错误体系（`HarnessCliError`、`toCliResponse()`，覆盖错误码 1001/1002/2001/4001/5001）
- 实现全局参数解析（`--cwd`、`--dry-run`、`--json`、`--no-color`）
- 实现命令注册表（8 个顶层命令路由、handler 接口定义）
- 实现统一输出适配（JSON 模式纯净输出 + 人类可读摘要）
- 实现交互式入口（初始化向导 + 操作菜单，根据 `.harness/config/harness.config.json` 分流）
- 实现 CLI 主入口 `main()` 和 binary shim（`src/bin/harness.ts`）
- 编写单元测试和集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（原生 `node:test` 或 `vitest`）
- 依赖：`commander`（参数解析）、`inquirer` 或 `@inquirer/prompts`（交互式提示）、`chalk`（终端颜色）
- 构建：`tsup` 或 `tsc`
- 包管理：npm >= 10.0.0

---

## 2. 任务执行拓扑图

> **⚠️ 依赖管理**：任务必须按层级执行，每层任务可并行，跨层必须等待前置完成

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

| 策略 | 说明 | 拓扑结构 |
|--------|------|------------|
| 测试驱动 | 测试先行 | 测试骨架 → 实现代码 → 测试验证 |

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行) - 项目基础                                    │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ TASK-CLI-01  │  │ TASK-CLI-02  │                                 │
│  │ 项目配置      │  │ 类型定义      │                                 │
│  └──────┬───────┘  └──────┬───────┘                                 │
│         │                 │                                          │
│         v                 v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐   │ │
│  │  │ TASK-CLI-03  单元测试骨架（依赖: 01, 02）                   │   │ │
│  │  └──────────────────────────────────────────────────────────┘   │ │
│  │         │                                                        │ │
│  │         v                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  层级 3 (依赖 L2) - 核心实现（可并行）                      │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │ │
│  │  │  │ TASK-CLI-04  │  │ TASK-CLI-05  │  │ TASK-CLI-06  │   │    │ │
│  │  │  │ 错误+选项     │  │ 注册表       │  │ 输出适配      │   │    │ │
│  │  │  │ 依赖: 03     │  │ 依赖: 03     │  │ 依赖: 03     │   │    │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │    │ │
│  │  │         │                 │                 │            │    │ │
│  │  │         v                 v                 v            │    │ │
│  │  │  ┌─────────────────────────────────────────────────────┐│    │ │
│  │  │  │  层级 4 (依赖 L3) - 入口与交互                        ││    │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐                 ││    │ │
│  │  │  │  │ TASK-CLI-07  │  │ TASK-CLI-08  │                 ││    │ │
│  │  │  │  │ 交互入口      │  │ 主入口+Shim   │                 ││    │ │
│  │  │  │  │ 依赖: 04,05  │  │ 依赖: 04~07  │                 ││    │ │
│  │  │  │  └──────────────┘  └──────┬───────┘                 ││    │ │
│  │  │  │                           │                          ││    │ │
│  │  │  │                           v                          ││    │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐││    │ │
│  │  │  │  │  层级 5 (依赖 L4) - 验证                          │││    │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │││    │ │
│  │  │  │  │  │ TASK-CLI-09  │  │ TASK-CLI-10  │              │││    │ │
│  │  │  │  │  │ 集成测试      │  │ 构建验证      │              │││    │ │
│  │  │  │  │  │ 依赖: 08     │  │ 依赖: 09     │              │││    │ │
│  │  │  │  │  └──────────────┘  └──────────────┘              │││    │ │
│  │  │  │  └──────────────────────────────────────────────────┘││    │ │
│  │  │  └─────────────────────────────────────────────────────┘│    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-CLI-01, TASK-CLI-02 | ✅ 是 | 无 |
| 层级 2 | TASK-CLI-03 | - | 层级 1 |
| 层级 3 | TASK-CLI-04, TASK-CLI-05, TASK-CLI-06 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-CLI-07, TASK-CLI-08 | 部分并行（07 先于 08） | 层级 3 |
| 层级 5 | TASK-CLI-09, TASK-CLI-10 | 顺序执行 | 层级 4 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 配置 | 配置文件、依赖添加 | 项目配置相关 |
| 数据层 | 实体、DTO、类型定义 | 共享类型和接口 |
| 接口层 | Service、核心模块 | 业务逻辑和接口 |
| UI层 | 终端交互组件 | 交互式向导和菜单 |
| 测试-骨架 | 测试类结构、Mock 设置 | TDD 模式下的测试前置任务 |
| 测试-验证 | 测试用例实现、断言 | 实现后的测试验证任务 |

---

### [TASK-CLI-01] 项目配置与依赖初始化

- **类型**: 配置
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
创建 `@hunterzheng/harness` npm 包基础结构，包括 `package.json`、`tsconfig.json`，安装核心依赖。

#### 输入
- design.md 中的包名、bin 配置、Node 版本要求（§7.2、§9.1）

#### 输出
- `package.json`：声明 `@hunterzheng/harness` 包名、`bin.harness` 指向 `dist/bin/harness.js`、`engines.node >= 20.0.0`
- `tsconfig.json`：TypeScript 编译配置
- 依赖安装：`commander`、`@inquirer/prompts`、`chalk`

#### 实现步骤
1. 在项目根目录创建 `package.json`，设置 `name`、`version`、`bin`、`engines`、`scripts`（build、test、lint）
2. 创建 `tsconfig.json`，配置 `target: ES2022`、`module: NodeNext`、`outDir: dist`、`strict: true`
3. 安装依赖：`npm install commander @inquirer/prompts chalk`
4. 安装开发依赖：`npm install -D typescript @types/node tsup vitest`

#### 验收标准
- [x] `package.json` 中 `bin.harness` 指向 `dist/bin/harness.js`
- [x] `engines.node` 设置为 `>=20.0.0`
- [x] `npm install` 成功完成，无报错
- [x] `npx tsc --noEmit` 不报错（空项目基线）

#### 关联设计
- spec.md 章节：§4.2 外部依赖（Node.js >= 20、npm >= 10、TypeScript >= 5）
- design.md 章节：§7.2 第三方 API/SDK、§9.1 业务配置

---

### [TASK-CLI-02] CLI 共享类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
定义 CLI 模块共享的 TypeScript 类型，包括 `ParsedCommand`、`GlobalOptions`、`CliResponse`、`CliArtifact`、`CommandContext`、`CommandHandler` 接口。

#### 输入
- design.md §1.1 字段映射表中的 10 个字段定义
- design.md §2.2 需新建文件列表中的 `src/cli/types.ts`

#### 输出
- `src/cli/types.ts`：包含所有共享类型定义

#### 实现步骤
1. 创建 `src/cli/types.ts`
2. 定义 `ParsedCommand`：`{ command: string | null; args: string[] }`
3. 定义 `GlobalOptions`：`{ cwd: string; dryRun: boolean; json: boolean; noColor: boolean }`
4. 定义 `CliArtifact`：`{ type: string; path: string; description?: string }`
5. 定义 `CliResponse`：`{ code: number; msg: string; data: object | null; warnings: string[]; artifacts?: CliArtifact[] }`
6. 定义 `CommandContext`：`{ globalOptions: GlobalOptions; command: string; io: CliIo; registry: CommandRegistry }`
7. 定义 `CommandHandler` 接口：`{ name: string; description: string; requiresInitializedWorkspace: boolean; run(context: CommandContext): Promise<CliResponse> }`
8. 定义 `CommandRegistry` 接口：`{ resolve(command: string): CommandHandler | null; list(): CommandHandler[] }`
9. 定义 `CliIo` 接口：`{ stdout: Writable; stderr: Writable; stdin: Readable }`

#### 验收标准
- [x] 所有类型与 design.md §1.1 字段追溯表一致
- [x] `CliResponse` 包含 `code`、`msg`、`data`、`warnings` 字段
- [x] `GlobalOptions` 使用 camelCase（`dryRun`、`noColor`）
- [x] `npx tsc --noEmit` 通过，无类型错误

#### 关联设计
- spec.md 章节：§2.1 接口定义（请求参数、响应结构）
- design.md 章节：§1.1 字段映射表、§2.2 需新建文件

---

### [TASK-CLI-03] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-CLI-01, TASK-CLI-02
- **状态**: [x] 已完成

#### 任务描述
编写 CLI 入口模块的单元测试骨架，覆盖所有核心模块的测试用例结构（红灯状态），使用 mock `CliIo` 隔离终端输出。

#### 输入
- `src/cli/types.ts` 中的类型定义
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/cli/entrypoint.test.ts`：单元测试骨架文件

#### 实现步骤
1. 创建 `test/cli/entrypoint.test.ts`，引入 `node:test`（或 `vitest`）和 `src/cli/types.ts`
2. 创建 mock `CliIo` 辅助函数：`createMockIo()` 返回可捕获 stdout/stderr 输出的 mock 对象
3. 编写 `parseGlobalOptions` 测试骨架：
   - `should parse --cwd to absolute path`
   - `should default cwd to process.cwd()`
   - `should parse --dry-run as boolean`
   - `should parse --json as boolean`
   - `should parse --no-color as boolean`
   - `should reject invalid --cwd path`
4. 编写 `HarnessCliError` 测试骨架：
   - `should create error with code 1001 for invalid command`
   - `should create error with code 1002 for invalid path`
   - `should create error with code 2001 for uninitialized workspace`
   - `should create error with code 4001 for missing external dependency`
   - `should convert unknown error to code 5001`
5. 编写 `CommandRegistry` 测试骨架：
   - `should resolve known command`
   - `should return null for unknown command`
   - `should list all 8 commands`
6. 编写 `writeCliResponse` 测试骨架：
   - `should output valid JSON when --json is true`
   - `should not mix non-JSON text in JSON mode`
   - `should output human summary when --json is false`
7. 编写 `main()` 测试骨架：
   - `should enter interactive mode when no command`
   - `should route to handler when command exists`
   - `should return exit code 0 on success`
   - `should return non-zero exit code on error`
8. 所有测试用例标记为 `todo` 或预期失败（红灯状态）

#### 验收标准
- [x] 测试文件可被测试运行器发现（`npx vitest run --reporter=verbose` 列出所有用例）
- [x] 所有测试用例处于红灯（失败）状态
- [x] mock `CliIo` 可正确捕获 stdout/stderr 输出
- [x] 测试覆盖 design.md §6.1 核心流程的所有分支

#### 关联设计
- spec.md 章节：§1 需求规格（所有场景）
- design.md 章节：§6.1 核心流程、§6.2 状态机、§8.1 异常分类

---

### [TASK-CLI-04] 错误体系与全局参数解析实现

- **类型**: 接口层
- **依赖**: TASK-CLI-03
- **状态**: [x] 已完成

#### 任务描述
实现 `HarnessCliError` 错误类、`toCliResponse()` 转换函数和 `parseGlobalOptions()` 全局参数解析函数，使对应测试用例通过。

#### 输入
- `src/cli/types.ts` 中的类型定义
- `test/cli/entrypoint.test.ts` 中的测试用例

#### 输出
- `src/cli/errors.ts`：`HarnessCliError` 类 + `toCliResponse()` 函数
- `src/cli/global-options.ts`：`parseGlobalOptions()` 函数

#### 实现步骤
1. 创建 `src/cli/errors.ts`
2. 实现 `HarnessCliError` 类：继承 `Error`，包含 `code`、`msg`、`suggestion` 字段
3. 实现错误码常量映射：`1001`=参数错误、`1002`=路径错误、`2001`=未初始化、`4001`=外部依赖不可用、`5001`=未知错误
4. 实现 `toCliResponse(error)` 函数：将 `HarnessCliError` 或未知 `Error` 转换为 `CliResponse`
5. 创建 `src/cli/global-options.ts`
6. 实现 `parseGlobalOptions(argv: string[])` 函数：使用 `commander` 解析 `--cwd`、`--dry-run`、`--json`、`--no-color`
7. 实现 `--cwd` 路径校验：必须解析为存在的目录，否则抛出 `HarnessCliError(1002)`
8. 实现 `--cwd` 默认值为 `process.cwd()`，并转换为绝对路径
9. 返回 `{ parsedCommand: ParsedCommand; globalOptions: GlobalOptions }`
10. 运行测试，确保 `parseGlobalOptions` 和 `HarnessCliError` 相关测试全部通过（绿灯）

#### 验收标准
- [x] `HarnessCliError` 覆盖错误码 1001、1002、2001、4001、5001
- [x] `toCliResponse()` 对 `HarnessCliError` 返回对应 code/msg/warnings
- [x] `toCliResponse()` 对未知 `Error` 返回 code 5001
- [x] `parseGlobalOptions()` 正确解析所有 4 个全局参数
- [x] `parseGlobalOptions()` 对非法 `--cwd` 抛出 `HarnessCliError(1002)`
- [x] 对应测试用例全部绿灯

#### 关联设计
- spec.md 章节：§2.1 错误码定义、§1 场景（全局上下文参数）
- design.md 章节：§4.2 接口 2（命令注册表）、§8.1 异常分类

---

### [TASK-CLI-05] 命令注册表实现

- **类型**: 接口层
- **依赖**: TASK-CLI-03
- **状态**: [x] 已完成

#### 任务描述
实现 `createCommandRegistry()` 和 `resolveCommand()` 函数，注册 8 个顶层命令并完成路由，使对应测试用例通过。

#### 输入
- `src/cli/types.ts` 中的 `CommandRegistry`、`CommandHandler` 接口
- `test/cli/entrypoint.test.ts` 中的注册表测试用例

#### 输出
- `src/cli/command-registry.ts`：命令注册表实现

#### 实现步骤
1. 创建 `src/cli/command-registry.ts`
2. 定义 8 个命令元数据：`inspect`、`sync`、`develop`、`review`、`knowledge`、`status`、`doctor`、`config`
3. 每个命令包含 `name`、`description`、`requiresInitializedWorkspace` 标志
4. 为每个命令创建 stub handler（抛出 `HarnessCliError(5001)` 提示"未实现"，后续由各 capability 替换）
5. 实现 `createCommandRegistry()` 函数：返回 `CommandRegistry` 对象
6. 实现 `resolve(command)` 方法：校验命令名在枚举内，返回对应 handler；未知命令返回 `null`
7. 实现 `list()` 方法：返回所有已注册命令的元数据列表
8. 提供 `registerHandler(command, handler)` 方法：供后续 capability 替换 stub handler
9. 运行测试，确保注册表相关测试全部通过（绿灯）

#### 验收标准
- [x] `resolve("inspect")` 返回有效 handler
- [x] `resolve("unknown")` 返回 `null`
- [x] `list()` 返回 8 个命令
- [x] 每个命令包含 `name`、`description`、`requiresInitializedWorkspace`
- [x] stub handler 被调用时返回 code 5001
- [x] 对应测试用例全部绿灯

#### 关联设计
- spec.md 章节：§1 需求项（统一 CLI 入口 - 8 个顶层命令）
- design.md 章节：§4.2 接口 2（命令注册表）、§6.1 核心流程

---

### [TASK-CLI-06] 统一输出适配实现

- **类型**: 接口层
- **依赖**: TASK-CLI-03
- **状态**: [x] 已完成

#### 任务描述
实现 `writeCliResponse()` 和 `formatHumanSummary()` 函数，统一 JSON 与人类可读输出，使对应测试用例通过。

#### 输入
- `src/cli/types.ts` 中的 `CliResponse`、`CliIo` 接口
- `test/cli/entrypoint.test.ts` 中的输出测试用例

#### 输出
- `src/cli/output.ts`：输出适配模块

#### 实现步骤
1. 创建 `src/cli/output.ts`
2. 实现 `writeCliResponse(response: CliResponse, options: { json: boolean; noColor: boolean; io: CliIo })` 函数
3. JSON 模式：`io.stdout.write(JSON.stringify(response))`，确保不混入非 JSON 文本
4. 人类模式：调用 `formatHumanSummary(response)` 生成摘要，写入 `io.stdout`
5. 实现 `formatHumanSummary(response: CliResponse): string`：
   - 成功时：显示命令名、状态、产物路径、下一步建议
   - 失败时：显示错误码、错误消息、修复建议
   - warnings 逐行显示
6. 人类模式下诊断信息和 debug 写入 `io.stderr`，不污染 stdout
7. `--no-color` 为 true 时禁用 ANSI 颜色码
8. 运行测试，确保输出相关测试全部通过（绿灯）

#### 验收标准
- [x] JSON 模式下 stdout 只包含合法 JSON（`JSON.parse()` 不抛异常）
- [x] JSON 模式下无 ANSI 颜色码混入
- [x] 人类模式下显示命令名、状态和产物路径
- [x] 错误响应显示错误码和修复建议
- [x] `--no-color` 时输出无颜色码
- [x] 对应测试用例全部绿灯

#### 关联设计
- spec.md 章节：§1 需求项（命令参数与输出契约 - 机器可读输出）
- design.md 章节：§4.2 接口 1（CLI 主入口 - 响应结构）、§6.3 关键算法

---

### [TASK-CLI-07] 交互式入口实现

- **类型**: UI层
- **依赖**: TASK-CLI-04, TASK-CLI-05
- **状态**: [x] 已完成

#### 任务描述
实现 `runInteractiveEntrypoint()`、`runInitWizard()` 和 `runOperationMenu()` 函数，根据初始化状态分流到向导或菜单。

#### 输入
- `src/cli/types.ts` 中的 `CommandContext`、`CommandRegistry` 接口
- `src/cli/command-registry.ts` 中的 `list()` 方法
- design.md §3.1 前端组件设计（`InitWizardPrompt`、`OperationMenuPrompt`）

#### 输出
- `src/cli/interactive.ts`：交互式入口模块

#### 实现步骤
1. 创建 `src/cli/interactive.ts`
2. 实现 `runInteractiveEntrypoint(context: CommandContext): Promise<CliResponse>`：
   - 检查 `.harness/config/harness.config.json` 是否存在（通过 `fs.existsSync`）
   - 存在则调用 `runOperationMenu()`
   - 不存在则调用 `runInitWizard()`
3. 实现 `runInitWizard(context: CommandContext): Promise<CliResponse>`：
   - 使用 `@inquirer/prompts` 收集：目标项目路径、AI 工具选择、能力集、项目类型、写入策略、Hook 强度
   - 将用户选择写入 `.harness/config/harness.config.json`（调用 workspace-config 接口或 stub）
   - 返回 `CliResponse` 包含初始化结果
4. 实现 `runOperationMenu(context: CommandContext): Promise<CliResponse>`：
   - 使用 `@inquirer/prompts` 展示 8 个命令菜单（从 `registry.list()` 获取）
   - 用户选择后调用 `resolveCommand()` 获取 handler 并执行
   - 返回 handler 的 `CliResponse`
5. 处理用户取消（Ctrl+C）：返回 `CliResponse` code 0，msg "cancelled"

#### 验收标准
- [x] 未初始化项目进入向导流程
- [x] 已初始化项目进入操作菜单
- [x] 菜单展示 8 个顶层命令
- [x] 用户选择命令后正确路由到 handler
- [x] Ctrl+C 不抛出异常，返回 code 0
- [x] `--dry-run` 透传到向导/菜单的后续操作

#### 关联设计
- spec.md 章节：§1 场景（首次运行进入初始化向导、已初始化项目进入操作菜单）
- design.md 章节：§3.1 组件结构、§3.2 状态管理、§6.2 状态机

---

### [TASK-CLI-08] CLI 主入口与 Binary Shim

- **类型**: 接口层
- **依赖**: TASK-CLI-04, TASK-CLI-05, TASK-CLI-06, TASK-CLI-07
- **状态**: [x] 已完成

#### 任务描述
实现 `main()` 函数和 `src/bin/harness.ts` binary shim，串联所有模块完成 CLI 核心流程。

#### 输入
- 所有已实现的 CLI 模块（`errors.ts`、`global-options.ts`、`command-registry.ts`、`output.ts`、`interactive.ts`）
- `test/cli/entrypoint.test.ts` 中的 `main()` 测试用例

#### 输出
- `src/cli/main.ts`：CLI 主入口函数
- `src/bin/harness.ts`：binary shim

#### 实现步骤
1. 创建 `src/cli/main.ts`
2. 实现 `main(argv: string[], env: NodeJS.ProcessEnv, io: CliIo): Promise<number>`：
   - 调用 `parseGlobalOptions(argv)` 解析参数
   - 若 command 为空，调用 `runInteractiveEntrypoint(context)`
   - 若 command 非空，调用 `registry.resolve(command)` 获取 handler
   - 未知 command 抛出 `HarnessCliError(1001)`
   - 构造 `CommandContext`（含 `cwd`、`dryRun`、`json`、`noColor`、`io`、`registry`）
   - 调用 `handler.run(context)` 获取 `CliResponse`
   - 调用 `writeCliResponse(response, options)` 输出
   - 返回退出码（`code === 0` 返回 0，其他返回 1）
3. 顶层 try-catch 捕获所有异常，转换为 `CliResponse` 并输出
4. 创建 `src/bin/harness.ts`
5. 添加 shebang `#!/usr/bin/env node`
6. 调用 `main(process.argv.slice(2), process.env, { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin })`
7. 设置 `process.exitCode` 为返回值（不直接调用 `process.exit()`）
8. 运行测试，确保 `main()` 相关测试全部通过（绿灯）

#### 验收标准
- [x] `main()` 无参数时进入交互模式
- [x] `main()` 有已知命令时路由到 handler
- [x] `main()` 有未知命令时返回 code 1001
- [x] `main()` 成功时返回退出码 0
- [x] `main()` 失败时返回非 0 退出码
- [x] `src/bin/harness.ts` 包含 shebang
- [x] `src/bin/harness.ts` 不直接调用 `process.exit()`
- [x] 对应测试用例全部绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（CLI 主入口 - 业务逻辑）、§6.1 核心流程

---

### [TASK-CLI-09] 集成测试

- **类型**: 测试-验证
- **依赖**: TASK-CLI-08
- **状态**: [x] 已完成

#### 任务描述
编写并运行集成测试，验证 CLI 端到端流程：参数解析 → 命令路由 → handler 执行 → 输出格式化。

#### 输入
- 所有已实现的 CLI 模块
- design.md §6.1 核心流程、§8.1 异常分类

#### 输出
- `test/cli/integration.test.ts`：集成测试文件

#### 实现步骤
1. 创建 `test/cli/integration.test.ts`
2. 编写端到端测试场景：
   - `harness status --json`：验证 JSON 输出包含 `code: 0`、`data.command: "status"`
   - `harness --cwd /nonexistent`：验证返回 code 1002
   - `harness unknown-command`：验证返回 code 1001
   - `harness status --dry-run --json`：验证 `dryRun` 透传
   - `harness status --no-color`：验证输出无 ANSI 码
3. 编写交互模式测试（mock `@inquirer/prompts`）：
   - 无参数 + 未初始化：验证进入向导
   - 无参数 + 已初始化：验证进入菜单
4. 编写异常兜底测试：
   - handler 抛出未知异常：验证转换为 code 5001
5. 运行全部测试：`npx vitest run`

#### 验收标准
- [x] 所有集成测试通过（绿灯）
- [x] 所有单元测试通过（绿灯）
- [x] JSON 输出可被 `JSON.parse()` 正确解析
- [x] 错误码与 spec.md §2.1 定义一致
- [x] 测试覆盖率：核心流程分支 ≥ 80%

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程、§6.2 状态机、§8.1 异常分类

---

### [TASK-CLI-10] 构建验证与 Dry-Run

- **类型**: 测试-验证
- **依赖**: TASK-CLI-09
- **状态**: [x] 已完成

#### 任务描述
执行完整构建、lint 检查和 dry-run 验证，确保 CLI 可正常打包和运行。

#### 输入
- 所有已实现的源码和测试
- `package.json` 中的 build/lint scripts

#### 输出
- 构建产物 `dist/bin/harness.js`
- lint 和测试结果报告

#### 实现步骤
1. 运行 `npx tsc --noEmit`：验证无类型错误
2. 运行 `npx vitest run`：验证所有测试通过
3. 运行 lint（`npx eslint src/ test/` 或项目配置的 linter）：验证无错误
4. 运行 `npx tsup`（或 `npm run build`）：生成 `dist/bin/harness.js`
5. 验证构建产物包含 shebang `#!/usr/bin/env node`
6. 运行 `node dist/bin/harness.js status --json`：验证端到端可执行
7. 运行 `node dist/bin/harness.js doctor --json`：验证诊断命令
8. 运行 `npm pack --dry-run`：验证发布包内容不含敏感文件

#### 验收标准
- [x] `npx tsc --noEmit` 无错误
- [x] `npx vitest run` 所有测试通过
- [x] lint 无错误
- [x] `dist/bin/harness.js` 存在且包含 shebang
- [x] `node dist/bin/harness.js status --json` 输出合法 JSON
- [x] `npm pack --dry-run` 不含 `.env`、`*.local.json` 等敏感文件

#### 关联设计
- spec.md 章节：§3 物理约束、§5 安全与合规
- design.md 章节：§7.2 第三方 API/SDK（npm bin）、§9.1 业务配置

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-CLI-04 | 单元测试 | `parseGlobalOptions` 解析 4 个全局参数 | 返回正确的 `GlobalOptions` 对象 |
| TASK-CLI-04 | 单元测试 | `parseGlobalOptions` 非法 `--cwd` | 抛出 `HarnessCliError(1002)` |
| TASK-CLI-04 | 单元测试 | `HarnessCliError` 创建各错误码 | `code`、`msg`、`suggestion` 字段正确 |
| TASK-CLI-04 | 单元测试 | `toCliResponse` 转换已知/未知错误 | 返回正确 `CliResponse` |
| TASK-CLI-05 | 单元测试 | `resolveCommand` 已知命令 | 返回有效 handler |
| TASK-CLI-05 | 单元测试 | `resolveCommand` 未知命令 | 返回 `null` |
| TASK-CLI-05 | 单元测试 | `list()` 命令列表 | 返回 8 个命令 |
| TASK-CLI-06 | 单元测试 | `writeCliResponse` JSON 模式 | stdout 为合法 JSON |
| TASK-CLI-06 | 单元测试 | `writeCliResponse` 人类模式 | stdout 包含摘要文本 |
| TASK-CLI-06 | 单元测试 | `writeCliResponse` noColor | 输出无 ANSI 码 |
| TASK-CLI-08 | 单元测试 | `main()` 无参数 | 进入交互模式 |
| TASK-CLI-08 | 单元测试 | `main()` 已知命令 | 路由到 handler |
| TASK-CLI-08 | 单元测试 | `main()` 未知命令 | 返回 code 1001 |
| TASK-CLI-08 | 单元测试 | `main()` 异常兜底 | 返回 code 5001 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| JSON 输出 status | 已初始化项目 | `harness status --json` | stdout 为 `{"code":0,"msg":"success","data":{"command":"status",...}}` |
| 非法路径 | 任意项目 | `harness --cwd /nonexistent` | 退出码非 0，JSON 含 code 1002 |
| 未知命令 | 任意项目 | `harness foobar` | 退出码非 0，JSON 含 code 1001 |
| dry-run 透传 | 已初始化项目 | `harness status --dry-run --json` | `data` 中无实际写入产物 |
| 未初始化向导 | 无 `.harness/` | `npx @hunterzheng/harness` | 进入交互式向导 |
| 已初始化菜单 | 有 `.harness/config/` | `npx @hunterzheng/harness` | 进入操作菜单 |

### 4.3 手动验证清单

- [x] `node dist/bin/harness.js status --json` 输出合法 JSON
- [x] `node dist/bin/harness.js doctor --json` 输出诊断信息
- [x] `node dist/bin/harness.js` 无参数进入交互流程
- [x] `node dist/bin/harness.js unknown-cmd` 显示错误码和修复建议
- [x] `npm pack --dry-run` 不含敏感文件

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | 初始化状态检查和配置读写 |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | dry-run 和安全策略 |
| 各 capability handlers | 其他能力 | 本变更 | ⏳ 待建 | inspect/sync/develop/review/knowledge/status/doctor/config |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | 本地开发环境已满足 |
| npm >= 10.0.0 | 包管理器 | 系统环境 | ✅ 就绪 | 本地开发环境已满足 |
| TypeScript >= 5.0.0 | 开发工具 | npm | ✅ 就绪 | 作为 devDependency 安装 |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | 非 Git 项目允许基础初始化 |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`HarnessCliError`、`CommandRegistry`）
- 方法名：camelCase（`parseGlobalOptions`、`resolveCommand`、`writeCliResponse`）
- 变量名：camelCase（`globalOptions`、`parsedCommand`）
- 常量：UPPER_SNAKE_CASE（`ERROR_CODES`、`ALLOWED_COMMANDS`）
- 文件名：kebab-case（`global-options.ts`、`command-registry.ts`）
- 类型名：PascalCase（`CliResponse`、`GlobalOptions`、`CommandContext`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式，所有导出函数和类型必须有注释
- 异常处理：所有异常统一通过 `HarnessCliError` 体系处理，禁止直接 `process.exit()`
- 模块风格：ESM（`import`/`export`）

### 6.3 日志规范

- 日志级别：人类模式下诊断信息写 `stderr`，结果摘要写 `stdout`
- 日志格式：JSON 模式下所有信息必须进入 `CliResponse` 对象
- 敏感信息处理：禁止输出 `.env`、token、密钥等敏感内容

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `package.json` | npm 包配置 | TASK-CLI-01 |
| `tsconfig.json` | TypeScript 配置 | TASK-CLI-01 |
| `src/cli/types.ts` | 共享类型定义 | TASK-CLI-02 |
| `src/cli/errors.ts` | 错误体系 | TASK-CLI-04 |
| `src/cli/global-options.ts` | 全局参数解析 | TASK-CLI-04 |
| `src/cli/command-registry.ts` | 命令注册表 | TASK-CLI-05 |
| `src/cli/output.ts` | 输出适配 | TASK-CLI-06 |
| `src/cli/interactive.ts` | 交互式入口 | TASK-CLI-07 |
| `src/cli/main.ts` | CLI 主入口 | TASK-CLI-08 |
| `src/bin/harness.ts` | Binary shim | TASK-CLI-08 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/cli/entrypoint.test.ts` | 单元测试 | TASK-CLI-03, 04, 05, 06, 08 |
| `test/cli/integration.test.ts` | 集成测试 | TASK-CLI-09 |

### 7.3 文档更新

- [x] README 更新（CLI 使用说明）
- [x] 接口文档更新（命令契约）
- [x] 变更日志更新

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
