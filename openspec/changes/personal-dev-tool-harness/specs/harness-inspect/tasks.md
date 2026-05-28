# 实施任务拆解 - harness-inspect

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-inspect` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-inspect/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-inspect/design.md` | 当前能力设计 |

### 1.2 实现范围

- Inspect 类型定义（`InspectOptions`、`InspectScope`、`RepoMap`、各类 Fact 类型、`ReviewRequiredItem`）
- 范围解析（`resolveInspectScope()`，路径校验与越界防护）
- 文件遍历器（`walkProjectFiles()`，含 ignore 和 secretPatterns 过滤）
- 4 个 Scanner 插件（build、docs、agent、ci）
- 模块检测器（`detectModules()`，含 confidence 和 REVIEW_REQUIRED）
- 3 个输出写入器（`writeRepoMap()`、`renderModuleMap()`、`renderRulesGenerated()`）
- Inspect 命令 handler（`runInspectCommand()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path` API）
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `Transaction`、`WorkspacePaths`
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型基础                                               │
│  ┌──────────────┐                                                        │
│  │ TASK-IN-01   │                                                        │
│  │ 类型定义      │                                                        │
│  └──────┬───────┘                                                        │
│         │                                                                 │
│         v                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-IN-02  单元测试骨架（依赖: 01）                           │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 核心扫描模块（可并行）                       │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-IN-03   │  │ TASK-IN-04   │  │ TASK-IN-05   │        │   │ │
│  │  │  │ 范围+遍历     │  │ Scanner插件   │  │ 模块检测      │        │   │ │
│  │  │  │ 依赖: 02     │  │ 依赖: 02     │  │ 依赖: 02     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 输出渲染                             │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐                    │   │   │ │
│  │  │  │  │ TASK-IN-06   │  │ TASK-IN-07   │                    │   │   │ │
│  │  │  │  │ RepoMap写入   │  │ MD渲染器      │                    │   │   │ │
│  │  │  │  │ 依赖: 03~05  │  │ 依赖: 03~05  │                    │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘                    │   │   │ │
│  │  │  │         │                 │                             │   │   │ │
│  │  │  │         v                 v                             │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler + 验证            │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-IN-08   │  │ TASK-IN-09   │              │   │   │   │ │
│  │  │  │  │  │ inspect命令   │  │ 集成测试      │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 06,07  │  │ 依赖: 08     │              │   │   │   │ │
│  │  │  │  │  └──────────────┘  └──────────────┘              │   │   │   │ │
│  │  │  │  └──────────────────────────────────────────────────┘   │   │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-IN-01 | - | 无 |
| 层级 2 | TASK-IN-02 | - | 层级 1 |
| 层级 3 | TASK-IN-03, TASK-IN-04, TASK-IN-05 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-IN-06, TASK-IN-07 | ✅ 是 | 层级 3 |
| 层级 5 | TASK-IN-08, TASK-IN-09 | 顺序执行 | 层级 4 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 数据层 | 类型定义 | 共享类型和数据结构 |
| 接口层 | 核心服务模块 | 业务逻辑和接口 |
| 测试-骨架 | 测试类结构 | TDD 前置任务 |
| 测试-验证 | 测试用例实现 | 实现后验证 |

---

### [TASK-IN-01] Inspect 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
定义 inspect 模块共享的 TypeScript 类型，包括 `InspectOptions`、`InspectScope`、`RepoMap`、各类 Fact 类型和 `ReviewRequiredItem`。

#### 输入
- design.md §1.1 字段映射表（22 个字段）、§5.3 RepoMap 核心字段

#### 输出
- `src/capabilities/inspect/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/inspect/types.ts`
2. 定义 `InspectOptions`：`{ full, path, rules, json, dryRun }`
3. 定义 `InspectScope`：`{ full, path, absoluteRoot, absoluteScanRoot }`
4. 定义 `BuildFileFact`：`{ path, type, name, version? }`
5. 定义 `DocumentFact`：`{ path, type, title? }`
6. 定义 `AgentFileFact`：`{ path, tool, type }`
7. 定义 `CiFact`：`{ path, platform, name? }`
8. 定义 `ModuleFact`：`{ name, path, language, buildEntry?, dependencies?, confidence }`
9. 定义 `ReviewRequiredItem`：`{ field, reason, suggestion }`
10. 定义 `RepoMap`：包含 `schemaVersion`、`root`、`languages`、`packageManagers`、`buildFiles`、`docs`、`agentFiles`、`ci`、`modules`、`generatedAt`
11. 定义 `InspectResult`：`{ factsPath, moduleMapPath, rulesPath, scope, reviewRequired }`

#### 验收标准
- [ ] 所有类型与 design.md §1.1 字段追溯表一致
- [ ] `RepoMap` 包含全部 10 个核心字段
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表、§5.3 数据模型

---

### [TASK-IN-02] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-IN-01
- **状态**: [ ] 未完成

#### 任务描述
编写 inspect 模块完整单元测试骨架（红灯状态），覆盖范围解析、文件遍历、scanner、模块检测、输出写入等。

#### 输入
- `src/capabilities/inspect/types.ts`
- design.md §6.1 核心流程、§6.3 关键算法、§8.1 异常分类

#### 输出
- `test/inspect/inspect.test.ts`

#### 实现步骤
1. 创建 `test/inspect/inspect.test.ts`
2. 创建辅助函数：`createTempProject()`（创建含各类文件的临时项目）
3. 编写 `resolveInspectScope` 测试骨架：
   - `should resolve full scope when no path`
   - `should resolve scoped path within cwd`
   - `should reject path outside cwd (2302)`
   - `should reject non-existent path (2301)`
4. 编写 `walkProjectFiles` 测试骨架：
   - `should walk all files in full scan`
   - `should walk only scoped path`
   - `should skip .git and .harness/cache`
   - `should skip files matching secretPatterns`
   - `should not read content of sensitive files`
5. 编写 scanner 测试骨架：
   - `build-scanner: should detect package.json`
   - `build-scanner: should detect pom.xml`
   - `docs-scanner: should detect README.md`
   - `docs-scanner: should detect AGENTS.md, CLAUDE.md`
   - `agent-scanner: should detect .claude/ files`
   - `ci-scanner: should detect .github/workflows/`
6. 编写 `detectModules` 测试骨架：
   - `should detect modules from package.json workspaces`
   - `should detect modules from src/ directories`
   - `should mark uncertain modules as REVIEW_REQUIRED`
7. 编写 `writeRepoMap` / `renderModuleMap` / `renderRulesGenerated` 测试骨架
8. 编写 `runInspectCommand` 测试骨架：
   - `should return factsPath and moduleMapPath`
   - `should return rulesPath when --rules`
   - `should respect dry-run (zero writes)`
   - `should auto-promote to full when no existing facts`
9. 所有测试标记为红灯

#### 验收标准
- [ ] 测试文件可被运行器发现
- [ ] 所有测试处于红灯状态
- [ ] 覆盖 design.md §6.1 核心流程所有分支
- [ ] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

### [TASK-IN-03] 范围解析与文件遍历

- **类型**: 接口层
- **依赖**: TASK-IN-02
- **状态**: [ ] 未完成

#### 任务描述
实现 `resolveInspectScope()` 和 `walkProjectFiles()` 函数，处理扫描范围校验和文件遍历。

#### 输入
- `src/capabilities/inspect/types.ts`
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/scope.ts`
- `src/capabilities/inspect/file-walker.ts`

#### 实现步骤
1. 创建 `src/capabilities/inspect/scope.ts`
2. 实现 `resolveInspectScope(options, workspacePaths): InspectScope`：
   - 规范化 cwd 和 path
   - path 为空时 scanRoot=cwd
   - path 非空时计算 absoluteScanRoot，校验在 cwd 内
   - 越界抛出 2302，不存在抛出 2301
3. 创建 `src/capabilities/inspect/file-walker.ts`
4. 实现 `walkProjectFiles(scope, secretPatterns, ignoredDirs): ScannedFile[]`：
   - 递归遍历 scanRoot 下文件
   - 跳过 `.git`、`.harness/cache` 等默认忽略目录
   - 命中 secretPatterns 时跳过内容读取，只记录统计
   - 返回文件列表（路径、相对路径、大小、是否敏感标记）

#### 验收标准
- [ ] `resolveInspectScope()` 正确校验路径范围
- [ ] 越界路径抛出 2302
- [ ] `walkProjectFiles()` 跳过默认忽略目录
- [ ] `walkProjectFiles()` 跳过敏感文件内容读取
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（限定路径扫描）
- design.md 章节：§4.2 接口 2（范围解析）、§6.3 文件过滤算法

---

### [TASK-IN-04] Scanner 插件实现

- **类型**: 接口层
- **依赖**: TASK-IN-02
- **状态**: [ ] 未完成

#### 任务描述
实现 4 个 Scanner 插件：build-scanner、docs-scanner、agent-scanner、ci-scanner。

#### 输入
- `src/capabilities/inspect/types.ts`
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/scanners/build-scanner.ts`
- `src/capabilities/inspect/scanners/docs-scanner.ts`
- `src/capabilities/inspect/scanners/agent-scanner.ts`
- `src/capabilities/inspect/scanners/ci-scanner.ts`

#### 实现步骤
1. 创建 `build-scanner.ts`：识别 `package.json`、`pom.xml`、`build.gradle`、`Cargo.toml`、`go.mod` 等，输出 `BuildFileFact[]`
2. 创建 `docs-scanner.ts`：识别 `README.md`、`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursorrules` 等，输出 `DocumentFact[]`
3. 创建 `agent-scanner.ts`：识别 `.claude/`、`.agents/`、`.codex/`、`.github/` 下的 skill/agent/hook 文件，输出 `AgentFileFact[]`
4. 创建 `ci-scanner.ts`：识别 `.github/workflows/`、`Jenkinsfile`、`.gitlab-ci.yml` 等，输出 `CiFact[]`
5. 每个 scanner 接收 `ScannedFile[]`，返回对应 Fact 数组

#### 验收标准
- [ ] build-scanner 正确识别 package.json、pom.xml 等
- [ ] docs-scanner 正确识别 README、AGENTS、CLAUDE 等
- [ ] agent-scanner 正确识别 .claude/、.agents/ 等
- [ ] ci-scanner 正确识别 GitHub Actions 等
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（首次全量扫描）
- design.md 章节：§2.2 需新建文件（scanner plugins）

---

### [TASK-IN-05] 模块检测器

- **类型**: 接口层
- **依赖**: TASK-IN-02
- **状态**: [ ] 未完成

#### 任务描述
实现 `detectModules()` 函数，从源码目录、包结构、构建文件推导模块，不确定信息标记 REVIEW_REQUIRED。

#### 输入
- `src/capabilities/inspect/types.ts`
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/module-detector.ts`

#### 实现步骤
1. 创建 `src/capabilities/inspect/module-detector.ts`
2. 实现 `detectModules(files: ScannedFile[], buildFacts: BuildFileFact[]): { modules: ModuleFact[], reviewRequired: ReviewRequiredItem[] }`：
   - 优先从 package.json workspaces、Maven modules 识别模块根
   - 其次从 `src/`、`apps/`、`packages/`、`services/` 识别候选模块
   - 缺少构建文件的模块标记 confidence=`medium`
   - 无法确认语言/入口/依赖的模块生成 `REVIEW_REQUIRED`
3. 返回模块列表和待确认项

#### 验收标准
- [ ] 从 workspaces 正确识别模块
- [ ] 从源码目录识别候选模块
- [ ] 不确定模块标记 REVIEW_REQUIRED
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（生成模块图）
- design.md 章节：§6.3 模块识别算法

---

### [TASK-IN-06] RepoMap 写入器

- **类型**: 接口层
- **依赖**: TASK-IN-03, TASK-IN-04, TASK-IN-05
- **状态**: [ ] 未完成

#### 任务描述
实现 `writeRepoMap()` 函数，将 RepoMap 写入 `.harness/facts/repo-map.json`，含大小控制和 transaction。

#### 输入
- `src/capabilities/inspect/types.ts`
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/repo-map-writer.ts`

#### 实现步骤
1. 创建 `src/capabilities/inspect/repo-map-writer.ts`
2. 实现 `writeRepoMap(repoMap, outputs, dryRun, tx): WriteResult`：
   - 校验 `schemaVersion=1`
   - 序列化后检查大小（≤ 5 MB）
   - 超 5 MB 时调用 `summarizeLargeFacts()` 摘要化
   - `dryRun=true` 时返回 planned artifacts
   - 非 dry-run 时通过 transaction 写入
   - 写入失败返回 2303 并 rollback
3. 实现 `summarizeLargeFacts(repoMap): { summarized: RepoMap, reviewRequired: ReviewRequiredItem[] }`

#### 验收标准
- [ ] 正确写入 repo-map.json
- [ ] dry-run 时零写入
- [ ] 超 5 MB 时摘要化并生成 REVIEW_REQUIRED
- [ ] 写入失败时 rollback
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（机器可读事实契约）
- design.md 章节：§4.2 接口 3（RepoMap 写入）、§6.3 facts 大小控制算法

---

### [TASK-IN-07] Markdown 渲染器

- **类型**: 接口层
- **依赖**: TASK-IN-03, TASK-IN-04, TASK-IN-05
- **状态**: [ ] 未完成

#### 任务描述
实现 `renderModuleMap()` 和 `renderRulesGenerated()` 函数，生成人类可读的 Markdown 输出。

#### 输入
- `src/capabilities/inspect/types.ts`
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/module-map-renderer.ts`
- `src/capabilities/inspect/rules-renderer.ts`

#### 实现步骤
1. 创建 `module-map-renderer.ts`
2. 实现 `renderModuleMap(modules: ModuleFact[]): string`：
   - 生成 Markdown 表格：模块名、路径、语言、构建入口、依赖
   - 按 confidence 排序
3. 创建 `rules-renderer.ts`
4. 实现 `renderRulesGenerated(repoMap, reviewRequired): string`：
   - 生成 agent 规则建议
   - 不确定事实标记 `REVIEW_REQUIRED`
   - 包含生成时间和 Harness 版本

#### 验收标准
- [ ] module-map.md 包含模块名、路径、语言、构建入口
- [ ] rules.generated.md 标记 REVIEW_REQUIRED
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（生成规则建议、生成模块图）
- design.md 章节：§2.2 需新建文件（renderers）

---

### [TASK-IN-08] Inspect 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-IN-06, TASK-IN-07
- **状态**: [ ] 未完成

#### 任务描述
实现 `runInspectCommand()` 函数，串联扫描 pipeline 并输出结果。

#### 输入
- 所有已实现的 inspect 模块
- `test/inspect/inspect.test.ts`

#### 输出
- `src/capabilities/inspect/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/inspect/command.ts`
2. 实现 `runInspectCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 `InspectOptions`（`--full`、`--path`、`--rules`、`--dry-run`、`--json`）
   - 调用 `resolveInspectScope()`
   - 调用 `walkProjectFiles()`
   - 调用 scanner pipeline（build、docs、agent、ci）
   - 调用 `detectModules()`
   - 组装 `RepoMap`
   - 调用 `writeRepoMap()`、`renderModuleMap()`
   - `--rules` 时调用 `renderRulesGenerated()`
   - 首次无 facts 时自动提升为 full scan
   - 返回 `InspectResult`

#### 验收标准
- [ ] 全量扫描生成 factsPath 和 moduleMapPath
- [ ] `--rules` 时生成 rulesPath
- [ ] `--path` 限定扫描范围
- [ ] dry-run 时零写入
- [ ] 首次无 facts 自动提升为 full
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Inspect 命令）、§6.1 核心流程

---

### [TASK-IN-09] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-IN-08
- **状态**: [ ] 未完成

#### 任务描述
编写并运行集成测试，验证 inspect 端到端流程。

#### 输入
- 所有已实现的 inspect 模块

#### 输出
- `test/inspect/inspect-integration.test.ts`

#### 实现步骤
1. 创建 `test/inspect/inspect-integration.test.ts`
2. 编写端到端场景：
   - 全量扫描临时项目 → 验证 repo-map.json 结构
   - 限定路径扫描 → 验证 scope.path
   - `--rules` → 验证 rules.generated.md 生成
   - `--dry-run` → 验证零写入
   - 路径越界 → 验证 2302
   - 敏感文件 → 验证不读取内容
3. 运行全部测试、tsc、lint

#### 验收标准
- [ ] 所有集成测试通过
- [ ] 所有单元测试通过
- [ ] `npx tsc --noEmit` 无错误
- [ ] lint 无错误

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-IN-03 | 单元测试 | 范围解析（full/path/越界/不存在） | 正确 scope 或错误码 |
| TASK-IN-03 | 单元测试 | 文件遍历（full/scoped/ignore/secret） | 文件列表正确 |
| TASK-IN-04 | 单元测试 | 4 个 scanner 识别各类文件 | Fact 数组正确 |
| TASK-IN-05 | 单元测试 | 模块检测（workspaces/src/REVIEW_REQUIRED） | 模块列表正确 |
| TASK-IN-06 | 单元测试 | RepoMap 写入（正常/dry-run/超大/失败） | 写入正确或错误码 |
| TASK-IN-07 | 单元测试 | Markdown 渲染 | 输出格式正确 |
| TASK-IN-08 | 单元测试 | inspect 命令全流程 | CliResponse 正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 全量扫描 | 含多类文件的临时项目 | inspect --full | repo-map.json 含所有字段 |
| 限定路径 | 临时项目 | inspect --path src | scope.path = "src" |
| 规则生成 | 临时项目 | inspect --rules | rules.generated.md 存在 |
| dry-run | 临时项目 | inspect --dry-run | 零写入 |
| 路径越界 | 临时项目 | inspect --path ../outside | 返回 2302 |

### 4.3 手动验证清单

- [ ] `harness inspect --full --json` 输出合法 JSON
- [ ] `harness inspect --path src --json` 限定范围
- [ ] `harness inspect --rules` 生成 rules.generated.md
- [ ] `harness inspect --dry-run` 零写入

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `Transaction`、`WorkspacePaths` |
| `harness-safety-orchestration` | 其他能力 | 本变更 | ⏳ 待建 | secretPatterns |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path |
| Git >= 2.30.0 | 版本控制 | 系统环境 | ✅ 就绪 | git facts |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`BuildScanner`、`ModuleDetector`）
- 方法名：camelCase（`walkProjectFiles`、`detectModules`）
- 文件名：kebab-case（`file-walker.ts`、`module-detector.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2301-2304、5301）

### 6.3 日志规范

- 敏感信息处理：命中 secretPatterns 的文件不读取内容

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/inspect/types.ts` | 共享类型定义 | TASK-IN-01 |
| `src/capabilities/inspect/scope.ts` | 范围解析 | TASK-IN-03 |
| `src/capabilities/inspect/file-walker.ts` | 文件遍历 | TASK-IN-03 |
| `src/capabilities/inspect/scanners/build-scanner.ts` | 构建文件扫描 | TASK-IN-04 |
| `src/capabilities/inspect/scanners/docs-scanner.ts` | 文档扫描 | TASK-IN-04 |
| `src/capabilities/inspect/scanners/agent-scanner.ts` | Agent 文件扫描 | TASK-IN-04 |
| `src/capabilities/inspect/scanners/ci-scanner.ts` | CI 文件扫描 | TASK-IN-04 |
| `src/capabilities/inspect/module-detector.ts` | 模块检测 | TASK-IN-05 |
| `src/capabilities/inspect/repo-map-writer.ts` | RepoMap 写入 | TASK-IN-06 |
| `src/capabilities/inspect/module-map-renderer.ts` | 模块图渲染 | TASK-IN-07 |
| `src/capabilities/inspect/rules-renderer.ts` | 规则渲染 | TASK-IN-07 |
| `src/capabilities/inspect/command.ts` | inspect 命令 handler | TASK-IN-08 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/inspect/inspect.test.ts` | 单元测试 | TASK-IN-02~08 |
| `test/inspect/inspect-integration.test.ts` | 集成测试 | TASK-IN-09 |

### 7.3 文档更新

- [ ] README 更新（inspect 命令说明）
- [ ] 接口文档更新
- [ ] 变更日志更新

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
