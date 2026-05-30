# 实施任务拆解 - harness-develop（增量）

> **边界声明**：增量修改，仅涉及 develop 命令未实现阶段的状态标注。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-develop/spec.md` | 3 需求项 9 场景 |
| 技术方案 | `specs/harness-develop/design.md` | 3 文件 3 修改点 |

### 1.2 实现范围

为 develop 的 7 个阶段设置明确状态：propose `completed`，其余 `not_implemented`；apply 返回 2505；legacy 检测增加迁移建议。

### 1.3 技术栈

TypeScript 5.5+

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1: [TASK-DEV-01] 编写 develop 阶段状态测试
层级 2: [TASK-DEV-02] 实现 notImplementedStage + 阶段状态修正
        [TASK-DEV-03] 扩展 status 命令展示 develop 阶段矩阵
层级 3: [TASK-DEV-04] 运行测试验证
```

---

## 3. 原子任务清单

### [TASK-DEV-01] 编写 develop 阶段状态测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 编写测试验证每个阶段返回正确的 data.status 和 code
- **输出**: `test/develop-stage-status.test.ts`

- **实现步骤**:
  1. propose → `status: "completed"`, code 0
  2. spec/design/tasks/check/archive → `status: "not_implemented"`, code 0
  3. apply → `status: "not_implemented"`, code 2505
  4. legacy 检测 → warning 含迁移建议

- **验收标准**:
  - [ ] 8 个测试用例存在（预期部分失败）

---

### [TASK-DEV-02] 实现 notImplementedStage + 阶段状态修正

- **类型**: 接口层
- **依赖**: TASK-DEV-01
- **状态**: [ ] 未完成

- **任务描述**: 替换 6 个未实现阶段的 `TODO + warning` 为 `notImplementedStage()` 调用
- **输入**: `src/capabilities/develop/command.ts`, `types.ts`
- **输出**: 修正后的 command.ts

- **实现步骤**:
  1. 新增 `StageStatus` 类型
  2. 实现 `notImplementedStage()` 函数
  3. spec/design/tasks/check/archive → 调用 `notImplementedStage()`
  4. apply → 调用 `notImplementedStage()`（code 2505）
  5. legacy/mixed → 增加迁移建议 warning

- **验收标准**:
  - [ ] `data.status` 正确反映阶段状态
  - [ ] apply 返回 code 2505
  - [ ] `npm run typecheck` 通过

- **关联设计**: design.md §4.1 & §4.2

---

### [TASK-DEV-03] 扩展 status 命令展示 develop 阶段矩阵

- **类型**: 接口层
- **依赖**: TASK-DEV-01
- **状态**: [ ] 未完成

- **任务描述**: 在 status 输出中增加 develop 各阶段状态
- **输入**: `src/commands/status.ts`
- **输出**: status 扩展

- **实现步骤**:
  1. 增加 `capabilities.develop.stages` 节点
  2. 每个阶段标记 `available` 或 `next_version`

- **验收标准**:
  - [ ] `harness status --json` 输出含 develop 7 阶段状态

- **关联设计**: design.md §4.3

---

### [TASK-DEV-04] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-DEV-02, TASK-DEV-03
- **状态**: [ ] 未完成

- **验收标准**:
  - [ ] `test/develop-stage-status.test.ts` 8/8 通过
  - [ ] `npm run typecheck` + `npm run lint` 通过

---

## 4. 交付物

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/develop/types.ts` | StageStatus 类型 | TASK-DEV-02 |
| `src/capabilities/develop/command.ts` | notImplementedStage | TASK-DEV-02 |
| `src/commands/status.ts` | develop 阶段矩阵 | TASK-DEV-03 |
| `test/develop-stage-status.test.ts` | 阶段状态测试 | TASK-DEV-01 |

---

> **质量红线检查清单**
> - [x] 每个任务 ≤ 5 分钟
> - [x] 100% 覆盖 spec.md（3 需求项 → 4 任务）
> - [x] 100% 覆盖 design.md（3 修改点 → 4 任务）
> - [x] 无循环依赖