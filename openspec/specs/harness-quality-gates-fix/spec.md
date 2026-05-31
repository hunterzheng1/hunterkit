# spec.md - 能力规格定义

> **定位**：`harness-quality-gates-fix` — 修复 typecheck、lint、build、test 基础工程门禁
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：`npm run typecheck` 必须通过

系统必须修复所有 TypeScript 类型错误，使 `npm run typecheck`（`tsc --noEmit`）零错误通过。

##### 场景：typecheck 通过验证
- **当** 开发者或 CI 执行 `npm run typecheck`
- **预期** 命令必须返回退出码 0，stderr 不得包含 TypeScript 编译错误

##### 场景：已知类型错误修复
- **当** typecheck 发现类型错误
- **预期** 系统必须逐一修复以下已知类型问题：`Transaction` 类型未正确导出、review severity 类型与 spec 定义不匹配、config 类型转换缺少安全守卫、ESLint 找不到 `eslint.config.js`（与 lint 配置联动）

##### 场景：类型边界安全
- **当** 编译时检查类型边界
- **预期** 所有 `as` 类型断言必须有明显的上下文安全约束（如立即加载类型的常量检查）；禁止未经运行时校验的 `as` 转换跨越不兼容类型

#### 需求项：`npm run lint` 必须通过

系统必须配置 ESLint 9 使其在 `src/` 和 `test/` 上零错误通过。

##### 场景：lint 通过验证
- **当** 开发者或 CI 执行 `npm run lint`
- **预期** 命令必须返回退出码 0，不得产生 error 级别问题

##### 场景：ESLint 9 配置生成
- **当** 项目缺少 ESLint 9 兼容的配置文件
- **预期** 系统必须创建 `eslint.config.js`（ESLint 9 flat config 格式），包含 `src/` 和 `test/` 的配置规则

##### 场景：lint 规则约束
- **当** lint 运行
- **预期** 规则集必须至少包含：`no-unused-vars`（警告级别）、`no-undef`（错误级别）、TypeScript 特定规则（通过 `typescript-eslint`）

#### 需求项：`npm run build` 必须通过

系统必须确保 `npm run build`（tsup 构建）零错误完成，构建产物包含完整可执行的 CLI 入口。

##### 场景：build 成功
- **当** 开发者或 CI 执行 `npm run build`
- **预期** 命令必须返回退出码 0，`dist/bin/harness.js` 必须存在且为可执行的 Node.js 脚本

##### 场景：构建产物验证
- **当** build 完成后
- **预期** `node dist/bin/harness.js --help` 必须正常输出帮助信息；`node dist/bin/harness.js` 至少能进入交互模式或返回明确错误

##### 场景：npm pack 完整性
- **当** 执行 `npm pack --dry-run`
- **预期** 输出必须包含 `dist/` 目录内容和 `README.md`，不得包含 `src/`、`test/`、`node_modules/`（除 bundled）、cache、secret、本地 context 或调试文件

#### 需求项：`npm test` 必须保持通过

系统必须确保 `npm test`（vitest run）继续通过，不能因类型错误或参数修复引入回归。

##### 场景：测试套件通过
- **当** 开发者或 CI 执行 `npm test`
- **预期** 所有测试（当前基线 275 项）必须通过，无失败、无挂起（pending）测试

##### 场景：新增测试覆盖修复点
- **当** 修复 CLI 参数透传和帮助输出
- **预期** 系统必须新增测试用例覆盖：`main()` 入口参数透传、`--help` 输出内容、全局选项与命令参数分离、未知命令错误码

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 质量门禁命令行契约

```bash
npm run typecheck    # tsc --noEmit → 退出码 0
npm run lint         # eslint src/ test/ → 退出码 0
npm run build        # tsup → 退出码 0, dist/ 产物完整
npm test             # vitest run → 退出码 0, 全部通过
npm pack --dry-run   # 验证发布包内容
```

#### ESLint 9 配置契约

```javascript
// eslint.config.js — ESLint 9 flat config 格式
export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      // TypeScript 特定规则
    },
  },
];
```

#### tsup 构建契约

| 配置项 | 约束值 | 说明 |
|-------|-------|------|
| 入口 | `src/bin/harness.ts` | CLI 入口文件 |
| 输出目录 | `dist/` | 构建产物 |
| 格式 | ESM | Node.js 模块格式 |
| target | node20 | Node.js 20 兼容 |
| shebang | `#!/usr/bin/env node` | bin 入口必须包含 |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 3001 | typecheck 失败 | `tsc --noEmit` 返回非零 |
| 3002 | lint 失败 | `eslint` 返回非零 |
| 3003 | build 失败 | `tsup` 返回非零 |
| 3004 | test 失败 | `vitest run` 返回非零 |
| 3005 | 发布包不完整 | `npm pack --dry-run` 缺失必需文件 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| typecheck 时间 | < 30000 毫秒 (P95) | TypeScript 编译检查 |
| lint 时间 | < 30000 毫秒 (P95) | ESLint 检查 |
| build 时间 | < 30000 毫秒 (P95) | tsup 构建 |
| test 时间 | < 60000 毫秒 (P95) | 全量测试运行 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 1024 MB | typecheck + lint + build + test |
| 存储 | < 20 MB | dist/ 构建产物上限 |

### 3.3 超时配置
- 总超时（四个门禁合计）：< 180000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `tsconfig.json`：可能需要调整 `include`/`exclude` 或 `strict` 设置
- [ ] `eslint.config.js`：新建 ESLint 9 flat config 文件
- [ ] `src/core/transaction.ts`：确保 `Transaction` 类型正确导出
- [ ] `src/capabilities/review/types.ts`：确保 severity 类型与实际使用一致
- [ ] `src/cli/main.ts`：确保 config 类型转换有安全守卫
- [ ] `package.json`：确保 `files` 字段正确包含 `dist/` 和 `README.md`
- [ ] `.gitignore`：确保 `.npmrc`、`.npmignore` 已忽略

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 构建和测试 | 阻断 CI |
| 构建工具 | tsup | ^8.1.0 | TypeScript 构建 | 降级为 tsc |
| 类型检查 | TypeScript | ^5.5.0 | 静态类型检查 | 阻断 CI |
| 测试框架 | vitest | ^2.0.0 | 单元测试 | 降级为 node:test |
| Lint | ESLint | ^9.6.0 | 代码规范检查 | 降级为 warning 不阻断 |
| 代码打包 | npm | >= 10.0.0 | 发布包打包 | 阻断发布 |

### 4.3 数据存储
无新增数据存储。

---

## 5. 安全与合规

### 5.1 权限要求
N/A — 本地构建验证。

### 5.2 数据安全
- 发布包不得包含：`.npmrc`、`.env*`、`*.pem`、`*.key`、cache、secret、本地 context、调试文件

### 5.3 审计要求
- CI 日志必须记录每个门禁的通过/失败状态和执行时间
- `npm pack --dry-run` 输出必须审查发布包内容

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：构建产物接口不变；CI 门禁配置变化不影响产品行为

### 6.2 数据兼容性
- 数据迁移方案：无
- 回滚策略：Git 版本控制回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（4 个需求项，11 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
> - [x] 若跳过 proposal.md，影响范围已在此补齐（proposal.md 已存在）