# 局部技术实现方案 - harness-adapter-skill-runtime

> **⚠️ 边界声明**：本设计仅服务于 `harness-adapter-skill-runtime` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | Claude SKILL.md frontmatter | claudeFrontmatter | object | ✅ 保留 | |
| 2 | Codex SKILL.md frontmatter | codexFrontmatter | object | ✅ 保留 | |
| 3 | references/*.md | referenceDocs | string[] | ✅ 保留 | |
| 4 | scripts/*.mjs | scriptFiles | string[] | ✅ 保留 | |
| 5 | assets/*.md | assetFiles | string[] | ✅ 保留 | |
| 6 | openai.yaml | codexAgentDef | object | ✅ 保留 | |
| 7 | copilot-instructions.md | copilotInstructions | string | ✅ 保留 | |
| 8 | --repair-adapters | repairAdapters | boolean | ✅ 保留 | |
| 9 | --migrate-docsync | migrateDocsync | boolean | ✅ 保留 | |
| 10 | --migrate-sdd | migrateSdd | boolean | ✅ 保留 | |
| 11 | --migrate-review | migrateReview | boolean | ✅ 保留 | |
| 12 | --migrate-docs | migrateDocs | boolean | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：12 个
- **设计输出字段总数**：12 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/adapters/projection-renderer.ts` | adapters/projection-renderer | `renderProjection()` | 扩展逻辑 | 添加 YAML frontmatter 生成 |
| `src/adapters/registry.ts` | adapters/registry | `createAdapterRegistry()` | 扩展逻辑 | 添加 Copilot/Cursor 完整 adapter 定义；修正 copilot projectionPath |
| `src/adapters/projection-writer.ts` | adapters/projection-writer | `applyProjectionWrites()` | 扩展逻辑 | 支持生成 `openai.yaml` 和 `copilot-instructions.md` |
| `src/adapters/source-manager.ts` | adapters/source-manager | `ensureAdapterSources()` | 扩展逻辑 | 生成 shared/skills/harness/ 下的 references/scripts/assets |
| `src/commands/config.ts` | commands/config | `runConfigCommand()` | 替换实现 | 消除硬编码，逐一解析 4 个 `--migrate-*` 参数；添加 `--repair-adapters` |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| `renderProjection` 不生成 frontmatter | 只添加 managed marker | 需添加 YAML frontmatter | 在 MANAGED_MARKER 前插入 frontmatter |
| `registry.ts` copilot projectionPath 错误 | 指向 `.github/copilot/skills/harness/SKILL.md` | 需修正为 `.github/copilot-instructions.md` | 修改 registry 条目 |
| `config.ts` 迁移参数硬编码 | `migrateDocsync: true` 硬编码 | 需从 args 解析 | 使用 commander 解析命令级参数 |
| `source-manager.ts` 不生成 shared 目录 | 只生成各 adapter 独立目录 | 需添加 shared 目录生成 | 扩展 `ensureAdapterSources()` |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 修复投影 | `CLI: harness config --repair-adapters` | 本地进程 | 重新生成所有运行时投影 |
| DocSync 迁移 | `CLI: harness config --migrate-docsync` | 本地进程 | 迁移 .docsync/ |
| SDD 迁移 | `CLI: harness config --migrate-sdd` | 本地进程 | 迁移 openspec/changes/ |
| Review 迁移 | `CLI: harness config --migrate-review` | 本地进程 | 迁移 .kld-review/ |
| Docs 迁移 | `CLI: harness config --migrate-docs` | 本地进程 | 迁移 docs/adr/ |

### 4.2 接口详细设计

#### 接口 1：--repair-adapters

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --repair-adapters | boolean | 是 | 触发修复 | 仅 config 命令有效 |
| --ai-tools | string[] | 否 | 限定工具 | 枚举：claude/codex/copilot/cursor |
| --dry-run | boolean | 否 | 预览 | 写入文件数量必须为 0 |

**业务逻辑**：
1. 从 `.harness/adapters/**` 读取源模板
2. 对每个 adapter entry 调用 `renderProjection()` 生成投影
3. 通过 transaction 写入 `.claude/`、`.agents/`、`.codex/`、`.github/`
4. 返回修复文件列表

#### 接口 2-5：--migrate-* 参数

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --migrate-docsync | boolean | 否 | DocSync 迁移 | 配合 --dry-run |
| --migrate-sdd | boolean | 否 | SDD 迁移 | 配合 --dry-run |
| --migrate-review | boolean | 否 | Review 迁移 | 配合 --dry-run |
| --migrate-docs | boolean | 否 | Docs 迁移 | 配合 --dry-run |

**业务逻辑**（消除硬编码）：
```typescript
// 从 context.command 的 args 中解析迁移参数
const args = context.args; // ['--migrate-docsync', '--dry-run']
const options: MigrationOptions = {
  migrateDocsync: args.includes('--migrate-docsync'),
  migrateSdd: args.includes('--migrate-sdd'),
  migrateReview: args.includes('--migrate-review'),
  migrateDocs: args.includes('--migrate-docs'),  // 新增
};
```

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
--repair-adapters:
  ensureAdapterSources(cwd, entries)  // 确保源模板存在
  → planProjectionWrites(cwd, entries)  // 规划投影写入
  → applyProjectionWrites(cwd, entries, tx)  // 执行投影写入
  → commitTransaction(tx)
  → AdapterProjectionStatus[]

--migrate-*:
  parseArgs(context.args) → MigrationOptions
  → detectLegacySources(cwd) → LegacySource[]
  → buildMigrationPlan(cwd, options, paths) → MigrationPlan
  → applyMigrationPlan(plan, paths, tx)
  → commitTransaction(tx)
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

#### frontmatter 生成

```typescript
// Claude SKILL.md frontmatter
const CLAUDE_FRONTMATTER = `---
name: harness
description: Use the local Harness CLI to inspect codebases, sync agent docs, drive feature development, review changes, and search project knowledge.
when_to_use: Use when the user asks to scan a project, update docs, create or continue a feature spec, check implementation against specs, review code, or search archived project knowledge.
argument-hint: "[inspect|sync|develop|review|knowledge] [args]"
user-invocable: true
disable-model-invocation: false
allowed-tools: Read Grep Glob Bash(harness *) Bash(npx @hunterzheng/harness *)
model: inherit
effort: medium
paths:
  - ".harness/**"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "README.md"
  - "openspec/**"
---`;

// Codex SKILL.md frontmatter
const CODEX_FRONTMATTER = `---
name: harness
description: Use the local Harness CLI for project inspection, document sync, feature development, code review, and knowledge search.
---`;
```

#### shared 目录生成

```typescript
function ensureSharedSkillSources(cwd: string): void {
  const sharedBase = resolve(cwd, '.harness/adapters/shared/skills/harness');

  // references/
  const refs = ['command-contract.md', 'document-contract.md', 'agent-orchestration.md', 'safety.md'];
  for (const ref of refs) {
    const p = resolve(sharedBase, 'references', ref);
    if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, generateRefContent(ref)); }
  }

  // scripts/
  const scripts = ['validate-workspace.mjs', 'run-harness.mjs', 'parse-result.mjs'];
  for (const s of scripts) {
    const p = resolve(sharedBase, 'scripts', s);
    if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, generateScriptContent(s)); }
  }

  // assets/
  const assets = ['AGENTS.block.md', 'CLAUDE.template.md', 'review-report.template.md'];
  for (const a of assets) {
    const p = resolve(sharedBase, 'assets', a);
    if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, generateAssetContent(a)); }
  }
}
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 备注 |
|------|------|------|------|
| YAML | 1.2 | openai.yaml 格式 | 回退 Markdown |

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |
| core/legacy-sources | `detectLegacySources`, `buildMigrationPlan`, `applyMigrationPlan` | cwd, options, paths | MigrationPlan | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 文件系统写权限 | `.harness/adapters/**` 和投影路径 | 本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| frontmatter 生成失败 | SKILL.md 写入失败 | 返回错误码 2205 | "frontmatter 生成失败" |
| references/scripts/assets 生成失败 | 源文件目录创建失败 | 返回错误码 2206 | "源文件生成失败" |
| Copilot 投影生成失败 | copilot-instructions.md 写入失败 | 返回错误码 2207 | "Copilot 投影生成失败" |
| openai.yaml 生成失败 | Codex agent 定义写入失败 | 返回错误码 2208 | "openai.yaml 生成失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：通过 transaction 回滚

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| Skill 名称 | skill.name | "harness" | 固定 |
| 源文件基础路径 | adapters.sharedBase | ".harness/adapters/shared/skills/harness" | 固定 |

### 9.2 开关配置

无。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：5 个需修改文件已明确
> - [x] **现有约束已识别**：4 个约束已列出
> - [x] **字段完整性**：12 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：YAML 1.2
> - [x] **环境权限已确认**：文件系统写权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
