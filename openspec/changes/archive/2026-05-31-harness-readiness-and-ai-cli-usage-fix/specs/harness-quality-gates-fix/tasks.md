# 实施任务拆解 - harness-quality-gates-fix

> **边界声明**：本任务清单仅服务于工程门禁修复（typecheck/lint/build/test/npm pack）。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-quality-gates-fix/spec.md` | 4 需求项 11 场景 |
| 技术方案 | `specs/harness-quality-gates-fix/design.md` | 6 文件 5 步流程 |

### 1.2 实现范围

修复 ESLint 9 配置、TypeScript 类型错误、构建验证、测试保持、发布包验证。

### 1.3 技术栈

- TypeScript 5.5+ / ESLint 9.6+ / tsup 8.1+ / vitest 2.0+

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1 (无依赖):
  [TASK-QG-01] 编写质量门禁测试（运行门禁命令并检查退出码）

层级 2 (依赖 L1):
  [TASK-QG-02] 创建 ESLint 9 flat config
  [TASK-QG-03] 修复 Transaction 类型导出

层级 3 (依赖 L2):
  [TASK-QG-04] 修复 ReviewFinding severity 类型
  [TASK-QG-05] 修复 config 类型转换安全守卫

层级 4 (依赖 L3):
  [TASK-QG-06] 运行全部门禁验证
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-QG-01 | - | 无 |
| 层级 2 | TASK-QG-02, TASK-QG-03 | ✅ | TASK-QG-01 |
| 层级 3 | TASK-QG-04, TASK-QG-05 | ✅ | TASK-QG-03 |
| 层级 4 | TASK-QG-06 | - | TASK-QG-04, TASK-QG-05 |

---

## 3. 原子任务清单

### [TASK-QG-01] 编写质量门禁测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

- **任务描述**: 编写脚本验证 `npm run typecheck`、`npm run lint`、`npm run build`、`npm test` 均返回 0
- **输入**: package.json scripts
- **输出**: `test/quality-gates.test.ts`

- **实现步骤**:
  1. 创建 `test/quality-gates.test.ts`
  2. 用 `execSync` 运行每个门禁命令并检查退出码
  3. 验证 `dist/bin/harness.js` 存在且可执行
  4. 验证 `npm pack --dry-run` 输出含 `dist/`

- **验收标准**:
  - [x] 4 个门禁测试用例存在（预期 typecheck/lint 失败）
  - [x] 构建和测试通过

- **关联设计**: design.md §4.1

---

### [TASK-QG-02] 创建 ESLint 9 flat config

- **类型**: 配置
- **依赖**: TASK-QG-01
- **状态**: [x] 已完成

- **任务描述**: 创建 `eslint.config.js`（ESLint 9 flat config 格式）
- **输入**: design.md §4.2 ESLint 配置
- **输出**: `eslint.config.js`

- **实现步骤**:
  1. 创建 `eslint.config.js`
  2. 配置 `ignores: ['dist/', 'node_modules/', '.harness/', 'coverage/']`
  3. 配置 TypeScript 规则（`no-unused-vars: warn`, `no-undef: error`）
  4. 安装 `@typescript-eslint/parser` 和 `@typescript-eslint/eslint-plugin`（如需要）

- **验收标准**:
  - [x] `npm run lint` 不报"找不到配置"错误
  - [x] ESLint 能解析 `src/` 和 `test/` 目录

- **关联设计**: design.md §4.2

---

### [TASK-QG-03] 修复 Transaction 类型导出

- **类型**: 数据层
- **依赖**: TASK-QG-01
- **状态**: [x] 已完成

- **任务描述**: 确保 `Transaction` 类型从 `src/core/transaction.ts` 正确导出
- **输入**: `src/core/transaction.ts`
- **输出**: 修复后的 `src/core/transaction.ts`

- **实现步骤**:
  1. 检查 `Transaction` 类型定义是否用 `export` 标记
  2. 检查 `src/core/types.ts` 是否重新导出
  3. 检查所有 import 路径是否一致

- **验收标准**:
  - [x] `import { Transaction } from '../core/transaction.js'` 不报类型错误
  - [x] TSC 针对此文件的错误清零

---

### [TASK-QG-04] 修复 ReviewFinding severity 类型

- **类型**: 数据层
- **依赖**: TASK-QG-03
- **状态**: [x] 已完成

- **任务描述**: 统一 `ReviewFinding.severity` 类型定义与实际使用
- **输入**: `src/capabilities/review/types.ts` + `command.ts`
- **输出**: 修复后的类型文件

- **实现步骤**:
  1. 检查 `ReviewFinding` 接口中 severity 定义
  2. 检查 `command.ts` 中 classifySeverity 使用的值
  3. 统一为 `'P0' | 'P1' | 'P2' | 'info' | 'warning'` 或等价联合类型

- **验收标准**:
  - [x] severity 类型与 classifySeverity 返回值一致
  - [x] `npm run typecheck -- src/capabilities/review/` 通过

- **关联设计**: design.md §4.3

---

### [TASK-QG-05] 修复 config 类型转换安全守卫

- **类型**: 接口层
- **依赖**: TASK-QG-03
- **状态**: [x] 已完成

- **任务描述**: 确保 `buildConfigFromAnswers()` 返回类型与 `HarnessConfig` 完全匹配
- **输入**: `src/cli/main.ts`
- **输出**: 修复后的 `src/cli/main.ts`

- **实现步骤**:
  1. 检查 `buildConfigFromAnswers` 返回的对象是否覆盖 `HarnessConfig` 所有必需字段
  2. 为缺失字段添加默认值
  3. 增加类型守卫避免不安全类型断言

- **验收标准**:
  - [x] `buildConfigFromAnswers()` 返回值通过 TypeScript 类型检查
  - [x] 所有必需字段有显式默认值

---

### [TASK-QG-06] 运行全部门禁验证

- **类型**: 测试-验证
- **依赖**: TASK-QG-02, TASK-QG-04, TASK-QG-05
- **状态**: [x] 已完成

- **任务描述**: 运行 TASK-QG-01 测试，确保全部门禁通过
- **输入**: 所有修复后的文件
- **输出**: 4/4 门禁通过

- **实现步骤**:
  1. `npm run typecheck` → 0
  2. `npm run lint` → 0
  3. `npm run build` → 0 + dist 验证
  4. `npm test` → 0（275+ 项）
  5. `npm pack --dry-run` → 验证输出

- **验收标准**:
  - [x] 4 个门禁命令全部返回退出码 0
  - [x] `test/quality-gates.test.ts` 全部通过

---

## 4. 验证方式

### 4.1 手动验证清单

- [x] `npm run typecheck` 零错误
- [x] `npm run lint` 零 error
- [x] `npm run build` 成功
- [x] `npm test` 全部通过
- [x] `npm pack --dry-run` 输出含 `dist/` + `README.md`

---

## 5. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `eslint.config.js` | ESLint 9 flat config | TASK-QG-02 |
| `src/core/transaction.ts` | Transaction 导出修复 | TASK-QG-03 |
| `src/capabilities/review/types.ts` | severity 类型修复 | TASK-QG-04 |
| `src/cli/main.ts` | config 类型守卫 | TASK-QG-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/quality-gates.test.ts` | 门禁验证测试 | TASK-QG-01 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5 分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md（4 需求项 → 6 任务）
> - [x] 任务清单 100% 覆盖 design.md（5 步流程 → 6 任务）
> - [x] 每个任务有验收标准
> - [x] 依赖拓扑已明确
> - [x] 无循环依赖