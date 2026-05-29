# 实施任务拆解 - harness-safety-orchestration

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-safety-orchestration` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-safety-orchestration/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-safety-orchestration/design.md` | 当前能力设计 |

### 1.2 实现范围

- 生成 5 个 Hook 脚本（遵循四条原则）
- 生成 Hook 配置文件（Claude settings.json、Codex hooks.json）
- 生成 22 个 Subagent 定义文件（需求分析 4 + 设计 4 + 代码生成 4 + review 7，Claude .md + Codex .toml）
- 替换阻断列表为需求文档定义的 6 个命令
- 在 `src/cli/main.ts` 集成 dangerous-command CLI 拦截

### 1.3 技术栈

- 语言：TypeScript (ESM) + Bash 脚本
- 依赖：Git >= 2.30.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1 (测试骨架，可并行)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TASK-SO-01   │  │ TASK-SO-02   │  │ TASK-SO-03   │       │
│  │ Hook脚本测试  │  │ Subagent测试 │  │ CLI拦截测试  │       │
│  │ 骨架         │  │ 骨架         │  │ 骨架         │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-SO-04   │  │ TASK-SO-05   │  │ TASK-SO-06   │  ││
│  │  │ Hook脚本生成  │  │ Subagent定义 │  │ 阻断列表+    │  ││
│  │  │ +配置文件    │  │ 文件生成     │  │ CLI拦截      │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 03    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (测试验证)                                   │││
│  │  │  ┌──────────────┐                                   │││
│  │  │  │ TASK-SO-07   │ 依赖: 04,05,06                    │││
│  │  │  │ 测试验证     │                                   │││
│  │  │  └──────────────┘                                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-SO-01, TASK-SO-02, TASK-SO-03 | ✅ 是 | 无 |
| 层级 2 | TASK-SO-04, TASK-SO-05, TASK-SO-06 | ✅ 是 | 层级 1 对应 |
| 层级 3 | TASK-SO-07 | - | TASK-SO-04, 05, 06 |

---

## 3. 原子任务清单

### [TASK-SO-01] 编写 Hook 脚本生成单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 5 个 Hook 脚本生成和 Hook 配置文件创建测试骨架，验证四条原则。

#### 输入
- `src/capabilities/safety/command.ts` 函数签名

#### 输出
- `test/capabilities/safety.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('generateHooks')` 块
2. 编写测试：5 个 Hook 脚本生成到 Claude 和 Codex 路径
3. 编写测试：每个脚本满足四条原则（不做复杂 AI 判断、输出结构化 JSON、不直接修代码、只调用 harness CLI）
4. 编写测试：Claude settings.json 生成正确
5. 编写测试：Codex hooks.json 生成正确
6. 编写测试：dangerous-command.sh 阻断 6 个命令

#### 验收标准
- [ ] 包含 6 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「5 个 Hook 脚本生成」「Hook 四条原则」
- design.md 章节：§4.2 接口 1-2、§6.1

---

### [TASK-SO-02] 编写 Subagent 定义文件生成测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 22 个 Subagent 定义文件生成创建测试骨架。

#### 输入
- `generateSubagentDefs()` 函数签名

#### 输出
- `test/capabilities/safety.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('generateSubagentDefs')` 块
2. 编写测试：需求分析 4 个 agent 文件生成
3. 编写测试：设计 4 个 agent 文件生成
4. 编写测试：代码生成 4 个 agent 文件生成
5. 编写测试：review 7 个 agent 文件生成
6. 编写测试：Claude .md 和 Codex .toml 格式正确

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「Subagent 定义文件生成」
- design.md 章节：§4.2 接口 3、§6.1

---

### [TASK-SO-03] 编写 CLI 拦截和阻断列表测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 dangerous-command CLI 拦截和阻断列表创建测试骨架。

#### 输入
- `src/cli/main.ts` 拦截逻辑

#### 输出
- `test/capabilities/safety.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('CLI dangerous-command 拦截')` 块
2. 编写测试：`rm -rf` 被阻断返回 2801
3. 编写测试：`git reset --hard` 被阻断
4. 编写测试：`git clean -fdx` 被阻断
5. 编写测试：`Remove-Item -Recurse -Force` 被阻断
6. 编写测试：`npm publish` 被阻断
7. 编写测试：`git push --force` 被阻断
8. 编写测试：正常命令放行
9. 编写测试：`safety.dangerousCommandsBlocked=false` 时不拦截

#### 验收标准
- [ ] 包含 8 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「dangerous-command CLI 拦截」「阻断列表」
- design.md 章节：§4.2 接口 4、§6.2

---

### [TASK-SO-04] 实现 5 个 Hook 脚本生成和配置文件

- **类型**: 接口层
- **依赖**: TASK-SO-01
- **状态**: [ ] 未完成

#### 任务描述
在 `safety/command.ts` 中实现 `generateHooks()` 生成 5 个 Hook 脚本；实现 `generateHookConfigs()` 生成 Claude settings.json 和 Codex hooks.json。

#### 输入
- Hook 定义清单和四条原则

#### 输出
- 10 个 Hook 脚本文件（Claude 5 + Codex 5）+ 2 个配置文件

#### 实现步骤
1. 实现 `generateDangerousCommandHook()`：字符串匹配 6 个阻断命令，输出 JSON
2. 实现 `generateSyncAfterDocChangeHook()`：检测文档变更后触发 `harness sync --check`
3. 实现 `generateReviewBeforePushHook()`：push 前触发 `harness review --staged`
4. 实现 `generateSessionSummaryHook()`：会话结束时写入 `.harness/events/`
5. 实现 `generateCompactStateHook()`：压缩前保存状态
6. 每个脚本写入 Claude 和 Codex 两个路径
7. 生成 Claude `settings.json`（PreToolUse/PostToolUse hooks）
8. 生成 Codex `hooks.json`

#### 验收标准
- [ ] 5 个 Hook 脚本 × 2 个路径 = 10 个文件
- [ ] 2 个配置文件生成正确
- [ ] 所有脚本满足四条原则
- [ ] TASK-SO-01 测试通过

#### 关联设计
- spec.md 章节：需求项「5 个 Hook 脚本生成」「Hook 四条原则」
- design.md 章节：§4.2 接口 1-2、§6.1

---

### [TASK-SO-05] 实现 22 个 Subagent 定义文件生成

- **类型**: 接口层
- **依赖**: TASK-SO-02
- **状态**: [ ] 未完成

#### 任务描述
在 `safety/command.ts` 中实现 `generateSubagentDefs()` 生成 22 个 Subagent 定义文件。

#### 输入
- Subagent 清单（4+4+4+7）

#### 输出
- 44 个文件（Claude .md × 22 + Codex .toml × 22）

#### 实现步骤
1. 定义 22 个 agent 清单（名称+类别），注意代码生成类别使用 `harness-impl-contract-validator`（避免与设计类别的 `harness-contract-validator` 重名）
2. 实现 `generateAgentMarkdown(agent)` 生成 Claude .md 格式
3. 实现 `generateAgentToml(agent)` 生成 Codex .toml 格式
4. 写入 `.harness/adapters/claude/agents/<name>.md`
5. 写入 `.harness/adapters/codex/agents/<name>.toml`

#### 验收标准
- [ ] 22 个 Claude .md 文件生成
- [ ] 22 个 Codex .toml 文件生成
- [ ] 文件格式正确
- [ ] TASK-SO-02 测试通过

#### 关联设计
- spec.md 章节：需求项「Subagent 定义文件生成」
- design.md 章节：§4.2 接口 3、§6.1

---

### [TASK-SO-06] 替换阻断列表并集成 CLI 拦截

- **类型**: 接口层
- **依赖**: TASK-SO-03
- **状态**: [ ] 未完成

#### 任务描述
替换 `DEFAULT_DANGEROUS_COMMANDS` 为需求文档定义的 6 个命令；在 `src/cli/main.ts` 的 `handler.run()` 前添加 dangerous-command 拦截。

#### 输入
- 现有阻断列表

#### 输出
- 替换后的阻断列表 + CLI 拦截逻辑

#### 实现步骤
1. 替换 `BLOCKED_COMMANDS` 为 `['rm -rf', 'git reset --hard', 'git clean -fdx', 'Remove-Item -Recurse -Force', 'npm publish', 'git push --force']`
2. 在 `main.ts` 的 `handler.run()` 前添加 `checkCommandLineSafety()` 调用
3. 从 `harness.config.json` 读取 `safety.dangerousCommandsBlocked` 开关
4. 阻断时返回错误码 2801，跳过 `handler.run()`
5. 实现 `checkCommandLineSafety()` 字符串匹配逻辑

#### 验收标准
- [ ] 6 个命令全部阻断
- [ ] 正常命令放行
- [ ] 开关可配置
- [ ] 阻断返回 2801
- [ ] TASK-SO-03 测试通过

#### 关联设计
- spec.md 章节：需求项「dangerous-command CLI 拦截」「阻断列表」
- design.md 章节：§4.2 接口 4、§6.2

---

### [TASK-SO-07] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-SO-04, TASK-SO-05, TASK-SO-06
- **状态**: [ ] 未完成

#### 任务描述
运行全部 safety 相关测试，确保所有断言通过。

#### 输入
- 层级 1-2 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/safety.test.ts`
3. 修复失败用例

#### 验收标准
- [ ] 全部 19 个测试通过
- [ ] 无 TypeScript 编译错误

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-SO-01 | Hook 生成 | 5 脚本×2 路径+配置+四条原则 | 文件存在、内容正确 |
| TASK-SO-02 | Subagent | 22 agent×2 格式 | 文件存在、格式正确 |
| TASK-SO-03 | CLI 拦截 | 6 个阻断+放行+开关 | 错误码 2801 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| Hook 安装 | 初始化完成 | 检查 .harness/adapters/ | Hook 脚本存在 |
| 危险命令阻断 | safety 启用 | 执行 rm -rf | 返回 2801 |
| Subagent 生成 | 初始化完成 | 检查 agents/ | 22 个定义文件存在 |

### 4.3 手动验证清单

- [ ] Hook 脚本可执行（`chmod +x`）
- [ ] `rm -rf` 被阻断
- [ ] Subagent 定义文件格式正确

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| harness-workspace-config | 内部模块 | loadHarnessConfig | ✅ 就绪 | |
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| Git >= 2.30.0 | 外部工具 | 系统 | ✅ 就绪 | push Hook 依赖 |

---

## 6. 代码规范

### 6.1 命名规范

- Hook 脚本：kebab-case.sh（如 `dangerous-command.sh`）
- Agent 文件：kebab-case.md/.toml（如 `harness-rules-reviewer.md`）
- 常量名：UPPER_SNAKE_CASE（如 `BLOCKED_COMMANDS`）

### 6.2 代码风格

- 缩进：2 空格（TS）/ 4 空格（Bash）
- 注释：中文注释
- Hook 输出：JSON 格式

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/safety/command.ts` | Hook/Subagent 生成 | TASK-SO-04, TASK-SO-05 |
| `src/cli/main.ts` | CLI 拦截集成 | TASK-SO-06 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/safety.test.ts` | safety 全部测试 | TASK-SO-01~03, TASK-SO-07 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖
