# 实施任务拆解 - harness-adapter-skill-runtime

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-adapter-skill-runtime` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-adapter-skill-runtime/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-adapter-skill-runtime/design.md` | 当前能力设计 |

### 1.2 实现范围

- 完善 Claude/Codex 投影 frontmatter 生成
- 生成 shared/skills/harness/ 下的 references/scripts/assets
- 添加 Copilot/Cursor adapter 定义
- 生成 openai.yaml 和 copilot-instructions.md
- 实现 `--repair-adapters` 和 4 个 `--migrate-*` 参数

### 1.3 技术栈

- 语言：TypeScript (ESM)
- 依赖：YAML 1.2

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1 (测试骨架，可并行)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TASK-AR-01 ✅│  │ TASK-AR-02 ✅│  │ TASK-AR-03 ✅│       │
│  │ frontmatter  │  │ shared目录   │  │ 迁移参数测试  │       │
│  │ 测试骨架     │  │ 测试骨架     │  │ 骨架         │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-AR-04 ✅│  │ TASK-AR-05 ✅│  │ TASK-AR-06 ✅│  ││
│  │  │ frontmatter  │  │ shared目录   │  │ Copilot/     │  ││
│  │  │ 生成实现     │  │ 生成实现     │  │ Cursor适配   │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 02    │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (配置命令 + 验证)                            │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-AR-07 ✅│  │ TASK-AR-08 ✅│                │││
│  │  │  │ repair+迁移  │  │ 测试验证     │                │││
│  │  │  │ 依赖: 04,05 │  │ 依赖: 07    │                │││
│  │  │  └──────────────┘  └──────────────┘                │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-AR-01, TASK-AR-02, TASK-AR-03 | ✅ 是 | 无 |
| 层级 2 | TASK-AR-04, TASK-AR-05, TASK-AR-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-AR-07 | - | TASK-AR-04, 05 |
| 层级 3 | TASK-AR-08 | - | TASK-AR-07 |

---

## 3. 原子任务清单

### [TASK-AR-01] 编写 frontmatter 生成单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `renderProjection()` 的 YAML frontmatter 生成创建测试骨架。

#### 输入
- `src/adapters/projection-renderer.ts` 函数签名

#### 输出
- `test/adapters/projection-renderer.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('frontmatter 生成')` 块
2. 编写 Claude SKILL.md frontmatter 测试（验证包含 name/description/when_to_use/allowed-tools 等字段）
3. 编写 Codex SKILL.md frontmatter 测试

#### 验收标准
- [ ] 包含 2 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「Claude/Codex 投影 frontmatter」
- design.md 章节：§6.1 frontmatter 生成

---

### [TASK-AR-02] 编写 shared 目录和 Copilot/Cursor 测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 shared/skills/harness/ 目录生成和 Copilot/Cursor adapter 创建测试骨架。

#### 输入
- `src/adapters/source-manager.ts` 和 `src/adapters/registry.ts` 函数签名

#### 输出
- `test/adapters/source-manager.test.ts` 和 `test/adapters/registry.test.ts` 追加测试

#### 实现步骤
1. 编写 shared 目录生成测试（验证 references/scripts/assets 子目录和文件）
2. 编写 Copilot adapter 注册测试
3. 编写 Cursor adapter 注册测试
4. 编写 openai.yaml 生成测试
5. 编写 copilot-instructions.md 生成测试

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「shared 目录」「Copilot/Cursor adapter」
- design.md 章节：§6.1 shared 目录生成

---

### [TASK-AR-03] 编写迁移参数和 repair-adapters 测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `config.ts` 的 4 个 `--migrate-*` 参数解析和 `--repair-adapters` 创建测试骨架。

#### 输入
- `src/commands/config.ts` 函数签名

#### 输出
- `test/commands/config.test.ts` 追加测试

#### 实现步骤
1. 编写 4 个 `--migrate-*` 参数独立解析测试
2. 编写 `--repair-adapters` 测试（验证重新生成投影）
3. 编写 `--dry-run` 配合测试

#### 验收标准
- [ ] 包含 6 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「4 个迁移参数」「--repair-adapters」
- design.md 章节：§4.2 接口 1-5

---

### [TASK-AR-04] 实现 frontmatter 生成

- **类型**: 接口层
- **依赖**: TASK-AR-01
- **状态**: [x] 已完成

#### 任务描述
在 `projection-renderer.ts` 的 `renderProjection()` 中添加 YAML frontmatter 生成逻辑。

#### 输入
- Claude/Codex frontmatter 模板（design.md §6.1）

#### 输出
- 扩展后的 `renderProjection()`

#### 实现步骤
1. 定义 `CLAUDE_FRONTMATTER` 和 `CODEX_FRONTMATTER` 常量
2. 在 `renderProjection()` 中根据 adapter 类型插入对应 frontmatter
3. frontmatter 位于 MANAGED_MARKER 之前

#### 验收标准
- [ ] Claude SKILL.md 包含完整 frontmatter
- [ ] Codex SKILL.md 包含完整 frontmatter
- [ ] TASK-AR-01 测试通过

#### 关联设计
- spec.md 章节：需求项「Claude/Codex 投影 frontmatter」
- design.md 章节：§6.1

---

### [TASK-AR-05] 实现 shared 目录生成

- **类型**: 接口层
- **依赖**: TASK-AR-02
- **状态**: [x] 已完成

#### 任务描述
在 `source-manager.ts` 的 `ensureAdapterSources()` 中添加 `.harness/adapters/shared/skills/harness/` 下的 references/scripts/assets 生成。

#### 输入
- shared 目录文件清单（design.md §6.1）

#### 输出
- 扩展后的 `ensureAdapterSources()`

#### 实现步骤
1. 实现 `ensureSharedSkillSources()` 函数
2. 生成 references/（command-contract.md、document-contract.md、agent-orchestration.md、safety.md）
3. 生成 scripts/（validate-workspace.mjs、run-harness.mjs、parse-result.mjs）
4. 生成 assets/（AGENTS.block.md、CLAUDE.template.md、review-report.template.md）
5. 幂等：已存在则跳过

#### 验收标准
- [ ] 3 个子目录各生成正确文件
- [ ] 幂等性保持
- [ ] TASK-AR-02 中 shared 测试通过

#### 关联设计
- spec.md 章节：需求项「shared 目录」
- design.md 章节：§6.1 shared 目录生成

---

### [TASK-AR-06] 添加 Copilot/Cursor adapter 和投影

- **类型**: 接口层
- **依赖**: TASK-AR-02
- **状态**: [x] 已完成

#### 任务描述
在 `registry.ts` 中添加 Copilot/Cursor adapter 定义；在 `projection-writer.ts` 中生成 `openai.yaml` 和 `copilot-instructions.md`；修正 copilot projectionPath。

#### 输入
- adapter 定义规范

#### 输出
- 扩展后的 registry 和 projection-writer

#### 实现步骤
1. 在 `registry.ts` 中添加 copilot 和 cursor adapter 条目
2. 修正 copilot 的 projectionPath 为 `.github/copilot-instructions.md`
3. 在 `projection-writer.ts` 中添加 `openai.yaml` 生成逻辑
4. 添加 `copilot-instructions.md` 生成逻辑

#### 验收标准
- [ ] registry 包含 4 个 adapter（claude/codex/copilot/cursor）
- [ ] openai.yaml 内容正确
- [ ] copilot-instructions.md 内容正确
- [ ] TASK-AR-02 中 Copilot/Cursor 测试通过

#### 关联设计
- spec.md 章节：需求项「Copilot/Cursor adapter」
- design.md 章节：§2.1

---

### [TASK-AR-07] 实现 --repair-adapters 和 4 个 --migrate-* 参数

- **类型**: 接口层
- **依赖**: TASK-AR-04, TASK-AR-05
- **状态**: [x] 已完成

#### 任务描述
在 `config.ts` 中消除硬编码，逐一实现 4 个 `--migrate-*` 参数解析；实现 `--repair-adapters` 从 shared 源模板重新生成投影。

#### 输入
- 现有硬编码迁移逻辑

#### 输出
- 完整的参数解析和修复逻辑

#### 实现步骤
1. 从 `context.args` 解析 `--migrate-docsync`/`--migrate-sdd`/`--migrate-review`/`--migrate-docs`
2. 消除 `migrateDocsync: true` 硬编码
3. 实现 `--repair-adapters`：读取 shared 源模板 → 重新生成所有投影
4. 支持 `--dry-run` 配合

#### 验收标准
- [ ] 4 个迁移参数独立生效
- [ ] `--repair-adapters` 重新生成全部投影
- [ ] `--dry-run` 时不写入文件
- [ ] TASK-AR-03 测试通过

#### 关联设计
- spec.md 章节：需求项「4 个迁移参数」「--repair-adapters」
- design.md 章节：§4.2 接口 1-5、§5.3

---

### [TASK-AR-08] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-AR-07
- **状态**: [x] 已完成

#### 任务描述
运行全部 adapter 相关测试，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/adapters/ test/commands/`
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
| TASK-AR-01 | frontmatter | Claude/Codex 投影 | YAML 字段完整 |
| TASK-AR-02 | shared/adapter | 目录生成、adapter 注册 | 文件存在、内容正确 |
| TASK-AR-03 | 迁移/修复 | 参数解析、dry-run | 错误码、文件数 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| repair-adapters | 已有 shared 源 | --repair-adapters | 重新生成全部投影 |
| migrate-docsync | 有 .docsync/ | --migrate-docsync | 迁移完成 |

### 4.3 手动验证清单

- [ ] Claude SKILL.md 包含 frontmatter
- [ ] shared/skills/harness/ 下有 references/scripts/assets
- [ ] `--repair-adapters` 能修复损坏的投影

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| core/transaction | 内部模块 | beginTransaction/stageWrite | ✅ 就绪 | |
| core/legacy-sources | 内部模块 | detectLegacySources | ✅ 就绪 | |

---

## 6. 代码规范

### 6.1 命名规范

- 常量名：UPPER_SNAKE_CASE（如 `CLAUDE_FRONTMATTER`）
- 方法名：camelCase（如 `ensureSharedSkillSources`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/adapters/projection-renderer.ts` | frontmatter 生成 | TASK-AR-04 |
| `src/adapters/source-manager.ts` | shared 目录生成 | TASK-AR-05 |
| `src/adapters/registry.ts` | Copilot/Cursor adapter | TASK-AR-06 |
| `src/adapters/projection-writer.ts` | openai.yaml/copilot-instructions | TASK-AR-06 |
| `src/commands/config.ts` | 迁移参数+repair | TASK-AR-07 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/adapters/projection-renderer.test.ts` | frontmatter 测试 | TASK-AR-01 |
| `test/adapters/source-manager.test.ts` | shared 目录测试 | TASK-AR-02 |
| `test/adapters/registry.test.ts` | adapter 注册测试 | TASK-AR-02 |
| `test/commands/config.test.ts` | 迁移/修复测试 | TASK-AR-03 |
| `test/pack.test.ts` | npm pack 打包安全测试 | TASK-AR-09 |

---

### [TASK-AR-09] npm pack 打包安全测试

- **类型**: 测试-验证
- **依赖**: TASK-AR-07
- **状态**: [x] 已完成

#### 任务描述
新增 `test/pack.test.ts`，验证 `npm pack --dry-run` 输出不包含 cache、secrets、巨大 context 文件。

#### 输入
- `package.json` 的 `files` 字段配置

#### 输出
- 打包安全测试文件

#### 实现步骤
1. 创建 `test/pack.test.ts`
2. 执行 `npm pack --dry-run --json` 并解析输出
3. 断言打包文件列表不包含 `node_modules/`、`.env*`、`*.pem`、`*.key`
4. 断言打包文件列表不包含 `.harness/cache/`、`.harness/state/`
5. 断言打包文件大小 < 5 MB

#### 验收标准
- [ ] 测试文件创建成功
- [ ] 打包不包含敏感文件
- [ ] 打包不包含 cache/state 目录
- [ ] 打包大小合理

#### 关联设计
- spec.md 章节：proposal §1.1「打包安全未验证」
- design.md 章节：proposal §4.1 `test/pack.test.ts`

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
