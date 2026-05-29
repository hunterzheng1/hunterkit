# 实施任务拆解 - harness-sync

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-sync` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-sync/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-sync/design.md` | 当前能力设计 |

### 1.2 实现范围

- 实现 `--check` 漂移检测（只检查不写入）
- 实现 `--fast` 快速判断（git diff + 高风险自动升级）
- 实现 `--docs` 文档限定
- 实现 `REVIEW_REQUIRED` 标注
- 默认只更新 generated block 或用户确认区域
- 报告写入 `.harness/reports/sync/*.md`

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
│  │ TASK-SY-01 ✅│  │ TASK-SY-02 ✅│  │ TASK-SY-03 ✅│       │
│  │ 参数解析测试  │  │ 漂移检测测试  │  │ fast+高风险  │       │
│  │ 骨架         │  │ 骨架         │  │ 测试骨架     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-SY-04 ✅│  │ TASK-SY-05 ✅│  │ TASK-SY-06 ✅│  ││
│  │  │ 参数解析实现  │  │ 漂移检测+    │  │ fast模式+    │  ││
│  │  │             │  │ REVIEW_REQUIRED│ │ 高风险升级   │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 03    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (报告+验证)                                  │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-SY-07 ✅│  │ TASK-SY-08 ✅│                │││
│  │  │  │ 报告写入     │  │ 测试验证     │                │││
│  │  │  │ 依赖: 04,05 │  │ 依赖: 07    │                │││
│  │  │  └──────────────┘  └──────────────┘                │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-SY-01, TASK-SY-02, TASK-SY-03 | ✅ 是 | 无 |
| 层级 2 | TASK-SY-04, TASK-SY-05, TASK-SY-06 | ✅ 是 | 层级 1 对应 |
| 层级 3 | TASK-SY-07 | - | TASK-SY-04, 05, 06 |
| 层级 3 | TASK-SY-08 | - | TASK-SY-07 |

---

## 3. 原子任务清单

### [TASK-SY-01] 编写参数解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `parseSyncArgs()` 创建测试骨架，覆盖 `--check`、`--fast`、`--docs` 参数解析和 `--docs` 枚举校验。

#### 输入
- `src/capabilities/sync/command.ts` 函数签名

#### 输出
- `test/capabilities/sync.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('parseSyncArgs')` 块
2. 编写测试：`--check` 解析
3. 编写测试：`--fast` 解析
4. 编写测试：`--docs readme,agents` 解析
5. 编写测试：`--docs invalid` 返回错误码 2402

#### 验收标准
- [ ] 包含 4 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--check 漂移检测」「--fast 快速判断」「--docs 文档限定」
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-SY-02] 编写漂移检测和 REVIEW_REQUIRED 测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `--check` 漂移检测、generated block 保护和 `REVIEW_REQUIRED` 标注创建测试骨架。

#### 输入
- `runSyncCommand()` 函数签名

#### 输出
- `test/capabilities/sync.test.ts` 追加测试

#### 实现步骤
1. 编写测试：`--check` 发现漂移返回错误码 2401
2. 编写测试：`--check` 不写入文件
3. 编写测试：写入会覆盖用户内容返回 2403
4. 编写测试：REVIEW_REQUIRED 标注出现在输出中
5. 编写测试：facts 缺失返回 2404

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--check 漂移检测」「REVIEW_REQUIRED 标注」「默认只更新 generated block」
- design.md 章节：§6.1 核心流程

---

### [TASK-SY-03] 编写 --fast 模式和高风险升级测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `--fast` git diff 快速判断和高风险变更自动升级创建测试骨架。

#### 输入
- `runSyncCommand()` 函数签名

#### 输出
- `test/capabilities/sync.test.ts` 追加测试

#### 实现步骤
1. 编写测试：`--fast` 使用 git diff 判断变更范围
2. 编写测试：高风险变更（package.json 等）自动升级为完整检查
3. 编写测试：Git 不可用时 `--fast` 降级为完整检查

#### 验收标准
- [ ] 包含 3 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--fast 快速判断」「高风险变更自动升级」
- design.md 章节：§6.2 高风险变更检测

---

### [TASK-SY-04] 实现 parseSyncArgs 参数解析

- **类型**: 接口层
- **依赖**: TASK-SY-01
- **状态**: [x] 已完成

#### 任务描述
在 `command.ts` 中新增 `parseSyncArgs()` 函数，解析 `--check`、`--fast`、`--docs` 参数。

#### 输入
- `context.args` 字符串数组

#### 输出
- `SyncOptions` 对象

#### 实现步骤
1. 解析 `--check` 布尔标志
2. 解析 `--fast` 布尔标志
3. 解析 `--docs <types>` 带值参数（逗号分隔）
4. 校验 `--docs` 枚举值（readme/agents/claude/copilot）
5. 无效枚举返回错误码 2402

#### 验收标准
- [ ] 全部参数正确解析
- [ ] 枚举校验正确
- [ ] TASK-SY-01 测试通过

#### 关联设计
- spec.md 章节：全部参数需求项
- design.md 章节：§4.2

---

### [TASK-SY-05] 实现漂移检测、generated block 保护和 REVIEW_REQUIRED

- **类型**: 接口层
- **依赖**: TASK-SY-02
- **状态**: [x] 已完成

#### 任务描述
在 `runSyncCommand()` 中添加 `--check` 漂移检测逻辑、generated block 保护和 `REVIEW_REQUIRED` 标注。

#### 输入
- `SyncOptions` 对象

#### 输出
- 扩展后的同步命令逻辑

#### 实现步骤
1. 读取 `repo-map.json` facts（不存在返回 2404）
2. 对每个目标文档计算期望内容，与现有内容比较
3. `--check` 模式：只报告漂移状态，不写入文件
4. 非 check 模式：只更新 generated block 或用户确认区域
5. 写入会覆盖用户内容时返回 2403
6. 从 `facts.reviewRequired` 读取不确定事实，标注 REVIEW_REQUIRED
7. 漂移时返回 2401

#### 验收标准
- [ ] `--check` 只检查不写入
- [ ] generated block 保护正确
- [ ] REVIEW_REQUIRED 标注出现
- [ ] TASK-SY-02 测试通过

#### 关联设计
- spec.md 章节：需求项「--check」「REVIEW_REQUIRED」「默认只更新 generated block」
- design.md 章节：§6.1

---

### [TASK-SY-06] 实现 --fast 模式和高风险变更升级

- **类型**: 接口层
- **依赖**: TASK-SY-03
- **状态**: [x] 已完成

#### 任务描述
在 `runSyncCommand()` 中添加 `--fast` git diff 快速判断和高风险变更自动升级逻辑。

#### 输入
- `SyncOptions` 对象

#### 输出
- 扩展后的快速判断逻辑

#### 实现步骤
1. 实现 `gitDiff(cwd)` 获取变更文件列表
2. 实现 `isHighRiskChange(changedFiles)` 检测高风险模式
3. 高风险时 `options.fast = false` 并添加 warning
4. Git 不可用时降级为完整检查
5. 在 `drift-detector.ts` 中补全文档级漂移检测

#### 验收标准
- [ ] `--fast` 使用 git diff
- [ ] 高风险变更自动升级
- [ ] Git 不可用时降级
- [ ] TASK-SY-03 测试通过

#### 关联设计
- spec.md 章节：需求项「--fast 快速判断」「高风险变更自动升级」
- design.md 章节：§6.2

---

### [TASK-SY-07] 实现 sync 报告写入

- **类型**: 接口层
- **依赖**: TASK-SY-04, TASK-SY-05, TASK-SY-06
- **状态**: [x] 已完成

#### 任务描述
在 `runSyncCommand()` 末尾添加 sync 报告写入 `.harness/reports/sync/<timestamp>-sync.md`。

#### 输入
- 同步结果 `SyncDocumentResult[]`

#### 输出
- 报告文件路径

#### 实现步骤
1. 生成报告 Markdown 内容（包含漂移状态、文档列表、REVIEW_REQUIRED）
2. 写入 `.harness/reports/sync/<timestamp>-sync.md`
3. 返回 `reportPath`

#### 验收标准
- [ ] 报告路径正确
- [ ] 报告内容包含漂移状态
- [ ] 报告写入失败返回 5401

#### 关联设计
- spec.md 章节：需求项「sync 报告路径」
- design.md 章节：§5.3 数据流转图

---

### [TASK-SY-08] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-SY-07
- **状态**: [x] 已完成

#### 任务描述
运行全部 sync 相关测试，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/sync.test.ts`
3. 修复失败用例

#### 验收标准
- [ ] 全部测试通过
- [ ] 无 TypeScript 编译错误

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-SY-01 | 参数解析 | --check/--fast/--docs/枚举 | options 字段正确 |
| TASK-SY-02 | 漂移检测 | check/保护/REVIEW_REQUIRED/facts缺失 | 错误码、文件不写入 |
| TASK-SY-03 | fast 模式 | git diff/高风险升级/降级 | 升级标志、warning |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 漂移检测 | 文档已漂移 | --check | 返回 2401，不写入 |
| fast 高风险 | package.json 变更 | --fast | 升级为完整检查 |
| 报告写入 | 同步完成 | 自动 | 报告文件存在 |

### 4.3 手动验证清单

- [ ] `harness sync --check` 只检查不写入
- [ ] `harness sync --fast` 快速判断
- [ ] 报告写入 `.harness/reports/sync/`

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| harness-inspect | 内部模块 | 读取 repo-map.json | ⏳ 等待 | |
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| adapters/drift-detector | 内部模块 | checkAdapterDrift | ✅ 就绪 | |
| Git >= 2.30.0 | 外部工具 | 系统 | ✅ 就绪 | 降级为完整检查 |

---

## 6. 代码规范

### 6.1 命名规范

- 常量名：UPPER_SNAKE_CASE（如 `HIGH_RISK_PATTERNS`）
- 方法名：camelCase（如 `parseSyncArgs`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/sync/command.ts` | 参数解析+漂移检测+报告 | TASK-SY-04~07 |
| `src/adapters/drift-detector.ts` | 文档级漂移检测 | TASK-SY-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/sync.test.ts` | sync 全部测试 | TASK-SY-01~03, TASK-SY-08 |

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
