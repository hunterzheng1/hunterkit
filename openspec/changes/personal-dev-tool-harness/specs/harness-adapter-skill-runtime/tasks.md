# 实施任务拆解 - harness-adapter-skill-runtime

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-adapter-skill-runtime` Capability，严禁跨模块任务。

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

- Adapter 类型定义（`AdapterTool`、`AdapterSource`、`ProjectionTarget`、`AdapterProjectionStatus`）
- Adapter 注册表（Claude、Codex、Copilot、Cursor 的 source/projection 路径规则）
- Adapter 源模板文件（shared SKILL.md、Claude SKILL.md、Codex SKILL.md、openai.yaml）
- 源管理器（`ensureAdapterSources()`、`readAdapterSource()`）
- 投影渲染器（`renderProjection()`，注入 managed marker、source hash、repair 命令）
- 投影写入器（`planProjectionWrites()`、`applyProjectionWrites()`，含冲突检测和 transaction）
- 漂移检测器（`checkAdapterDrift()`，managed marker + hash 比较）
- Hook 投影规划（`planHookProjection()`）
- 命令 handler（`runRepairAdaptersCommand()`、`collectAdapterDoctorInfo()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path`、`crypto` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`
- 格式：YAML 1.2（模板字符串）、Markdown、JSON
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

| 策略 | 说明 | 拓扑结构 |
|--------|------|------------|
| 测试驱动 | 测试先行 | 测试骨架 → 实现代码 → 测试验证 |

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与注册表基础                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ TASK-AR-01   │  │ TASK-AR-02   │  │ TASK-AR-03   │                    │
│  │ 类型定义      │  │ 注册表       │  │ 源模板文件    │                    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                 │                             │
│         v                 v                 v                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-AR-04  单元测试骨架（依赖: 01, 02, 03）                   │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心模块（可并行）                           │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-AR-05   │  │ TASK-AR-06   │  │ TASK-AR-07   │        │   │ │
│  │  │  │ 源管理器      │  │ 投影渲染器    │  │ 漂移检测器    │        │   │ │
│  │  │  │ 依赖: 04     │  │ 依赖: 04     │  │ 依赖: 04     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 写入与 Hook                         │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐                    │   │   │ │
│  │  │  │  │ TASK-AR-08   │  │ TASK-AR-09   │                    │   │   │ │
│  │  │  │  │ 投影写入器    │  │ Hook投影      │                    │   │   │ │
│  │  │  │  │ 依赖: 05~07  │  │ 依赖: 05~07  │                    │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘                    │   │   │ │
│  │  │  │         │                 │                             │   │   │ │
│  │  │  │         v                 v                             │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler                   │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-AR-10   │  │ TASK-AR-11   │              │   │   │   │ │
│  │  │  │  │  │ repair命令    │  │ doctor采集    │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 08,09  │  │ 依赖: 07     │              │   │   │   │ │
│  │  │  │  │  └──────┬───────┘  └──────┬───────┘              │   │   │   │ │
│  │  │  │  │         │                 │                       │   │   │   │ │
│  │  │  │  │         v                 v                       │   │   │   │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │   │   │   │ │
│  │  │  │  │  │  层级 6 (依赖 L5) - 验证                      │ │   │   │   │ │
│  │  │  │  │  │  ┌──────────────┐                            │ │   │   │   │ │
│  │  │  │  │  │  │ TASK-AR-12   │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 集成测试验证  │                            │ │   │   │   │ │
│  │  │  │  │  │  │ 依赖: 10,11  │                            │ │   │   │   │ │
│  │  │  │  │  │  └──────────────┘                            │ │   │   │   │ │
│  │  │  │  │  └──────────────────────────────────────────────┘ │   │   │   │ │
│  │  │  │  └──────────────────────────────────────────────────┘   │   │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-AR-01, TASK-AR-02, TASK-AR-03 | ✅ 是 | 无 |
| 层级 2 | TASK-AR-04 | - | 层级 1 |
| 层级 3 | TASK-AR-05, TASK-AR-06, TASK-AR-07 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-AR-08, TASK-AR-09 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-AR-10, TASK-AR-11 | ✅ 是 | 层级 4 |
| 层级 6 | TASK-AR-12 | - | 层级 5 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 数据层 | 类型定义 | 共享类型和数据结构 |
| 接口层 | 核心服务模块 | 业务逻辑和接口 |
| 配置 | 模板文件、配置 | 源模板和注册规则 |
| 测试-骨架 | 测试类结构、Mock 设置 | TDD 模式下的测试前置任务 |
| 测试-验证 | 测试用例实现、断言 | 实现后的测试验证任务 |

---

### [TASK-AR-01] Adapter 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
定义 adapter-skill-runtime 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（17 个字段）
- design.md §5.3 文件数据模型

#### 输出
- `src/adapters/types.ts`

#### 实现步骤
1. 创建 `src/adapters/types.ts`
2. 定义 `AdapterTool` 枚举：`"claude" | "codex" | "copilot" | "cursor"`
3. 定义 `AdapterSource`：`{ tool, path, files[] }`
4. 定义 `ProjectionTarget`：`{ tool, path, managedMarker }`
5. 定义 `AdapterProjectionStatus`：`{ tool, sourcePath, projectionPath, status }`，status 枚举 `"synced" | "missing" | "drifted" | "conflict" | "planned"`
6. 定义 `AdapterRepairOptions`：`{ repairAdapters, aiTools, dryRun, json }`
7. 定义 `AdapterRepairResult`：`{ adapters: AdapterProjectionStatus[] }`
8. 定义 `ProjectionOperation`：`{ type, targetPath, content, sourceHash }`
9. 定义 `ProjectionConflict`：`{ path, reason }`
10. 定义 `ProjectionContext`：`{ packageName, repairCommand, sourcePath, sourceHash }`

#### 验收标准
- [x] 所有类型与 design.md §1.1 字段追溯表一致
- [x] `AdapterProjectionStatus.status` 包含 5 个枚举值
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表

---

### [TASK-AR-02] Adapter 注册表

- **类型**: 接口层
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
实现 `createAdapterRegistry()` 函数，注册 Claude、Codex、Copilot、Cursor 的 source/projection 路径规则。

#### 输入
- `src/adapters/types.ts`
- design.md §2.2 `src/adapters/registry.ts`

#### 输出
- `src/adapters/registry.ts`

#### 实现步骤
1. 创建 `src/adapters/registry.ts`
2. 实现 `createAdapterRegistry()` 函数，返回包含 4 个工具规则的注册表
3. Claude 规则：source `.harness/adapters/claude/skills/harness`，projection `.claude/skills/harness`
4. Codex 规则：source `.harness/adapters/codex/skills/harness`，projection `.agents/skills/harness`；额外 metadata `agents/openai.yaml`
5. Copilot 规则：source `.harness/adapters/copilot`，projection `.github/copilot-instructions.md`
6. Cursor 规则：source `.harness/adapters/cursor`，projection `.cursor/rules`
7. 每个规则包含 `tool`、`sourcePath`、`projectionPaths[]`、`requiredFiles[]`
8. 提供 `getAdapterRule(tool)` 和 `listAdapterRules()` 方法

#### 验收标准
- [x] 注册表包含 4 个工具规则
- [x] 每个规则的 source 路径在 `.harness/adapters/**`
- [x] 每个规则的 projection 路径在平台固定识别路径
- [x] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（安装 Claude/Codex Skill）
- design.md 章节：§2.2 `src/adapters/registry.ts`

---

### [TASK-AR-03] Adapter 源模板文件

- **类型**: 配置
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
创建 adapter 源模板文件，作为 source-of-truth 的 Skill 和 metadata 模板。

#### 输入
- design.md §5.3 文件数据模型、§6.3 Skill 内容约束算法

#### 输出
- `.harness/adapters/shared/skills/harness/SKILL.md`
- `.harness/adapters/claude/skills/harness/SKILL.md`
- `.harness/adapters/codex/skills/harness/SKILL.md`
- `.harness/adapters/codex/skills/harness/agents/openai.yaml`

#### 实现步骤
1. 创建 shared SKILL.md：包含 Harness 意图识别、CLI 调用路由说明、报告摘要展示指南；包含 source path 占位符和 repair 命令
2. 创建 Claude SKILL.md：Claude 专用薄投影源，引用 shared 内容，添加 Claude 特定 frontmatter
3. 创建 Codex SKILL.md：Codex 专用薄投影源，引用 shared 内容，添加 Codex 特定 frontmatter
4. 创建 `openai.yaml`：Codex agent metadata，包含 name、description、tools 字段
5. 所有模板不得出现 DocSync、GSD、kld-sdd、kld-review 作为用户命令名
6. 所有模板不得包含 API key、token、RAGFlow 地址

#### 验收标准
- [x] shared SKILL.md 包含意图识别、CLI 路由、报告摘要说明
- [x] 所有模板包含 source path 和 `harness config --repair-adapters` 命令
- [x] 无内部来源项目名作为用户命令
- [x] 无敏感信息（key、token、secret）

#### 关联设计
- spec.md 章节：§1 需求项（单一 Harness Skill、Skill 路由职责边界）
- design.md 章节：§5.3 文件数据模型、§6.3 Skill 内容约束算法

---

### [TASK-AR-04] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-AR-01, TASK-AR-02, TASK-AR-03
- **状态**: [x] 已完成

#### 任务描述
编写 adapter-skill-runtime 模块的完整单元测试骨架（红灯状态）。

#### 输入
- `src/adapters/types.ts`、`src/adapters/registry.ts`
- design.md §6.1 核心流程、§6.2 状态机、§6.3 关键算法、§8.1 异常分类

#### 输出
- `test/adapters/adapter-skill-runtime.test.ts`

#### 实现步骤
1. 创建 `test/adapters/adapter-skill-runtime.test.ts`
2. 创建辅助函数：`createTempProjectWithAdapters()`（创建含 `.harness/adapters/` 的临时项目）
3. 编写 `ensureAdapterSources` 测试骨架：
   - `should create source templates when missing`
   - `should validate existing source templates`
   - `should return 2201 when required template missing`
4. 编写 `renderProjection` 测试骨架：
   - `should inject managed marker and source hash`
   - `should inject source path and repair command`
   - `should not include secret or token values`
   - `should produce minimal routing instructions`
5. 编写 `checkAdapterDrift` 测试骨架：
   - `should return missing when projection absent`
   - `should return synced when hash matches`
   - `should return drifted when hash differs`
   - `should return conflict when unmanaged file exists`
   - `should return conflict when source path mismatch`
6. 编写 `planProjectionWrites` 测试骨架：
   - `should plan writes for missing projections`
   - `should plan writes for drifted projections`
   - `should skip conflict projections`
   - `should respect dry-run (zero writes)`
7. 编写 `runRepairAdaptersCommand` 测试骨架：
   - `should repair all enabled tools`
   - `should filter by --ai-tools`
   - `should return 2203 for unknown tool`
   - `should return 2202 for conflict files`
8. 编写 `collectAdapterDoctorInfo` 测试骨架
9. 所有测试标记为红灯

#### 验收标准
- [x] 测试文件可被运行器发现
- [x] 所有测试处于红灯状态
- [x] 覆盖 design.md §6.2 状态机所有状态
- [x] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§6.2 状态机、§8.1 异常分类

---

### [TASK-AR-05] 源管理器实现

- **类型**: 接口层
- **依赖**: TASK-AR-04
- **状态**: [x] 已完成

#### 任务描述
实现 `ensureAdapterSources()` 和 `readAdapterSource()` 函数，确保 `.harness/adapters/**` 源模板存在。

#### 输入
- `src/adapters/types.ts`、`src/adapters/registry.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/adapters/source-manager.ts`

#### 实现步骤
1. 创建 `src/adapters/source-manager.ts`
2. 实现 `ensureAdapterSources(paths: WorkspacePaths, tools: AdapterTool[], tx: Transaction): void`：
   - 遍历 registry 中指定工具的规则
   - 检查 `.harness/adapters/{tool}/` 是否存在
   - 不存在时从内置模板创建源文件（通过 transaction）
   - 存在时验证必要文件完整性
3. 实现 `readAdapterSource(paths: WorkspacePaths, tool: AdapterTool): AdapterSource | null`：
   - 读取 `.harness/adapters/{tool}/` 下的文件列表
   - 不存在返回 `null`
4. 缺失必要模板时抛出 2201

#### 验收标准
- [x] `ensureAdapterSources()` 创建缺失的源模板
- [x] `ensureAdapterSources()` 验证已有模板完整性
- [x] `readAdapterSource()` 对不存在源返回 `null`
- [x] 缺失必要模板时返回 2201
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（安装 Claude/Codex Skill）
- design.md 章节：§2.2 `src/adapters/source-manager.ts`

---

### [TASK-AR-06] 投影渲染器实现

- **类型**: 接口层
- **依赖**: TASK-AR-04
- **状态**: [x] 已完成

#### 任务描述
实现 `renderProjection()` 函数，将 source 模板渲染成运行时薄投影。

#### 输入
- `src/adapters/types.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/adapters/projection-renderer.ts`

#### 实现步骤
1. 创建 `src/adapters/projection-renderer.ts`
2. 实现 `renderProjection(source: AdapterSource, target: ProjectionTarget, context: ProjectionContext): RenderedProjection`：
   - 读取 source 模板内容
   - 注入 managed marker（`<!-- harness-managed -->`）
   - 注入 source path 注释
   - 注入 source hash（SHA-256）
   - 注入 repair 命令（`harness config --repair-adapters`）
   - 只渲染最小路由说明
3. 实现 `computeSourceHash(content: string): string`：使用 `crypto.createHash('sha256')`
4. 实现 `sanitizeProjectionContent(content: string): string`：
   - 检测并移除 secret/token/key 模式
   - 阻断包含敏感内容的投影
5. 返回 `{ targetPath, content, sourceHash, managed: true }`

#### 验收标准
- [x] 渲染结果包含 managed marker
- [x] 渲染结果包含 source hash
- [x] 渲染结果包含 repair 命令
- [x] 敏感内容被检测并阻断
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 需求项（Skill 路由职责边界）
- design.md 章节：§4.2 接口 3（投影渲染）、§6.3 Skill 内容约束算法

---

### [TASK-AR-07] 漂移检测器实现

- **类型**: 接口层
- **依赖**: TASK-AR-04
- **状态**: [x] 已完成

#### 任务描述
实现 `checkAdapterDrift()` 函数，比较 source hash 和 projection hash 判断同步状态。

#### 输入
- `src/adapters/types.ts`、`src/adapters/registry.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/adapters/drift-detector.ts`

#### 实现步骤
1. 创建 `src/adapters/drift-detector.ts`
2. 实现 `checkAdapterDrift(paths: WorkspacePaths, tool: AdapterTool): AdapterProjectionStatus`：
   - 读取 projection 文件；不存在返回 `missing`
   - 查找 managed marker；不存在且文件存在返回 `conflict`
   - 检查 source path 是否匹配；不匹配返回 `conflict`
   - 计算当前 source hash，与 projection 中记录 hash 比较
   - hash 相同返回 `synced`，不同返回 `drifted`
3. 实现 `checkAllAdapterDrift(paths, tools): AdapterProjectionStatus[]`

#### 验收标准
- [x] projection 不存在时返回 `missing`
- [x] hash 匹配时返回 `synced`
- [x] hash 不同时返回 `drifted`
- [x] 无 managed marker 时返回 `conflict`
- [x] source path 不匹配时返回 `conflict`
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（投影漂移检查）
- design.md 章节：§6.3 Managed projection 判断算法

---

### [TASK-AR-08] 投影写入器实现

- **类型**: 接口层
- **依赖**: TASK-AR-05, TASK-AR-06, TASK-AR-07
- **状态**: [x] 已完成

#### 任务描述
实现 `planProjectionWrites()` 和 `applyProjectionWrites()` 函数，含冲突检测和 transaction 写入。

#### 输入
- `src/adapters/types.ts`、`src/adapters/projection-renderer.ts`、`src/adapters/drift-detector.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/adapters/projection-writer.ts`

#### 实现步骤
1. 创建 `src/adapters/projection-writer.ts`
2. 实现 `planProjectionWrites(paths, tools, options): ProjectionPlan`：
   - 对每个 tool 调用 `checkAdapterDrift()`
   - 对 `missing/drifted` 目标调用 `renderProjection()` 生成 write operation
   - 对 `conflict` 目标只记录冲突，不生成写入
   - 返回 `{ operations, conflicts, dryRun }`
3. 实现 `applyProjectionWrites(plan, tx): AdapterRepairResult`：
   - `dryRun=true` 时返回 planned 状态
   - 非 dry-run 时通过 transaction 执行写入
   - 冲突文件不写入，返回 2202
   - 写入失败时 rollback，返回 5201

#### 验收标准
- [x] `planProjectionWrites()` 为 missing/drifted 生成操作
- [x] `planProjectionWrites()` 跳过 conflict 目标
- [x] `applyProjectionWrites()` dry-run 时零写入
- [x] `applyProjectionWrites()` 通过 transaction 写入
- [x] 冲突时返回 2202
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（修复运行时投影）
- design.md 章节：§6.3 投影写入算法

---

### [TASK-AR-09] Hook 投影规划

- **类型**: 接口层
- **依赖**: TASK-AR-05, TASK-AR-06, TASK-AR-07
- **状态**: [x] 已完成

#### 任务描述
实现 `planHookProjection()` 函数，规划 `.claude/settings.json`、`.codex/hooks.json` 等 Hook 投影。

#### 输入
- `src/adapters/types.ts`、`src/adapters/registry.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/adapters/hook-projection.ts`

#### 实现步骤
1. 创建 `src/adapters/hook-projection.ts`
2. 实现 `planHookProjection(paths, tools): HookProjectionPlan`：
   - 对 Claude 规划 `.claude/settings.json` Hook 配置
   - 对 Codex 规划 `.codex/hooks.json` Hook 配置
   - 校验 Hook 配置必填字段和脚本路径
   - 校验失败返回 2204（不阻断 Skill 投影）
3. Hook 投影失败时标记 warning，不阻断 Skill 投影

#### 验收标准
- [x] 为 Claude 和 Codex 生成 Hook 投影计划
- [x] Hook 配置缺少字段时返回 2204
- [x] Hook 失败不阻断 Skill 投影
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 需求项（Adapter 与 Hook 投影修复）
- design.md 章节：§2.2 `src/adapters/hook-projection.ts`

---

### [TASK-AR-10] repair-adapters 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-AR-08, TASK-AR-09
- **状态**: [x] 已完成

#### 任务描述
实现 `runRepairAdaptersCommand()` 函数，处理 `harness config --repair-adapters`。

#### 输入
- 所有已实现的 adapter 模块
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/commands/config-repair-adapters.ts`

#### 实现步骤
1. 创建 `src/commands/config-repair-adapters.ts`
2. 实现 `runRepairAdaptersCommand(context: CommandContext): Promise<CliResponse>`：
   - 读取 `HarnessConfig.aiTools`
   - 解析 `--ai-tools`；未传时使用配置中启用的工具
   - 未知工具返回 2203
   - 调用 `ensureAdapterSources()`
   - 调用 `planProjectionWrites()`
   - `dryRun=true` 时返回计划
   - 非 dry-run 时调用 `applyProjectionWrites()`
   - 返回 `AdapterRepairResult`

#### 验收标准
- [x] 修复所有启用工具的投影
- [x] `--ai-tools` 过滤目标工具
- [x] 未知工具返回 2203
- [x] dry-run 时零写入
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（修复运行时投影）
- design.md 章节：§4.2 接口 1（Adapter 修复命令）

---

### [TASK-AR-11] doctor adapter 信息采集

- **类型**: 接口层
- **依赖**: TASK-AR-07
- **状态**: [x] 已完成

#### 任务描述
实现 `collectAdapterDoctorInfo()` 函数，为 `harness doctor` 收集 adapter 漂移状态。

#### 输入
- `src/adapters/drift-detector.ts`、`src/adapters/registry.ts`
- `test/adapters/adapter-skill-runtime.test.ts`

#### 输出
- `src/commands/doctor-adapters.ts`

#### 实现步骤
1. 创建 `src/commands/doctor-adapters.ts`
2. 实现 `collectAdapterDoctorInfo(paths, tools): AdapterDoctorInfo`：
   - 对每个启用工具调用 `checkAdapterDrift()`
   - 不写文件，只返回诊断状态
   - 包含 repair 命令提示
3. 返回 `{ adapters: AdapterProjectionStatus[], repairCommand }`

#### 验收标准
- [x] 返回每个工具的 drift/missing/synced/conflict 状态
- [x] 包含 repair 命令
- [x] 不写文件
- [x] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（投影漂移检查）
- design.md 章节：§4.2 接口 2（Adapter 诊断）

---

### [TASK-AR-12] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-AR-10, TASK-AR-11
- **状态**: [x] 已完成

#### 任务描述
编写并运行集成测试，验证 adapter-skill-runtime 端到端流程。

#### 输入
- 所有已实现的 adapter 模块

#### 输出
- `test/adapters/adapter-integration.test.ts`

#### 实现步骤
1. 创建 `test/adapters/adapter-integration.test.ts`
2. 编写端到端场景：
   - 初始化 → 安装 Claude Skill → 验证投影存在且 synced
   - 修改 source → drift 检测 → repair → 验证 synced
   - 创建 unmanaged 文件 → repair → 验证 conflict
   - repair --dry-run → 验证零写入
   - doctor → 验证诊断输出
3. 运行全部测试
4. 运行 `npx tsc --noEmit`
5. 运行 lint

#### 验收标准
- [x] 所有集成测试通过
- [x] 所有单元测试通过
- [x] `npx tsc --noEmit` 无错误
- [x] lint 无错误

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-AR-05 | 单元测试 | 源模板创建/验证 | 模板存在且完整 |
| TASK-AR-06 | 单元测试 | 投影渲染 | managed marker、hash、repair 命令注入 |
| TASK-AR-06 | 单元测试 | 敏感内容阻断 | 包含 token 的模板被拒绝 |
| TASK-AR-07 | 单元测试 | 漂移检测 5 种状态 | 返回正确 status 枚举 |
| TASK-AR-08 | 单元测试 | 投影写入计划/执行 | dry-run 零写入，transaction 写入 |
| TASK-AR-09 | 单元测试 | Hook 投影规划 | 生成计划，失败不阻断 |
| TASK-AR-10 | 单元测试 | repair 命令 | 过滤工具、错误码 |
| TASK-AR-11 | 单元测试 | doctor 采集 | 状态正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| Claude Skill 安装 | 已初始化 | ensureAdapterSources → applyProjectionWrites | `.claude/skills/harness/SKILL.md` 存在 |
| 投影漂移修复 | source 已修改 | checkDrift → repair | 投影更新为 synced |
| 冲突检测 | unmanaged 文件存在 | repair | 返回 2202，不覆盖 |
| dry-run 修复 | 任意 | repair --dry-run | 返回计划，零写入 |
| doctor 诊断 | 任意 | doctor | 输出 adapter 状态 |

### 4.3 手动验证清单

- [x] `harness config --repair-adapters --dry-run` 输出投影计划
- [x] `harness config --repair-adapters` 生成投影文件
- [x] `harness doctor --json` 输出 adapter 漂移状态
- [x] 投影文件包含 managed marker 和 repair 命令

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext`、`CliResponse` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `Transaction`、`WorkspacePaths` |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | safety policy |
| `harness-sync` | 其他能力 | 本变更 | ⏳ 待建 | managed docs 关系 |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/crypto/path |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`AdapterRegistry`、`ProjectionRenderer`）
- 方法名：camelCase（`ensureAdapterSources`、`checkAdapterDrift`）
- 常量：UPPER_SNAKE_CASE（`MANAGED_MARKER_PREFIX`、`ADAPTER_TOOLS`）
- 文件名：kebab-case（`source-manager.ts`、`drift-detector.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2201-2204、5201）
- 模块风格：ESM

### 6.3 日志规范

- 日志级别：诊断信息写 `stderr`
- 敏感信息处理：投影模板不得包含 key/token/secret

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/adapters/types.ts` | 共享类型定义 | TASK-AR-01 |
| `src/adapters/registry.ts` | Adapter 注册表 | TASK-AR-02 |
| `src/adapters/source-manager.ts` | 源管理器 | TASK-AR-05 |
| `src/adapters/projection-renderer.ts` | 投影渲染器 | TASK-AR-06 |
| `src/adapters/drift-detector.ts` | 漂移检测器 | TASK-AR-07 |
| `src/adapters/projection-writer.ts` | 投影写入器 | TASK-AR-08 |
| `src/adapters/hook-projection.ts` | Hook 投影规划 | TASK-AR-09 |
| `src/commands/config-repair-adapters.ts` | repair 命令 handler | TASK-AR-10 |
| `src/commands/doctor-adapters.ts` | doctor 采集器 | TASK-AR-11 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/adapters/adapter-skill-runtime.test.ts` | 单元测试 | TASK-AR-04~11 |
| `test/adapters/adapter-integration.test.ts` | 集成测试 | TASK-AR-12 |

### 7.3 模板文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `.harness/adapters/shared/skills/harness/SKILL.md` | 共享 Skill 源模板 | TASK-AR-03 |
| `.harness/adapters/claude/skills/harness/SKILL.md` | Claude Skill 源模板 | TASK-AR-03 |
| `.harness/adapters/codex/skills/harness/SKILL.md` | Codex Skill 源模板 | TASK-AR-03 |
| `.harness/adapters/codex/skills/harness/agents/openai.yaml` | Codex metadata 源模板 | TASK-AR-03 |

### 7.4 文档更新

- [x] README 更新（adapter 结构说明）
- [x] 接口文档更新（repair-adapters 命令）
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
