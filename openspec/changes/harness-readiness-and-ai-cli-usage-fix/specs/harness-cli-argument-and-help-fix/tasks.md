# 实施任务拆解 - harness-cli-argument-and-help-fix

> **边界声明**：本任务清单仅服务于 CLI 参数透传和 help 输出修复能力。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-cli-argument-and-help-fix/spec.md` | 5 需求项 11 场景 |
| 技术方案 | `specs/harness-cli-argument-and-help-fix/design.md` | 4 文件 4 修改点 |

### 1.2 实现范围

修复 CLI 参数透传和 help 输出，涉及 `main.ts`、`global-options.ts`、`types.ts`、`output.ts`。

### 1.3 技术栈

- TypeScript 5.5+ / Node.js 20+ / commander 12.1

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1 (无依赖):
  [TASK-CLI-01] 编写 CLI 入口集成测试（骨架）

层级 2 (依赖 L1):
  [TASK-CLI-02] 扩展 CommandContext 类型
  [TASK-CLI-03] 实现 help 输出（文本 + JSON 模式）

层级 3 (依赖 L2):
  [TASK-CLI-04] 实现参数透传（commandArgs → handler）
  [TASK-CLI-05] 更新各 handler 的 args 读取方式

层级 4 (依赖 L3):
  [TASK-CLI-06] 运行集成测试验证
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-CLI-01 | - | 无 |
| 层级 2 | TASK-CLI-02, TASK-CLI-03 | ✅ | TASK-CLI-01 |
| 层级 3 | TASK-CLI-04, TASK-CLI-05 | ✅ (之间独立) | TASK-CLI-02 |
| 层级 4 | TASK-CLI-06 | - | TASK-CLI-04, TASK-CLI-05 |

---

## 3. 原子任务清单

### [TASK-CLI-01] 编写 CLI 入口集成测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 编写集成测试，覆盖 --help 输出、命令参数透传、全局选项分离、未知命令错误
- **输入**: spec.md 场景定义
- **输出**: `test/cli-entrypoint.test.ts`

- **实现步骤**:
  1. 创建 `test/cli-entrypoint.test.ts`
  2. 编写 help 输出测试（验证 8 命令列表）
  3. 编写 develop 参数透传测试（change + --propose）
  4. 编写 knowledge 参数透传测试（--search + query）
  5. 编写全局选项分离测试（--dry-run --json 不与命令参数混淆）
  6. 编写未知命令测试（预期 1001 错误码）

- **验收标准**:
  - [ ] 6 个测试用例均以骨架形式存在（预期失败）
  - [ ] 使用 `main(argv, env, io)` 作为测试入口

- **关联设计**: design.md §4 & §6

---

### [TASK-CLI-02] 扩展 CommandContext 类型

- **类型**: 接口层
- **依赖**: TASK-CLI-01
- **状态**: [ ] 未完成

- **任务描述**: 在 `CommandContext` 接口增加 `args: string[]` 字段
- **输入**: `src/cli/types.ts`
- **输出**: 修改后的 `src/cli/types.ts`

- **实现步骤**:
  1. 在 `src/cli/types.ts` 的 `CommandContext` 接口增加 `args: string[]`
  2. 确保该字段为必需（非可选）
  3. 检查 TypeScript 编译

- **验收标准**:
  - [ ] `CommandContext` 含 `args: string[]`
  - [ ] `npm run typecheck -- src/cli/types.ts` 通过

- **关联设计**: design.md §4 接口 3

---

### [TASK-CLI-03] 实现 help 输出

- **类型**: 接口层
- **依赖**: TASK-CLI-01
- **状态**: [ ] 未完成

- **任务描述**: 在 `main()` 中增加 help 检测分支，支持文本和 JSON 两种模式
- **输入**: `src/cli/main.ts`
- **输出**: 修改后的 `src/cli/main.ts`

- **实现步骤**:
  1. 在 `parseGlobalOptions` 之后增加 `isHelp` 检测
  2. `--help --json` → 输出 `{ commands: [...] }` JSON
  3. 纯 `--help` → 输出 8 个命令的帮助文本
  4. 提前 return 0

- **验收标准**:
  - [ ] `node dist/bin/harness.js --help` 有完整输出
  - [ ] `node dist/bin/harness.js --help --json` stdout 为合法 JSON
  - [ ] help 文本包含 8 个命令名称

- **关联设计**: design.md §4.1

---

### [TASK-CLI-04] 实现参数透传

- **类型**: 接口层
- **依赖**: TASK-CLI-02
- **状态**: [ ] 未完成

- **任务描述**: 在 `main()` 中构造 CommandContext 时加入 `parsedCommand.commandArgs`
- **输入**: `src/cli/main.ts`
- **输出**: 修改后的 `src/cli/main.ts`

- **实现步骤**:
  1. 在 context 构造处加入 `args: parsedCommand.commandArgs`
  2. 确保 handler 可从 `context.args` 读取命令参数

- **验收标准**:
  - [ ] `develop demo-change --propose` handler 能获取 `args: ['demo-change', '--propose']`
  - [ ] `knowledge --search demo` handler 能获取 `args: ['--search', 'demo']`

- **关联设计**: design.md §4 接口 1

---

### [TASK-CLI-05] 更新 handler 的 args 读取方式

- **类型**: 接口层
- **依赖**: TASK-CLI-02
- **状态**: [ ] 未完成

- **任务描述**: 将各 handler 中的 `(context as any).args` 改为 `context.args`
- **输入**: `src/capabilities/*/command.ts`、`src/commands/*.ts`
- **输出**: 更新后的 handler 文件

- **实现步骤**:
  1. grep 搜索 `(context as any).args`
  2. 逐文件替换为 `context.args`
  3. 移除不必要的 `as any` 类型断言

- **验收标准**:
  - [ ] 无 handler 使用 `(context as any).args`
  - [ ] `npm run typecheck` 通过

- **关联设计**: design.md §6.2 修改点 4

---

### [TASK-CLI-06] 运行集成测试验证

- **类型**: 测试-验证
- **依赖**: TASK-CLI-04, TASK-CLI-05
- **状态**: [ ] 未完成

- **任务描述**: 运行 TASK-CLI-01 创建的测试，确保全部通过
- **输入**: 测试文件 + 修改后的源码
- **输出**: 6/6 测试通过

- **实现步骤**:
  1. `npm run build`
  2. `npx vitest run test/cli-entrypoint.test.ts`
  3. 修正失败用例

- **验收标准**:
  - [ ] 6 个测试用例全部通过
  - [ ] `npm run typecheck` 通过

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 |
|--------|---------|---------|
| TASK-CLI-01 | 骨架 | help 输出、参数透传、全局选项、未知命令 |
| TASK-CLI-06 | 验证 | 全部场景通过 |

### 4.2 手动验证清单

- [ ] `node dist/bin/harness.js --help` 有输出
- [ ] `node dist/bin/harness.js develop demo --propose --json` 返回合法 JSON 且识别 change
- [ ] `node dist/bin/harness.js knowledge --search demo --json` 返回合法 JSON 且识别 query
- [ ] `node dist/bin/harness.js unknown-cmd` 返回 1001

---

## 5. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/cli/types.ts` | CommandContext 扩展 | TASK-CLI-02 |
| `src/cli/main.ts` | help + 参数透传 | TASK-CLI-03, TASK-CLI-04 |
| `src/capabilities/*/command.ts` | args 读取方式更新 | TASK-CLI-05 |
| `src/commands/*.ts` | args 读取方式更新 | TASK-CLI-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/cli-entrypoint.test.ts` | CLI 入口集成测试 | TASK-CLI-01 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5 分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md（5 需求项 → 6 任务）
> - [x] 任务清单 100% 覆盖 design.md（4 修改点 → 6 任务）
> - [x] 每个任务有验收标准
> - [x] 依赖拓扑已明确
> - [x] 无循环依赖