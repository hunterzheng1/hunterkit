# 实施任务拆解 - harness-adapter-skill-runtime

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
| 技术契约 | `specs/harness-adapter-skill-runtime/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-adapter-skill-runtime/design.md` | 当前能力设计 |

### 1.2 实现范围

- Shared Skill 源结构合规：`SKILL.md`、`references/`、`scripts/`、`assets/`
- AI 工具适配器源树完整：Claude/Codex 工具源目录生成
- 运行时薄投影：只写最小路由 + frontmatter + managed marker
- Agent 定义生成：Claude `.md` 和 Codex `.toml` 质量合规
- Adapter registry 扩展：source/runtime/skipped/agent 维度
- Drift 检测修复：hash 写入、metadata 统一、repair 路径

### 1.3 技术栈

- 语言：TypeScript 5.5+
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
│  │ TASK-ADP-01   │  │ TASK-ADP-02   │  │ TASK-ADP-03          │   │
│  │ Skill 源合规   │  │ 运行时薄投影   │  │ Agent 定义测试        │   │
│  │ 测试 (骨架)    │  │ 测试 (骨架)    │  │ (骨架)               │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          │                  │                      │               │
│          v                  v                      v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │ │
│  │  │ TASK-ADP-04   │  │ TASK-ADP-05   │  │ TASK-ADP-06      │  │ │
│  │  │ Skill 源管理器  │  │ 投影渲染器     │  │ Agent 模板实现    │  │ │
│  │  │ 扩展实现       │  │ 扩展实现       │  │ 依赖: 03         │  │ │
│  │  │ 依赖: 01      │  │ 依赖: 02      │  │                  │  │ │
│  │  └───────┬───────┘  └───────┬───────┘  └────────┬─────────┘  │ │
│  │          │                  │                    │             │ │
│  │          v                  v                    v             │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌───────────────┐  ┌──────────────────────────────────┐ │ │ │
│  │  │  │ TASK-ADP-07   │  │ TASK-ADP-08                      │ │ │ │
│  │  │  │ Registry 扩展  │  │ Drift detector 修复              │ │ │ │
│  │  │  │ 依赖: 04,05   │  │ 依赖: 05                         │ │ │ │
│  │  │  └───────┬───────┘  └──────────────┬───────────────────┘ │ │ │
│  │  │          │                          │                      │ │ │
│  │  │          v                          v                      │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌───────────────┐  ┌──────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-ADP-09   │  │ TASK-ADP-10                  │ │ │ │ │
│  │  │  │  │ Repair 实现   │  │ Artifact plan 实现            │ │ │ │ │
│  │  │  │  │ 依赖: 07,08   │  │ 依赖: 07                     │ │ │ │ │
│  │  │  │  └───────┬───────┘  └──────────────┬───────────────┘ │ │ │ │
│  │  │  │          │                          │                  │ │ │ │
│  │  │  │          v                          v                  │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  层级 5 (依赖层级 4)                               │ │ │ │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │ │ │ │ │
│  │  │  │  │  │ TASK-ADP-11                                   │ │ │ │ │ │
│  │  │  │  │  │ 全量测试验证                                   │ │ │ │ │ │
│  │  │  │  │  │ 依赖: 09,10                                   │ │ │ │ │ │
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
| 层级 1 | TASK-ADP-01, TASK-ADP-02, TASK-ADP-03 | ✅ 是 | 无 |
| 层级 2 | TASK-ADP-04, TASK-ADP-05, TASK-ADP-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-ADP-07, TASK-ADP-08 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-ADP-09, TASK-ADP-10 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-ADP-11 | - | 层级 4 |

---

## 3. 原子任务清单

### [TASK-ADP-01] Skill 源结构合规测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 shared Skill 源树合规测试骨架，验证 `SKILL.md`、`references/`、`scripts/`、`assets/` 生成。

#### 输入
- spec.md 中 Shared Skill source contains standard files 场景
- design.md 中 `skill-source-manifest.ts` 设计

#### 输出
- `test/adapters/adapter-skill-runtime.test.ts` 新增 TASK-ADP-01 测试组
- `test/adapters/adapter-artifact-compliance.test.ts` 新增合规回归测试

#### 实现步骤
1. 新增 `describe('TASK-ADP-01: Shared skill source compliance')` 
2. 编写 `generates SKILL.md for each tool adapter` 测试
3. 编写 `generates references/scripts/assets directories in shared tree` 测试
4. 编写 `tool SKILL.md content describes harness capabilities` 测试
5. 测试通过（实现代码已完成，测试验证通过）

#### 验收标准
- [x] 3 个 shared source 测试已创建并通过
- [x] 测试验证通过（实现代码已完成）

---

### [TASK-ADP-02] 运行时薄投影测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写运行时投影测试骨架，验证 Claude/Codex runtime 只写薄投影，未选择工具不写 runtime。

#### 输入
- spec.md 中 Runtime Skill remains a thin projection 场景
- spec.md 中 Unselected tool runtime is not written 场景

#### 输出
- `test/adapters/adapter-skill-runtime.test.ts` 新增 TASK-ADP-02 测试组
- `test/adapters/adapter-artifact-compliance.test.ts` 新增 unselected tool 合规测试

#### 实现步骤
1. 新增 `describe('TASK-ADP-02: Runtime thin projection')`
2. 编写 `Claude runtime SKILL.md is thin projection` 测试
3. 编写 `Codex runtime SKILL.md is thin projection` 测试
4. 编写 `Codex runtime not written when codex is unselected` 测试
5. 编写 `Unselected tool artifact plan records skipped reason` 测试
6. 测试通过（实现代码已完成，测试验证通过）

#### 验收标准
- [x] 4 个 runtime projection 测试已创建并通过
- [x] 测试验证通过（实现代码已完成）

#### 关联设计
- spec.md 章节：Selected AI tool runtime projection
- design.md 章节：2.1 projection-renderer 修改

---

### [TASK-ADP-03] Agent 定义质量测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 agent 定义测试骨架，验证 frontmatter 完整性、Codex TOML 结构、合规性。

#### 输入
- spec.md 中 Harness agent definitions are guide-quality 场景
- design.md 中 `agent-templates.ts` 设计

#### 输出
- `test/adapters/adapter-skill-runtime.test.ts` 新增 TASK-ADP-03 测试组
- `test/adapters/adapter-artifact-compliance.test.ts` 新增 agent compliance 测试

#### 实现步骤
1. 新增 `describe('TASK-ADP-03: Agent definition quality')`
2. 编写 `Claude agent md has required frontmatter` 测试
3. 编写 `Codex agent TOML has required fields` 测试
4. 编写 `Finding validator agent is actionable` 测试
5. 编写 `Codex finding validator is actionable` 测试
6. 编写 `Agent definitions match between Claude and Codex` 测试
7. 测试通过（实现代码已完成，测试验证通过）

#### 验收标准
- [x] 5 个 agent 测试已创建并通过
- [x] 测试验证通过（实现代码已完成）

#### 关联设计
- spec.md 章节：Harness agent definitions are guide-quality
- design.md 章节：2.2 新建 agent-templates.ts

---

### [TASK-ADP-04] Skill 源管理器扩展实现

- **类型**: 接口层
- **依赖**: TASK-ADP-01
- **状态**: [x] 已完成

#### 任务描述
扩展 `source-manager.ts` 确保 shared 和 tool adapter 源目录生成完整。

#### 输入
- `src/adapters/source-manager.ts` 现有实现

#### 输出
- `src/adapters/source-manager.ts` 修改
- `src/adapters/skill-source-manifest.ts` 新文件

#### 实现步骤
1. 创建 `skill-source-manifest.ts`，定义 shared/tool Skill 源树清单
2. 修改 `ensureSharedSkillSources()`：确保生成 `SKILL.md`、`references/`、`scripts/`、`assets/`
3. 修改 `ensureAdapterSources()`：tool adapter 生成完整源模板
4. 运行 TASK-ADP-01 测试确认通过

#### 验收标准
- [x] shared Skill 源包含 SKILL.md + 3 个目录
- [x] tool adapter 源包含完整资料
- [x] TASK-ADP-01 测试通过

#### 关联设计
- spec.md 章节：Shared Skill source contains standard files
- design.md 章节：2.1 source-manager 修改

---

### [TASK-ADP-05] 投影渲染器扩展实现

- **类型**: 接口层
- **依赖**: TASK-ADP-02
- **状态**: [x] 已完成

#### 任务描述
扩展 `projection-renderer.ts` 实现薄投影渲染、managed marker、source hash、repair command 写入。

#### 输入
- `src/adapters/projection-renderer.ts` 现有实现

#### 输出
- `src/adapters/projection-renderer.ts` 修改
- `src/adapters/metadata.ts` 新文件

#### 实现步骤
1. 创建 `metadata.ts` 实现 `computeSourceHash()` 和 `buildManagedMetadata()`
2. 修改 `renderProjection()`：写入 frontmatter、managed marker、source path、source hash、repairCommand
3. 确保 runtime 内容保持薄投影（路由说明 + frontmatter + CLI 映射）
4. 运行 TASK-ADP-02 测试确认通过

#### 验收标准
- [x] runtime 文件只保留最小路由 + frontmatter + managed marker
- [x] source hash 正确写入
- [x] repairCommand 写入
- [x] TASK-ADP-02 测试通过

#### 关联设计
- spec.md 章节：Runtime Skill remains a thin projection
- design.md 章节：2.1 projection-renderer 修改

---

### [TASK-ADP-06] Agent 模板实现

- **类型**: 接口层
- **依赖**: TASK-ADP-03
- **状态**: [x] 已完成

#### 任务描述
创建 `agent-templates.ts` 生成 Claude `.md` 和 Codex `.toml` agent 定义。

#### 输入
- `src/capabilities/safety/command.ts` 中现有 agent 占位文本

#### 输出
- `src/adapters/agent-templates.ts` 新文件
- `src/capabilities/safety/command.ts` 重构委托

#### 实现步骤
1. 创建 `agent-templates.ts`，实现 `renderClaudeAgent()` 和 `renderCodexAgent()`
2. Claude agent 包含：name、description、tools、职责边界、输入输出格式、禁止事项、触发场景
3. Codex TOML 包含：agent 名称、model/effort、职责说明、工具约束、prompt/body
4. 修改 `safety/command.ts` 的 `generateSubagentDefs()` 委托到新模板
5. 运行 TASK-ADP-03 测试确认通过

#### 验收标准
- [x] Claude agent 包含所有必填字段
- [x] Codex TOML 包含所有必填字段
- [x] Finding validator 描述具体验证证据、文件行号、严重度、置信度
- [x] TASK-ADP-03 测试通过

#### 关联设计
- spec.md 章节：Harness agent definitions are guide-quality
- design.md 章节：2.2 新建 agent-templates.ts

---

### [TASK-ADP-07] Adapter Registry 扩展

- **类型**: 接口层
- **依赖**: TASK-ADP-04, TASK-ADP-05
- **状态**: [x] 已完成

#### 任务描述
扩展 `AdapterRegistryEntry` 支持 source/runtime/skipped/agent 维度和 artifact 分类。

#### 输入
- `src/adapters/registry.ts` 现有实现
- `src/adapters/types.ts` 现有类型

#### 输出
- `src/adapters/types.ts` 修改
- `src/adapters/registry.ts` 修改

#### 实现步骤
1. 扩展 `AdapterRegistryEntry`：增加 artifact kind、source kind、required files、metadata、repairCommand、skipped 状态
2. 扩展 `createAdapterRegistry()`：从单文件 entry 升级为 Skill/metadata/agent projection 清单
3. 保持 `filterByTool()` 兼容
4. 运行相关测试确认

#### 验收标准
- [x] registry entry 支持 source/runtime/skipped 分类
- [x] agent projection 可注册到 registry
- [x] 现有 `filterByTool()` 兼容

#### 关联设计
- spec.md 章节：Adapter repair verifies generated artifacts
- design.md 章节：2.1 registry 修改

---

### [TASK-ADP-08] Drift Detector 修复

- **类型**: 接口层
- **依赖**: TASK-ADP-05
- **状态**: [x] 已完成

#### 任务描述
统一 hash 算法与 metadata 格式，修复 drift detector 误判问题。

#### 输入
- `src/adapters/drift-detector.ts` 现有实现
- `src/adapters/metadata.ts`（TASK-ADP-05 创建）

#### 输出
- `src/adapters/drift-detector.ts` 修改

#### 实现步骤
1. 修改 `checkAdapterDrift()`：使用 `metadata.ts` 的统一 hash 函数
2. 增强 metadata 格式：source hash、managed marker 版本、时间戳
3. 测试 drift 检测正确性

#### 验收标准
- [x] renderer 写入的 hash 与 detector 读取的 hash 一致
- [x] 不再误判所有投影为 drifted
- [x] 手动修改的投影被正确检测为 drift

#### 关联设计
- spec.md 章节：Repair detects stale runtime projection
- design.md 章节：2.3 Drift hash 缺口

---

### [TASK-ADP-09] Repair 实现

- **类型**: 接口层
- **依赖**: TASK-ADP-07, TASK-ADP-08
- **状态**: [x] 已完成

#### 任务描述
实现 adapter repair/reinstall 路径，支持从源重新生成运行时投影。

#### 输入
- `src/commands/config.ts` 中 `handleRepairAdapters()` 现有实现
- TASK-ADP-07 的 registry 扩展

#### 输出
- `src/commands/config.ts` 修改

#### 实现步骤
1. 修改 `handleRepairAdapters()`：读取 config 中选择的工具
2. 支持 `--ai-tools` 显式覆盖
3. 输出 repaired/skipped/conflict 三类结果
4. 保留用户非托管内容（conflict 状态）
5. 运行测试确认

#### 验收标准
- [x] repair 可恢复缺失的 runtime Skill
- [x] repair 可修复 drift 投影
- [x] 用户自定义文件不被覆盖（conflict 提示）
- [x] repair 输出 repaired/skipped/conflict 分类

#### 关联设计
- spec.md 章节：Adapter repair verifies generated artifacts
- design.md 章节：2.1 config.ts 修改

---

### [TASK-ADP-10] Artifact Plan 实现

- **类型**: 接口层
- **依赖**: TASK-ADP-07
- **状态**: [x] 已完成

#### 任务描述
创建 `artifact-plan.ts` 构建 source/runtime/skipped artifact plan，供 init、repair、doctor 复用。

#### 输入
- TASK-ADP-07 的 registry 扩展
- design.md 中 artifact-plan 设计

#### 输出
- `src/adapters/artifact-plan.ts` 新文件

#### 实现步骤
1. 创建 `artifact-plan.ts`，实现 `buildArtifactPlan(config, registry)`
2. 根据 selected tools 和 registry 计算 expected runtime artifacts
3. unselected tools 的 artifact 标记为 skipped
4. 返回 classified artifact plan
5. 运行测试确认

#### 验收标准
- [x] artifact plan 区分 source/runtime/skipped
- [x] unselected tool 的 runtime 标记为 skipped
- [x] init/repair/doctor 可复用

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.2 新建 artifact-plan.ts

---

### [TASK-ADP-11] 全量测试验证

- **类型**: 测试-验证
- **依赖**: TASK-ADP-09, TASK-ADP-10
- **状态**: [x] 已完成

#### 任务描述
运行全量测试，确认所有 adapter 相关测试通过。

#### 输入
- 所有已实现的代码和测试

#### 输出
- 测试报告（全部通过）

#### 实现步骤
1. 运行 `npm run test`
2. 运行 `npm run typecheck`
3. 运行 `npm run lint`
4. 修复任何失败

#### 验收标准
- [x] `npm run test` 全部通过（340/340）
- [x] `npm run typecheck` 无新增错误（4 个预存错误与本次变更无关）
- [x] `npm run lint` 无错误
- [x] 新测试覆盖 spec 中所有 4 个 Requirement、12 个 Scenario

#### 关联设计
- spec.md 章节：全部

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-ADP-01 | 单元测试 | Skill 源结构 | SKILL.md + 3 目录 |
| TASK-ADP-02 | 单元测试 | 运行时薄投影 | 薄投影内容、unselected 不写 |
| TASK-ADP-03 | 单元测试 | Agent 定义 | frontmatter/TOML 完整性 |
| TASK-ADP-04 | 单元测试 | 源管理器 | 完整源树生成 |
| TASK-ADP-05 | 单元测试 | 投影渲染 | hash/marker/thin content |
| TASK-ADP-06 | 单元测试 | Agent 模板 | 必填字段覆盖 |
| TASK-ADP-07 | 单元测试 | Registry | 多维 entry |
| TASK-ADP-08 | 单元测试 | Drift | hash 一致性 |
| TASK-ADP-09 | 单元测试 | Repair | 恢复/冲突/跳过 |
| TASK-ADP-10 | 单元测试 | Artifact plan | 分类正确 |
| TASK-ADP-11 | 全量测试 | 端到端 | 全部通过 |

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| CLI entrypoint | 内部 | harness-cli-entrypoint | ⏳ 等待 | 消费 artifact plan |
| Safety capability | 内部 | harness-safety-orchestration | ⏳ 等待 | agent 模板委托 |

---

## 6. 代码规范

### 6.1 命名规范

- 函数名：camelCase（`renderProjection`、`computeSourceHash`）
- 类型名：PascalCase（`AdapterSourceManifest`、`RuntimeProjection`）
- 文件名：kebab-case（`skill-source-manifest.ts`、`agent-templates.ts`）

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/adapters/skill-source-manifest.ts` | Skill 源树清单 | TASK-ADP-04 |
| `src/adapters/agent-templates.ts` | Agent 定义模板 | TASK-ADP-06 |
| `src/adapters/artifact-plan.ts` | Artifact plan 构建 | TASK-ADP-10 |
| `src/adapters/metadata.ts` | Hash 与 metadata | TASK-ADP-05 |
| `src/adapters/source-manager.ts` | 源管理器扩展 | TASK-ADP-04 |
| `src/adapters/projection-renderer.ts` | 投影渲染器扩展 | TASK-ADP-05 |
| `src/adapters/projection-writer.ts` | 投影写入器扩展 | TASK-ADP-05 |
| `src/adapters/registry.ts` | Registry 扩展 | TASK-ADP-07 |
| `src/adapters/types.ts` | 类型扩展 | TASK-ADP-07 |
| `src/adapters/drift-detector.ts` | Drift 修复 | TASK-ADP-08 |
| `src/commands/config.ts` | Repair 实现 | TASK-ADP-09 |
| `src/capabilities/safety/command.ts` | Agent 委托重构 | TASK-ADP-06 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/adapters/adapter-skill-runtime.test.ts` | 核心测试 | TASK-ADP-01,02,03 |
| `test/adapters/adapter-artifact-compliance.test.ts` | 合规回归测试 | TASK-ADP-11 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（4 个 Requirement，12 个 Scenario）
> - [x] 任务清单 100% 覆盖 design.md 定义（14 个字段映射、14 个修改/新建文件）
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖