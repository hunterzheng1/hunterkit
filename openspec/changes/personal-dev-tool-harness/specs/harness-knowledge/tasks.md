# 实施任务拆解 - harness-knowledge

> **⚠️ 边界声明**：本任务清单仅服务于 `harness-knowledge` Capability，严禁跨模块任务。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-knowledge/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-knowledge/design.md` | 当前能力设计 |

### 1.2 实现范围

- Knowledge 类型定义（`KnowledgeOptions`、`KnowledgeResult`、`KnowledgeDocument`、`KnowledgeSearchResult`、`KnowledgeSource`）
- 参数校验器（`validateKnowledgeOptions()`，index/search/limit/query 校验）
- 配置加载器（`loadKnowledgeConfig()`，读取本地配置）
- 远程配置守卫（`ignoreRemoteKnowledgeConfig()`，忽略远程服务配置）
- 来源注册表（`buildKnowledgeSources()`，默认来源 + 配置来源）
- 路径守卫（`assertSourceInsideProject()`，防越界）
- 文件扫描器（`scanKnowledgeSources()`，扫描 Markdown/JSON/报告）
- 隐私过滤器（`shouldSkipSensitiveFile()`、`redactSensitiveText()`）
- Markdown 解析器（`parseMarkdownDocument()`，提取 title/headings/body）
- 文档切片器（`chunkDocument()`，按标题和段落切片）
- 内容哈希器（`hashContent()`，增量索引依据）
- SQLite 驱动（`openKnowledgeDb()`、`assertFts5Available()`）
- SQLite Schema（`ensureKnowledgeSchema()`，meta/documents/chunks/FTS5 表）
- 增量索引器（`diffDocumentsForIndex()`，path/mtime/hash diff）
- 索引执行器（`runKnowledgeIndex()`，dry-run 或事务写入）
- 搜索器（`searchKnowledge()`，FTS5 查询）
- 片段构建器（`buildSnippet()`，脱敏命中片段）
- 结果排序器（`rankSearchResults()`，score 排序 + kind 加权）
- 报告写入器（`buildKnowledgeReport()`，索引/搜索摘要）
- Knowledge 命令 handler（`runKnowledgeCommand()`）
- 单元测试与集成测试

### 1.3 技术栈

- 语言：TypeScript >= 5.0.0
- 框架：Node.js >= 20.0.0（`fs`、`path`、`crypto` API）
- 数据库：SQLite >= 3.35.0（`better-sqlite3` 或 `sql.js`）
- 搜索扩展：SQLite FTS5 >= 3.35.0
- 文档格式：CommonMark Markdown 0.30
- 依赖：复用 `harness-cli-entrypoint` 的 `CommandContext`、`CliResponse`；复用 `harness-workspace-config` 的 `WorkspacePaths`
- 测试：`vitest` 或 `node:test`

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖) - 类型与配置基础                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ TASK-KN-01   │  │ TASK-KN-02   │  │ TASK-KN-03   │                    │
│  │ 类型定义      │  │ 参数校验      │  │ 配置+来源     │                    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                 │                             │
│         v                 v                 v                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖 L1) - 测试骨架                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────┐    │ │
│  │  │ TASK-KN-04  单元测试骨架（依赖: 01, 02, 03）                   │    │ │
│  │  └──────────────────────────────────────────────────────────────┘    │ │
│  │         │                                                             │ │
│  │         v                                                             │ │
│  │  ┌───────────────────────────────────────────────────────────────┐   │ │
│  │  │  层级 3 (依赖 L2) - 扫描与解析（可并行）                         │   │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │ │
│  │  │  │ TASK-KN-05   │  │ TASK-KN-06   │  │ TASK-KN-07   │        │   │ │
│  │  │  │ 扫描+隐私     │  │ MD解析+切片   │  │ SQLite驱动    │        │   │ │
│  │  │  │ 依赖: 04     │  │ 依赖: 04     │  │ 依赖: 04     │        │   │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │   │ │
│  │  │         │                 │                 │                 │   │ │
│  │  │         v                 v                 v                 │   │ │
│  │  │  ┌────────────────────────────────────────────────────────┐   │   │ │
│  │  │  │  层级 4 (依赖 L3) - 索引与搜索                           │   │   │ │
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │   │ │
│  │  │  │  │ TASK-KN-08   │  │ TASK-KN-09   │  │ TASK-KN-10   │  │   │   │ │
│  │  │  │  │ 增量索引      │  │ 搜索+片段     │  │ 报告写入      │  │   │   │ │
│  │  │  │  │ 依赖: 05~07  │  │ 依赖: 07     │  │ 依赖: 08,09  │  │   │   │ │
│  │  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │   │ │
│  │  │  │         │                 │                 │           │   │   │ │
│  │  │  │         v                 v                 v           │   │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐   │   │   │ │
│  │  │  │  │  层级 5 (依赖 L4) - 命令 Handler + 验证            │   │   │   │ │
│  │  │  │  │  ┌──────────────┐  ┌──────────────┐              │   │   │   │ │
│  │  │  │  │  │ TASK-KN-11   │  │ TASK-KN-12   │              │   │   │   │ │
│  │  │  │  │  │ knowledge命令 │  │ 集成测试      │              │   │   │   │ │
│  │  │  │  │  │ 依赖: 08~10  │  │ 依赖: 11     │              │   │   │   │ │
│  │  │  │  │  └──────────────┘  └──────────────┘              │   │   │   │ │
│  │  │  │  └──────────────────────────────────────────────────┘   │   │   │ │
│  │  │  └─────────────────────────────────────────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-KN-01, TASK-KN-02, TASK-KN-03 | ✅ 是 | 无 |
| 层级 2 | TASK-KN-04 | - | 层级 1 |
| 层级 3 | TASK-KN-05, TASK-KN-06, TASK-KN-07 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-KN-08, TASK-KN-09, TASK-KN-10 | 部分并行（08,09 并行，10 依赖 08,09） | 层级 3 |
| 层级 5 | TASK-KN-11, TASK-KN-12 | 顺序执行 | 层级 4 |

---

## 3. 原子任务清单

### 3.0 任务类型说明

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| 数据层 | 类型定义、Schema | 共享类型和数据结构 |
| 接口层 | 核心服务模块 | 业务逻辑和接口 |
| 配置 | 配置文件、依赖 | 项目配置相关 |
| 测试-骨架 | 测试类结构 | TDD 前置任务 |
| 测试-验证 | 测试用例实现 | 实现后验证 |

---

### [TASK-KN-01] Knowledge 类型定义

- **类型**: 数据层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
定义 knowledge 模块共享的 TypeScript 类型。

#### 输入
- design.md §1.1 字段映射表（25 个字段）、§5.1 数据表设计

#### 输出
- `src/capabilities/knowledge/types.ts`

#### 实现步骤
1. 创建 `src/capabilities/knowledge/types.ts`
2. 定义 `KnowledgeOptions`：`{ index, search, json, limit, dryRun }`
3. 定义 `KnowledgeSource`：`{ root, glob?, kind }`，kind 枚举 `"develop" | "docs" | "rules" | "reports" | "archive" | "custom"`
4. 定义 `KnowledgeDocument`：`{ sourcePath, title, kind, mtimeMs, contentHash, sizeBytes, indexedAt }`，kind 枚举 `"spec" | "adr" | "rule" | "report" | "archive" | "doc"`
5. 定义 `KnowledgeChunk`：`{ id, documentId, ordinal, heading, body }`
6. 定义 `KnowledgeSearchResult`：`{ sourcePath, title, kind, snippet, score }`
7. 定义 `KnowledgeResult`：`{ indexPath, indexedFiles, results }`
8. 定义 `KnowledgeIndexPlan`：`{ toCreate, toUpdate, toDelete, skipped }`
9. 定义 `KnowledgeIndexStats`：`{ created, updated, deleted, skipped, redacted }`
10. 定义 `KnowledgePrivacyStats`：`{ filesSkipped, textRedacted }`
11. 定义 `KnowledgeDbMeta`：`{ schemaVersion, indexedAt }`

#### 验收标准
- [ ] 所有类型与 design.md §1.1 字段追溯表一致
- [ ] `KnowledgeDocument` 包含 sourcePath、mtimeMs、contentHash
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 接口定义
- design.md 章节：§1.1 字段映射表、§5.1 数据表设计

---

### [TASK-KN-02] 参数校验器

- **类型**: 接口层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
实现 `validateKnowledgeOptions()` 函数，校验 index/search/limit/query 参数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- design.md §2.2 `options-validator.ts`

#### 输出
- `src/capabilities/knowledge/options-validator.ts`

#### 实现步骤
1. 创建 `src/capabilities/knowledge/options-validator.ts`
2. 实现 `validateKnowledgeOptions(options: KnowledgeOptions): ValidationResult`：
   - 至少存在 `index` 或 `search` 之一
   - `search` 长度 1-200，不满足返回 2701
   - `limit` 范围 1-50，默认 20
   - 合法返回 `{ valid: true }`

#### 验收标准
- [ ] 无 index 且无 search 时返回参数错误
- [ ] search 为空或超 200 字符返回 2701
- [ ] limit 越界时返回参数错误
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§2.1 错误码 2701
- design.md 章节：§6.3.4 搜索与片段算法

---

### [TASK-KN-03] 配置加载与来源注册

- **类型**: 接口层
- **依赖**: 无
- **状态**: [ ] 未完成

#### 任务描述
实现 `loadKnowledgeConfig()`、`ignoreRemoteKnowledgeConfig()`、`buildKnowledgeSources()` 和 `assertSourceInsideProject()` 函数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- design.md §2.2 相关文件、§6.3.1 Source Registry 算法

#### 输出
- `src/capabilities/knowledge/config-loader.ts`
- `src/capabilities/knowledge/remote-config-guard.ts`
- `src/capabilities/knowledge/source-registry.ts`
- `src/capabilities/knowledge/path-guard.ts`

#### 实现步骤
1. 创建 `config-loader.ts`
2. 实现 `loadKnowledgeConfig(configPath): KnowledgeConfig`：读取 `.harness/config/knowledge.config.json`
3. 创建 `remote-config-guard.ts`
4. 实现 `ignoreRemoteKnowledgeConfig(config): { cleanedConfig, ignoredRemoteConfig }`：
   - 扫描 remote、endpoint、apiKey、rag、vector 字段
   - 发现时设置 `ignoredRemoteConfig=true`
   - 不报错，只标记
5. 创建 `source-registry.ts`
6. 实现 `buildKnowledgeSources(config, projectRoot): KnowledgeSource[]`：
   - 默认来源：`.harness/develop`、`.harness/docs`、`.harness/rules`、`.harness/reports`、`openspec/changes/**/archive`
   - 合并配置来源
   - 来源不存在时记录 skipped
7. 创建 `path-guard.ts`
8. 实现 `assertSourceInsideProject(sourcePath, projectRoot): void`：越界返回 2703

#### 验收标准
- [ ] 配置正确加载
- [ ] 远程配置被忽略并标记
- [ ] 默认来源正确构建
- [ ] 越界路径返回 2703
- [ ] `npx tsc --noEmit` 通过

#### 关联设计
- spec.md 章节：§1 场景（本地与隐私边界）
- design.md 章节：§6.3.1 Source Registry 算法、§6.3.5 本地隐私边界算法

---

### [TASK-KN-04] 单元测试骨架

- **类型**: 测试-骨架
- **依赖**: TASK-KN-01, TASK-KN-02, TASK-KN-03
- **状态**: [ ] 未完成

#### 任务描述
编写 knowledge 模块完整单元测试骨架（红灯状态）。

#### 输入
- 已实现的类型、参数校验、配置模块
- design.md §6.1 核心流程、§6.2 状态机、§8.1 异常分类

#### 输出
- `test/knowledge/knowledge.test.ts`

#### 实现步骤
1. 创建 `test/knowledge/knowledge.test.ts`
2. 创建辅助函数：`createTempKnowledgeProject()`（创建含 `.harness/develop`、`.harness/docs` 等的临时项目）
3. 编写 `validateKnowledgeOptions` 测试骨架
4. 编写 `loadKnowledgeConfig` 测试骨架
5. 编写 `ignoreRemoteKnowledgeConfig` 测试骨架：
   - `should ignore remote config and set flag`
   - `should not error when remote config exists`
6. 编写 `buildKnowledgeSources` 测试骨架
7. 编写 `scanKnowledgeSources` 测试骨架：
   - `should scan markdown files`
   - `should skip non-document files`
   - `should record skipped count`
8. 编写 `shouldSkipSensitiveFile` / `redactSensitiveText` 测试骨架：
   - `should skip .env files`
   - `should skip files matching secretPatterns`
   - `should redact token/key in text`
9. 编写 `parseMarkdownDocument` 测试骨架：
   - `should extract title and headings`
   - `should fallback to plain text on parse failure`
10. 编写 `chunkDocument` 测试骨架：
    - `should split by headings`
    - `should split long chunks by paragraphs`
11. 编写 `hashContent` 测试骨架
12. 编写 `openKnowledgeDb` / `assertFts5Available` 测试骨架：
    - `should open SQLite database`
    - `should return 2704 when FTS5 unavailable`
13. 编写 `ensureKnowledgeSchema` 测试骨架
14. 编写 `diffDocumentsForIndex` 测试骨架：
    - `should detect new documents`
    - `should detect updated documents by mtime/hash`
    - `should detect deleted documents`
    - `should skip unchanged documents`
15. 编写 `runKnowledgeIndex` 测试骨架：
    - `should write to temp db and atomic replace`
    - `should respect dry-run (zero writes)`
    - `should preserve old db on failure`
16. 编写 `searchKnowledge` 测试骨架：
    - `should return results with sourcePath/title/kind/snippet/score`
    - `should return 2702 when index missing`
    - `should respect limit`
17. 编写 `buildSnippet` 测试骨架：
    - `should generate redacted snippet`
18. 编写 `runKnowledgeCommand` 测试骨架：
    - `should index then search when both flags`
    - `should return 2701 for invalid query`
19. 所有测试标记为红灯

#### 验收标准
- [ ] 测试文件可被运行器发现
- [ ] 所有测试处于红灯状态
- [ ] 覆盖 design.md §6.2 状态机所有状态
- [ ] 覆盖 design.md §8.1 所有异常类型

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§6.1 核心流程、§8.1 异常分类

---

### [TASK-KN-05] 文件扫描与隐私过滤

- **类型**: 接口层
- **依赖**: TASK-KN-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `scanKnowledgeSources()`、`shouldSkipSensitiveFile()` 和 `redactSensitiveText()` 函数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/scanner.ts`
- `src/capabilities/knowledge/privacy-filter.ts`

#### 实现步骤
1. 创建 `scanner.ts`
2. 实现 `scanKnowledgeSources(sources, projectRoot): ScannedDocument[]`：
   - 遍历每个 source 的 root/glob
   - 扫描 Markdown/JSON/报告文档
   - 记录 sourcePath、mtimeMs、sizeBytes
   - 记录跳过数量和原因
3. 创建 `privacy-filter.ts`
4. 实现 `shouldSkipSensitiveFile(filePath, secretPatterns): boolean`：
   - 命中 `.env*`、`*token*`、`*secret*`、证书、私钥等模式时返回 true
5. 实现 `redactSensitiveText(text, secretPatterns): string`：
   - 命中敏感模式时替换为 `[REDACTED]`

#### 验收标准
- [ ] 正确扫描 Markdown/JSON 文档
- [ ] 敏感文件被跳过
- [ ] 敏感文本被脱敏
- [ ] 跳过数量正确记录
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（本地知识索引）
- design.md 章节：§6.3.5 本地隐私边界算法

---

### [TASK-KN-06] Markdown 解析与文档切片

- **类型**: 接口层
- **依赖**: TASK-KN-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `parseMarkdownDocument()`、`chunkDocument()` 和 `hashContent()` 函数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/markdown-parser.ts`
- `src/capabilities/knowledge/chunker.ts`
- `src/capabilities/knowledge/hash.ts`

#### 实现步骤
1. 创建 `markdown-parser.ts`
2. 实现 `parseMarkdownDocument(content, sourcePath): ParsedDocument`：
   - 提取 title（第一个 H1 或文件名）
   - 提取 headings 和 body text
   - 解析失败时降级纯文本
3. 创建 `chunker.ts`
4. 实现 `chunkDocument(parsed, targetChars=1200): KnowledgeChunk[]`：
   - 优先按 Markdown 标题拆分
   - 单个 chunk 超过目标长度时按段落继续拆分
   - 每个 chunk 包含 heading、body、ordinal
5. 创建 `hash.ts`
6. 实现 `hashContent(content: string): string`：使用 `crypto.createHash('sha256')`

#### 验收标准
- [ ] Markdown 正确提取 title 和 headings
- [ ] 解析失败时降级纯文本
- [ ] 文档按标题和段落正确切片
- [ ] hash 输出稳定
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（本地知识索引）
- design.md 章节：§6.3.3 Markdown 切片算法

---

### [TASK-KN-07] SQLite 驱动与 Schema

- **类型**: 接口层
- **依赖**: TASK-KN-04
- **状态**: [ ] 未完成

#### 任务描述
实现 `openKnowledgeDb()`、`assertFts5Available()` 和 `ensureKnowledgeSchema()` 函数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/sqlite-driver.ts`
- `src/capabilities/knowledge/sqlite-schema.ts`

#### 实现步骤
1. 创建 `sqlite-driver.ts`
2. 实现 `openKnowledgeDb(dbPath): KnowledgeDb`：
   - 打开 SQLite 数据库
   - 返回 db 实例
3. 实现 `assertFts5Available(db): void`：
   - 执行 `PRAGMA compile_options` 或测试 FTS5 创建
   - 不可用时抛出 2704
4. 创建 `sqlite-schema.ts`
5. 实现 `ensureKnowledgeSchema(db): void`：
   - 创建 `knowledge_meta` 表（key PK, value, updated_at）
   - 创建 `knowledge_documents` 表（id PK, source_path UNIQUE, title, kind, mtime_ms, content_hash, size_bytes, indexed_at, created_at, updated_at）
   - 创建 `knowledge_chunks` 表（id PK, document_id, ordinal, heading, body, created_at, updated_at）
   - 创建 `knowledge_chunks_fts` FTS5 虚拟表（title, heading, body, source_path）
   - 写入 schemaVersion 到 meta 表

#### 验收标准
- [ ] 数据库正确打开
- [ ] FTS5 不可用时返回 2704
- [ ] Schema 正确创建所有表和索引
- [ ] schemaVersion 写入 meta 表
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§2.1 错误码 2704
- design.md 章节：§5.1 数据表设计

---

### [TASK-KN-08] 增量索引与索引执行

- **类型**: 接口层
- **依赖**: TASK-KN-05, TASK-KN-06, TASK-KN-07
- **状态**: [ ] 未完成

#### 任务描述
实现 `diffDocumentsForIndex()` 和 `runKnowledgeIndex()` 函数。

#### 输入
- 所有已实现的 knowledge 模块
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/incremental-indexer.ts`
- `src/capabilities/knowledge/indexer.ts`

#### 实现步骤
1. 创建 `incremental-indexer.ts`
2. 实现 `diffDocumentsForIndex(scanned, existing): KnowledgeIndexPlan`：
   - sourcePath 不存在于 DB → 标记 `create`
   - mtimeMs 和 sizeBytes 未变化 → 跳过 hash 计算
   - mtime 或 size 变化 → 计算 contentHash；hash 变化标记 `update`
   - DB 中存在但文件已删除 → 标记 `delete`
3. 创建 `indexer.ts`
4. 实现 `runKnowledgeIndex(plan, db, options): KnowledgeIndexStats`：
   - `dryRun=true` 时只返回计划，不写入
   - 非 dry-run 时写入临时数据库 `.harness/cache/knowledge.sqlite.tmp`
   - 写入成功后原子替换 `knowledge.sqlite`
   - 失败时保留旧库，删除临时库
   - 写入时先删除旧 chunks，再插入新 chunks 和 FTS rows

#### 验收标准
- [ ] 增量 diff 正确检测新增/更新/删除/未变
- [ ] dry-run 时零写入
- [ ] 写入使用临时库 + 原子替换
- [ ] 失败时保留旧库
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（首次索引、增量索引）
- design.md 章节：§6.3.2 增量索引算法

---

### [TASK-KN-09] 搜索与片段构建

- **类型**: 接口层
- **依赖**: TASK-KN-07
- **状态**: [ ] 未完成

#### 任务描述
实现 `searchKnowledge()`、`buildSnippet()` 和 `rankSearchResults()` 函数。

#### 输入
- `src/capabilities/knowledge/types.ts`
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/searcher.ts`
- `src/capabilities/knowledge/snippet-builder.ts`
- `src/capabilities/knowledge/result-ranker.ts`

#### 实现步骤
1. 创建 `searcher.ts`
2. 实现 `searchKnowledge(db, query, limit): KnowledgeSearchResult[]`：
   - indexPath 不存在时返回 2702
   - 使用 FTS5 `MATCH` 查询 title、heading、body、sourcePath
   - 截断到 limit（默认 20，最大 50）
3. 创建 `snippet-builder.ts`
4. 实现 `buildSnippet(chunk, query): string`：
   - 从命中 chunk 生成片段
   - 再次执行敏感文本脱敏
5. 创建 `result-ranker.ts`
6. 实现 `rankSearchResults(results): KnowledgeSearchResult[]`：
   - 使用 SQLite score 作为基础分
   - 按 kind 与标题命中轻微加权
   - 排序并截断

#### 验收标准
- [ ] FTS5 查询正确执行
- [ ] 索引不存在时返回 2702
- [ ] 片段正确生成且脱敏
- [ ] 结果按 score 排序
- [ ] limit 正确截断
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（知识检索）
- design.md 章节：§6.3.4 搜索与片段算法

---

### [TASK-KN-10] 报告写入

- **类型**: 接口层
- **依赖**: TASK-KN-08, TASK-KN-09
- **状态**: [ ] 未完成

#### 任务描述
实现 `buildKnowledgeReport()` 函数，生成索引/搜索摘要和 ignored remote 说明。

#### 输入
- `src/capabilities/knowledge/types.ts`
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/report-writer.ts`

#### 实现步骤
1. 创建 `src/capabilities/knowledge/report-writer.ts`
2. 实现 `buildKnowledgeReport(result, stats, privacyStats, ignoredRemote): KnowledgeReport`：
   - 包含 indexPath、indexedFiles、搜索结果摘要
   - 包含 skipped/redacted 统计
   - 包含 ignoredRemoteConfig 说明（第一版只支持本地 FTS5）
   - 支持 JSON 与终端文本输出

#### 验收标准
- [ ] 报告包含索引和搜索摘要
- [ ] 包含隐私统计
- [ ] 包含远程配置忽略说明
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 场景（本地与隐私边界）
- design.md 章节：§2.2 `report-writer.ts`

---

### [TASK-KN-11] Knowledge 命令 Handler

- **类型**: 接口层
- **依赖**: TASK-KN-08, TASK-KN-09, TASK-KN-10
- **状态**: [ ] 未完成

#### 任务描述
实现 `runKnowledgeCommand()` 函数，串联 knowledge pipeline 并输出结果。

#### 输入
- 所有已实现的 knowledge 模块
- `test/knowledge/knowledge.test.ts`

#### 输出
- `src/capabilities/knowledge/command.ts`

#### 实现步骤
1. 创建 `src/capabilities/knowledge/command.ts`
2. 实现 `runKnowledgeCommand(context: CommandContext): Promise<CliResponse>`：
   - 解析 `KnowledgeOptions`
   - `validateKnowledgeOptions()` 校验参数
   - `loadKnowledgeConfig()` 加载配置
   - `ignoreRemoteKnowledgeConfig()` 忽略远程配置
   - `buildKnowledgeSources()` 构建来源
   - `assertSourceInsideProject()` 校验路径
   - `index=true` 时：
     - `scanKnowledgeSources()` 扫描
     - `shouldSkipSensitiveFile()` 过滤
     - `diffDocumentsForIndex()` 增量 diff
     - `runKnowledgeIndex()` 执行索引
   - `search` 存在时：
     - 确认 indexPath 存在，不存在返回 2702
     - `searchKnowledge()` 执行搜索
     - `buildSnippet()` 生成片段
     - `rankSearchResults()` 排序
   - `buildKnowledgeReport()` 生成报告
   - 返回 `KnowledgeResult`

#### 验收标准
- [ ] index + search 同时使用时先索引后搜索
- [ ] dry-run 时零写入
- [ ] 远程配置被忽略
- [ ] 错误码正确（2701-2704、5701）
- [ ] 对应测试绿灯

#### 关联设计
- spec.md 章节：§1 所有需求项
- design.md 章节：§4.2 接口 1（Knowledge CLI）、§6.1 核心流程

---

### [TASK-KN-12] 集成测试与构建验证

- **类型**: 测试-验证
- **依赖**: TASK-KN-11
- **状态**: [ ] 未完成

#### 任务描述
编写并运行集成测试，验证 knowledge 端到端流程。

#### 输入
- 所有已实现的 knowledge 模块

#### 输出
- `test/knowledge/knowledge-integration.test.ts`

#### 实现步骤
1. 创建 `test/knowledge/knowledge-integration.test.ts`
2. 编写端到端场景：
   - 首次索引 → 验证 knowledge.sqlite 创建
   - 增量索引 → 验证只更新变化文档
   - 搜索 → 验证结果包含 sourcePath/title/kind/snippet/score
   - index + search → 验证先索引后搜索
   - dry-run → 验证零写入
   - 无索引搜索 → 验证返回 2702
   - 无效查询 → 验证返回 2701
   - 敏感文件 → 验证被跳过
   - 远程配置 → 验证被忽略
3. 运行全部测试、tsc、lint

#### 验收标准
- [ ] 所有集成测试通过
- [ ] 所有单元测试通过
- [ ] `npx tsc --noEmit` 无错误
- [ ] lint 无错误

#### 关联设计
- spec.md 章节：§1 所有场景
- design.md 章节：§6.1 核心流程

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-KN-02 | 单元测试 | 参数校验（index/search/limit/query） | 正确通过或错误码 |
| TASK-KN-03 | 单元测试 | 配置加载/远程忽略/来源构建/路径守卫 | 正确行为 |
| TASK-KN-05 | 单元测试 | 扫描/隐私过滤 | 正确扫描和脱敏 |
| TASK-KN-06 | 单元测试 | MD 解析/切片/hash | 正确解析和切片 |
| TASK-KN-07 | 单元测试 | SQLite 驱动/Schema/FTS5 | 正确创建 |
| TASK-KN-08 | 单元测试 | 增量 diff/索引执行/dry-run | 正确行为 |
| TASK-KN-09 | 单元测试 | 搜索/片段/排序 | 正确结果 |
| TASK-KN-10 | 单元测试 | 报告生成 | 正确摘要 |
| TASK-KN-11 | 单元测试 | knowledge 命令全流程 | CliResponse 正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 首次索引 | 含文档的临时项目 | knowledge --index | knowledge.sqlite 创建 |
| 增量索引 | 已索引 + 修改文件 | knowledge --index | 只更新变化文档 |
| 搜索 | 已索引 | knowledge --search "query" | 返回结果 |
| index + search | 含文档 | knowledge --index --search "query" | 先索引后搜索 |
| dry-run | 含文档 | knowledge --index --dry-run | 零写入 |
| 无索引搜索 | 无 sqlite | knowledge --search "query" | 返回 2702 |
| 敏感文件 | 含 .env | knowledge --index | .env 被跳过 |

### 4.3 手动验证清单

- [ ] `harness knowledge --index --json` 输出合法 JSON
- [ ] `harness knowledge --search "query" --json` 返回搜索结果
- [ ] `harness knowledge --index --dry-run` 零写入
- [ ] knowledge.sqlite 存在于 `.harness/cache/`

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| `harness-cli-entrypoint` | 其他能力 | 本变更 | ⏳ 待建 | `CommandContext` |
| `harness-workspace-config` | 其他能力 | 本变更 | ⏳ 待建 | `WorkspacePaths`、cache 路径 |
| `harness-develop` | 其他能力 | 本变更 | ⏳ 待建 | develop 文档来源 |
| `harness-sync` | 其他能力 | 本变更 | ⏳ 待建 | rules 文档来源 |
| `harness-review` | 其他能力 | 本变更 | ⏳ 待建 | review 报告来源 |
| `harness-inspect` | 其他能力 | 本变更 | ⏳ 待建 | secretPatterns |
| Node.js >= 20.0.0 | 运行时 | 系统环境 | ✅ 就绪 | fs/path/crypto |
| SQLite >= 3.35.0 | 数据库 | npm (`better-sqlite3`) | ⏳ 待安装 | FTS5 支持 |

---

## 6. 代码规范

### 6.1 命名规范

- 类名：PascalCase（`KnowledgeIndexer`、`SearchResult`）
- 方法名：camelCase（`scanKnowledgeSources`、`searchKnowledge`）
- 文件名：kebab-case（`source-registry.ts`、`privacy-filter.ts`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：JSDoc 格式
- 异常处理：使用 `HarnessCliError` 体系（code 2701-2704、5701）

### 6.3 日志规范

- 敏感信息处理：knowledge.sqlite 不得包含敏感文件内容

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `src/capabilities/knowledge/types.ts` | 共享类型定义 | TASK-KN-01 |
| `src/capabilities/knowledge/options-validator.ts` | 参数校验 | TASK-KN-02 |
| `src/capabilities/knowledge/config-loader.ts` | 配置加载 | TASK-KN-03 |
| `src/capabilities/knowledge/remote-config-guard.ts` | 远程配置守卫 | TASK-KN-03 |
| `src/capabilities/knowledge/source-registry.ts` | 来源注册表 | TASK-KN-03 |
| `src/capabilities/knowledge/path-guard.ts` | 路径守卫 | TASK-KN-03 |
| `src/capabilities/knowledge/scanner.ts` | 文件扫描器 | TASK-KN-05 |
| `src/capabilities/knowledge/privacy-filter.ts` | 隐私过滤器 | TASK-KN-05 |
| `src/capabilities/knowledge/markdown-parser.ts` | Markdown 解析器 | TASK-KN-06 |
| `src/capabilities/knowledge/chunker.ts` | 文档切片器 | TASK-KN-06 |
| `src/capabilities/knowledge/hash.ts` | 内容哈希器 | TASK-KN-06 |
| `src/capabilities/knowledge/sqlite-driver.ts` | SQLite 驱动 | TASK-KN-07 |
| `src/capabilities/knowledge/sqlite-schema.ts` | SQLite Schema | TASK-KN-07 |
| `src/capabilities/knowledge/incremental-indexer.ts` | 增量索引器 | TASK-KN-08 |
| `src/capabilities/knowledge/indexer.ts` | 索引执行器 | TASK-KN-08 |
| `src/capabilities/knowledge/searcher.ts` | 搜索器 | TASK-KN-09 |
| `src/capabilities/knowledge/snippet-builder.ts` | 片段构建器 | TASK-KN-09 |
| `src/capabilities/knowledge/result-ranker.ts` | 结果排序器 | TASK-KN-09 |
| `src/capabilities/knowledge/report-writer.ts` | 报告写入器 | TASK-KN-10 |
| `src/capabilities/knowledge/command.ts` | knowledge 命令 handler | TASK-KN-11 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|--------|
| `test/knowledge/knowledge.test.ts` | 单元测试 | TASK-KN-04~11 |
| `test/knowledge/knowledge-integration.test.ts` | 集成测试 | TASK-KN-12 |

### 7.3 文档更新

- [ ] README 更新（knowledge 命令说明）
- [ ] 接口文档更新
- [ ] 变更日志更新

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**（依赖字段已填写）
> - [x] **任务执行拓扑图已绘制**（层级关系清晰）
> - [x] 无循环依赖
