# 局部技术实现方案 - harness-sync

> **定位**：单一 Capability 的业务维度技术实现方案  
> **边界声明**：本设计只覆盖安装产物合规修复中的根文档同步、managed block 迁移和用户可见文档净化，不设计 Skill runtime、Hook runtime 或 doctor 的完整实现。  
> **质量红线专注**：只更新 Harness managed block，保留用户手写内容，并隐藏 DocSync/GSD/kld-sdd/kld-review 等内部来源命令名。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | 初始化和 sync 写入根文档 | `syncManagedRootDocuments()` | 行为契约 | 保留 | init 与 `harness sync` 共用同一文档同步逻辑 |
| 2 | Harness managed block | `MANAGED_BLOCK_START = "<!-- harness:start -->"`、`MANAGED_BLOCK_END = "<!-- harness:end -->"` | 标记常量 | 保留 | 统一新规范 marker |
| 3 | 移除旧 DocSync 日常命令暴露 | `detectInternalSourceExposure()` 与 `sanitizeUserVisibleContent()` | 校验/净化逻辑 | 保留 | 防止用户可见文档继续展示旧入口 |
| 4 | AGENTS managed block | `renderAgentsManagedBlock(context)` | 文档模板 | 保留 | 写入 `harness` Skill 与 inspect/sync/develop/review/knowledge 工作流 |
| 5 | 不展示 `/docsync:init`、`/docsync:sync` | `FORBIDDEN_DAILY_UX_PATTERNS` | 规则集合 | 保留 | 作为 2407 诊断依据 |
| 6 | CLAUDE short entry | `renderClaudeShortEntry(context)` | 文档模板 | 保留 | 指向 `.claude/skills/harness/SKILL.md` |
| 7 | 保留 CLAUDE 用户内容 | `upsertManagedBlock()` | 写入算法 | 保留 | 仅替换 managed block |
| 8 | Codex short entry | `renderCodexShortEntry(context)` | 文档模板 | 保留 | 在 `AGENTS.md` 写入 `.agents/skills/harness/SKILL.md` 指针 |
| 9 | AI 工具 CLI 触发 harness 工作流 | `renderWorkflowUsage()` | 文档模板 | 保留 | 明确日常入口在 AI 工具 CLI 内发生 |
| 10 | README daily usage | `renderReadmeUsageBlock(context)` | 文档模板 | 保留 | 只展示允许命令与自然语言触发方式 |
| 11 | 允许 `npx @hunterzheng/harness` | `ALLOWED_DAILY_COMMANDS` | 白名单 | 保留 | README/AGENTS 日常使用可展示一次安装入口 |
| 12 | 允许 `harness inspect/sync/develop/review/knowledge` | `ALLOWED_DAILY_COMMANDS` | 白名单 | 保留 | 用户可见工作流命令 |
| 13 | 内部来源说明上下文 | `UserVisibleScope` / `InternalSourceScope` | 分类模型 | 保留 | 内部来源名只允许出现在迁移/开发者说明 |
| 14 | 只替换 `<!-- harness:start -->` 到 `<!-- harness:end -->` | `upsertManagedBlock()` | 写入算法 | 保留 | 防止覆盖用户内容 |
| 15 | 旧 `docsync` block 迁移 | `migrateLegacyManagedBlock()` | 迁移算法 | 保留 | 兼容旧项目 |
| 16 | 报告原 block 名称 | `LegacyBlockMigration.fromBlockName` | 报告字段 | 保留 | 满足迁移可追踪 |
| 17 | 报告目标 block 名称 | `LegacyBlockMigration.toBlockName` | 报告字段 | 保留 | 满足迁移可追踪 |
| 18 | 报告受影响文件 | `LegacyBlockMigration.path` | 报告字段 | 保留 | 满足迁移可追踪 |
| 19 | 报告是否保留用户内容 | `LegacyBlockMigration.preservedUserContent` | 报告字段 | 保留 | 验收用户内容保护 |
| 20 | `harness sync` | `runSyncCommand()` | CLI 入口 | 保留 | 现有命令继续承载同步 |
| 21 | 初始化流程内部 sync | `executePostWizardIntegration()` 调用 `syncManagedRootDocuments()` | 内部调用 | 保留 | 避免 init 直接手写 AGENTS/CLAUDE |
| 22 | Managed documents | `SyncDocumentResult[]` | 输出类型 | 保留 | CLI data 中列出文档状态 |
| 23 | sync report | `.harness/reports/sync/<timestamp>-sync.md` | 输出文件 | 保留 | 记录同步与迁移 |
| 24 | JSON drift report | `SyncResult.drift`、`documents`、`exposures`、`migrations` | JSON 输出 | 保留 | 供 `--json` 和测试断言 |
| 25 | Node.js `>=20.0.0` | 继承 CLI 运行时约束 | 版本依赖 | 保留 | 不新增运行时依赖 |
| 26 | 2405 Legacy block migration conflict | `SYNC_LEGACY_BLOCK_MIGRATION_CONFLICT` | 错误码 | 保留 | 旧 block 与用户内容无法安全区分 |
| 27 | 2406 Harness managed block missing | `SYNC_MANAGED_BLOCK_MISSING` | 错误码 | 保留 | 初始化后应有 block 却不存在 |
| 28 | 2407 Internal source exposed | `SYNC_INTERNAL_SOURCE_EXPOSED` | 错误码 | 保留 | 用户可见文档暴露内部来源命令名 |

### 1.2 完整性自检

- **用户输入字段总数**：28 个
- **设计输出字段总数**：28 个
- **差异说明**：无字段移除；`README`、`AGENTS`、`CLAUDE` 的具体文案被归入模板渲染函数，旧 block 与内部来源扫描被结构化为诊断模型。
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/sync/command.ts` | sync command module | `MANAGED_BLOCK_START`、`MANAGED_BLOCK_END` | 替换实现 | 从 `harness-managed:start/end` 迁移到 `harness:start/end`，并兼容旧 marker 检测 |
| `src/capabilities/sync/command.ts` | sync command module | `generateManagedBlock()` | 重构抽取 | 拆分为 `renderAgentsManagedBlock()`、`renderClaudeShortEntry()`、`renderCodexShortEntry()`、`renderReadmeUsageBlock()` |
| `src/capabilities/sync/command.ts` | sync command module | `runSyncCommand()` | 扩展逻辑 | 读取 config、按所选 AI 工具决定文档目标、执行 legacy block 迁移与内部来源扫描 |
| `src/capabilities/sync/command.ts` | sync command module | `generateReportContent()` | 扩展逻辑 | 报告 migrations、exposures、preservedUserContent、2405/2406/2407 诊断 |
| `src/capabilities/sync/types.ts` | sync types | `DocumentKind`、`SyncDocumentResult`、`SyncResult` | 新增字段 | 增加 `migrations`、`exposures`、`blockRange`、`preservedUserContent` 等结构 |
| `src/cli/main.ts` | CLI main | `executePostWizardIntegration()` | 替换实现 | 初始化时不再直接 `writeFileSync` 写 AGENTS/CLAUDE，而调用 sync 文档服务 |
| `src/core/config-schema.ts` | config schema | `createDefaultConfig()`、`validateHarnessConfig()` | 扩展逻辑 | documents 默认 marker 与 managed 文档列表对齐新规范 |
| `src/core/types.ts` | core types | `HarnessConfig.documents` | 新增字段 | 建议加入 `managedBlockStart`、`managedBlockEnd`、`legacyBlockNames` |
| `src/adapters/projection-renderer.ts` | projection renderer | `sanitizeInternalNames()`、`INTERNAL_NAME_MAP` | 复用/扩展 | sync 文档渲染复用内部来源名净化规则 |
| `src/adapters/source-manager.ts` | source manager | `generateAssetContent()` 的 `AGENTS.block`、`CLAUDE.template` | 替换模板 | 资产模板内容与 sync managed block 保持一致 |
| `test/capabilities/sync.test.ts` | sync tests | `runSyncCommand` 相关用例 | 扩展测试 | 新增 managed block、legacy block、内部来源暴露、用户内容保留断言 |
| `test/readme-validation.test.ts` | README validation | 内部来源名与安装命令断言 | 扩展测试 | 对生成/同步 README 的 daily usage 进行 fixture 验证 |

### 2.2 需新建的文件

| 文件路径（建议） | 模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/sync/managed-block.ts` | managed block service | upsert、迁移、冲突检测、用户内容保留判断 | 被 `command.ts` 调用 | 将字符串替换从命令入口拆出 |
| `src/capabilities/sync/document-templates.ts` | sync document templates | 渲染 AGENTS/CLAUDE/Codex/README managed block | 被 `managed-block.ts` 调用 | 集中维护用户可见文案 |
| `src/capabilities/sync/internal-source-guard.ts` | internal source guard | 扫描用户可见文档中的旧来源命令名 | 复用 sanitizer map | 触发 2407 |
| `test/capabilities/sync-managed-block.test.ts` | managed block tests | TDD 覆盖 block upsert 与迁移 | vitest | 重点测“不覆盖用户手写内容” |
| `test/capabilities/sync-internal-source-guard.test.ts` | source exposure tests | TDD 覆盖 2407 | vitest | 区分 daily UX 与 internal explanation |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| sync 依赖 facts | `runSyncCommand()` 要求 `.harness/facts/repo-map.json` 存在 | init 阶段可能尚未 inspect | 文档同步服务支持 `factsPath` 可选；缺 facts 时仍能写入口 block，但 `harness sync` 命令保持 2404 |
| 当前 marker 不一致 | 代码使用 `<!-- harness-managed:start -->` | 新 spec 要求 `<!-- harness:start -->` | 新 marker 作为 canonical，旧 marker 作为迁移来源 |
| init 直接写根文档 | `executePostWizardIntegration()` 用 `writeFileSync` 创建 AGENTS/CLAUDE | 会绕过用户内容保护和净化规则 | init 调用同一 managed document 服务 |
| README/AGENTS/CLAUDE 模板分散 | `sync/command.ts` 与 `source-manager.ts` 都有模板 | 容易出现文案漂移 | 抽出 `document-templates.ts`，source assets 复用或同步快照 |
| 内部来源净化已存在 | `projection-renderer.ts` 有 `sanitizeInternalNames()` | sync 需要更严格：不仅替换，还要诊断 | 保留 sanitizer，新增 scope-aware exposure detector |
| 事务写入已存在 | sync 使用 `beginTransaction()`、`stageWrite()` | managed block 写入应继续事务化 | upsert 只返回 plan，最终由 command 统一 stageWrite |

---

## 3. 局部前端设计

本 Capability 不包含 Web 前端。用户界面是 CLI 文本/JSON 输出和目标项目 Markdown 文档，具体输出结构在第 4、5、6 节定义。

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| 不适用 | CLI capability | 无浏览器 UI | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| 不适用 | N/A | N/A | N/A |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| 不适用 | N/A | N/A | N/A |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 不适用 | N/A | N/A | N/A |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 参数解析 | `parseSyncArgs(args)` | 函数调用 | 继续解析 `--check`、`--fast`、`--docs` |
| 文档同步服务 | `syncManagedRootDocuments(cwd, request)` | 函数调用 | 规划或写入根文档 managed block |
| Managed block upsert | `upsertManagedBlock(existing, block, options)` | 函数调用 | 只替换 Harness block，保留其他内容 |
| 旧 block 迁移 | `migrateLegacyManagedBlock(existing, options)` | 函数调用 | 将 `docsync` block 迁移为 Harness block |
| 内部来源扫描 | `detectInternalSourceExposure(path, content, scope)` | 函数调用 | 发现用户可见旧命令名并返回 2407 |
| CLI sync | `harness sync` | 命令 | 输出 managed documents、sync report、JSON drift report |
| 初始化内部 sync | `executePostWizardIntegration()` | 内部调用 | 初始化后调用文档同步服务写 AGENTS/CLAUDE/Codex 入口 |

### 4.2 接口详细设计

#### 接口 1：文档同步服务

**基本信息**：
- 路径：`src/capabilities/sync/managed-block.ts`
- 方法：`syncManagedRootDocuments(cwd: string, request: ManagedRootDocumentRequest): ManagedRootDocumentResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | string | 是 | 目标项目根目录 | 必须可解析 |
| `request.config` | `HarnessConfig` | 是 | 当前 harness 配置 | 用于判断 selected tools 和 capabilities |
| `request.mode` | `"sync" \| "check" \| "dry-run" \| "init"` | 是 | 调用模式 | init 可在 facts 缺失时工作 |
| `request.docs` | `DocumentKind[]` | 否 | 文档过滤 | 默认按 config 选择 `readme/agents/claude` |
| `request.factsPath` | string | 否 | facts 路径 | `harness sync` 必须存在，init 可为空 |
| `request.timestamp` | string | 否 | 报告时间戳 | 便于测试固定输出 |

**响应结构**：

```ts
interface ManagedRootDocumentResult {
  documents: SyncDocumentResult[];
  migrations: LegacyBlockMigration[];
  exposures: InternalSourceExposure[];
  drift: boolean;
  warnings: string[];
  blockingCode?: 2405 | 2406 | 2407;
}
```

**业务逻辑**：
1. 根据 `config.aiTools` 与 `config.capabilities.sync` 选择文档目标。
2. 渲染每个目标文档的 canonical Harness block。
3. 若存在 `<!-- harness:start -->...<!-- harness:end -->`，只替换该范围。
4. 若存在旧 `<!-- harness-managed:start -->` 或 `<!-- docsync:start -->`，走迁移路径并记录 `LegacyBlockMigration`。
5. 若旧 block 边界缺失、嵌套或与用户内容无法区分，返回 2405，不写该文档。
6. 写入或 check 后扫描用户可见范围；若仍暴露 `/docsync:init`、`/docsync:sync`、`GSD`、`kld-sdd`、`kld-review` 等作为命令或 Skill 名称，返回 2407。

#### 接口 2：Managed block upsert

**基本信息**：
- 路径：`src/capabilities/sync/managed-block.ts`
- 方法：`upsertManagedBlock(existing: string | null, block: ManagedBlock, options: UpsertManagedBlockOptions): UpsertManagedBlockResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `existing` | string \| null | 是 | 当前文档内容 | null 表示文档不存在 |
| `block.kind` | `DocumentKind` | 是 | 文档类型 | `readme/agents/claude/copilot` |
| `block.content` | string | 是 | 新 Harness block 内容 | 必须包含 start/end marker |
| `options.allowLegacyMigration` | boolean | 是 | 是否迁移旧 block | sync/init 为 true |
| `options.heading` | string | 否 | 文档不存在时的标题 | 默认按 target label |

**响应结构**：

```ts
interface UpsertManagedBlockResult {
  status: "created" | "updated" | "unchanged" | "migrated" | "blocked";
  content: string;
  migration?: LegacyBlockMigration;
  preservedUserContent: boolean;
  message?: string;
  code?: 2405 | 2406;
}
```

**业务逻辑**：
1. 文档不存在时创建标题和 Harness block。
2. 存在 canonical block 时仅替换 block 范围。
3. 存在旧 `docsync` block 时迁移为 canonical block，保留旧 block 外全部内容。
4. 存在缺失结束 marker 的旧 block 时阻断，返回 2405。
5. upsert 后校验必须包含 canonical block，否则返回 2406。

#### 接口 3：内部来源暴露扫描

**基本信息**：
- 路径：`src/capabilities/sync/internal-source-guard.ts`
- 方法：`detectInternalSourceExposure(path: string, content: string, scope: UserVisibleScope): InternalSourceExposure[]`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `path` | string | 是 | 文档相对路径 | 用于报告 |
| `content` | string | 是 | 待扫描文档内容 | 仅扫描用户可见章节 |
| `scope` | `"daily-ux" \| "internal-explanation"` | 是 | 文档上下文 | daily-ux 更严格 |

**响应结构**：

```ts
interface InternalSourceExposure {
  path: string;
  token: "docsync" | "gsd" | "kld-sdd" | "kld-review";
  line: number;
  scope: UserVisibleScope;
  code: 2407;
  message: string;
}
```

**业务逻辑**：
1. daily-ux 范围中禁止 `/docsync:init`、`/docsync:sync`、`docsync` Skill、`GSD`、`kld-sdd`、`kld-review`。
2. internal-explanation 范围允许出现内部来源名，但不得以“运行/使用/执行/Skill 名称”形式出现。
3. 返回 exposures 后，`--check` 模式报告 drift，sync/init 模式阻断写入或返回 warning 取决于是否属于生成内容。

---

## 5. 局部数据模型

### 5.1 数据结构设计

#### 模型：ManagedDocumentTarget

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| kind | `DocumentKind` | 是 | 无 | 文档类型 | N/A |
| path | string | 是 | 无 | 相对目标路径，如 `AGENTS.md` | N/A |
| label | string | 是 | 无 | 报告显示名 | N/A |
| enabledWhen | string | 是 | 无 | 生成条件，如 `aiTools.claude` | N/A |
| userVisibleScope | `UserVisibleScope` | 是 | `daily-ux` | 内部来源扫描范围 | N/A |

#### 模型：ManagedBlock

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| startMarker | string | 是 | `<!-- harness:start -->` | 起始 marker | N/A |
| endMarker | string | 是 | `<!-- harness:end -->` | 结束 marker | N/A |
| kind | `DocumentKind` | 是 | 无 | 文档类型 | N/A |
| content | string | 是 | 无 | 含 marker 的完整 block | N/A |
| generatedAt | string | 否 | 当前时间 | 报告使用，不写入易漂移正文 | N/A |

#### 模型：LegacyBlockMigration

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| path | string | 是 | 无 | 受影响文档 | N/A |
| fromBlockName | string | 是 | 无 | 如 `docsync`、`harness-managed` | N/A |
| toBlockName | string | 是 | `harness` | 目标 block 名称 | N/A |
| status | `"migrated" \| "blocked"` | 是 | 无 | 迁移结果 | N/A |
| preservedUserContent | boolean | 是 | true | 是否保留 block 外用户内容 | N/A |
| message | string | 否 | 无 | 迁移说明 | N/A |
| code | 2405 \| undefined | 否 | 无 | 冲突时错误码 | N/A |

#### 模型：SyncDocumentResult

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| path | string | 是 | 无 | 文档相对路径 | N/A |
| kind | `DocumentKind` | 是 | 无 | 文档类型 | N/A |
| status | `up-to-date/planned/written/drifted/blocked` | 是 | 无 | 同步状态 | N/A |
| message | string | 否 | 无 | 状态说明 | N/A |
| blockRange | `{ startLine: number; endLine: number }` | 否 | 无 | managed block 行范围 | N/A |
| preservedUserContent | boolean | 否 | true | 是否保留用户内容 | N/A |

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 不使用缓存 | N/A | N/A | 每次 sync/init 实时读取目标文档 | 避免覆盖用户最新手写内容 |

### 5.3 数据流转图

```text
[HarnessConfig + WizardAnswers]
  --> [select document targets]
  --> [render canonical Harness blocks]
  --> [upsert or migrate managed blocks]
  --> [scan internal source exposure]
  --> [stageWrite documents]
  --> [write sync report]
  --> [CliResponse data.documents/migrations/exposures]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

#### 初始化内部 sync

```text
[executePostWizardIntegration]
  --> [ensureWorkspace writes config]
  --> [load selected aiTools/capabilities]
  --> [syncManagedRootDocuments mode=init]
      --> [AGENTS block always when sync enabled]
      --> [CLAUDE short entry when aiTools.claude]
      --> [Codex pointer in AGENTS when aiTools.codex]
  --> [append artifacts and warnings]
```

关键规则：
- init 不直接手写 `AGENTS.md`、`CLAUDE.md`。
- 目标文档已存在时，只插入或替换 Harness block，保留 block 外用户内容。
- Codex 入口优先写入 `AGENTS.md` managed block：`.agents/skills/harness/SKILL.md`。

#### `harness sync` 流程

```text
[runSyncCommand]
  --> [parseSyncArgs]
  --> [load config and facts]
  --> [syncManagedRootDocuments mode=sync/check/dry-run]
  --> [generate sync report]
  --> [return CliResponse]
```

关键规则：
- `--check` 不写文件；发现 drift、2406、2407 时返回非零 code。
- `--docs` 只限制文档目标，不降低内部来源扫描要求。
- report 必须写入 `.harness/reports/sync/<timestamp>-sync.md`，其中包含 migrated legacy block 信息。

### 6.2 状态机

```text
[missing-document] --sync--> [created-with-harness-block]
[user-document-without-block] --sync--> [appended-harness-block]
[canonical-block-present] --sync--> [updated-canonical-block]
[docsync-block-present] --safe-migrate--> [migrated-to-harness-block]
[docsync-block-present] --ambiguous--> [blocked:2405]
[expected-block-absent-after-init] --doctor/check--> [missing:2406]
[daily-ux-internal-source-found] --scan--> [blocked:2407]
```

### 6.3 关键算法

#### Managed block upsert

```text
if canonical start/end both exist:
  replace exact range from start marker to end marker
else if legacy block exists:
  migrate legacy range to canonical block and record migration
else if only one marker exists:
  block with 2405
else:
  append canonical block after existing user content

after content planned:
  verify canonical start/end exists
  verify content outside replaced range remains byte-identical
```

#### 旧来源暴露扫描

```text
for each visible line:
  if line belongs to allowed internal explanation heading:
    allow noun mention, forbid command-like forms
  else:
    match forbidden tokens and forbidden command patterns
    emit 2407 exposure
```

禁止样例：
- `/docsync:init`
- `/docsync:sync`
- `docsync Skill`
- `run kld-sdd`
- `use kld-review`
- `GSD workflow`

允许样例：
- `内部来源/迁移说明` 章节中说明“历史来源已迁移为 harness”，但不得要求用户执行旧命令。

#### 文档模板内容原则

AGENTS managed block 必须包含：
- `harness` Skill 作为统一入口。
- `.agents/skills/harness/SKILL.md` 指针（选择 Codex 时）。
- inspect/sync/develop/review/knowledge 工作流。
- AI 工具 CLI 自然语言触发提示。

CLAUDE short entry 必须包含：
- `.claude/skills/harness/SKILL.md` 指针。
- 简短说明通过 Claude Code 中的 harness Skill 触发工作流。

README daily usage 必须只包含：
- `npx @hunterzheng/harness`
- `harness inspect`
- `harness sync`
- `harness develop`
- `harness review`
- `harness knowledge`
- AI 工具自然语言触发方式。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | 本 Capability 完全本地执行 | N/A | N/A | N/A | N/A |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js `node:fs`、`node:path` | Node.js `>=20.0.0` | 读取/写入 Markdown 文档 | 无 | 无 | 沿用现有运行时 |
| Git CLI | 系统提供 | `--fast` 模式读取 changed files | 无 | 无 | 不可用时降级为完整检查 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读写 `README.md`、`AGENTS.md`、`CLAUDE.md`、sync report | `readFileSync`、transaction `stageWrite` | 目标项目 cwd | 必须保护用户内容 |
| Harness transaction | 原子写入文档和报告 | `beginTransaction`、`stageWrite`、`commitTransaction` | `dryRun`/`check` | 继续复用现有模式 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| CLI main | `executePostWizardIntegration()` | wizard answers、config | init 后触发 managed root docs | 已有，需改为调用 sync 服务 |
| Workspace config | `loadHarnessConfig()`、`HarnessConfig.documents` | `.harness/config/harness.config.json` | AI 工具和 managed 文档配置 | 已有，需扩展 documents 字段 |
| Transaction | `stageWrite()` | 文档路径与内容 | 事务化写入 | 已有 |
| Projection renderer | `sanitizeInternalNames()`、`INTERNAL_NAME_MAP` | 文本 | 内部来源名净化 | 已有，可复用 |
| Adapter source assets | `generateAssetContent()` | asset type | AGENTS/CLAUDE 模板 | 已有，需同步模板内容 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 文件写权限 | 写入目标项目根文档和 `.harness/reports/sync` | 用户在目标项目运行 `npx @hunterzheng/harness` 或 `harness sync` |
| Git 可用性 | `--fast` 模式可选 | 系统 PATH |
| 环境变量/密钥 | 无 | N/A |
| 网络策略 | 无网络依赖 | N/A |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| Legacy block migration conflict | `docsync` 或旧 marker 只有 start/end 一端、嵌套、与用户内容无法安全区分 | 返回 2405，不写该文档；报告冲突路径和 marker | 用户知道需要手动整理旧 block |
| Harness managed block missing | init/sync 后预期文档没有 canonical block | 返回 2406；`--check` 视为 drift | 用户知道 root docs 未完成初始化 |
| Internal source exposed | 用户可见文档仍出现旧来源命令名 | 返回 2407；报告 token、line、path | 用户知道还有旧入口暴露 |
| Facts missing | `harness sync` 找不到 repo facts | 保持现有 2404 | 提示先运行 `harness inspect` |
| Invalid docs arg | `--docs` 传入未知类型 | 保持现有 2402 | 提示合法文档类型 |
| Report write failure | `.harness/reports/sync` 写入失败 | 保持 5401 | 提示报告写入失败 |
| Git unavailable in fast mode | `git diff` 失败 | warning 并降级为 full check | 用户看到降级提示 |

### 8.2 重试与降级

- **重试次数**：文件读写不自动重试。
- **重试间隔**：不适用。
- **降级策略**：
  - `--fast` 模式 Git 不可用时降级为完整检查。
  - init 模式 facts 缺失时仍写入口 managed block，但不写依赖 facts 的项目事实摘要。
  - legacy block 冲突时只阻断冲突文档，不覆盖用户内容。
  - 发现 2407 时不自动猜测删除用户手写内容；仅对 Harness 生成 block 使用净化模板。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| Managed 文档列表 | `documents.managed` | `["README.md", "AGENTS.md", "CLAUDE.md"]` | sync 默认目标 |
| Managed block 起始 | `documents.managedBlockStart`（建议新增） | `<!-- harness:start -->` | canonical marker |
| Managed block 结束 | `documents.managedBlockEnd`（建议新增） | `<!-- harness:end -->` | canonical marker |
| Legacy block 名称 | `documents.legacyBlockNames`（建议新增） | `["docsync", "harness-managed"]` | 迁移识别 |
| 生成块前缀 | `documents.generatedBlockPrefix` | `harness` | 与旧字段兼容，不再作为完整 marker 使用 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `capabilities.sync` | 是否写入/更新 sync managed docs | 用户选择决定 |
| `aiTools.claude` | 是否写入 `CLAUDE.md` short entry | 用户选择决定 |
| `aiTools.codex` | 是否在 `AGENTS.md` 写 Codex skill 指针 | 用户选择决定 |
| `--check` | 只检查 drift/缺失/暴露，不写文件 | 用户命令决定 |
| `--fast` | 尝试用 git diff 优化检查范围 | 用户命令决定 |
| `--docs` | 限定同步文档类型 | 用户命令决定 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：`sync/command.ts`、`sync/types.ts`、`cli/main.ts`、`config-schema.ts`、`source-manager.ts` 等修改点已明确。
> - [x] **现有约束已识别**：facts 依赖、旧 marker、init 直接写文档、模板分散、事务写入等约束已列出。
> - [x] **字段完整性**：字段追溯表覆盖 spec 的全部场景、输出类型和错误码。
> - [x] **边界遵守**：未设计 Skill runtime、Hook runtime 或 doctor 的内部逻辑。
> - [x] **全局遵守**：CLI 输出沿用 `code/msg/data/warnings/artifacts`；错误码使用 2405/2406/2407。
> - [x] 前端设计已完成：确认本 Capability 无浏览器 UI。
> - [x] 后端接口已完成：定义 sync 文档服务、upsert、迁移、暴露扫描和 CLI 集成。
> - [x] 数据模型已完成：定义 ManagedDocumentTarget、ManagedBlock、LegacyBlockMigration、SyncDocumentResult。
> - [x] **外部依赖已明确**：仅依赖 Node.js、本地文件系统和可选 Git。
> - [x] **环境权限已确认**：根文档与 sync report 写权限已说明。
> - [x] 异常处理策略已定义：包含 2405/2406/2407、2404、2402、5401 与 fast 降级。
> - [x] 包含足够的局部细节支持任务拆解。
