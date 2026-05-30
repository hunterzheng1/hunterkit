# spec.md - 能力规格定义

> **定位**：`harness-cli-argument-and-help-fix` — 修复 CLI 参数透传、help 输出和真实命令路由
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：`harness --help` 输出命令帮助

系统必须在执行 `node dist/bin/harness.js --help` 时有完整的命令帮助输出，而非空或无输出。

##### 场景：无命令时的 help 输出
- **当** 用户执行 `node dist/bin/harness.js --help`
- **预期** 系统必须输出包含 8 个命令列表（inspect/sync/develop/review/knowledge/status/doctor/config）的帮助信息，并展示全局选项（--cwd、--dry-run、--json、--no-color）说明

##### 场景：help 输出完整性
- **当** help 输出展示
- **预期** 每个命令必须包含一行描述文本和是否要求工作空间初始化的标注

##### 场景：help 输出格式
- **当** help 输出到终端
- **预期** 格式必须使用 commander 默认的 Usage/Options/Commands 分节结构，`--json` 时则跳过 help 直接输出命令列表 JSON

#### 需求项：命令级参数透传到 handler

系统必须将命令后的所有参数完整透传到对应 capability handler，不得在路由层丢弃参数。

##### 场景：develop 带参数透传
- **当** 用户执行 `node dist/bin/harness.js develop demo-change --propose --dry-run --json`
- **预期** 系统必须将 `demo-change` 识别为 change 名称，将 `--propose`、`--dry-run`、`--json` 完整透传给 develop handler，handler 能正确解析 change 名称

##### 场景：knowledge 带参数透传
- **当** 用户执行 `node dist/bin/harness.js knowledge --search demo --json`
- **预期** 系统必须将 `--search` 和 `demo` 完整透传给 knowledge handler，handler 能正确解析 query 参数

##### 场景：review 带参数透传
- **当** 用户执行 `node dist/bin/harness.js review --local --no-fix --json`
- **预期** 系统必须将 `--local`、`--no-fix`、`--json` 完整透传给 review handler，handler 能正确解析范围模式

#### 需求项：全局选项和命令参数分离

系统必须正确分离全局选项（--cwd、--dry-run、--json、--no-color）和命令级参数，确保全局选项不被误传给 handler。

##### 场景：全局选项不干扰命令参数
- **当** 用户执行 `node dist/bin/harness.js --dry-run --json review --local --no-fix`
- **预期** `--dry-run` 和 `--json` 必须被全局选项解析器消费，`review` 被识别为命令，`--local` 和 `--no-fix` 必须透传给 review handler

##### 场景：cwd 不影响命令参数
- **当** 用户执行 `node dist/bin/harness.js --cwd /path/to/project review --local`
- **预期** `--cwd` 被全局解析器消费并解析为绝对路径，`review` 和 `--local` 透传给 handler

#### 需求项：未知命令返回错误码并展示帮助

系统必须在用户输入未知命令时返回明确的错误码并展示可用命令建议。

##### 场景：未知命令处理
- **当** 用户执行 `node dist/bin/harness.js unknown-command`
- **预期** 系统必须返回错误码 1001，输出包含 `Unknown command: unknown-command` 的消息，并建议 `Run harness --help for available commands`

##### 场景：空命令进入交互模式
- **当** 用户执行 `node dist/bin/harness.js`（无参数）
- **预期** 系统必须进入交互式向导（未初始化）或操作菜单（已初始化），而非返回空错误

#### 需求项：错误边界不丢弃参数信息

系统必须在顶层错误边界中保留参数信息，确保错误响应包含触发错误的命令和参数。

##### 场景：错误响应包含命令上下文
- **当** handler 执行过程中抛出异常
- **预期** 错误响应必须包含 `command` 字段（指示触发错误的命令名），以及 `args` 字段（指示传入的参数列表）

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: node dist/bin/harness.js <command> [args...]`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 入口契约

```typescript
// main(argv: string[], env: ProcessEnv, io: CliIo): Promise<number>
// 入参：
//   argv — process.argv.slice(2) 的原始字符串数组
//   env  — process.env
//   io   — { stdout, stderr, stdin }
// 返回：exit code（0 = 成功，1 = 失败）
```

#### 参数分离规则

| 规则 | 说明 |
|------|------|
| R1 | `--cwd`、`--dry-run`、`--json`、`--no-color` 为全局选项，由 `parseGlobalOptions()` 消费 |
| R2 | 全局选项后的第一个非选项参数为命令名 |
| R3 | 命令名之后的所有参数（含选项和值）为命令参数，完整透传给 handler |
| R4 | `--help`、`-h` 触发 help 输出（非 JSON 模式） |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 1001 | 未知命令 | 命令名不在已注册 handler 列表 |
| 1002 | 路径不存在 | `--cwd` 指向不存在的目录 |
| 2001 | 需要工作空间初始化 | 命令要求初始化但项目未初始化 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| help 输出渲染 | < 100 毫秒 (P99) | 命令列表固定 8 个 |
| 参数解析 | < 50 毫秒 (P99) | 不涉及 I/O |
| 命令路由 | < 50 毫秒 (P99) | Map 查找 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 64 MB | 解析和路由阶段 |

### 3.3 超时配置
- 无超时要求（解析和路由阶段不涉及时延操作）

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/cli/global-options.ts`：确保 commander 解析全局选项后剩余参数正确分离为命令 + 命令参数
- [ ] `src/cli/main.ts`：确保 `parsedCommand.commandArgs` 或等价的命令参数数组完整透传给 handler context；在 `--help` 触发时输出帮助信息
- [ ] `src/cli/command-registry.ts`：确保命令列表完整且 help 文本一致
- [ ] `src/cli/output.ts`：确保 `--json` 模式下的输出与 `--help` 不冲突

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 框架 | commander | ^12.1.0 | CLI 解析 | 替换为手动 argv 解析 |
| 运行时 | Node.js | >= 20.0.0 | 进程执行 | 阻断 |

### 4.3 数据存储
无新增数据存储。

---

## 5. 安全与合规

### 5.1 权限要求
N/A — 本地 CLI 执行。

### 5.2 数据安全
- 输入清理：命令参数不进行 shell 注入；Node.js 进程隔离提供基本保护

### 5.3 审计要求
- 日志记录：触发的命令名、透传参数计数

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：`main()` 函数签名不变；参数透传不影响现有 handler 接口

### 6.2 数据兼容性
- 数据迁移方案：无
- 回滚策略：Git 版本控制回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（5 个需求项，11 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
> - [x] 若跳过 proposal.md，影响范围已在此补齐（proposal.md 已存在）