# spec.md - 能力规格定义（增量）

> **定位**：`harness-cli-entrypoint` — 入口契约修正，确保 npx/AI 工具 CLI 使用路径、help 输出和命令参数透传一致
> **增量说明**：本文档为对 `openspec/specs/harness-cli-entrypoint/spec.md` 的增量修改
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：dist 入口 help 输出

系统必须确保通过 `node dist/bin/harness.js --help` 有完整的命令帮助，而非无输出或空输出。

##### 场景：dist 入口 help
- **当** 用户执行 `node dist/bin/harness.js --help`
- **预期** 系统必须输出包含 8 个命令列表和全局选项说明的帮助信息，不得出现空输出或 "commander output suppressed" 行为

##### 场景：npx 调用 help
- **当** 用户执行 `npx @hunterzheng/harness --help`
- **预期** 系统必须输出与 `node dist/bin/harness.js --help` 相同的帮助信息

#### 需求项：交互式入口 AI 工具 CLI 口径

系统必须在交互式入口（未初始化向导和已初始化菜单）中明确体现 AI 工具 CLI 使用口径。

##### 场景：向导首屏提示 AI CLI
- **当** 用户在 AI 工具 CLI 中触发 npx 进入向导
- **预期** 向导首屏必须提示 "由 Claude Code / Codex 触发" 或等价说明，让用户知晓当前流程由 AI 工具 CLI 驱动

##### 场景：菜单提示 AI CLI
- **当** 用户在 AI 工具 CLI 中触发 npx 进入操作菜单
- **预期** 菜单必须提示当前操作上下文的 AI 工具类型（通过环境变量或检测）

### 修改需求

#### 需求项：命令级 `--json` 格式化输出

系统必须为每个命令提供命令级 `--json` 格式化输出，确保 stdout 为合法 JSON。

**增量修改**：补充关于 `--help` 与 `--json` 同时出现时的行为。原 spec 未定义此冲突情况。

##### 场景：`--help` 与 `--json` 同时出现（新增）
- **当** 用户执行 `node dist/bin/harness.js --help --json`
- **预期** 系统必须优先输出 JSON（code 0，data.commands 数组），而非 commander 默认帮助文本，确保 stdout 仍为合法 JSON 可用于脚本解析

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 入口补充契约

在原 `openspec/specs/harness-cli-entrypoint/spec.md` 技术契约基础上新增：

| 补充项 | 要求 |
|-------|------|
| dist help | `node dist/bin/harness.js --help` 必须输出完整帮助 |
| --json + --help | 同时出现时优先 JSON 输出，包含 `commands` 数组 |
| AI CLI 感知 | 交互式入口需通过环境变量（`CLAUDE_CODE_SESSION_ID` 等）检测 AI CLI 类型 |

#### 新增错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 1005 | help 输出失败 | dist 入口 help 渲染异常 |

---

## 3. 物理约束

在原 spec 基础上无新增约束。全局选项解析性能仍要求 < 50 毫秒。

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/bin/harness.ts`：入口脚本，确保与 `src/cli/main.ts` 的接口不变
- [ ] `src/cli/main.ts`：在命令路由前增加 help 请求检测；增加 AI CLI 类型环境变量检测
- [ ] `src/cli/global-options.ts`：`--help` 和 `--json` 同时出现时改变输出模式
- [ ] `src/cli/interactive.ts`：向导/菜单增加 AI CLI 上下文提示
- [ ] `src/cli/output.ts`：增加 JSON 格式的 help 输出路径

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 框架 | commander | ^12.1.0 | CLI 解析 | 替换为手动 argv 解析 |
| 运行时 | Node.js | >= 20.0.0 | 进程执行 | 阻断 |

### 4.3 数据存储
无新增。

---

## 5. 安全与合规

无新增安全约束。

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：新增的 `--help --json` 行为向后兼容；`main()` 签名不变

### 6.2 数据兼容性
无新增。

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（2 个新增 + 1 个修改 = 3 个需求项，5 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息