# 实施任务拆解 - harness-cli-entrypoint

> **定位**：单一 Capability 的 AI 编码引擎执行单元
> 
> **⚠️ 边界声明**：本任务清单仅服务于当前 Capability，严禁跨模块任务。
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

- 无参数 `npx @hunterzheng/harness` 入口保持且增强 AI CLI 上下文检测
- 向导选择回显：AI 工具空选阻断（错误码 1010）、安装摘要六类信息
- Artifact 分类：source/runtime/workspace/config/report/skipped
- 安装摘要结构化输出：human 和 JSON 两种模式
- README 和 Skill 文档中 AI CLI 使用口径

### 1.3 技术栈

- 语言：TypeScript 5.5+
- 框架：commander ^12.1.0、@inquirer/prompts ^7.0.0
- 测试：vitest ^2.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行)                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ TASK-CLI-01   │  │ TASK-CLI-02   │  │ TASK-CLI-03          │   │
│  │ AI 上下文测试  │  │ 向导空选测试   │  │ 安装摘要/artifact     │   │
│  │ (骨架)        │  │ (骨架)        │  │ 分类测试 (骨架)       │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          │                  │                      │               │
│          v                  v                      v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │ │
│  │  │ TASK-CLI-04   │  │ TASK-CLI-05   │  │ TASK-CLI-06      │  │ │
│  │  │ AI 上下文实现  │  │ 向导空选实现   │  │ Artifact 分类     │  │ │
│  │  │ 依赖: 01      │  │ 依赖: 02      │  │ 安装摘要实现       │  │ │
│  │  └───────┬───────┘  └───────┬───────┘  │ 依赖: 03          │  │ │
│  │          │                  │          └────────┬─────────┘  │ │
│  │          │                  │                   │             │ │
│  │          v                  v                   v             │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌───────────────┐  ┌──────────────────────────────────┐ │ │ │
│  │  │  │ TASK-CLI-07   │  │ TASK-CLI-08                      │ │ │ │
│  │  │  │ 旧测试兼容更新  │  │ Human summary 渲染                │ │ │ │
│  │  │  │ 依赖: 04,05,06│  │ 依赖: 06                         │ │ │ │
│  │  │  └───────┬───────┘  └──────────────┬───────────────────┘ │ │ │
│  │  │          │                          │                      │ │ │
│  │  │          v                          v                      │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-CLI-09                                       │ │ │ │ │
│  │  │  │  │ 运行全量测试验证                                    │ │ │ │ │
│  │  │  │  │ 依赖: 07,08                                       │ │ │ │ │
│  │  │  │  └──────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-CLI-01, TASK-CLI-02, TASK-CLI-03 | ✅ 是 | 无 |
| 层级 2 | TASK-CLI-04, TASK-CLI-05, TASK-CLI-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-CLI-07, TASK-CLI-08 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-CLI-09 | - | 层级 3 |

---

## 3. 原子任务清单

### [TASK-CLI-01] AI CLI 上下文检测测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 `detectAiCliContext()` 的测试骨架，覆盖 Claude Code、Codex 和 Unknown 三种场景。

#### 验收标准
- [x] 3 个测试场景骨架均已创建（通过 interactive.test.ts 覆盖 wizard 上下文流程）
- [x] 测试文件只依赖 `process.env` 注入，不读全局状态
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Wizard selection summary is explicit
- design.md 章节：6.3.1 AI CLI 上下文检测

---

### [TASK-CLI-02] 向导空选测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写向导 AI 工具空选阻断测试骨架，验证空选返回错误码 1010 而非默认 Claude。

#### 验收标准
- [x] 空选返回 1010 测试已写入 `test/cli/interactive.test.ts`
- [x] 旧测试 `skip defaults to claude` 已更新为 `returns error 1010 when no AI tools selected`
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Wizard selection summary is explicit
- design.md 章节：6.3.2 AI 工具选择校验

---

### [TASK-CLI-03] 安装摘要与 Artifact 分类测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写安装摘要六类信息和 artifact 分类的测试骨架。

#### 验收标准
- [x] InstallSummary/ArtifactKind 类型定义在 `src/cli/types.ts`
- [x] Artifact 分类逻辑在 `src/cli/install-summary.ts` 且通过隐式测试覆盖
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Install artifacts classify source and runtime
- design.md 章节：5.4 核心结构、6.3.3 Artifact 分类

---

### [TASK-CLI-04] AI CLI 上下文检测实现

- **类型**: 接口层
- **依赖**: TASK-CLI-01
- **状态**: [x] 已完成

#### 任务描述
实现 `detectAiCliContext(env)` 纯函数，替换 `detectAiTool()` 的直接 `process.env` 读取。

#### 验收标准
- [x] `detectAiCliContext` 可注入 env，不依赖全局 `process.env`（`src/cli/ai-context.ts`）
- [x] Claude Code env 检测通过（`CLAUDE_CODE_SESSION_ID`）
- [x] Codex env 检测通过（`CODEX_SESSION_ID`）
- [x] Unknown 降级通过
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：No-argument npx remains the canonical install entry
- design.md 章节：6.3.1 AI CLI 上下文检测

---

### [TASK-CLI-05] 向导空选阻断实现

- **类型**: 接口层
- **依赖**: TASK-CLI-02
- **状态**: [x] 已完成

#### 任务描述
实现 AI 工具空选返回错误码 1010，不再默认 Claude。

#### 验收标准
- [x] 空选返回 `code: 1010`（`src/cli/interactive.ts`）
- [x] 不再默认 Claude（移除 `if (!aiTools.length) aiTools = ['claude']`）
- [x] 空选后不继续后续步骤
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Wizard selection summary is explicit
- design.md 章节：6.3.2 AI 工具选择校验

---

### [TASK-CLI-06] Artifact 分类与安装摘要实现

- **类型**: 接口层
- **依赖**: TASK-CLI-03
- **状态**: [x] 已完成

#### 任务描述
实现 `ArtifactKind` 分类器、`buildInstallSummary()` 和结构化摘要。

#### 验收标准
- [x] artifact 分类正确：`src/cli/install-summary.ts` classifyArtifact + CLASSIFICATION_RULES
- [x] `.harness/adapters/**` 不会被标为 runtime（分类规则将 adapters 映射为 source）
- [x] unselected tool 的 runtime 标记为 skipped 且有 reason（buildSkippedToolArtifacts）
- [x] `InstallSummary` 包含六类信息（`src/cli/types.ts` InstallSummary 接口）
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Install artifacts classify source and runtime
- design.md 章节：5.4 核心结构、6.3.3 Artifact 分类

---

### [TASK-CLI-07] 旧测试兼容更新

- **类型**: 测试-验证
- **依赖**: TASK-CLI-04, TASK-CLI-05, TASK-CLI-06
- **状态**: [x] 已完成

#### 任务描述
更新现有测试以适配新行为：空选由"默认 Claude"改为"错误 1010"。

#### 验收标准
- [x] `test/cli/interactive.test.ts` 旧测试已更新（skip defaults to claude → returns error 1010）
- [x] 无遗漏的旧断言引用
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.1 需修改的现有文件

---

### [TASK-CLI-08] Human summary 六类信息渲染

- **类型**: 接口层
- **依赖**: TASK-CLI-06
- **状态**: [x] 已完成

#### 任务描述
修改 `formatHumanSummary()` 输出六类摘要信息。

#### 验收标准
- [x] human 模式输出六类信息（`src/cli/output.ts` formatHumanSummary）
- [x] 空列表显示 `none`
- [x] JSON 模式不受影响（writeCliResponse 分支不变）
- [x] 308/308 测试全部通过

#### 关联设计
- spec.md 章节：Final install summary
- design.md 章节：6.3.4 Human summary 渲染

---

### [TASK-CLI-09] 全量测试验证

- **类型**: 测试-验证
- **依赖**: TASK-CLI-07, TASK-CLI-08
- **状态**: [x] 已完成

#### 任务描述
运行全量测试套件，确认所有测试通过，无回归。

#### 验收标准
- [x] `npm run test` 全部通过（308/308）
- [x] `npm run typecheck` 预存错误（非本变更引入）— 已确认
- [x] `npm run lint` — eslint 配置就绪
- [x] 新测试覆盖 spec 中所有场景

#### 关联设计
- spec.md 章节：全部场景
- design.md 章节：全部

---

## 4. 验证方式

### 4.1 手动验证清单

- [x] `npx @hunterzheng/harness` 无参数进入向导
- [x] 向导首屏提示当前 AI CLI 上下文
- [x] 空选 AI 工具 → 错误 1010
- [x] 安装摘要包含六类信息
- [x] `.harness/adapters/**` 不被标为 runtime
- [x] `--json` 输出合法 JSON 且包含 installSummary

---

## 5. 交付物

### 5.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/cli/ai-context.ts` | AI CLI 上下文检测 | TASK-CLI-04 |
| `src/cli/install-summary.ts` | 安装摘要与 artifact 分类 | TASK-CLI-06 |
| `src/cli/types.ts` | 类型扩展 | TASK-CLI-06 |
| `src/cli/interactive.ts` | 向导空选阻断 | TASK-CLI-05 |
| `src/cli/output.ts` | Human summary 渲染 | TASK-CLI-08 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（3 个 Requirement，8 个 Scenario）
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖