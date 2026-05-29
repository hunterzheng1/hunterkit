# 实施任务拆解 - harness-review

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-review` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-review/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-review/design.md` | 当前能力设计 |

### 1.2 实现范围

- 实现 `parseReviewArgs()` 参数解析（8 个参数 + 互斥校验）
- 实现 3 种范围模式（local/staged/scan）+ 交互式范围选择
- 实现 6 个并行 review agent + N 个 finding validator
- 实现 confidence < 80 过滤和去重
- 实现 P0/P1/P2 严重度分级
- 实现 Markdown + JSON 双报告写入 `.harness/reports/review/<ts>-<branch>.md/.json`
- 实现 `--fix`/`--no-fix` 自动修复
- 编排器本身不做实质审查，review agent 必须读完整相关源码
- 用户可见内容使用简体中文

### 1.3 技术栈

- 语言：TypeScript (ESM)
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
│  │ TASK-RV-01 ✅│  │ TASK-RV-02 ✅│  │ TASK-RV-03 ✅│       │
│  │ 参数解析测试  │  │ 多agent审查  │  │ 报告输出测试  │       │
│  │ 骨架         │  │ 测试骨架     │  │ 骨架         │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-RV-04 ✅│  │ TASK-RV-05 ✅│  │ TASK-RV-06 ✅│  ││
│  │  │ 参数解析实现  │  │ 范围解析+    │  │ reviewer选择 │  ││
│  │  │             │  │ 交互式选择   │  │ +并行执行    │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 02    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (过滤+报告)                                  │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-RV-07 ✅│  │ TASK-RV-08 ✅│                │││
│  │  │  │ 过滤+分级+   │  │ 报告写入+    │                │││
│  │  │  │ validator    │  │ fix实现      │                │││
│  │  │  │ 依赖: 03,06 │  │ 依赖: 07    │                │││
│  │  │  └──────┬───────┘  └──────┬───────┘                │││
│  │  │         v                 v                         │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │  层级 4 (测试验证)                               ││││
│  │  │  │  ┌──────────────┐                               ││││
│  │  │  │  │ TASK-RV-09 ✅│ 依赖: 08                      ││││
│  │  │  │  │ 测试验证     │                               ││││
│  │  │  │  └──────────────┘                               ││││
│  │  │  └─────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-RV-01, TASK-RV-02, TASK-RV-03 | ✅ 是 | 无 |
| 层级 2 | TASK-RV-04 | - | TASK-RV-01 |
| 层级 2 | TASK-RV-05, TASK-RV-06 | ✅ 是 | TASK-RV-02 |
| 层级 3 | TASK-RV-07 | - | TASK-RV-03, TASK-RV-06 |
| 层级 3 | TASK-RV-08 | - | TASK-RV-07 |
| 层级 4 | TASK-RV-09 | - | TASK-RV-08 |

---

## 3. 原子任务清单

### [TASK-RV-01] 编写参数解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `parseReviewArgs()` 创建测试骨架，覆盖 8 个参数解析和互斥校验。

#### 输入
- `src/capabilities/review/command.ts` 函数签名

#### 输出
- `test/capabilities/review.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('parseReviewArgs')` 块
2. 编写测试：`--local`/`--staged`/`--scan` 解析
3. 编写测试：scope flags 互斥（多个返回 2602）
4. 编写测试：`--fix`/`--no-fix` 互斥
5. 编写测试：`--full`/`--lite` 互斥
6. 编写测试：`--comment` 解析

#### 验收标准
- [ ] 包含 6 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「范围参数」「--fix/--no-fix」「--full/--lite」「--comment」
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-RV-02] 编写范围解析和多 agent 审查测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 3 种范围模式、交互式范围选择、reviewer 选择和并行执行创建测试骨架。

#### 输入
- `resolveScope()` 和 `selectReviewers()` 函数签名

#### 输出
- `test/capabilities/review.test.ts` 追加测试

#### 实现步骤
1. 编写测试：`--local` → git diff main...HEAD
2. 编写测试：`--staged` → git diff --cached
3. 编写测试：`--scan <path>` → 扫描指定目录
4. 编写测试：`--scan` 路径越界返回 2603
5. 编写测试：无参数 → 交互式选择
6. 编写测试：`--lite` → 仅 contract-reviewer + bug-scanner
7. 编写测试：`--full` 或文件数 > 3 → 全部 6 个 reviewer
8. 编写测试：reviewer 必须读完整相关源码

#### 验收标准
- [ ] 包含 8 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「范围解析」「交互式范围选择」「6 个并行 review agent」
- design.md 章节：§6.1、§6.2

---

### [TASK-RV-03] 编写报告输出和过滤测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 confidence 过滤、去重、P0/P1/P2 分级、双报告写入和简体中文创建测试骨架。

#### 输入
- `classifySeverity()` 和报告写入函数签名

#### 输出
- `test/capabilities/review.test.ts` 追加测试

#### 实现步骤
1. 编写测试：confidence < 80 的 finding 被丢弃
2. 编写测试：相同 file+line+category 去重
3. 编写测试：P0/P1/P2 分级正确
4. 编写测试：Markdown + JSON 双报告写入正确路径
5. 编写测试：报告路径包含 timestamp 和 branch
6. 编写测试：P0 > 0 返回 2601
7. 编写测试：用户可见内容为简体中文

#### 验收标准
- [ ] 包含 7 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「confidence 过滤」「去重」「P0/P1/P2 分级」「报告路径」「简体中文」
- design.md 章节：§6.1、§6.3

---

### [TASK-RV-04] 实现 parseReviewArgs 参数解析

- **类型**: 接口层
- **依赖**: TASK-RV-01
- **状态**: [x] 已完成

#### 任务描述
在 `command.ts` 中新增 `parseReviewArgs()` 函数，解析全部参数并校验互斥。

#### 输入
- `context.args` 字符串数组

#### 输出
- `ReviewOptions` 对象

#### 实现步骤
1. 解析 `--local`/`--staged`/`--scan` 并校验互斥（返回 2602）
2. 解析 `--fix`/`--no-fix` 并校验互斥
3. 解析 `--full`/`--lite` 并校验互斥
4. 解析 `--comment`
5. 返回 `ReviewOptions`

#### 验收标准
- [ ] 全部参数正确解析
- [ ] 互斥校验正确
- [ ] TASK-RV-01 测试通过

#### 关联设计
- spec.md 章节：全部参数需求项
- design.md 章节：§4.2

---

### [TASK-RV-05] 实现范围解析和交互式选择

- **类型**: 接口层
- **依赖**: TASK-RV-02
- **状态**: [x] 已完成

#### 任务描述
实现 `resolveScope()` 支持 local/staged/scan 三种模式；实现无参数时交互式范围选择。

#### 输入
- `ReviewOptions` 对象

#### 输出
- `{ files: string[]; scopeName: string }`

#### 实现步骤
1. `--local`：执行 `git diff main...HEAD --name-only` 获取文件列表
2. `--staged`：执行 `git diff --cached --name-only`
3. `--scan <path>`：扫描指定目录，校验路径在项目内（否则 2603）
4. 无参数：使用 `@inquirer/prompts` 的 `select` 交互式选择
5. Git 不可用时降级为仅 `--scan`

#### 验收标准
- [ ] 3 种范围模式正确
- [ ] 交互式选择可用
- [ ] 路径越界返回 2603
- [ ] TASK-RV-02 中范围测试通过

#### 关联设计
- spec.md 章节：需求项「范围参数」「交互式范围选择」
- design.md 章节：§6.1

---

### [TASK-RV-06] 实现 reviewer 选择和并行执行

- **类型**: 接口层
- **依赖**: TASK-RV-02
- **状态**: [x] 已完成

#### 任务描述
实现 `selectReviewers()` 和 `runReviewersParallel()`；编排器本身不做实质审查；reviewer 必须读完整相关源码。

#### 输入
- `ReviewOptions` 和文件列表

#### 输出
- `CandidateFinding[]`

#### 实现步骤
1. 实现 `selectReviewers()`：`--lite` → 2 个，`--full` 或文件 > 3 → 6 个
2. 实现 `runReviewersParallel()`：并行执行 reviewer，收集候选 findings
3. 编排器本身不做实质审查，只负责调度
4. 每个 reviewer 必须读完整相关源码而非仅看 diff
5. 单个 reviewer 失败时跳过并在 warnings 中记录

#### 验收标准
- [ ] lite/full/默认 reviewer 选择正确
- [ ] 并行执行正确
- [ ] 编排器不做实质审查
- [ ] TASK-RV-02 中 reviewer 测试通过

#### 关联设计
- spec.md 章节：需求项「6 个并行 review agent」「编排器不做实质审查」
- design.md 章节：§6.2

---

### [TASK-RV-07] 实现 validator、confidence 过滤、去重和分级

- **类型**: 接口层
- **依赖**: TASK-RV-03, TASK-RV-06
- **状态**: [x] 已完成

#### 任务描述
实现 finding validator 独立复核、confidence < 80 过滤、去重和 P0/P1/P2 分级。

#### 输入
- `CandidateFinding[]`

#### 输出
- `ReviewFinding[]`（已验证、过滤、去重、分级）

#### 实现步骤
1. 对每条 finding 启动 validator 独立复核，validator 拒绝的丢弃
2. 过滤 confidence < 80 的 finding
3. 去重：相同 file+line+category 只保留一条
4. 实现 `classifySeverity()`：security+confidence>=90 → P0，security/contract → P1，其他 → P2
5. 统计 summary（p0/p1/p2/discarded）

#### 验收标准
- [ ] validator 复核正确
- [ ] confidence 过滤正确
- [ ] 去重正确
- [ ] P0/P1/P2 分级正确
- [ ] TASK-RV-03 中过滤/分级测试通过

#### 关联设计
- spec.md 章节：需求项「finding validator」「confidence 过滤」「去重」「P0/P1/P2 分级」
- design.md 章节：§6.1、§6.3

---

### [TASK-RV-08] 实现双报告写入和 --fix 自动修复

- **类型**: 接口层
- **依赖**: TASK-RV-07
- **状态**: [x] 已完成

#### 任务描述
实现 Markdown + JSON 双报告写入；实现 `--fix` 自动修复低风险问题；确保用户可见内容使用简体中文。

#### 输入
- 已分级的 `ReviewFinding[]`

#### 输出
- 报告文件路径

#### 实现步骤
1. **新建** `src/capabilities/review/types.ts`（当前不存在），导出 `ReviewFinding` 接口（含 severity/confidence/reviewer 字段）
2. 获取当前分支名 `getCurrentBranch(cwd)`
3. 生成 timestamp（ISO 8601）
4. 写入 `.harness/reports/review/<ts>-<branch>.md`
5. 写入 `.harness/reports/review/<ts>-<branch>.json`
6. 如果 `--fix`：修复 P2 级机械性问题
7. 如果 P0 > 0：返回 2601
8. 确保报告中用户可见内容为简体中文

#### 验收标准
- [ ] Markdown 报告内容正确
- [ ] JSON 报告内容正确
- [ ] 报告路径包含 timestamp 和 branch
- [ ] `--fix` 修复 P2 问题
- [ ] P0 > 0 返回 2601
- [ ] 用户可见内容为简体中文
- [ ] TASK-RV-03 中报告测试通过

#### 关联设计
- spec.md 章节：需求项「报告路径」「--fix/--no-fix」「简体中文」
- design.md 章节：§6.1

---

### [TASK-RV-09] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-RV-08
- **状态**: [x] 已完成

#### 任务描述
运行全部 review 相关测试，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/review.test.ts`
3. 修复失败用例

#### 验收标准
- [ ] 全部 21 个测试通过
- [ ] 无 TypeScript 编译错误

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-RV-01 | 参数解析 | 8 个参数+互斥 | options 字段正确 |
| TASK-RV-02 | 范围+reviewer | 3 种范围+交互式+reviewer 选择 | 文件列表、reviewer 集合 |
| TASK-RV-03 | 过滤+报告 | confidence/去重/分级/双报告/中文 | findings 数量、报告内容 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| local 审查 | 有分支 diff | --local | 审查 diff 文件 |
| lite 审查 | 有文件 | --lite | 仅 2 个 reviewer |
| P0 阻断 | 有安全漏洞 | review | 返回 2601 |
| 双报告 | 审查完成 | 自动 | .md + .json 报告存在 |

### 4.3 手动验证清单

- [ ] `harness review --local` 审查当前分支
- [ ] `harness review --lite` 轻量审查
- [ ] 报告写入 `.harness/reports/review/`
- [ ] 报告内容为简体中文

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| harness-inspect | 内部模块 | 读取 repo-map.json | ⏳ 等待 | |
| harness-develop | 内部模块 | 读取 spec/design/tasks | ⏳ 等待 | |
| core/paths | 内部模块 | resolveWorkspacePaths | ✅ 就绪 | |
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| Git >= 2.30.0 | 外部工具 | 系统 | ✅ 就绪 | 降级为 --scan |

---

## 6. 代码规范

### 6.1 命名规范

- 类型名：PascalCase（如 `ReviewFinding`、`ReviewOptions`）
- 常量名：UPPER_SNAKE_CASE（如 `ALL_REVIEWERS`、`LITE_REVIEWERS`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释
- 用户可见文本：简体中文

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/review/command.ts` | 参数解析+范围+reviewer+报告 | TASK-RV-04~08 |
| `src/capabilities/review/types.ts` | ReviewFinding 类型扩展 | TASK-RV-08 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/review.test.ts` | review 全部测试 | TASK-RV-01~03, TASK-RV-09 |

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
