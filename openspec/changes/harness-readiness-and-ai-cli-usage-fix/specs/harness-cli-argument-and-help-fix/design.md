# 局部技术实现方案 - harness-cli-argument-and-help-fix

> **⚠️ 边界声明**：本设计仅服务于 `harness-cli-argument-and-help-fix`，聚焦 CLI 参数透传、help 输出和命令路由修复。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | --help 输出 8 命令列表 | helpText | string | ✅ 保留 | commander 自动生成 |
| 2 | 命令级参数透传（commandArgs） | context.args | string[] | ✅ 保留 | 透传给 handler |
| 3 | 全局选项分离（--cwd/--dry-run/--json/--no-color） | globalOptions | GlobalOptions | ✅ 保留 | parseGlobalOptions 消费 |
| 4 | 未知命令错误码 1001 | error.code | number | ✅ 保留 | HarnessCliError |
| 5 | 空命令进入交互模式 | interactive | CliResponse | ✅ 保留 | runInteractiveEntrypoint |

### 1.2 完整性自检

- **用户输入字段总数**：5 个
- **设计输出字段总数**：5 个
- **差异说明**：无差异
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/cli/main.ts` | - | `main()` | 扩展逻辑 | 增加 help 检测、commandArgs 透传 |
| `src/cli/global-options.ts` | - | `parseGlobalOptions()` | 扩展逻辑 | 提取 commandArgs 数组 |
| `src/cli/types.ts` | - | `CommandContext` | 新增参数 | 增加 `args: string[]` 字段 |
| `src/cli/output.ts` | - | `writeCliResponse()` | 扩展逻辑 | `--help --json` 输出处理 |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| commander 已 suppress output | `configureOutput({ writeOut: () => {} })` | help 输出被抑制 | 在 main() 中检测 `--help` 参数，绕过 commander 直接输出 |
| CommandContext 无 args | context 只有 globalOptions/command/io/registry | 无法透传参数 | 扩展 CommandContext 增加 `args` 字段 |
| parseGlobalOptions 已计算 commandArgs | `parsedCommand.commandArgs` 已存在 | 但 main() 未使用 | 修改 main() 使用此字段透传 |

---

## 3. 局部前端设计

N/A — CLI 工具，无前端组件。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 类型 | 方法 | 说明 |
|---------|------|------|------|
| 参数解析 | CLI 入口 | `parseGlobalOptions(argv)` | 解析全局选项 + 命令 + 命令参数 |
| 命令路由 | CLI 入口 | `registry.resolve(command)` | 查找 handler |
| help 输出 | CLI 入口 | `--help` 检测 | 输出帮助文本或 JSON |

### 4.2 接口详细设计

#### 接口 1：main() 参数透传增强

**当前逻辑**（`src/cli/main.ts`）：
```typescript
// 当前：CommandContext 不含 args
const context: CommandContext = {
  globalOptions,
  command: parsedCommand.command,
  io,
  registry,
};
response = await handler.run(context);
```

**修改后逻辑**：
```typescript
// 修改：CommandContext 包含 commandArgs
const context: CommandContext = {
  globalOptions,
  command: parsedCommand.command,
  io,
  registry,
  args: parsedCommand.commandArgs,  // ← 新增：透传命令参数
};
response = await handler.run(context);
```

#### 接口 2：help 输出检测

```typescript
// main() 开头增加 help 检测
if (argv.includes('--help') || argv.includes('-h')) {
  if (globalOptions.json) {
    // JSON 模式 help
    const commands = registry.list().map(h => ({
      name: h.name,
      description: h.description,
      requiresInitializedWorkspace: h.requiresInitializedWorkspace,
    }));
    writeCliResponse({
      code: 0, msg: 'success',
      data: { commands },
      warnings: [],
    }, { json: true, noColor: true, io });
    return 0;
  }
  // 文本模式 help — 使用 commander help 输出
  // 调用 commander.outputHelp() 或手动构建 help 文本
}
```

#### 接口 3：CommandContext 类型扩展

```typescript
// src/cli/types.ts
export interface CommandContext {
  globalOptions: GlobalOptions;
  command: string;
  io: CliIo;
  registry: CommandRegistry;
  args: string[];  // ← 新增字段
}
```

---

## 5. 局部数据模型

N/A — 参数透传不涉及数据存储。

---

## 6. 模块内部逻辑

### 6.1 核心流程 — 参数分离与透传

```
argv (process.argv.slice(2))
  │
  ├─ parseGlobalOptions(argv)
  │   ├─ commander 消费全局选项（--cwd, --dry-run, --json, --no-color）
  │   ├─ 第一个非选项参数 → command
  │   └─ 剩余参数 → commandArgs[]
  │
  ├─ 检测 --help / -h
  │   ├─ --json 模式 → JSON 命令列表
  │   └─ 文本模式 → commander help 输出
  │
  └─ 正常路由
      ├─ command == null → 交互式入口
      └─ command 非空 → registry.resolve(command)
          └─ handler.run(context)  // context.args = commandArgs
```

### 6.2 关键修改点

```
修改点 1: src/cli/types.ts
  CommandContext 接口 → 增加 args: string[] 字段

修改点 2: src/cli/main.ts (L217-L223)
  context 构造 → 加入 args: parsedCommand.commandArgs

修改点 3: src/cli/main.ts (L163-L165)
  help 检测 → 在 parseGlobalOptions 之后、命令路由之前插入

修改点 4: 各 handler 入口
  将 (context as any).args 改为 context.args
  移除对 any 类型的依赖
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 鉴权方式 | 备注 |
|------|------|------|---------|------|
| commander | ^12.1.0 | CLI 解析框架 | N/A | 当前已使用 |

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `src/cli/global-options.ts` | `parseGlobalOptions(argv)` | 原始 argv | { parsedCommand, globalOptions } | 已有 |
| `src/cli/command-registry.ts` | `registry.resolve(command)` | 命令名 | CommandHandler 或 null | 已有 |
| `src/cli/output.ts` | `writeCliResponse(response, options)` | CliResponse + 输出选项 | 终端输出 / JSON | 已有 |
| 所有 handler | `handler.run(context)` | CommandContext | CliResponse | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Node.js >= 20.0.0 | 运行时 | 用户环境 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 未知命令 | `registry.resolve()` 返回 null | 返回 1001 + 建议 help | "Unknown command: xxx" |
| 路径不存在 | `--cwd` 指向无效路径 | 返回 1002 | "Path does not exist: xxx" |
| 缺少初始化 | 命令需要 workspace 但未初始化 | 返回 2001 | "requires initialized workspace" |
| handler 异常 | handler.run() 抛错 | 顶层 try/catch 返回 5000 系列错误 | 错误摘要 + JSON |

### 8.2 重试与降级

- 参数解析失败不重试（确定性错误）
- commander 异常时降级为手动 argv 解析

---

## 9. 局部配置

无新增配置项。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：4 个文件的 5 个修改点
> - [x] **现有约束已识别**：commander suppress output、context 无 args
> - [x] **字段完整性**：5 输入 → 5 输出，无丢弃
> - [x] **边界遵守**：仅修改 CLI 路由层，不涉及 handler 内部
> - [x] **全局遵守**：与现有 main() 签名兼容
> - [x] 前端设计已完成：N/A
> - [x] 后端接口已完成：3 个接口详细设计
> - [x] 数据模型已完成：N/A
> - [x] **外部依赖已明确**：仅 commander
> - [x] **环境权限已确认**：Node.js >= 20
> - [x] 异常处理策略已定义：4 类异常 + 降级方案
> - [x] 包含足够的局部细节支持任务拆解：核心流程图 + 4 个修改点