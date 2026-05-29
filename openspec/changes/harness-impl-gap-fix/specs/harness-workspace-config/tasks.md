# 实施任务拆解 - harness-workspace-config

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-workspace-config` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-workspace-config/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-workspace-config/design.md` | 当前能力设计 |

### 1.2 实现范围

- 补全 `WorkspacePaths` 新增 `docs`/`rules`/`events` 路径字段
- 补全 `ensureWorkspace()` 约 18 个目录（含子目录）和 3 个初始文件
- 补全 `validateHarnessConfig()` 子字段校验（orchestration/safety/documents）
- 补全 `review.config.json`、`knowledge.config.json`、`*.local.json` 配置 schema

### 1.3 技术栈

- 语言：TypeScript (ESM)
- 框架：无新增
- 依赖：无新增

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1 (测试骨架，可并行)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TASK-WC-01   │  │ TASK-WC-02   │  │ TASK-WC-03   │       │
│  │ 目录创建测试  │  │ 配置校验测试  │  │ 路径解析测试  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码，可并行)                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-WC-04   │  │ TASK-WC-05   │  │ TASK-WC-06   │  ││
│  │  │ 路径+目录扩展 │  │ 配置校验扩展  │  │ 初始文件生成  │  ││
│  │  │ 依赖: 01,03 │  │ 依赖: 02    │  │ 依赖: 04    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         v                 v                 v           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (测试验证)                                   │││
│  │  │  ┌──────────────┐                                   │││
│  │  │  │ TASK-WC-07   │                                   │││
│  │  │  │ 测试验证     │ 依赖: 04,05,06                    │││
│  │  │  └──────────────┘                                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-WC-01, TASK-WC-02, TASK-WC-03 | ✅ 是 | 无 |
| 层级 2 | TASK-WC-04, TASK-WC-05 | ✅ 是 | 层级 1 |
| 层级 2 | TASK-WC-06 | - | TASK-WC-04 |
| 层级 3 | TASK-WC-07 | - | TASK-WC-04, 05, 06 |

---

## 3. 原子任务清单

### [TASK-WC-01] 编写目录创建单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `ensureWorkspace()` 的完整目录创建创建测试骨架，覆盖约 18 个目录和 3 个初始文件。

#### 输入
- `src/core/workspace.ts` 中 `ensureWorkspace()` 的函数签名

#### 输出
- `test/core/workspace.test.ts` 中追加测试用例

#### 实现步骤
1. 追加 `describe('ensureWorkspace 完整目录')` 块
2. 编写测试：验证所有目录创建（含 docs/adr/architecture/decisions、rules、adapters 子目录等）
3. 编写测试：验证 rules/ 下 3 个初始文件内容
4. 编写测试：幂等性（重复调用不报错）

#### 验收标准
- [ ] 包含 3 个测试用例骨架
- [ ] 覆盖目录清单和初始文件

#### 关联设计
- spec.md 章节：需求项「完整目录结构创建」
- design.md 章节：§4.2 接口 1

---

### [TASK-WC-02] 编写配置校验单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `validateHarnessConfig()` 的子字段校验创建测试骨架。

#### 输入
- `src/core/config-schema.ts` 中 `validateHarnessConfig()` 的函数签名

#### 输出
- `test/core/config-schema.test.ts` 中追加测试用例

#### 实现步骤
1. 追加 `describe('配置子字段校验')` 块
2. 编写测试：`orchestration.subagents/maxParallelAgents/validatorRequired` 缺失时报错
3. 编写测试：`safety.dangerousCommandsBlocked/secretPatterns` 缺失时报错
4. 编写测试：`documents.generatedBlockPrefix` 缺失时报错

#### 验收标准
- [ ] 包含 4 个测试用例骨架
- [ ] 覆盖全部子字段校验

#### 关联设计
- spec.md 章节：需求项「完整配置校验」
- design.md 章节：§4.2 接口 2

---

### [TASK-WC-03] 编写路径解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `resolveWorkspacePaths()` 新增的 `docs`/`rules`/`events` 路径字段创建测试骨架。

#### 输入
- `src/core/paths.ts` 中 `resolveWorkspacePaths()` 的函数签名

#### 输出
- `test/core/paths.test.ts` 中追加测试用例

#### 实现步骤
1. 追加测试：验证返回对象包含 `docs`、`rules`、`events` 字段
2. 验证路径拼接正确（`.harness/docs`、`.harness/rules`、`.harness/events`）

#### 验收标准
- [ ] 包含 1 个测试用例骨架
- [ ] 覆盖 3 个新路径字段

#### 关联设计
- spec.md 章节：需求项「完整目录结构创建」
- design.md 章节：§6.1

---

### [TASK-WC-04] 扩展 WorkspacePaths 和 ensureWorkspace

- **类型**: 接口层
- **依赖**: TASK-WC-01, TASK-WC-03
- **状态**: [ ] 未完成

#### 任务描述
在 `src/core/types.ts` 的 `WorkspacePaths` 中添加 `docs`/`rules`/`events` 字段；在 `src/core/paths.ts` 的 `resolveWorkspacePaths()` 中计算新路径；在 `src/core/workspace.ts` 的 `ensureWorkspace()` 中补全约 18 个目录。

#### 输入
- 现有 `WorkspacePaths` 接口和 `ensureWorkspace()` 函数

#### 输出
- 扩展后的类型、路径解析和目录创建逻辑

#### 实现步骤
1. 在 `WorkspacePaths` 中添加 `docs: string`、`rules: string`、`events: string`
2. 在 `resolveWorkspacePaths()` 中计算新路径
3. 在 `ensureWorkspace()` 的 `dirs` 数组中追加约 18 个目录（含 docs/adr、docs/architecture、docs/decisions、adapters/claude、adapters/codex、adapters/copilot、adapters/cursor、develop/archive、develop/templates、reports/sync、reports/develop、reports/review）

#### 验收标准
- [ ] `WorkspacePaths` 包含 3 个新字段
- [ ] `ensureWorkspace()` 创建约 24 个目录（含原有）
- [ ] 幂等性保持（已存在目录跳过）
- [ ] TASK-WC-01 和 TASK-WC-03 测试通过

#### 关联设计
- spec.md 章节：需求项「完整目录结构创建」
- design.md 章节：§4.2 接口 1、§6.1

---

### [TASK-WC-05] 扩展 validateHarnessConfig 子字段校验

- **类型**: 接口层
- **依赖**: TASK-WC-02
- **状态**: [ ] 未完成

#### 任务描述
在 `src/core/config-schema.ts` 的 `validateHarnessConfig()` 中添加 `orchestration`、`safety`、`documents` 子字段校验。

#### 输入
- 现有 `validateHarnessConfig()` 函数

#### 输出
- 扩展后的配置校验逻辑

#### 实现步骤
1. 添加 `orchestration.subagents/maxParallelAgents/validatorRequired` 校验
2. 添加 `safety.dangerousCommandsBlocked/secretPatterns` 校验
3. 添加 `documents.generatedBlockPrefix` 校验
4. 缺失字段加入 `missing` 数组，返回错误码 2106

#### 验收标准
- [ ] 子字段缺失时返回错误码 2106
- [ ] 错误消息包含缺失字段名
- [ ] TASK-WC-02 测试通过

#### 关联设计
- spec.md 章节：需求项「完整配置校验」
- design.md 章节：§4.2 接口 2

---

### [TASK-WC-06] 生成 rules 初始文件和配置 schema

- **类型**: 接口层
- **依赖**: TASK-WC-04
- **状态**: [ ] 未完成

#### 任务描述
在 `ensureWorkspace()` 中添加 `rules/default.md`、`rules/override.md`、`rules/generated.md` 3 个初始文件的 stageWrite；补全 `review.config.json`、`knowledge.config.json`、`*.local.json` 配置 schema。

#### 输入
- `ensureWorkspace()` 中的 transaction 对象

#### 输出
- 3 个初始文件写入逻辑 + 配置 schema 扩展

#### 实现步骤
1. 在 `ensureWorkspace()` 中添加 3 个 `stageWrite` 调用
2. 在 `config-schema.ts` 中添加 `ReviewConfig`、`KnowledgeConfig` 接口定义
3. 添加 `*.local.json` 的 merge 逻辑

#### 验收标准
- [ ] 3 个初始文件内容正确
- [ ] 幂等性（已存在不覆盖）
- [ ] TASK-WC-01 中初始文件测试通过

#### 关联设计
- spec.md 章节：需求项「完整目录结构创建」、「配置文件补全」
- design.md 章节：§4.2 接口 1

---

### [TASK-WC-07] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-WC-04, TASK-WC-05, TASK-WC-06
- **状态**: [ ] 未完成

#### 任务描述
运行全部 workspace-config 相关测试，确保所有断言通过。

#### 输入
- 层级 1-2 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全 TASK-WC-01/02/03 中标记为 `TODO` 的断言
2. 运行 `npx vitest run test/core/`
3. 修复失败用例

#### 验收标准
- [ ] 全部测试通过
- [ ] 无 TypeScript 编译错误
- [ ] 目录创建时间 < 500ms (P95)

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-WC-01 | 目录测试 | 完整目录创建、初始文件、幂等性 | 目录存在、文件内容正确 |
| TASK-WC-02 | 配置测试 | 子字段缺失校验 | 错误码 2106、缺失字段列表 |
| TASK-WC-03 | 路径测试 | 新路径字段 | docs/rules/events 路径正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 全新初始化 | 空目录 | ensureWorkspace() | 约 24 个目录 + 3 个文件 |
| 重复初始化 | 已有目录 | ensureWorkspace() | 无报错，跳过已存在 |

### 4.3 手动验证清单

- [ ] `.harness/docs/adr/` 目录存在
- [ ] `.harness/rules/default.md` 内容正确
- [ ] 配置校验能检测缺失子字段

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| core/config | 内部模块 | writeHarnessConfig | ✅ 就绪 | |

---

## 6. 代码规范

### 6.1 命名规范

- 接口名：PascalCase（如 `WorkspacePaths`）
- 方法名：camelCase（如 `ensureWorkspace`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释
- 异常处理：使用 `HarnessCliError` 类

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/core/types.ts` | WorkspacePaths 扩展 | TASK-WC-04 |
| `src/core/paths.ts` | 路径解析扩展 | TASK-WC-04 |
| `src/core/workspace.ts` | 目录创建扩展 | TASK-WC-04, TASK-WC-06 |
| `src/core/config-schema.ts` | 配置校验扩展 | TASK-WC-05, TASK-WC-06 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/core/workspace.test.ts` | 目录创建测试 | TASK-WC-01, TASK-WC-07 |
| `test/core/config-schema.test.ts` | 配置校验测试 | TASK-WC-02, TASK-WC-07 |
| `test/core/paths.test.ts` | 路径解析测试 | TASK-WC-03, TASK-WC-07 |

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
