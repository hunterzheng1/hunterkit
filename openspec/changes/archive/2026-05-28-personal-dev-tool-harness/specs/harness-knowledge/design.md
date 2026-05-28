# 局部技术实现方案 - harness-knowledge

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-knowledge`，负责本地知识索引、SQLite FTS5 检索、source path 追踪和隐私边界，不设计 develop、sync、review、workspace 等其他能力的内部实现。
>
> **质量红线**：第一版 knowledge 必须完全本地运行，只使用本地 SQLite FTS5；不得调用远程向量库、外部知识库或内网知识服务；不得索引 secret、token、私钥、证书和本地连接配置。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `--index` | `KnowledgeOptions.index` | boolean | ✅ 保留 | 建立或刷新本地索引 |
| 2 | `--search` | `KnowledgeOptions.search` | string | ✅ 保留 | 搜索查询，长度 1-200 |
| 3 | `--json` | `KnowledgeOptions.json` | boolean | ✅ 保留 | stdout 输出合法 JSON |
| 4 | `--limit` | `KnowledgeOptions.limit` | number | ✅ 保留 | 搜索结果数量，范围 1-50，默认 20 |
| 5 | `--dry-run` | `KnowledgeOptions.dryRun` | boolean | ⚠️ 重命名 | 转为 camelCase，语义保持预览来源且不写库 |
| 6 | `indexPath` | `KnowledgeResult.indexPath` | path | ✅ 保留 | `.harness/cache/knowledge.sqlite` |
| 7 | `indexedFiles` | `KnowledgeResult.indexedFiles` | number | ✅ 保留 | 本次新增或更新文档数 |
| 8 | `results` | `KnowledgeResult.results` | `KnowledgeSearchResult[]` | ✅ 保留 | 搜索结果数组 |
| 9 | `sourcePath` | `KnowledgeSearchResult.sourcePath` | path | ✅ 保留 | 结果来源路径 |
| 10 | `title` | `KnowledgeSearchResult.title` | string | ✅ 保留 | 文档标题或片段标题 |
| 11 | `kind` | `KnowledgeSearchResult.kind` | enum | ✅ 保留 | `spec`、`adr`、`rule`、`report`、`archive`、`doc` |
| 12 | `snippet` | `KnowledgeSearchResult.snippet` | string | ✅ 保留 | 命中片段，必须脱敏 |
| 13 | `score` | `KnowledgeSearchResult.score` | number | ✅ 保留 | SQLite FTS5 相关度分数 |
| 14 | `error.data.indexPath` | `KnowledgeErrorData.indexPath` | path | ✅ 保留 | 索引不存在或写入失败时返回 |
| 15 | `.harness/develop` | `KnowledgeSource.root` | path | ✅ 保留 | 默认知识来源之一 |
| 16 | `.harness/docs` | `KnowledgeSource.root` | path | ✅ 保留 | 默认知识来源之一 |
| 17 | `.harness/rules` | `KnowledgeSource.root` | path | ✅ 保留 | 默认知识来源之一 |
| 18 | `.harness/reports` | `KnowledgeSource.root` | path | ✅ 保留 | 默认知识来源之一 |
| 19 | `openspec/changes/**/archive` | `KnowledgeSource.glob` | glob | ✅ 保留 | 旧 OpenSpec archive 兼容来源 |
| 20 | `file path` | `KnowledgeDocument.sourcePath` | path | ✅ 保留 | 增量索引主定位字段 |
| 21 | `mtime` | `KnowledgeDocument.mtimeMs` | number | ✅ 保留 | 增量索引变化判断字段 |
| 22 | `content hash` | `KnowledgeDocument.contentHash` | string | ✅ 保留 | 增量索引变化判断字段 |
| 23 | `schemaVersion` | `KnowledgeDbMeta.schemaVersion` | string | ✅ 保留 | SQLite schema 兼容控制 |
| 24 | `indexedAt` | `KnowledgeDocument.indexedAt` | 时间戳 | ✅ 保留 | 审计每个 sourcePath 的索引时间 |
| 25 | `远程服务配置` | `RemoteKnowledgeConfig.ignored` | boolean | ✅ 保留 | 第一版必须忽略远程服务配置并报告说明 |

### 1.2 完整性自检

- **用户输入字段总数**：25 个
- **设计输出字段总数**：25 个
- **差异说明**：仅 `--dry-run` 转为 `dryRun` 以适配 TypeScript/JSON 命名，语义不变。
- **完整性确认**：[x] 已确认所有字段都有对应处理

### 1.3 Spec 需求项覆盖表

| Spec 需求项 | 设计落点 | 覆盖方式 |
|------------|---------|---------|
| 本地知识索引 | `source-registry.ts`、`scanner.ts`、`indexer.ts`、`incremental-indexer.ts`、`sqlite-schema.ts` | 扫描默认知识来源，按 path、mtime、hash 增量写入 `.harness/cache/knowledge.sqlite` |
| 知识检索 | `searcher.ts`、`snippet-builder.ts`、`result-ranker.ts` | `--search` 返回最多 `limit` 条结果，包含 sourcePath、title、kind、snippet、score |
| 本地与隐私边界 | `config-loader.ts`、`privacy-filter.ts`、`remote-config-guard.ts` | 第一版忽略远程服务配置，过滤敏感文件和敏感内容，报告说明仅支持本地 FTS5 |

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无现有实现文件 | 无 | 无 | 纯新建 | 当前仓库未发现 `src/`、`bin/`、`lib/`、`test/` 等实现目录；本 Capability 以新建模块设计 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/knowledge/types.ts` | `KnowledgeOptions`、`KnowledgeResult`、`KnowledgeDocument` | 定义 CLI 入参、source、document、chunk、result、错误数据类型 | 无 | 所有 knowledge 子模块共享类型 |
| `src/capabilities/knowledge/command.ts` | `registerKnowledgeCommand()`、`runKnowledgeCommand()` | 挂载 `harness knowledge` 并编排 index/search | CLI command handler | 支持先 index 后 search |
| `src/capabilities/knowledge/options-validator.ts` | `validateKnowledgeOptions()` | 校验 `--index`/`--search`、limit、query 长度 | 无 | 返回 `2701` 等错误 |
| `src/capabilities/knowledge/config-loader.ts` | `loadKnowledgeConfig()` | 读取本地 knowledge 配置与默认来源 | Workspace config adapter | 远程配置只读取用于报告，不启用 |
| `src/capabilities/knowledge/remote-config-guard.ts` | `ignoreRemoteKnowledgeConfig()` | 忽略 `.local.json` 或远程服务配置 | 无 | 报告当前只支持本地 FTS5 |
| `src/capabilities/knowledge/source-registry.ts` | `buildKnowledgeSources()` | 生成默认 source 列表和 glob | 无 | 覆盖 `.harness/**` 与 OpenSpec archive |
| `src/capabilities/knowledge/path-guard.ts` | `assertSourceInsideProject()` | 阻断越界来源路径 | 无 | 返回 `2703` |
| `src/capabilities/knowledge/scanner.ts` | `scanKnowledgeSources()` | 扫描 Markdown/JSON/报告文档 | 无 | 记录跳过数量和原因 |
| `src/capabilities/knowledge/privacy-filter.ts` | `shouldSkipSensitiveFile()`、`redactSensitiveText()` | 过滤 secretPatterns 命中文件和内容 | Inspect rules adapter | 禁止敏感内容进入 SQLite |
| `src/capabilities/knowledge/markdown-parser.ts` | `parseMarkdownDocument()` | 提取 title、headings、body text | CommonMark adapter | 失败时纯文本解析 |
| `src/capabilities/knowledge/chunker.ts` | `chunkDocument()` | 将文档切片为可检索 chunk | 无 | 控制 snippet 粒度 |
| `src/capabilities/knowledge/hash.ts` | `hashContent()` | 计算内容 hash | Node crypto | 增量索引依据 |
| `src/capabilities/knowledge/sqlite-driver.ts` | `openKnowledgeDb()`、`assertFts5Available()` | 打开 SQLite 并检测 FTS5 | SQLite adapter | FTS5 不可用返回 `2704` |
| `src/capabilities/knowledge/sqlite-schema.ts` | `ensureKnowledgeSchema()` | 创建 meta/documents/chunks FTS 表 | SQLite adapter | 包含 schemaVersion |
| `src/capabilities/knowledge/incremental-indexer.ts` | `diffDocumentsForIndex()` | 根据 path、mtime、hash 判断新增/更新/删除 | 无 | 避免重复全量写入 |
| `src/capabilities/knowledge/indexer.ts` | `runKnowledgeIndex()` | 执行 dry-run 或事务索引写入 | SQLite adapter | 失败保留旧库 |
| `src/capabilities/knowledge/searcher.ts` | `searchKnowledge()` | 执行 FTS5 查询并限制结果数量 | SQLite FTS5 | 索引不存在返回 `2702` |
| `src/capabilities/knowledge/snippet-builder.ts` | `buildSnippet()` | 生成脱敏命中片段 | 无 | 结果必须包含 snippet |
| `src/capabilities/knowledge/result-ranker.ts` | `rankSearchResults()` | 统一 score 排序和 kind 加权 | 无 | 保留 SQLite score 字段 |
| `src/capabilities/knowledge/report-writer.ts` | `buildKnowledgeReport()` | 生成索引/搜索摘要和 ignored remote 说明 | 无 | 支持 JSON 与终端文本 |
| `test/knowledge/knowledge.test.ts` | knowledge tests | 覆盖索引、增量、搜索、隐私、dry-run | Test runner | tasks 阶段按 TDD 继续细拆 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 代码基线 | 当前仓库没有 Harness CLI 实现源码 | 不能锚定已有类/方法 | 所有文件标注为纯新建 |
| 本地优先 | spec 明确第一版不调用远程服务 | 不能接入远程向量库或外部知识库 | `remote-config-guard` 强制忽略远程配置 |
| 敏感内容 | knowledge.sqlite 不加密 | 不能索引 secret、token、证书、本地连接配置 | `privacy-filter` 在写库前过滤文件和内容 |
| 增量索引 | 重复执行必须只更新变化文档 | 需要保存 path、mtime、hash | `documents` 表保存变化判断字段 |
| SQLite FTS5 | 本地检索依赖 FTS5 | 启动时必须检测扩展能力 | `assertFts5Available()` 失败返回 `2704` 或进入文件名标题降级 |
| dry-run | `--dry-run` 时不得写 knowledge.sqlite | 索引执行器必须支持只计划不写入 | `runKnowledgeIndex()` 分离 scan plan 与 db write |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `KnowledgeCliView` | 终端展示 | 展示索引路径、扫描数量、索引数量、搜索摘要 | `IndexSummaryTable`、`SearchResultList` |
| `IndexSummaryTable` | 终端展示 | 展示 indexed、updated、deleted、skipped、dry-run 状态 | 无 |
| `SearchResultList` | 终端展示 | 展示 sourcePath、kind、title、score、snippet | 无 |
| `PrivacyNoticeLine` | 终端展示 | 展示远程配置被忽略、本地 FTS5 边界和敏感文件跳过数量 | 无 |
| `KnowledgeJsonView` | JSON 输出 | 当 `--json` 为 true 时输出统一响应体 | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `sources` | `KnowledgeSource[]` | `[]` | 配置加载与 source registry 构建后更新 |
| `indexPlan` | `KnowledgeIndexPlan | null` | `null` | source 扫描与增量 diff 后更新 |
| `indexStats` | `KnowledgeIndexStats` | 全 0 | index 写入或 dry-run 完成后更新 |
| `searchResults` | `KnowledgeSearchResult[]` | `[]` | FTS5 查询完成后更新 |
| `ignoredRemoteConfig` | boolean | `false` | 发现远程配置并忽略后更新 |
| `privacyStats` | `KnowledgePrivacyStats` | 全 0 | 文件过滤和内容脱敏时更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness knowledge` | `KnowledgeCliView` / `KnowledgeJsonView` | 本地文件系统读写权限 | 本 Capability 无浏览器前端路由 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 用户执行索引 | `runKnowledgeCommand()` | `KnowledgeOptions.index=true` | 展示 indexPath、indexedFiles 和跳过统计 |
| 用户执行 dry-run | `runKnowledgeIndex()` | `KnowledgeOptions.dryRun=true` | 展示预览来源与计划变化，写入数量为 0 |
| 用户执行搜索 | `searchKnowledge()` | `KnowledgeOptions.search`、`limit` | 展示最多 limit 条搜索结果 |
| 用户执行 index + search | `runKnowledgeCommand()` | `index=true`、`search=query` | 先完成索引，再执行搜索 |
| 用户执行 JSON 模式 | `formatHarnessResponse()` | `KnowledgeResult` / `KnowledgeErrorData` | stdout 输出合法 JSON |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Knowledge CLI | `CLI: harness knowledge` | 本地进程调用 | 建立本地知识索引、执行 FTS5 搜索、输出 JSON 或终端摘要 |

### 4.2 接口详细设计

#### 接口 1：Knowledge CLI

**基本信息**：
- 路径：`CLI: harness knowledge`
- 方法：本地进程调用
- 认证：不需要远程认证，依赖本地文件系统权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `index` | boolean | 否 | 建立或刷新索引 | 与 `search` 至少传一个 |
| `search` | string | 否 | 检索查询 | 长度 1-200；可与 `index` 同时使用 |
| `json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |
| `limit` | number | 否 | 结果数量 | 范围 1-50，默认 20 |
| `dryRun` | boolean | 否 | 预览索引来源 | 不得写入 knowledge.sqlite |

**响应结构**：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "indexPath": ".harness/cache/knowledge.sqlite",
    "indexedFiles": 42,
    "results": [
      {
        "sourcePath": ".harness/develop/archive/demo/spec.md",
        "title": "文档防腐",
        "kind": "spec",
        "snippet": "同步必须保护 managed block...",
        "score": 12.4
      }
    ]
  }
}
```

**业务逻辑**：
1. `validateKnowledgeOptions()` 校验至少存在 `index` 或 `search`；校验 query 长度与 limit 范围。
2. `loadKnowledgeConfig()` 读取配置；`ignoreRemoteKnowledgeConfig()` 标记并忽略所有远程服务设置。
3. `buildKnowledgeSources()` 合并默认来源和配置来源；`assertSourceInsideProject()` 阻断越界路径。
4. 若 `index=true`，执行 `scanKnowledgeSources()`、`privacy-filter`、`diffDocumentsForIndex()`。
5. `dryRun=true` 时只返回 index plan，不打开写入事务。
6. 非 dry-run 时 `openKnowledgeDb()`、`assertFts5Available()`、`ensureKnowledgeSchema()`，然后写入临时数据库并原子替换。
7. 若 `search` 存在，先确认 indexPath 存在；不存在返回 `2702`。
8. `searchKnowledge()` 执行 FTS5 查询；`buildSnippet()` 生成脱敏片段；`rankSearchResults()` 排序和截断。
9. `buildKnowledgeReport()` 输出终端摘要或统一 JSON。

---

## 5. 局部数据模型

### 5.1 数据表设计

#### 表名：`knowledge_meta`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `key` | TEXT | 是 | 无 | 元数据键 | PK |
| `value` | TEXT | 是 | 无 | 元数据值 | 无 |
| `updated_at` | TEXT | 是 | 当前时间 | 更新时间，ISO 8601 | 无 |

**索引设计**：
- 主键索引：`key`
- 唯一索引：无
- 普通索引：无

#### 表名：`knowledge_documents`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `id` | TEXT | 是 | hash(sourcePath) | 文档主键 | PK |
| `source_path` | TEXT | 是 | 无 | 项目内相对来源路径 | UNIQUE |
| `title` | TEXT | 是 | 空字符串 | 文档标题 | 普通索引 |
| `kind` | TEXT | 是 | `doc` | 文档类型 | 普通索引 |
| `mtime_ms` | INTEGER | 是 | 0 | 文件 mtime 毫秒 | 无 |
| `content_hash` | TEXT | 是 | 无 | 内容 hash | 普通索引 |
| `size_bytes` | INTEGER | 是 | 0 | 文件大小 | 无 |
| `indexed_at` | TEXT | 是 | 当前时间 | 索引时间 | 无 |
| `created_at` | TEXT | 是 | 当前时间 | 创建时间 | 无 |
| `updated_at` | TEXT | 是 | 当前时间 | 更新时间 | 无 |

**索引设计**：
- 主键索引：`id`
- 唯一索引：`source_path`
- 普通索引：`kind`、`content_hash`、`title`

#### 表名：`knowledge_chunks`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `id` | TEXT | 是 | hash(documentId + ordinal) | chunk 主键 | PK |
| `document_id` | TEXT | 是 | 无 | 关联 `knowledge_documents.id` | 普通索引 |
| `ordinal` | INTEGER | 是 | 0 | 文档内切片序号 | 普通索引 |
| `heading` | TEXT | 否 | 空字符串 | 所属标题 | 无 |
| `body` | TEXT | 是 | 无 | 脱敏后的切片文本 | 无 |
| `created_at` | TEXT | 是 | 当前时间 | 创建时间 | 无 |
| `updated_at` | TEXT | 是 | 当前时间 | 更新时间 | 无 |

**索引设计**：
- 主键索引：`id`
- 唯一索引：`document_id + ordinal`
- 普通索引：`document_id`

#### 表名：`knowledge_chunks_fts`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `title` | TEXT | 是 | 空字符串 | 文档标题 | FTS5 |
| `heading` | TEXT | 否 | 空字符串 | chunk 标题 | FTS5 |
| `body` | TEXT | 是 | 无 | chunk 正文 | FTS5 |
| `source_path` | TEXT | 是 | 无 | 来源路径 | FTS5 |

**索引设计**：
- FTS5 虚拟表：`title`、`heading`、`body`、`source_path`
- 通过 rowid 对应 `knowledge_chunks` 查询结果。

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| `.harness/cache/knowledge.sqlite` | SQLite | 永不过期 | index 命令增量更新 | 主知识索引库 |
| `.harness/cache/knowledge.sqlite.tmp` | SQLite | 命令结束清理 | 索引期间写入，成功后原子替换 | 失败时保留旧库 |
| `.harness/cache/knowledge-scan.json` | JSON | 可覆盖 | dry-run 或调试时生成 | 记录 source 扫描与跳过原因 |

### 5.3 数据流转图

```text
[knowledge config + default sources]
  --> [path guard]
  --> [scanner]
  --> [privacy filter]
  --> [markdown parser]
  --> [chunker]
  --> [path/mtime/hash diff]
  --> [SQLite schema + FTS5]
  --> [search query]
  --> [snippet + score + sourcePath]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[parse options]
  --> [validate index/search/limit/query]
  --> [load config and ignore remote settings]
  --> [build local sources]
  --> [guard paths and scan files]
  --> [filter sensitive files and redact text]
  --> [index dry-run or SQLite transaction]
  --> [optional FTS5 search]
  --> [format result]
```

### 6.2 状态机（如有）

```text
[uninitialized]
  --index requested--> [scanning]
  --scan complete--> [diff_ready]
  --dry-run--> [planned_no_write]
  --write temp db--> [indexing]
  --atomic replace--> [indexed]
  --search requested--> [searching]
  --results built--> [completed]

[uninitialized] --search without db--> [failed_2702]
[any state] --remote config found--> [remote_ignored_notice]
[any state] --sensitive match--> [skipped_or_redacted]
```

### 6.3 关键算法（如有）

#### 6.3.1 Source Registry 算法

1. 从 workspace 配置获取项目根目录和 `.harness/cache` 路径。
2. 构建默认来源：`.harness/develop`、`.harness/docs`、`.harness/rules`、`.harness/reports`、`openspec/changes/**/archive`。
3. 读取 `.harness/config/knowledge.config.json` 中的本地来源；忽略所有远程服务项。
4. 对每个来源执行路径规范化，必须落在项目根目录内。
5. 来源不存在时记录 skipped；配置来源越界时返回 `2703`。

#### 6.3.2 增量索引算法

1. 扫描候选文档，读取 `sourcePath`、`mtimeMs`、`sizeBytes`。
2. 若 `sourcePath` 不存在于 `knowledge_documents`，标记 `create`。
3. 若 `mtimeMs` 和 `sizeBytes` 未变化，跳过 hash 计算。
4. 若 mtime 或 size 变化，计算 `contentHash`；hash 变化则标记 `update`。
5. 数据库中存在但文件已删除的 sourcePath 标记 `delete`。
6. 写入时先删除旧 chunks，再插入新 chunks 和 FTS rows。

#### 6.3.3 Markdown 切片算法

1. 优先按 Markdown 标题拆分，标题作为 chunk heading。
2. 单个 chunk 超过目标长度时按段落继续拆分。
3. 每个 chunk 写入脱敏后的 body，保留 title、heading、sourcePath。
4. JSON/报告文件转为纯文本摘要后同样切片。

#### 6.3.4 搜索与片段算法

1. 校验 query 长度 1-200，不满足返回 `2701`。
2. indexPath 不存在时返回 `2702`。
3. 使用 FTS5 `MATCH` 查询 title、heading、body、sourcePath。
4. 用 SQLite score 作为基础分，按 kind 与标题命中轻微加权。
5. `buildSnippet()` 从命中 chunk 生成片段，并再次执行敏感文本脱敏。
6. 截断到 `limit`，默认 20，最大 50。

#### 6.3.5 本地隐私边界算法

1. `remote-config-guard` 扫描 knowledge 配置中的 remote、endpoint、apiKey、rag、vector 字段。
2. 发现远程配置时不报错，但设置 `ignoredRemoteConfig=true` 并在报告说明第一版只支持本地 FTS5。
3. `privacy-filter` 对 sourcePath 和内容执行 secretPatterns 检测。
4. 命中文件整体跳过；命中片段替换为 `[REDACTED]`。
5. SQLite 写入层只接收已脱敏文本。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无远程服务 | 第一版 knowledge 不调用远程向量库、RAG 或外部知识库 | 无 | 0 毫秒连接超时 | 无 | 远程配置被忽略并在报告中说明 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>= 20.0.0` | CLI、文件扫描、hash、报告输出 | 无 | 无 | 缺失时阻断 knowledge |
| SQLite | `>= 3.35.0` | 本地知识数据库 | 无 | 无 | 不可用时阻断 index/search |
| SQLite FTS5 | `>= 3.35.0` | 全文检索 | 无 | 无 | 不可用时返回 `2704`，可降级文件名与标题搜索 |
| CommonMark Markdown | `0.30` | Markdown 文档解析和切片 | 无 | 无 | 解析失败时降级纯文本切片 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 扫描知识来源、读取文档、写缓存库 | Node fs API | 项目根目录内路径 | 禁止越界读取 |
| SQLite 本地文件 | 存储 metadata、documents、chunks 和 FTS5 | SQLite SDK | `.harness/cache/knowledge.sqlite` | 写入使用临时库原子替换 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-workspace-config | `resolveWorkspace()`、`resolveCachePath()` | 项目根目录 | `.harness/cache`、config 路径 | 待建 |
| harness-develop | `readDevelopArchiveSources()` | `.harness/develop` | proposal/spec/design/tasks/archive 文档路径 | 待建 |
| harness-sync | `readRulesSources()` | `.harness/rules`、reports | rules 与同步报告路径 | 待建 |
| harness-review | `readReviewReportSources()` | `.harness/reports/review` | 审查报告与 finding 摘要路径 | 待建 |
| harness-inspect | `readSecretPatterns()` | 项目根目录 | secretPatterns 与 ignore 规则 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 第一版不要求任何环境变量 | 无 |
| 密钥/证书 | 不需要密钥；发现配置中存在 token、apiKey、privateKey 时不得写入索引 | 无 |
| 网络策略 | 不建立网络连接；远程配置被忽略 | 无 |
| 权限/角色 | 读取项目根目录内知识来源；写 `.harness/cache/knowledge.sqlite` | 本地文件系统权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 查询参数无效 | `--search` 为空、超过 200 字符，或 limit 越界 | 返回 `2701` | 展示 query/limit 约束 |
| 索引不存在 | 未建立 knowledge.sqlite 且执行搜索 | 返回 `2702` | 提示先运行 `harness knowledge --index` |
| 索引来源无效 | 配置来源越界或不可读 | 返回 `2703` 或记录 skipped | 越界阻断，不存在来源可跳过 |
| SQLite FTS 不可用 | 本地 SQLite 不支持 FTS5 | 返回 `2704` 或进入文件名标题降级 | 说明当前环境不支持 FTS5 |
| 索引写入失败 | 临时库写入、原子替换或权限失败 | 返回 `5701` | 保留旧库并展示 indexPath |
| 敏感内容命中 | 文件或内容匹配 secretPatterns | 跳过文件或脱敏片段 | 报告 skipped/redacted 数量 |

### 8.2 重试与降级

- 重试次数：SQLite 写入 0 次；文件读取失败不重试。
- 重试间隔：不适用。
- 降级策略：
  - Markdown 解析失败时降级为纯文本切片。
  - FTS5 不可用时优先返回 `2704`；若已有 metadata 可读且用户只需要粗略搜索，可降级为文件名与标题搜索并在结果中标记 degraded。
  - 索引写入失败时保留旧 `knowledge.sqlite`，临时库删除或标记为失败。
  - 远程配置存在时不失败，但必须忽略并输出本地 FTS5 边界说明。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 索引数据库路径 | `knowledge.indexPath` | `.harness/cache/knowledge.sqlite` | 本地 SQLite FTS5 数据库 |
| 配置文件路径 | `knowledge.configPath` | `.harness/config/knowledge.config.json` | 本地知识来源和忽略规则 |
| 默认来源 | `knowledge.defaultSources` | `.harness/develop,.harness/docs,.harness/rules,.harness/reports,openspec/changes/**/archive` | 默认扫描范围 |
| 默认 limit | `knowledge.defaultLimit` | `20` | 搜索默认结果数 |
| 最大 limit | `knowledge.maxLimit` | `50` | 搜索结果上限 |
| query 最大长度 | `knowledge.maxQueryLength` | `200` | 搜索字符串最大长度 |
| chunk 目标长度 | `knowledge.chunkTargetChars` | `1200` | Markdown 切片目标长度 |
| schema 版本 | `knowledge.schemaVersion` | `knowledge.v1` | SQLite schema 兼容控制 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `knowledge.enableLocalFts5` | 启用本地 SQLite FTS5 | 开启 |
| `knowledge.ignoreRemoteServices` | 忽略远程知识服务配置 | 开启，第一版不可关闭 |
| `knowledge.redactSecrets` | 索引前过滤和脱敏敏感内容 | 开启 |
| `knowledge.enableDryRunScanReport` | dry-run 输出扫描计划 | 开启 |
| `knowledge.enableFilenameTitleFallback` | FTS5 不可用时允许文件名与标题降级搜索 | 关闭，需显式开启 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：当前确认为纯新建，并列出拟建文件、模块和函数
> - [x] **现有约束已识别**：本地 FTS5、隐私边界、增量索引、dry-run 和远程配置忽略均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的内部逻辑，仅声明必要依赖
> - [x] **全局遵守**：遵循 overview.md 的统一返回体、错误码和时间戳约定
> - [x] 前端设计已完成（CLI 展示组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（SQLite meta/documents/chunks/FTS5 表、索引、缓存）
> - [x] **外部依赖已明确**：Node.js、SQLite、SQLite FTS5、CommonMark 和本地文件系统已列出
> - [x] **环境权限已确认**：本地读写权限、无密钥、无网络策略已说明
> - [x] 异常处理策略已定义（含 FTS5 降级、解析降级、写入失败保留旧库、远程配置忽略）
> - [x] 包含足够的局部细节支持任务拆解
