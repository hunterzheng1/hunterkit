# 实施任务拆解 - harness-quality-gates-fix

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
| 技术契约 | `specs/harness-quality-gates-fix/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-quality-gates-fix/design.md` | 当前能力设计 |

### 1.2 实现范围

- 安装产物合规性回归测试：Claude 全量、Codex 全量、未选择工具三种 fixture
- Doctor 负例测试：runtime hooks 缺失、stale DocSync docs、incomplete Skill structure
- npm pack 内容验证：包含 adapter 模板
- Published package dogfood 测试

### 1.3 技术栈

- 语言：TypeScript 5.5+
- 测试框架：vitest ^2.0.0
- 包管理：npm >=10.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

> ⚠️ 本能力特殊：所有任务本质上都是测试任务，不存在先写测试骨架再实现的经典 TDD 流程。改为"先构建测试 infrastructure → 写测试用例 → 运行验证 → 修复 → 通过"。

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行)                                            │
│  ┌───────────────────────────────┐  ┌──────────────────────────┐   │
│  │ TASK-QGF-01                   │  │ TASK-QGF-02              │   │
│  │ 安装 Fixture 基础设施          │  │ Doctor 负例 Fixture       │   │
│  │ (临时项目创建/清理工具)         │  │ 基础设施                   │   │
│  └───────────────┬───────────────┘  └──────────────┬───────────┘   │
│                  │                                  │               │
│                  v                                  v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────────────────────┐  ┌──────────────────────┐  │ │
│  │  │ TASK-QGF-03                   │  │ TASK-QGF-04          │  │ │
│  │  │ Claude 全量安装合规测试         │  │ Doctor 负例测试       │  │ │
│  │  │ 依赖: 01                      │  │ 依赖: 02             │  │ │
│  │  └───────────────┬───────────────┘  └──────────┬───────────┘  │ │
│  │                  │                              │               │ │
│  │                  v                              v               │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌───────────────────────────────┐  ┌──────────────────┐ │ │ │
│  │  │  │ TASK-QGF-05                   │  │ TASK-QGF-06      │ │ │ │
│  │  │  │ Codex 全量安装合规测试          │  │ npm pack 验证测试 │ │ │ │
│  │  │  │ 依赖: 01                      │  │ 依赖: 03         │ │ │ │
│  │  │  └───────────────┬───────────────┘  └──────────┬───────┘ │ │ │
│  │  │                  │                              │          │ │ │
│  │  │                  v                              v          │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-QGF-07                                       │ │ │ │ │
│  │  │  │  │ Unselected tool / Dogfood 测试                    │ │ │ │ │
│  │  │  │  │ 依赖: 05,06                                       │ │ │ │ │
│  │  │  │  └──────────────────────┬───────────────────────────┘ │ │ │ │
│  │  │  │                          │                              │ │ │ │
│  │  │  │                          v                              │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  层级 5 (依赖层级 4)                               │ │ │ │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │ │ │ │ │
│  │  │  │  │  │ TASK-QGF-08                                   │ │ │ │ │ │
│  │  │  │  │  │ 全量测试验证 + 修复循环                         │ │ │ │ │ │
│  │  │  │  │  │ 依赖: 07                                     │ │ │ │ │ │
│  │  │  │  │  └──────────────────────────────────────────────┘ │ │ │ │ │
│  │  │  │  └──────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-QGF-01, TASK-QGF-02 | ✅ 是 | 无 |
| 层级 2 | TASK-QGF-03, TASK-QGF-04 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-QGF-05, TASK-QGF-06 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-QGF-07 | - | 层级 3 |
| 层级 5 | TASK-QGF-08 | - | 层级 4 |

---

## 3. 原子任务清单

### [TASK-QGF-01] 安装 Fixture 基础设施

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
构建临时项目 fixture 创建/清理工具，供安装合规测试复用。

#### 实现步骤
1. 在 `test/` 目录下创建 fixture helper 工具
2. 实现 `createTempProject()`：在临时目录创建空项目
3. 实现 `simulateWizard(answers)`：模拟选择 Claude/Codex、capabilities、hookStrength
4. 实现 `cleanupTempProject()`：清理临时文件
5. 编写 fixture 基础测试确认功能可用

#### 验收标准
- [x] 可创建临时项目
- [x] 可模拟完整向导选择
- [x] 可清理临时文件
- [x] fixture helper 函数测试通过

#### 关联设计
- spec.md 章节：Installation artifact compliance tests
- design.md 章节：2.2 测试基础设施

---

### [TASK-QGF-02] Doctor 负例 Fixture 基础设施

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
构建 doctor 负例测试 fixture（故意制造缺陷状态）。

#### 实现步骤
1. 创建 doctor negative fixture 工具
2. 实现 `createMissingRuntimeHooksFixture()`：有 source hooks 但删除 runtime hooks
3. 实现 `createStaleDocSyncDocsFixture()`：AGENTS.md 包含旧 docsync block
4. 实现 `createIncompleteSkillFixture()`：shared skill 目录缺少 SKILL.md
5. 编写 fixture 基础测试确认功能可用

#### 验收标准
- [x] 3 种负例 fixture 可正确创建
- [x] fixture 基础测试通过

#### 关联设计
- spec.md 章节：Doctor negative tests cover real gaps
- design.md 章节：2.2 测试基础设施

---

### [TASK-QGF-03] Claude 全量安装合规测试

- **类型**: 测试-验证
- **依赖**: TASK-QGF-01
- **状态**: [x] 已完成

#### 任务描述
编写 Claude Code 全量安装合规测试（选择全部能力和完整质量门）。

#### 实现步骤
1. 在 `test/adapters/adapter-artifact-compliance.test.ts` 编写 `Claude full install fixture` 测试
2. 模拟选择 Claude Code、inspect/sync/develop/review/knowledge、写入项目配置、完整质量门
3. 断言 `.harness/adapters/shared/skills/harness/SKILL.md` 存在
4. 断言 `.claude/skills/harness/SKILL.md` 存在且内容合规
5. 断言 `.claude/settings.json` 和 `.claude/hooks/` 存在
6. 断言 Harness managed root docs 存在

#### 验收标准
- [x] 所有 Claude 安装产物断言通过
- [x] Skill 源结构合规
- [x] Hook runtime 生成
- [x] 根文档 managed block 存在

#### 关联设计
- spec.md 章节：Claude full install fixture
- design.md 章节：2.1 adapter-artifact-compliance.test.ts

---

### [TASK-QGF-04] Doctor 负例测试

- **类型**: 测试-验证
- **依赖**: TASK-QGF-02
- **状态**: [x] 已完成

#### 任务描述
编写 doctor 负例测试，验证 doctor 能检测真实缺口。

#### 实现步骤
1. 在 `test/commands/doctor-json.test.ts` 编写 3 个负例测试
2. `missing runtime hook`：断言返回非 0，包含 `projection.runtimeHooks` 错误
3. `stale DocSync docs`：断言返回非 0，包含 `managedDocs` 错误
4. `incomplete Skill structure`：断言返回非 0，包含 `skillSource` 错误

#### 验收标准
- [x] 3 个负例测试全部通过
- [x] doctor 非 0 退出码正确
- [x] 每个负例关联正确的诊断项 ID

#### 关联设计
- spec.md 章节：Doctor negative tests cover real gaps
- design.md 章节：2.2 doctor-json.test.ts

---

### [TASK-QGF-05] Codex 全量安装合规测试

- **类型**: 测试-验证
- **依赖**: TASK-QGF-01
- **状态**: [x] 已完成

#### 任务描述
编写 Codex 全量安装合规测试。

#### 实现步骤
1. 在 `test/adapters/adapter-artifact-compliance.test.ts` 编写 `Codex full install fixture` 测试
2. 模拟选择 Codex、inspect/sync/develop/review/knowledge、写入项目配置、完整质量门
3. 断言 `.agents/skills/harness/SKILL.md` 存在
4. 断言 `.agents/skills/harness/agents/openai.yaml` 存在
5. 断言 `.codex/hooks.json` 和 `.codex/hooks/` 存在
6. 断言 `.codex/agents/` 存在（如果 agent 启用）

#### 验收标准
- [x] 所有 Codex 安装产物断言通过
- [x] Skill 源结构合规
- [x] Hook runtime 生成
- [x] Agent 定义合规

#### 关联设计
- spec.md 章节：Codex full install fixture
- design.md 章节：2.1 adapter-artifact-compliance.test.ts

---

### [TASK-QGF-06] npm pack 验证测试

- **类型**: 测试-验证
- **依赖**: TASK-QGF-03
- **状态**: [x] 已完成

#### 任务描述
编写 npm pack 内容验证测试，确保包包含 adapter 模板资源。

#### 实现步骤
1. 在测试中执行 `npm pack --dry-run` 或解析 `package.json` 的 `files` 字段
2. 断言输出包含 Skill/Agent/Hook/managed docs 所需的模板或编译后资源
3. 断言不包含 `.harness/config/*.local.json`
4. 断言包内容不包括测试文件或开发工具

#### 验收标准
- [x] npm pack 包含 adapter 模板资源
- [x] 不泄露 local config
- [x] 不泄露测试文件

#### 关联设计
- spec.md 章节：Packaged npx artifact is verified
- design.md 章节：2.3 现有约束 package files

---

### [TASK-QGF-07] Unselected Tool / Dogfood 测试

- **类型**: 测试-验证
- **依赖**: TASK-QGF-05, TASK-QGF-06
- **状态**: [x] 已完成

#### 任务描述
编写未选择工具场景测试和打包产物 dogfood 测试。

#### 实现步骤
1. 在 `test/adapters/adapter-artifact-compliance.test.ts` 编写 `Unselected tool fixture` 测试
2. 模拟只选择 Claude 不选择 Codex
3. 断言 Codex runtime projection 不存在
4. 断言安装摘要和 config 明确记录 `codex=false`
5. 编写 `Published package dogfood` 测试：使用 `npm pack` 产物在临时项目中初始化
6. 通过 artifact compliance assertions

#### 验收标准
- [x] unselected tool runtime 不生成
- [x] config 记录 codex=false
- [x] 打包产物可完成初始化
- [x] dogfood 测试通过

#### 关联设计
- spec.md 章节：Unselected tool fixture、Published package dogfood
- design.md 章节：2.1 相关测试

---

### [TASK-QGF-08] 全量测试验证 + 修复循环

- **类型**: 测试-验证
- **依赖**: TASK-QGF-07
- **状态**: [x] 已完成

#### 任务描述
运行全量测试，建立修复循环直到全部通过。

#### 实现步骤
1. 运行 `npm run test`
2. 运行 `npm run typecheck`
3. 运行 `npm run lint`
4. 如果测试失败，分析根因 → 修复代码 → 重新运行测试
5. 循环直到全部通过或确认无法修复

#### 验收标准
- [x] `npm run test` 全部通过
- [x] `npm run typecheck` 无错误
- [x] `npm run lint` 无错误
- [x] 所有 8 个 spec Scenario 被测试覆盖

#### 关联设计
- spec.md 章节：全部（3 个 Requirement，8 个 Scenario）

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-QGF-01 | 基础设施 | Fixture | 临时项目创建/清理 |
| TASK-QGF-02 | 基础设施 | 负例 Fixture | 缺陷状态创建 |
| TASK-QGF-03 | 集成测试 | Claude 全量 | 安装产物合规 |
| TASK-QGF-04 | 集成测试 | Doctor 负例 | 缺口检测 |
| TASK-QGF-05 | 集成测试 | Codex 全量 | 安装产物合规 |
| TASK-QGF-06 | 集成测试 | npm pack | 包内容验证 |
| TASK-QGF-07 | 集成测试 | Unselected/Dogfood | 跳选/打包验证 |
| TASK-QGF-08 | 全量测试 | 端到端 | 全部通过 |

---

## 5. 交付物

### 5.1 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/adapters/adapter-artifact-compliance.test.ts` | 安装合规回归测试 | TASK-QGF-03,05,07 |
| `test/commands/doctor-json.test.ts` | Doctor 负例测试 | TASK-QGF-04 |
| `test/helpers/fixture-utils.ts` | Fixture 工具 | TASK-QGF-01,02 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（3 个 Requirement，8 个 Scenario）
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖