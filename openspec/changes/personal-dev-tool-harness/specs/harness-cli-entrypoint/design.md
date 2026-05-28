# 局部技术实现方案 - harness-cli-entrypoint

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **⚠️ 边界声明**：本设计仅服务于当前 Capability，严禁越权设计或覆盖其他模块逻辑。
>
> **【质量红线】专注"本业务如何落地"；严禁写入全局中间件或框架选型；必须为任务拆解提供足够局部细节

---

## 1. 字段完整性追溯表

> **⛔ 核心红线**：用户在 Spec 中输入的所有字段必须在此表中体现，严禁无故丢弃！

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `command` | `ParsedCommand.command` | string | ✅ 保留 | 顶层命令路由字段，保持 spec 枚举约束 |
| 2 | `--cwd` | `GlobalOptions.cwd` | path/string | ✅ 保留 | 所有命令共享的项目根目录输入 |
| 3 | `--dry-run` | `GlobalOptions.dryRun` | boolean | ⚠️ 重命名 | CLI 参数转为 camelCase 内部字段 |
| 4 | `--json` | `GlobalOptions.json` | boolean | ✅ 保留 | 控制 stdout 是否为纯 JSON |
| 5 | `--no-color` | `GlobalOptions.noColor` | boolean | ⚠️ 重命名 | CLI 参数转为 camelCase 内部字段 |
| 6 | `code` | `CliResponse.code` | number | ✅ 保留 | 统一响应码 |
| 7 | `msg` | `CliResponse.msg` | string | ✅ 保留 | 统一响应消息 |
| 8 | `data` | `CliResponse.data` | object/null | ✅ 保留 | 命令业务输出容器 |
| 9 | `warnings` | `CliResponse.warnings` | string[] | ✅ 保留 | 非阻断问题列表 |
| 10 | `artifacts` | `CliArtifact[]` / `data.artifacts` | array | 🔀 合并 | 对外保持 `data.artifacts`，内部抽成 `CliArtifact` 便于所有命令复用 |

**状态说明**：
- ✅ 保留：字段名和类型与用户输入一致
- ⚠️ 重命名：字段重命名（必须说明理由）
- 🔀 合并：多字段合并为一个（必须说明理由）
- ❌ 移除：字段被移除（必须有充分理由且经用户确认）

### 1.2 完整性自检

- **用户输入字段总数**：10 个
- **设计输出字段总数**：10 个
- **差异说明**：`--dry-run` 与 `--no-color` 在内部使用 camelCase；`artifacts` 内部抽象为 `CliArtifact[]`，对外仍位于 `data.artifacts`
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

> **⚠️ 重要**：大多数需求是在已有系统上改造/扩展，不是从零开始。
> AI 无法知道“要改哪里”，如果本 Capability 涉及对现有代码的修改，**请用户补充完整**。
> 纯新建项目可跳过此章节。

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无 | 无 | 无 | 纯新建 | 当前工作区未发现 `package.json`、`src/`、`bin/`、`lib/` 或 `dist`，本 Capability 不修改现有代码 |

**修改类型说明**：
- 扩展逻辑：在现有方法中添加新逻辑分支
- 新增参数：修改方法签名或请求/响应结构
- 重构抽取：抽取公共逻辑为新方法
- 替换实现：用新实现替换原有逻辑

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `package.json` | npm package manifest | 声明 `@hunterzheng/harness` 包名、`bin.harness`、Node 版本、scripts | npm package contract | `bin.harness` 指向构建后的 `dist/bin/harness.js` |
| `src/bin/harness.ts` | Harness binary shim | 捕获进程参数并调用 `main()` | Node executable entry | 只做进程桥接、异常兜底和 `process.exitCode` 设置 |
| `src/cli/main.ts` | `main(argv, env, io)` | CLI 主入口和顶层错误边界 | `CliMain` 函数契约 | 返回数字退出码，不直接散落 `process.exit()` |
| `src/cli/global-options.ts` | `parseGlobalOptions()` | 解析 `--cwd`、`--dry-run`、`--json`、`--no-color` | 参数解析模块 | 产出 `GlobalOptions` 并做路径基础校验 |
| `src/cli/command-registry.ts` | `createCommandRegistry()` / `resolveCommand()` | 注册 8 个顶层命令并完成路由 | capability registry adapter | 当前能力只定义 registry 接口，不实现其他 capability 业务 |
| `src/cli/interactive.ts` | `runInteractiveEntrypoint()` / `runInitWizard()` / `runOperationMenu()` | 无 command 时进入初始化向导或操作菜单 | 终端交互模块 | 根据 `.harness/config/harness.config.json` 是否存在选择流程 |
| `src/cli/output.ts` | `writeCliResponse()` / `formatHumanSummary()` | 统一 JSON 与人类可读输出 | 输出适配模块 | `--json` 模式必须保证 stdout 只有合法 JSON |
| `src/cli/errors.ts` | `HarnessCliError` / `toCliResponse()` | 统一错误码和响应转换 | Error adapter | 覆盖 1001、1002、2001、4001、5001 |
| `src/cli/types.ts` | `ParsedCommand` / `GlobalOptions` / `CliResponse` / `CliArtifact` | CLI 共享类型 | TypeScript type module | 与 spec 字段追溯表保持一致 |
| `test/cli/entrypoint.test.ts` | CLI entrypoint tests | 验证无参数、命令路由、JSON 输出、错误码 | Node test suite | TDD 阶段先写红灯测试 |

### 2.3 现有逻辑约束

> 影响本次设计的现有系统约束（如：已有事务边界、线程模型、日志规范、已有设计模式等）

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 当前仓库偏 SDD 文档工作区 | 未发现现有 npm package 或源码目录 | CLI entrypoint 属于纯新建能力 | 设计以新建 TypeScript npm 包为锚点，后续 task 阶段创建文件 |
| Spec 要求 8 个顶层命令 | 其他 capability 规格已拆分，但本设计不得越权实现 | registry 只能声明 handler 接口和路由边界 | 当前设计不展开其他 command 的业务逻辑 |
| JSON 输出必须纯净 | 机器消费者依赖 stdout 合法 JSON | 日志、提示、warning 必须进入响应对象或 stderr | `writeCliResponse()` 统一控制 stdout/stderr |
| `--dry-run` 全局语义 | 所有写文件命令都必须遵守 | entrypoint 需把 dryRun 传递给 handler | `CommandContext.globalOptions.dryRun` 作为 handler 必填上下文 |
| 未初始化项目也要可运行 | 首次 npx 依赖向导 | command 为空时不能直接报未初始化 | `runInteractiveEntrypoint()` 先判定 initialized 再分流 |

---

## 3. 局部前端设计

> 仅针对当前 Capability 的前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `InitWizardPrompt` | 终端交互容器 | 首次运行时收集目标项目、AI 工具、能力集、项目类型、写入策略、Hook 强度 | `GlobalOptions`、`CommandContext` |
| `OperationMenuPrompt` | 终端交互容器 | 已初始化项目无参数运行时展示 inspect/sync/develop/review/knowledge/status/doctor/config 菜单 | `CommandRegistry` |
| `HumanSummaryView` | 终端展示 | 非 JSON 模式展示命令结果摘要、产物路径、下一步建议 | `CliResponse` |
| `ErrorSummaryView` | 终端展示 | 非 JSON 模式展示错误码、错误消息、修复建议 | `HarnessCliError` |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `selectedCommand` | string/null | `null` | 用户从操作菜单选择命令时更新 |
| `wizardAnswers` | object | `{}` | 用户完成每个初始化向导问题时更新 |
| `isInitialized` | boolean | `false` | 读取 `.harness/config/harness.config.json` 后更新 |
| `outputMode` | `"json" \| "human"` | `"human"` | 解析 `--json` 后更新 |
| `exitCode` | number | `0` | main 完成或捕获错误时更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: npx @hunterzheng/harness` | `InitWizardPrompt` 或 `OperationMenuPrompt` | 本地终端权限 | 无 command 时根据初始化状态分流 |
| `CLI: harness <command>` | 无页面，直接命令 handler | 本地终端权限 | command 存在时绕过交互菜单 |
| `CLI: harness <command> --json` | 无页面，JSON 输出 | 本地终端权限 | stdout 必须只输出 JSON |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 用户启动无参数 npx | `runInteractiveEntrypoint(context)` | `GlobalOptions`、`CommandRegistry` | 未初始化进入向导，已初始化进入菜单 |
| 用户选择菜单命令 | `resolveCommand(selectedCommand)` | `selectedCommand` | 找到 handler 后构造 `CommandContext` 并执行 |
| 用户要求 JSON 输出 | `writeCliResponse(response, { json: true })` | `CliResponse` | stdout 写入 `JSON.stringify(response)` |
| 用户输入非法命令 | `toCliResponse(error)` | `HarnessCliError(1001)` | 返回非 0 exitCode，人类模式输出修复建议 |

---

## 4. 局部后端接口设计

> 仅针对当前 Capability 的接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| CLI 主入口 | `npx @hunterzheng/harness` / `harness` | 本地进程调用 | 解析参数、分流交互入口或命令 handler |
| 命令注册表 | `CommandRegistry.resolve(command)` | 函数调用 | 校验并解析 8 个顶层命令 |
| 输出适配器 | `writeCliResponse(response, options)` | 函数调用 | 统一 JSON 或人类可读输出 |

### 4.2 接口详细设计

#### 接口 1：CLI 主入口

**基本信息**：
- 路径：`CLI: npx @hunterzheng/harness` / `CLI: harness`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地用户权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `command` | string | 否 | 顶层命令名 | 枚举：`inspect`、`sync`、`develop`、`review`、`knowledge`、`status`、`doctor`、`config` |
| `--cwd` | path/string | 否 | 目标项目根目录 | 必须解析为存在目录；默认当前工作目录 |
| `--dry-run` | boolean | 否 | 预览模式 | 默认 `false`；写命令必须透传 |
| `--json` | boolean | 否 | JSON 输出模式 | 默认 `false`；启用后 stdout 必须为合法 JSON |
| `--no-color` | boolean | 否 | 禁用 ANSI 颜色 | 默认 `false`；CI 可强制启用 |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "status",
    "cwd": "E:/repo/demo",
    "status": "ok",
    "artifacts": []
  },
  "warnings": []
}
```

**业务逻辑**：
1. `src/bin/harness.ts` 调用 `main(process.argv.slice(2), process.env, nodeIo)`。
2. `main()` 调用 `parseGlobalOptions()`，解析全局参数和可选 command。
3. 若 command 为空，调用 `runInteractiveEntrypoint()`；该函数检查 `.harness/config/harness.config.json` 是否存在。
4. 若 command 非空，调用 `resolveCommand()` 获取 handler；未知 command 抛出 `HarnessCliError(1001)`。
5. 构造 `CommandContext`，包含 `cwd`、`dryRun`、`json`、`noColor`、`io`、`registry`。
6. handler 返回 `CliResponse`，由 `writeCliResponse()` 输出。
7. 捕获异常并转换为 `CliResponse`；返回对应退出码。

#### 接口 2：命令注册表

**基本信息**：
- 路径：`Function: CommandRegistry.resolve(command)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `command` | string | 是 | 顶层命令名 | 必须在八个顶层命令枚举中 |
| `context` | CommandContext | 是 | 命令上下文 | 必须包含 `globalOptions` 和 `cwd` |

**响应结构**：
```json
{
  "command": "inspect",
  "description": "Scan project structure and generate facts",
  "handlerName": "inspectHandler"
}
```

**业务逻辑**：
1. registry 在 `createCommandRegistry()` 中集中声明命令元数据。
2. 每个命令只暴露 `name`、`description`、`handler`、`requiresInitializedWorkspace`。
3. 本 capability 只定义 registry 和 handler 适配接口，不实现其他 capability 具体业务。

---

## 5. 局部数据模型

> 仅针对当前 Capability 的数据设计，遵循 overview.md 的全局约定

### 5.1 数据表设计

#### 表名：无

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| 无 | 无 | 否 | 无 | 本 Capability 不新增数据库表 | 无 |

**索引设计**：
- 主键索引：无
- 唯一索引：无
- 普通索引：无

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 无 | 无 | 无 | 无 | CLI entrypoint 不引入缓存 |

### 5.3 数据流转图

```
[argv/env/io]
  --> [parseGlobalOptions]
  --> [resolve interactive flow or command handler]
  --> [CliResponse]
  --> [stdout/stderr + exitCode]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[src/bin/harness.ts]
  --> [main(argv, env, io)]
  --> [parseGlobalOptions]
  --> [command empty?]
      --> yes: [runInteractiveEntrypoint]
              --> [isInitialized?]
                  --> yes: [runOperationMenu]
                  --> no:  [runInitWizard]
      --> no:  [resolveCommand]
              --> [build CommandContext]
              --> [handler.run(context)]
  --> [writeCliResponse]
  --> [return exitCode]
```

**Spec 需求项覆盖表**：

| Spec 需求项 | 设计覆盖位置 | 覆盖说明 |
|------------|-------------|---------|
| 统一 CLI 入口 | `src/bin/harness.ts`、`main()`、`runInteractiveEntrypoint()`、`CommandRegistry` | 覆盖 `npx @hunterzheng/harness`、本地 `harness`、无参数向导/菜单、8 个顶层命令路由 |
| 命令参数与输出契约 | `CliResponse`、`writeCliResponse()`、`HarnessCliError`、`toCliResponse()` | 覆盖统一退出码、JSON 输出、人类摘要、错误响应和 warnings/artifacts |
| 全局上下文参数 | `parseGlobalOptions()`、`GlobalOptions`、`CommandContext` | 覆盖 `--cwd`、`--dry-run`、`--json`、`--no-color` 的解析、校验和下游传递 |

### 6.2 状态机（如有）

```
[START]
  -- argv has no command --> [INTERACTIVE_ENTRY]
  -- argv has known command --> [COMMAND_EXECUTION]
  -- argv has unknown command --> [ERROR_1001]

[INTERACTIVE_ENTRY]
  -- config exists --> [OPERATION_MENU]
  -- config missing --> [INIT_WIZARD]

[COMMAND_EXECUTION]
  -- handler success --> [SUCCESS_EXIT_0]
  -- handler returns warning --> [SUCCESS_EXIT_0_WITH_WARNINGS]
  -- handler error --> [ERROR_EXIT_NON_ZERO]
```

### 6.3 关键算法（如有）

**命令解析与输出隔离算法**
1. 先解析全局参数，不提前执行业务 handler。
2. 将 stdout/stderr 抽象为 `io`，便于测试纯 JSON 输出。
3. `--json` 为 true 时，所有 warning、artifact 和修复建议必须进入 `CliResponse`，不得直接写 stdout。
4. 人类模式允许摘要输出到 stdout，诊断细节和 debug 信息写 stderr。
5. exitCode 由 `CliResponse.code` 映射：`code === 0` 返回 0，其他错误码返回 1；未来可扩展专用退出码。

---

## 7. 外部依赖与集成

> **⚠️ 必填**：列出本 Capability 依赖的所有外部系统、服务和基础设施，确保上下游关系透明、可追踪。
> AI 无法自动推断项目的外部依赖，**请用户补充完整**。

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | 本 Capability 不调用远程服务 | 无 | 0 毫秒连接超时 | 无 | 无 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | >= 20.0.0 | 执行 CLI、读取 argv/env/fs | 无 | 无 | 低于版本时阻断执行 |
| npm / npx | >= 10.0.0 | 分发 `@hunterzheng/harness` 与 `harness` bin | npm registry 权限仅发布时需要 | 受 npm registry 策略限制 | 本地运行不需要登录 |
| TypeScript | >= 5.0.0 | 类型检查与构建 | 无 | 无 | 不影响已构建产物运行 |
| Git | >= 2.30.0 | 为 status/inspect/review 等命令提供范围能力 | 本地 Git 权限 | 无 | 非 Git 项目允许基础初始化 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| npm package bin | 暴露 `harness` 命令 | `package.json#bin` | `"harness": "dist/bin/harness.js"` | 构建产物必须带 shebang |
| 本地文件系统 | 判断 `.harness/config/harness.config.json` 是否存在 | Node fs API | `--cwd` 解析后的项目根目录 | 失败映射到 1002 或 2001 |

### 7.4 内部跨模块依赖

> 本 Capability 需要调用项目内其他模块的能力（注意：仅声明依赖，不设计对方逻辑）

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `harness-workspace-config` | `workspaceStatus(cwd)` | `cwd` | initialized 状态与配置路径 | 待建 |
| `harness-safety-orchestration` | `applyGlobalSafety(context)` | `CommandContext` | dry-run、安全策略和事件边界 | 待建 |
| capability handlers | `handler.run(context)` | `CommandContext` | `CliResponse` | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | `NO_COLOR`、`CI` 可影响输出颜色；不要求业务密钥 | 从 `process.env` 读取 |
| 密钥/证书 | 本 Capability 不需要密钥或证书 | 无 |
| 网络策略 | 正常本地执行不需要网络；`npx` 首次下载依赖 npm 网络 | 用户本机 npm 配置 |
| 权限/角色 | 需要读取当前工作目录，初始化时需要写项目文件权限 | 本地用户权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 参数校验异常 | command 不在枚举内、`--cwd` 为空或格式非法 | 抛出 `HarnessCliError(1001)` 或 `HarnessCliError(1002)` | 非 JSON 模式显示错误码与可用命令；JSON 模式返回错误对象 |
| 业务逻辑异常 | 已知命令要求初始化但 `.harness/` 缺失 | 返回 `HarnessCliError(2001)`，建议运行无参数初始化 | 用户看到“未初始化”与下一步 |
| 外部依赖异常 | Node/npm/Git 等依赖不可用或版本过低 | 返回 `HarnessCliError(4001)`，列出依赖名和最低版本 | 用户看到 doctor 建议 |
| 未知执行异常 | handler 抛出非 HarnessCliError | 转换为 `HarnessCliError(5001)`，保留安全摘要 | 用户看到未知错误和报告路径（如有） |
| JSON 污染风险 | `--json` 模式下模块尝试直接写 stdout | 测试中使用 mock io 捕获；运行时由 `writeCliResponse()` 集中输出 | 用户得到合法 JSON，不出现混杂文本 |

### 8.2 重试与降级

- 重试次数：0 次；CLI 入口不自动重试本地参数、路径或依赖错误
- 重试间隔：0 毫秒
- 降级策略：Git 不可用时仅阻断依赖 Git 的命令；基础初始化、status 和 doctor 仍可运行并返回 warning

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 包名 | `package.name` | `@hunterzheng/harness` | npm 分发名称 |
| bin 名称 | `package.bin.harness` | `dist/bin/harness.js` | 本地 `harness` 命令入口 |
| Node 版本 | `package.engines.node` | `>=20.0.0` | 运行时最低版本 |
| 默认 cwd | `global.cwd` | 当前工作目录 | 未传 `--cwd` 时使用 |
| 默认输出模式 | `global.json` | `false` | 默认人类可读摘要 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--dry-run` | 禁止实际写文件，只输出计划或预览 | 关闭 |
| `--json` | 机器可读输出 | 关闭 |
| `--no-color` | 禁用 ANSI 颜色 | 关闭，CI/NO_COLOR 环境可自动开启 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：需修改的文件、类、方法已明确（或确认为纯新建）
> - [x] **现有约束已识别**：影响设计的现有系统约束已列出并有应对策略
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的逻辑
> - [x] **全局遵守**：遵循 overview.md 的数据字典和接口规范
> - [x] 前端设计已完成（组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（表结构、索引、缓存）
> - [x] **外部依赖已明确**：所有外部服务、第三方 API、中间件、跨模块依赖已列出
> - [x] **环境权限已确认**：所需环境变量、密钥、网络策略已说明
> - [x] 异常处理策略已定义（含外部依赖失败的降级方案）
> - [x] 包含足够的局部细节支持任务拆解
