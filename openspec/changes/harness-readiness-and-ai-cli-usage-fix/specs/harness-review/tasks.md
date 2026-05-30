# 实施任务拆解 - harness-review（增量）

> **边界声明**：增量修改，仅涉及 review 命令的 M1 完成边界标注和 source 字段。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-review/spec.md` | 3 需求项 7 场景 |
| 技术方案 | `specs/harness-review/design.md` | 2 文件 2 修改点 |

### 1.2 实现范围

ReviewFinding 增加 `source` 字段，响应增加 `reviewMode: "heuristic"`，`--comment` 返回 2606，受限功能 warning 标注。

### 1.3 技术栈

TypeScript 5.5+

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1: [TASK-REV-01] 编写 review M1 边界测试
层级 2: [TASK-REV-02] ReviewFinding 增加 source 字段
        [TASK-REV-03] 响应增加 reviewMode + --comment 2606
层级 3: [TASK-REV-04] 运行测试验证
```

---

## 3. 原子任务清单

### [TASK-REV-01] 编写 review M1 边界测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

- **任务描述**: 编写测试覆盖 reviewMode、source 字段、--comment 2606、M1 warning
- **输出**: `test/review-m1-boundary.test.ts`

- **实现步骤**:
  1. 测试 JSON 报告含 `reviewMode: "heuristic"`
  2. 测试 finding 含 `source: "heuristic"`
  3. 测试 `--comment` 返回 2606
  4. 测试 warnings 含 M1 受限标注

- **验收标准**:
  - [x] 4 个测试用例存在（预期部分失败）

---

### [TASK-REV-02] ReviewFinding 增加 source 字段

- **类型**: 数据层
- **依赖**: TASK-REV-01
- **状态**: [x] 已完成

- **任务描述**: 扩展 `ReviewFinding` 接口，增加 `source` 字段
- **输入**: `src/capabilities/review/types.ts`
- **输出**: 扩展后的类型定义

- **实现步骤**:
  1. 增加 `source: 'heuristic' | \`agent:${string}\`` 字段
  2. 在 `runReviewCommand` 中设置 `source: 'heuristic'`
  3. 在 JSON 报告中包含 source

- **验收标准**:
  - [x] `ReviewFinding.source` 类型正确
  - [x] `npm run typecheck` 通过

- **关联设计**: design.md §4.1

---

### [TASK-REV-03] 响应增加 reviewMode + --comment 2606

- **类型**: 接口层
- **依赖**: TASK-REV-01
- **状态**: [x] 已完成

- **任务描述**: 在 review 响应中增加 reviewMode 字段，--comment 返回 2606
- **输入**: `src/capabilities/review/command.ts`
- **输出**: 修改后的 command.ts

- **实现步骤**:
  1. `data` 增加 `reviewMode: 'heuristic'`
  2. `--comment` 检测 → 返回 `{ code: 2606, msg: '...' }`
  3. 多 agent reviewer 时增加 M1 受限 warning
  4. 保留现有启发式扫描逻辑不变

- **验收标准**:
  - [x] `data.reviewMode === "heuristic"`
  - [x] `--comment` 返回 code 2606
  - [x] 多 agent 模式有 warning

- **关联设计**: design.md §4.2

---

### [TASK-REV-04] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-REV-02, TASK-REV-03
- **状态**: [x] 已完成

- **验收标准**:
  - [x] `test/review-m1-boundary.test.ts` 4/4 通过
  - [x] `npm run typecheck` + `npm run lint` 通过

---

## 4. 交付物

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/review/types.ts` | source 字段 | TASK-REV-02 |
| `src/capabilities/review/command.ts` | reviewMode + --comment | TASK-REV-03 |
| `test/review-m1-boundary.test.ts` | M1 边界测试 | TASK-REV-01 |

---

> **质量红线检查清单**
> - [x] 每个任务 ≤ 5 分钟
> - [x] 100% 覆盖 spec.md（3 需求项 → 4 任务）
> - [x] 100% 覆盖 design.md（2 修改点 → 4 任务）
> - [x] 无循环依赖