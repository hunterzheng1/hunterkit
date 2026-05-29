# 实施任务拆解 - harness-develop

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-develop` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-develop/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-develop/design.md` | 当前能力设计 |

### 1.2 实现范围

- 实现 `parseDevelopArgs()` 参数解析（7 个阶段参数 + --from/--capability/--parallel/--no-parallel）
- 实现 7 阶段支持（propose/spec/design/tasks/check/apply/archive）
- 实现默认自动阶段检测
- 实现 canonical storage 路径 `.harness/develop/changes/<change>/`
- 实现兼容读取旧 `openspec/changes/**`
- 实现 design 阶段读取 repo facts
- 实现 apply 阶段 DAG 并行执行

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
│  │ TASK-DV-01 ✅│  │ TASK-DV-02 ✅│  │ TASK-DV-03 ✅│       │
│  │ 参数解析测试  │  │ 阶段检测测试  │  │ DAG并行测试  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-DV-04 ✅│  │ TASK-DV-05 ✅│  │ TASK-DV-06 ✅│  ││
│  │  │ 参数解析实现  │  │ 存储+阶段    │  │ 多阶段实现   │  ││
│  │  │             │  │ 检测实现     │  │             │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 04,05 │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (DAG+验证)                                   │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-DV-07 ✅│  │ TASK-DV-08 ✅│                │││
│  │  │  │ DAG并行实现  │  │ 测试验证     │                │││
│  │  │  │ 依赖: 03,06 │  │ 依赖: 07    │                │││
│  │  │  └──────────────┘  └──────────────┘                │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-DV-01, TASK-DV-02, TASK-DV-03 | ✅ 是 | 无 |
| 层级 2 | TASK-DV-04, TASK-DV-05 | ✅ 是 | 层级 1 |
| 层级 2 | TASK-DV-06 | - | TASK-DV-04, 05 |
| 层级 3 | TASK-DV-07 | - | TASK-DV-03, 06 |
| 层级 3 | TASK-DV-08 | - | TASK-DV-07 |

---

## 3. 原子任务清单

### [TASK-DV-01] 编写参数解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `parseDevelopArgs()` 创建测试骨架，覆盖 change 名称提取、7 个阶段参数互斥、--from/--capability/--parallel/--no-parallel 解析。

#### 输入
- `src/capabilities/develop/command.ts` 函数签名

#### 输出
- `test/capabilities/develop.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('parseDevelopArgs')` 块
2. 编写测试：change 名称提取和 kebab-case 校验
3. 编写测试：阶段参数互斥（多个阶段参数返回 2501）
4. 编写测试：`--from`、`--capability`、`--parallel`、`--no-parallel` 解析
5. 编写测试：`--parallel` 和 `--no-parallel` 互斥

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「多阶段支持」「参数解析」
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-DV-02] 编写阶段检测和存储解析测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `detectStage()` 和 `resolveStorage()` 创建测试骨架，覆盖 7 阶段检测和 canonical/legacy 存储解析。

#### 输入
- `detectStage()` 和 `resolveStorage()` 函数签名

#### 输出
- `test/capabilities/develop.test.ts` 追加测试

#### 实现步骤
1. 编写测试：无 proposal.md → 返回 'propose'
2. 编写测试：有 proposal 无 specs → 返回 'spec'
3. 编写测试：有 specs 无 design → 返回 'design'
4. 编写测试：有 design 无 tasks → 返回 'tasks'
5. 编写测试：canonical storage 路径解析
6. 编写测试：legacy `openspec/changes/**` 兼容读取

#### 验收标准
- [ ] 包含 6 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「默认自动阶段检测」「canonical storage」「兼容读取」
- design.md 章节：§6.2 阶段检测

---

### [TASK-DV-03] 编写 apply 阶段 DAG 并行测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `runApplyStage()` 的 DAG 并行执行和共享文件串行创建测试骨架。

#### 输入
- `runApplyStage()` 函数签名

#### 输出
- `test/capabilities/develop.test.ts` 追加测试

#### 实现步骤
1. 编写测试：无依赖任务并行执行
2. 编写测试：有依赖任务等待前置完成
3. 编写测试：共享文件修改串行执行
4. 编写测试：`--no-parallel` 强制串行

#### 验收标准
- [ ] 包含 4 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「apply 阶段 DAG 并行」
- design.md 章节：§6.3 apply 阶段 DAG 并行

---

### [TASK-DV-04] 实现 parseDevelopArgs 参数解析

- **类型**: 接口层
- **依赖**: TASK-DV-01
- **状态**: [x] 已完成

#### 任务描述
在 `command.ts` 中新增 `parseDevelopArgs()` 函数。

#### 输入
- `context.args` 字符串数组

#### 输出
- `{ change: string; options: DevelopOptions }`

#### 实现步骤
1. 提取 change 名称（args[0]），校验 kebab-case 和长度 3-80
2. 解析 7 个阶段参数互斥
3. 解析 `--from <path>`、`--capability <name>`
4. 解析 `--parallel`/`--no-parallel` 互斥
5. 无效参数返回 2501

#### 验收标准
- [ ] 全部参数正确解析
- [ ] 互斥校验正确
- [ ] TASK-DV-01 测试通过

#### 关联设计
- spec.md 章节：全部参数需求项
- design.md 章节：§4.2

---

### [TASK-DV-05] 实现 resolveStorage 和 detectStage

- **类型**: 接口层
- **依赖**: TASK-DV-02
- **状态**: [x] 已完成

#### 任务描述
实现 `resolveStorage()` 解析 canonical/legacy 存储位置；扩展 `detectStage()` 支持全部 7 阶段检测。

#### 输入
- cwd 和 change 名称

#### 输出
- `StorageLocation` 和 `DevelopStage`

#### 实现步骤
1. 实现 `resolveStorage()`：优先检查 `.harness/develop/changes/<change>/`，其次 `openspec/changes/<change>/`
2. 扩展 `detectStage()`：添加 apply/archive 阶段检测
3. 在 `paths.ts` 中添加 `developChanges` 路径辅助方法
4. 在 `legacy-sources.ts` 中补全 `openspec/changes/**` 兼容读取

#### 验收标准
- [ ] canonical/legacy 存储正确解析
- [ ] 7 阶段检测正确
- [ ] TASK-DV-02 测试通过

#### 关联设计
- spec.md 章节：需求项「canonical storage」「兼容读取」「默认自动阶段检测」
- design.md 章节：§6.2

---

### [TASK-DV-06] 实现 7 阶段执行逻辑

- **类型**: 接口层
- **依赖**: TASK-DV-04, TASK-DV-05
- **状态**: [x] 已完成

#### 任务描述
在 `runDevelopCommand()` 中实现 switch(stage) 的 7 个阶段执行逻辑，包括 design 阶段读取 repo facts。

#### 输入
- `DevelopStage` 和 `DevelopOptions`

#### 输出
- 各阶段产物列表

#### 实现步骤
1. propose：生成 proposal.md
2. spec：为每个 capability 生成 spec.md
3. design：`loadFacts(paths)` → 为每个 capability 生成 design.md
4. tasks：根据 design 生成 tasks.md
5. check：只读验证一致性，阻断问题返回 2505
6. apply：委托给 `runApplyStage()`（TASK-DV-07 实现）
7. archive：移动到 `.harness/develop/archive/`
8. `--capability` 限定时只处理指定能力域

#### 验收标准
- [ ] 7 个阶段可独立执行
- [ ] design 阶段读取 facts
- [ ] `--capability` 限定正确
- [ ] 阶段依赖缺失返回 2504

#### 关联设计
- spec.md 章节：需求项「多阶段支持」
- design.md 章节：§6.1 核心流程

---

### [TASK-DV-07] 实现 apply 阶段 DAG 并行执行

- **类型**: 接口层
- **依赖**: TASK-DV-03, TASK-DV-06
- **状态**: [x] 已完成

#### 任务描述
实现 `runApplyStage()` 的 DAG 并行执行逻辑：无依赖任务并行，共享文件修改串行。

#### 输入
- 任务列表和 DAG 依赖关系

#### 输出
- 产物文件列表

#### 实现步骤
1. 实现 `buildTaskDAG(tasks)` 构建依赖图
2. 循环找出所有依赖已完成的任务（ready）
3. `--parallel` 时并行执行 ready 任务（`groupByFileConflict` 分组）
4. `--no-parallel` 时串行执行
5. 共享文件修改必须串行
6. 检测循环依赖（ready 为空但未完成）

#### 验收标准
- [ ] 无依赖任务并行执行
- [ ] 共享文件串行执行
- [ ] 循环依赖检测
- [ ] TASK-DV-03 测试通过

#### 关联设计
- spec.md 章节：需求项「apply 阶段 DAG 并行」
- design.md 章节：§6.3

---

### [TASK-DV-08] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-DV-07
- **状态**: [x] 已完成

#### 任务描述
运行全部 develop 相关测试，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/develop.test.ts`
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
| TASK-DV-01 | 参数解析 | change/阶段互斥/--from/--capability | options 字段正确 |
| TASK-DV-02 | 阶段检测 | 7 阶段检测/canonical/legacy | stage 正确 |
| TASK-DV-03 | DAG 并行 | 并行/串行/共享文件/循环依赖 | 执行顺序正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 自动阶段检测 | 有 proposal+specs | 无阶段参数 | 自动进入 design |
| DAG 并行 | 多任务无依赖 | --parallel --apply | 并行执行 |
| legacy 兼容 | openspec/changes/ 存在 | develop <change> | 正确读取 |

### 4.3 手动验证清单

- [ ] `harness develop my-change` 自动检测阶段
- [ ] `harness develop my-change --spec` 只处理 spec
- [ ] `harness develop my-change --apply --parallel` 并行执行

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| harness-inspect | 内部模块 | 读取 repo-map.json | ⏳ 等待 | |
| core/paths | 内部模块 | resolveWorkspacePaths | ✅ 就绪 | |
| core/legacy-sources | 内部模块 | detectLegacySources | ✅ 就绪 | |
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |

---

## 6. 代码规范

### 6.1 命名规范

- 类型名：PascalCase（如 `DevelopStage`、`DevelopOptions`）
- 方法名：camelCase（如 `parseDevelopArgs`、`detectStage`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/develop/command.ts` | 参数解析+多阶段+DAG | TASK-DV-04~07 |
| `src/core/paths.ts` | developChanges 路径 | TASK-DV-05 |
| `src/core/legacy-sources.ts` | openspec 兼容读取 | TASK-DV-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/develop.test.ts` | develop 全部测试 | TASK-DV-01~03, TASK-DV-08 |

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
