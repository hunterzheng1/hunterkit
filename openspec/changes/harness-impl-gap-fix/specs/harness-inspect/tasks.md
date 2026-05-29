# 实施任务拆解 - harness-inspect

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-inspect` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

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

- 实现 `--full` 全量扫描参数解析
- 实现 `--path` 限定扫描范围
- 实现 `--rules` 条件生成 rules.generated.md
- 首次无 facts 时自动等价 `--full`

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
│  │ TASK-IN-01   │  │ TASK-IN-02   │  │ TASK-IN-03   │       │
│  │ 参数解析测试  │  │ 路径限定测试  │  │ rules条件测试 │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐                    ││
│  │  │ TASK-IN-04   │  │ TASK-IN-05   │                    ││
│  │  │ 参数解析实现  │  │ 扫描逻辑扩展  │                    ││
│  │  │ 依赖: 01    │  │ 依赖: 02,03 │                    ││
│  │  └──────┬───────┘  └──────┬───────┘                    ││
│  │         v                 v                             ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (测试验证)                                   │││
│  │  │  ┌──────────────┐                                   │││
│  │  │  │ TASK-IN-06   │ 依赖: 04,05                      │││
│  │  │  │ 测试验证     │                                   │││
│  │  │  └──────────────┘                                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-IN-01, TASK-IN-02, TASK-IN-03 | ✅ 是 | 无 |
| 层级 2 | TASK-IN-04 | - | TASK-IN-01 |
| 层级 2 | TASK-IN-05 | - | TASK-IN-02, TASK-IN-03 |
| 层级 3 | TASK-IN-06 | - | TASK-IN-04, TASK-IN-05 |

---

## 3. 原子任务清单

### [TASK-IN-01] 编写参数解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `parseInspectArgs()` 创建测试骨架，覆盖 `--full`、`--path`、`--rules` 参数解析和首次无 facts 自动等价 `--full` 场景。

#### 输入
- `src/capabilities/inspect/command.ts` 函数签名

#### 输出
- `test/capabilities/inspect.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('parseInspectArgs')` 块
2. 编写测试：无参数时 scope 默认值
3. 编写测试：`--full` 解析
4. 编写测试：`--path src/` 解析
5. 编写测试：`--rules` 解析
6. 编写测试：首次无 facts 自动等价 `--full`

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--full 全量扫描」「--path 限定扫描」「--rules 条件生成」
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-IN-02] 编写路径限定扫描单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `scanProject()` 的路径限定扫描和路径越界校验创建测试骨架。

#### 输入
- `src/capabilities/inspect/scanner.ts` 函数签名

#### 输出
- `test/capabilities/inspect.test.ts` 追加测试

#### 实现步骤
1. 编写测试：`--path src/` 只扫描 src/ 下文件
2. 编写测试：`--path` 越界返回错误码 2302
3. 编写测试：`--path` 不存在返回错误码 2301

#### 验收标准
- [ ] 包含 3 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--path 限定扫描」
- design.md 章节：§6.2 路径限定扫描

---

### [TASK-IN-03] 编写 rules 条件生成单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
为 `--rules` 条件生成 `rules.generated.md` 创建测试骨架。

#### 输入
- `runInspectCommand()` 函数签名

#### 输出
- `test/capabilities/inspect.test.ts` 追加测试

#### 实现步骤
1. 编写测试：`--rules` 为 true 时写入 rules.generated.md
2. 编写测试：不传 `--rules` 时不写入 rules.generated.md

#### 验收标准
- [ ] 包含 2 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--rules 条件生成」
- design.md 章节：§6.1 核心流程

---

### [TASK-IN-04] 实现 parseInspectArgs 参数解析

- **类型**: 接口层
- **依赖**: TASK-IN-01
- **状态**: [ ] 未完成

#### 任务描述
在 `command.ts` 中新增 `parseInspectArgs()` 函数，解析 `--full`、`--path`、`--rules` 参数。

#### 输入
- `context.args` 字符串数组

#### 输出
- `InspectOptions` 对象

#### 实现步骤
1. 解析 `--full` 布尔标志
2. 解析 `--path <dir>` 带值参数
3. 解析 `--rules` 布尔标志
4. 首次无 facts 时自动等价 `--full`
5. 返回 `{ scope: { full, path }, rules }`

#### 验收标准
- [ ] 全部参数正确解析
- [ ] 首次无 facts 自动等价
- [ ] TASK-IN-01 测试通过

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-IN-05] 扩展 scanProject 支持路径限定和 rules 条件生成

- **类型**: 接口层
- **依赖**: TASK-IN-02, TASK-IN-03
- **状态**: [ ] 未完成

#### 任务描述
新建 `src/capabilities/inspect/scanner.ts`（当前不存在），实现 `scanProject()` 路径限定扫描逻辑；在 `runInspectCommand()` 中添加 `--rules` 条件写入和路径越界校验。

#### 输入
- `InspectOptions` 对象

#### 输出
- 新建 `scanner.ts` + 扩展后的命令逻辑

#### 实现步骤
1. **新建** `src/capabilities/inspect/scanner.ts`，导出 `scanProject(cwd, scope)` 函数
2. 在 `scanProject()` 中根据 `scope.path` 限定 `scanRoot`
3. 在 `runInspectCommand()` 中校验 `--path` 位于 `--cwd` 内（否则返回 2302）
4. 校验 `--path` 存在（否则返回 2301）
4. 仅当 `options.rules` 为 true 时 `stageWrite(rulesPath, ...)`

#### 验收标准
- [ ] `--path` 限定扫描正确
- [ ] 路径越界返回 2302
- [ ] `--rules` 条件写入正确
- [ ] TASK-IN-02 和 TASK-IN-03 测试通过

#### 关联设计
- spec.md 章节：需求项「--path 限定扫描」「--rules 条件生成」
- design.md 章节：§6.1、§6.2

---

### [TASK-IN-06] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-IN-04, TASK-IN-05
- **状态**: [ ] 未完成

#### 任务描述
运行全部 inspect 相关测试，确保所有断言通过。

#### 输入
- 层级 1-2 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/inspect.test.ts`
3. 修复失败用例

#### 验收标准
- [ ] 全部 10 个测试通过
- [ ] 无 TypeScript 编译错误

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-IN-01 | 参数解析 | --full/--path/--rules/默认/自动等价 | options 字段正确 |
| TASK-IN-02 | 路径限定 | 限定扫描、越界、不存在 | 扫描范围、错误码 2301/2302 |
| TASK-IN-03 | rules 条件 | 写入/不写入 | 文件存在/不存在 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 首次扫描 | 无 facts | `harness inspect` | 等价 --full |
| 限定扫描 | 有 src/ | `harness inspect --path src/` | 只扫描 src/ |
| rules 生成 | 有 facts | `harness inspect --rules` | 写入 rules.generated.md |

### 4.3 手动验证清单

- [ ] `harness inspect --full` 全量扫描
- [ ] `harness inspect --path src/` 限定扫描
- [ ] `harness inspect --rules` 生成规则建议

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| core/paths | 内部模块 | resolveWorkspacePaths | ✅ 就绪 | |
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| Git >= 2.30.0 | 外部工具 | 系统 | ✅ 就绪 | 降级：跳过 Git facts |

---

## 6. 代码规范

### 6.1 命名规范

- 接口名：PascalCase（如 `InspectOptions`）
- 方法名：camelCase（如 `parseInspectArgs`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/inspect/command.ts` | 参数解析+命令逻辑 | TASK-IN-04, TASK-IN-05 |
| `src/capabilities/inspect/scanner.ts` | 路径限定扫描 | TASK-IN-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/inspect.test.ts` | inspect 全部测试 | TASK-IN-01~03, TASK-IN-06 |

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
