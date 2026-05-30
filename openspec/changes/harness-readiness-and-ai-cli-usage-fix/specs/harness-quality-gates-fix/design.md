# 局部技术实现方案 - harness-quality-gates-fix

> **⚠️ 边界声明**：本设计仅服务于 `harness-quality-gates-fix`，聚焦 TypeScript/ESLint/tsup/vitest 工程门禁修复。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | typecheck 通过 | `tsc --noEmit` 退出码 0 | command | ✅ 保留 | 直接映射到 npm script |
| 2 | lint 通过 | `eslint src/ test/` 退出码 0 | command | ✅ 保留 | 直接映射 |
| 3 | build 通过 | `tsup` 退出码 0 + dist/ 产物 | command | ✅ 保留 | 增加产物验证 |
| 4 | test 通过 | `vitest run` 退出码 0 | command | ✅ 保留 | 保持现有基线 275 项 |
| 5 | ESLint 9 配置 | `eslint.config.js` | file | ✅ 保留 | 新建 flat config |
| 6 | npm pack 完整性 | `npm pack --dry-run` 验证 | command | ✅ 保留 | 发布包验证 |

### 1.2 完整性自检

- **用户输入字段总数**：6 个
- **设计输出字段总数**：6 个
- **差异说明**：无差异
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `package.json` | - | `scripts.lint` | 扩展逻辑 | 确保 lint 脚步正确 |
| `tsconfig.json` | - | compilerOptions/ include/exclude | 扩展逻辑 | 可能需要调整 strict 或 exclude |
| `src/core/transaction.ts` | `Transaction` | 类型导出 | 修复类型 | Transaction 类型未正确导出 |
| `src/capabilities/review/types.ts` | `ReviewFinding` | severity 类型 | 修复类型 | severity 与实际使用不一致 |
| `src/cli/main.ts` | `buildConfigFromAnswers` | 返回类型 | 修复类型 | config 类型转换缺少安全守卫 |

### 2.2 需新建的文件

| 文件路径 | 类/模块名 | 职责 | 继承/实现 | 说明 |
|---------|----------|------|---------|------|
| `eslint.config.js` | - | ESLint 9 flat config | N/A | 新建 ESLint 9 兼容配置 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| ESLint 9 需要 flat config | 项目无 eslint.config.js | lint 命令找不到配置文件 | 创建 eslint.config.js |
| `tsc --noEmit` 报错 | 存在多个类型错误 | 需要逐项修复 | 按错误列表修复 |
| tsup 平台 target | target: node20 | 需要确保 ES2022 语法兼容 | 保持现有配置 |

---

## 3. 局部前端设计

N/A — CLI 工具，无前端组件。

---

## 4. 局部后端接口设计

### 4.1 工程门禁命令契约

```
npm run typecheck    → tsc --noEmit → exit 0
npm run lint         → eslint src/ test/ → exit 0
npm run build        → tsup → exit 0 + dist/bin/harness.js 存在
npm test             → vitest run → exit 0 (275 tests)
npm pack --dry-run   → 验证 files 字段内容
```

### 4.2 ESLint 9 flat config 设计

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', '.harness/', 'coverage/'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

### 4.3 类型错误修复清单

| 文件 | 错误 | 修复方案 |
|------|------|---------|
| `src/core/transaction.ts` | Transaction 类型未导出 | 确保 `export interface Transaction` 或 `export type Transaction` |
| `src/capabilities/review/types.ts` | severity 'info'/'warning' 不在 ReviewFinding 定义 | 统一 ReviewFinding.severity 为 'P0'\|'P1'\|'P2'；考虑扩展为 'P0'\|'P1'\|'P2'\|'info'\|'warning' |
| `src/cli/main.ts` | `buildConfigFromAnswers()` 返回类型与 HarnessConfig 不完全匹配 | 确保所有必需字段有默认值，增加类型守卫 |

---

## 5. 局部数据模型

### 5.1 构建产物结构

```
dist/
├── bin/
│   └── harness.js          # CLI 入口（含 shebang）
├── cli/
│   ├── main.js
│   ├── global-options.js
│   └── ...
├── core/
├── capabilities/
├── adapters/
└── commands/
```

---

## 6. 模块内部逻辑

### 6.1 核心流程 — 门禁修复顺序

```
[1. ESLint 配置]
  → 创建 eslint.config.js（ESLint 9 flat config）
  → 运行 npm run lint → 记录所有 error
  → 逐文件修复 lint error（no-undef / unused-vars）

[2. TypeScript 类型修复]
  → 运行 npm run typecheck → 记录所有 error
  → 逐模块修复：
    a. Transaction 导出
    b. ReviewFinding severity 类型统一
    c. buildConfigFromAnswers 类型守卫
  → 确认 tsc --noEmit 零错误

[3. 构建验证]
  → npm run build
  → 验证 dist/bin/harness.js 存在且可执行
  → node dist/bin/harness.js --help 有输出

[4. 测试保持]
  → npm test → 确认 275 项全部通过
  → 新增 CLI 参数透传测试（3-5 个用例）

[5. 发布包验证]
  → npm pack --dry-run
  → 验证输出包含 dist/ + README.md
  → 验证不含 src/ / test/ / node_modules/（非 bundled）/ cache / secret
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 鉴权方式 | 备注 |
|------|------|------|---------|------|
| typescript | ^5.5.0 | 类型检查 | N/A | devDependency |
| eslint | ^9.6.0 | 代码检查 | N/A | devDependency |
| tsup | ^8.1.0 | 构建工具 | N/A | devDependency |
| vitest | ^2.0.0 | 测试框架 | N/A | devDependency |
| @vitest/coverage-v8 | ^2.1.9 | 测试覆盖率 | N/A | devDependency |

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `src/core/transaction.ts` | Transaction 类型 | - | 正确导出的类型 | 需修复 |
| `src/capabilities/review/types.ts` | ReviewFinding 类型 | - | severity 类型匹配 | 需修复 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Node.js >= 20.0.0 | 运行时 | 系统环境 |
| npm >= 10.0.0 | 包管理 + pack 验证 | 随 Node.js 分发 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| typecheck 失败 | TypeScript 编译错误 | 逐项修复直至零错误 | CI 失败，日志包含错误详情 |
| lint 失败 | ESLint error | 逐文件修复 | CI 失败 |
| build 失败 | tsup 构建错误 | 检查入口路径 + 依赖 | CI 失败 |
| test 失败 | 测试回归 | 修代码或修复测试 | CI 失败 |
| pack 不完整 | files 字段不匹配 | 检查 package.json files | 仅记录警告，不阻断 |

### 8.2 重试与降级

- 门禁失败不重试（确定性错误，需代码修复）
- ESLint warning 不阻断（配置为 warn 级别）
- tsconfig strict 保持 true，不降级

---

## 9. 局部配置

### 9.1 ESLint 配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| ignore 路径 | ignores | dist/, node_modules/, .harness/, coverage/ | 不检查的目录 |

### 9.2 构建配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| tsup entry | entry | src/bin/harness.ts | CLI 入口 |
| tsup format | format | esm | ESM 格式 |
| tsup target | target | node20 | Node.js 20+ |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：5 个修改文件 + 1 个新建文件
> - [x] **现有约束已识别**：ESLint 9 flat config、TypeScript 类型错误
> - [x] **字段完整性**：6 输入 → 6 输出，无丢弃
> - [x] **边界遵守**：仅修改工程配置和类型，不涉及业务逻辑
> - [x] **全局遵守**：保持 tsup 和 vitest 现有配置基准
> - [x] 前端设计已完成：N/A
> - [x] 后端接口已完成：4 个门禁命令契约
> - [x] 数据模型已完成：构建产物结构
> - [x] **外部依赖已明确**：5 个 devDependencies
> - [x] **环境权限已确认**：Node.js >= 20, npm >= 10
> - [x] 异常处理策略已定义：5 种门禁失败 + 降级策略
> - [x] 包含足够的局部细节支持任务拆解：5 步修复流程 + 3 类类型错误