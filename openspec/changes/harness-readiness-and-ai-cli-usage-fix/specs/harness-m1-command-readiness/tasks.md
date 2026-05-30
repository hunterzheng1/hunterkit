# 实施任务拆解 - harness-m1-command-readiness

> **边界声明**：本任务清单仅服务于 M1 验收命令的可运行验证与受限功能标注。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-m1-command-readiness/spec.md` | 6 需求项 14 场景 |
| 技术方案 | `specs/harness-m1-command-readiness/design.md` | 12 条验收命令 + status 扩展 |

### 1.2 实现范围

确保 inspect/sync/review/status/doctor/config --repair-adapters 全部可运行，创建 fixture 项目，扩展 status 输出。

### 1.3 技术栈

- TypeScript 5.5+ / vitest 2.0+ / Node.js 20+

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1 (无依赖):
  [TASK-M1-01] 编写 M1 验收测试骨架（12 条命令）

层级 2 (依赖 L1):
  [TASK-M1-02] 创建 fixture 测试项目
  [TASK-M1-03] 扩展 status 命令（能力状态矩阵）

层级 3 (依赖 L2):
  [TASK-M1-04] 确保 inspect/sync 在 fixture 上可运行
  [TASK-M1-05] 确保 review 输出 reviewMode + 中文报告
  [TASK-M1-06] 确保 doctor/config --repair-adapters 可运行

层级 4 (依赖 L3):
  [TASK-M1-07] 运行 M1 验收测试验证
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-M1-01 | - | 无 |
| 层级 2 | TASK-M1-02, TASK-M1-03 | ✅ | TASK-M1-01 |
| 层级 3 | TASK-M1-04, TASK-M1-05, TASK-M1-06 | ✅ | TASK-M1-02 |
| 层级 4 | TASK-M1-07 | - | 层级 3 |

---

## 3. 原子任务清单

### [TASK-M1-01] 编写 M1 验收测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 创建集成测试，验证 12 条 M1 验收命令均可运行
- **输入**: design.md §4.1 验收命令清单
- **输出**: `test/m1-readiness.test.ts`

- **实现步骤**:
  1. 创建 `test/m1-readiness.test.ts`
  2. 为每条命令编写测试用例（共 12 个）
  3. 验证退出码、JSON 输出、产物存在、dry-run 零写入

- **验收标准**:
  - [ ] 12 个测试用例存在（有些可能因 fixture 未创建而失败）
  - [ ] 覆盖 inspect/sync/review/status/doctor/config --repair-adapters

- **关联设计**: design.md §4.1

---

### [TASK-M1-02] 创建 fixture 测试项目

- **类型**: 配置
- **依赖**: TASK-M1-01
- **状态**: [ ] 未完成

- **任务描述**: 创建 `test/fixtures/m1-test-project/` 用于 M1 验收
- **输入**: design.md §5.2 fixture 结构
- **输出**: `test/fixtures/m1-test-project/`

- **实现步骤**:
  1. 创建目录结构和 `package.json`
  2. 创建 `src/index.ts` 和 `src/utils.ts`
  3. 创建 `.harness/config/harness.config.json`（预配置）
  4. git init（为 review 准备 Git 上下文）

- **验收标准**:
  - [ ] fixture 目录结构完整
  - [ ] `.harness/config/harness.config.json` 存在

- **关联设计**: design.md §5.2

---

### [TASK-M1-03] 扩展 status 命令

- **类型**: 接口层
- **依赖**: TASK-M1-01
- **状态**: [ ] 未完成

- **任务描述**: 在 status 输出中增加能力状态矩阵（含 develop 阶段/safety 状态）
- **输入**: `src/commands/status.ts`
- **输出**: 扩展后的 status 命令

- **实现步骤**:
  1. 在 `runStatusCommand` 中增加 `capabilities` 节点
  2. inspect/sync/review 标记 `available`
  3. develop 展示 7 阶段状态
  4. knowledge 展示 storageBackend
  5. safety 展示 hooks/agents 状态

- **验收标准**:
  - [ ] `harness status --json` 输出含 `capabilities` 节点
  - [ ] develop 展示 7 阶段状态矩阵
  - [ ] safety 展示模板标注

- **关联设计**: design.md §4.2

---

### [TASK-M1-04] 确保 inspect/sync 在 fixture 上可运行

- **类型**: 接口层
- **依赖**: TASK-M1-02
- **状态**: [ ] 未完成

- **任务描述**: 在 fixture 项目上运行 inspect 和 sync，确保正常输出
- **输入**: `src/capabilities/inspect/command.ts`, `src/capabilities/sync/command.ts`
- **输出**: 修复后的命令（如有问题）

- **实现步骤**:
  1. 在 fixture 上运行 `harness inspect` → 验证 facts 生成
  2. 在 fixture 上运行 `harness sync --check` → 验证状态输出
  3. 确认 --json 输出为合法 JSON
  4. 确认 --dry-run 零写入

- **验收标准**:
  - [ ] inspect 返回 code 0，`facts/` 目录有文件
  - [ ] sync --check 返回 code 0，data 含 `drift`/`documents`

- **关联设计**: design.md §6.1 步骤 1-2

---

### [TASK-M1-05] 确保 review 输出 reviewMode + 中文报告

- **类型**: 接口层
- **依赖**: TASK-M1-02
- **状态**: [ ] 未完成

- **任务描述**: 验证 review 输出含 `reviewMode: "heuristic"`、双报告、中文内容
- **输入**: `src/capabilities/review/command.ts`
- **输出**: 修复后的 review 命令

- **实现步骤**:
  1. 在 fixture 上运行 `harness review --local`
  2. 确认 JSON 输出含 `reviewMode: "heuristic"`
  3. 确认 `.harness/reports/review/<ts>-<branch>.md` 存在
  4. 确认报告内容为中文
  5. 确认 `--dry-run` 零写入

- **验收标准**:
  - [ ] `data.reviewMode === "heuristic"`
  - [ ] 双报告文件存在
  - [ ] 报告含中文

- **关联设计**: design.md §6.1 步骤 3

---

### [TASK-M1-06] 确保 doctor/config --repair-adapters 可运行

- **类型**: 接口层
- **依赖**: TASK-M1-02
- **状态**: [ ] 未完成

- **任务描述**: 验证 doctor 诊断和 config --repair-adapters 投影修复
- **输入**: `src/commands/doctor.ts`, `src/commands/config.ts`
- **输出**: 修复后的命令

- **实现步骤**:
  1. 在 fixture 上运行 `harness doctor` → 验证诊断输出
  2. 运行 `harness config --repair-adapters` → 验证投影文件生成
  3. 确认 JSON 输出格式正确

- **验收标准**:
  - [ ] doctor 输出含 `environment`/`workspace`/`dependencies`
  - [ ] config --repair-adapters 返回 code 0

- **关联设计**: design.md §6.1 步骤 5-6

---

### [TASK-M1-07] 运行 M1 验收测试验证

- **类型**: 测试-验证
- **依赖**: TASK-M1-04, TASK-M1-05, TASK-M1-06
- **状态**: [ ] 未完成

- **任务描述**: 运行 TASK-M1-01 全部 12 个测试，确保通过
- **输入**: 所有修复后的文件
- **输出**: 12/12 测试通过

- **实现步骤**:
  1. `npx vitest run test/m1-readiness.test.ts`
  2. 修正失败用例

- **验收标准**:
  - [ ] 12 个测试用例全部通过
  - [ ] `npm run typecheck` 通过

---

## 4. 验证方式

### 4.1 手动验证清单

- [ ] `node dist/bin/harness.js inspect --json` 在 fixture 上输出合法 JSON
- [ ] `node dist/bin/harness.js sync --check --json` 输出合法 JSON
- [ ] `node dist/bin/harness.js review --local` 生成 MD+JSON 报告
- [ ] `node dist/bin/harness.js status --json` 含完整能力状态
- [ ] `node dist/bin/harness.js doctor --json` 含环境诊断
- [ ] `node dist/bin/harness.js config --repair-adapters` 可运行

---

## 5. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/commands/status.ts` | status 能力矩阵扩展 | TASK-M1-03 |
| `test/fixtures/m1-test-project/` | fixture 测试项目 | TASK-M1-02 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/m1-readiness.test.ts` | M1 验收集成测试 | TASK-M1-01 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5 分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md（6 需求项 → 7 任务）
> - [x] 任务清单 100% 覆盖 design.md（6 步流程 → 7 任务）
> - [x] 每个任务有验收标准
> - [x] 依赖拓扑已明确
> - [x] 无循环依赖