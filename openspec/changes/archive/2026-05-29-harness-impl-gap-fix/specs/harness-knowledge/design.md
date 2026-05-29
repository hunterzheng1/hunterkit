# 局部技术实现方案 - harness-knowledge

> **⚠️ 边界声明**：本设计仅服务于 `harness-knowledge` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | --index | options.index | boolean | ✅ 保留 | |
| 2 | --search | options.search | string \| null | ✅ 保留 | |
| 3 | --json | globalOptions.json | boolean | ✅ 保留 | 全局参数 |
| 4 | --limit | options.limit | number | ✅ 保留 | |
| 5 | --dry-run | globalOptions.dryRun | boolean | ✅ 保留 | 全局参数 |
| 6 | indexPath | data.indexPath | string | ✅ 保留 | |
| 7 | indexedFiles | data.indexedFiles | number | ✅ 保留 | |
| 8 | results[].sourcePath | data.results[].sourcePath | string | ✅ 保留 | |
| 9 | results[].title | data.results[].title | string | ✅ 保留 | |
| 10 | results[].kind | data.results[].kind | string | ✅ 保留 | |
| 11 | results[].snippet | data.results[].snippet | string | ✅ 保留 | |
| 12 | results[].score | data.results[].score | number | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：12 个
- **设计输出字段总数**：12 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/knowledge/command.ts` | capabilities/knowledge/command | `runKnowledgeCommand()` | 替换实现 | 当前使用 JSON 文件，需迁移到 SQLite FTS5 |
| `src/capabilities/knowledge/command.ts` | capabilities/knowledge/command | `scanIndexableFiles()` | 替换实现 | 需限定索引来源为 openspec archive/ADR/rules/reports |
| `src/capabilities/knowledge/types.ts` | capabilities/knowledge/types | `KnowledgeIndex` | 替换实现 | 从 JSON 结构迁移到 SQLite schema |
| `src/core/legacy-sources.ts` | core/legacy-sources | `detectLegacySources()` | 扩展逻辑 | 兼容读取旧目录作为索引来源 |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 使用 JSON 文件存储索引 | `knowledge-index.json` | 需迁移到 SQLite FTS5 | 替换存储层 |
| 扫描全部项目文件 | 不区分索引来源 | 需限定为 archive/ADR/rules/reports | 修改扫描范围 |
| 不解析命令级参数 | 无 --index/--search | 需添加参数解析 | 新增 `parseKnowledgeArgs()` |
| 索引写入 `.harness/facts/` | 路径不正确 | 需改为 `.harness/cache/knowledge.sqlite` | 修改输出路径 |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 知识索引 | `CLI: harness knowledge --index` | 本地进程 | 构建/刷新索引 |
| 知识搜索 | `CLI: harness knowledge --search <query>` | 本地进程 | 搜索知识库 |

### 4.2 接口详细设计

#### 接口 1：harness knowledge

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --index | boolean | 否 | 建立或刷新索引 | 与 --search 至少传一个 |
| --search | string | 否 | 检索查询 | 长度 1-200 |
| --json | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |
| --limit | number | 否 | 结果数量 | 范围 1-50；默认 20 |
| --dry-run | boolean | 否 | 预览索引来源 | 不写 knowledge.sqlite |

**参数解析伪代码**：
```typescript
function parseKnowledgeArgs(args: string[]): KnowledgeOptions {
  const index = args.includes('--index');
  let search: string | null = null;
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1 && searchIdx + 1 < args.length) {
    search = args[searchIdx + 1];
    if (search.length === 0 || search.length > 200) {
      throw new HarnessCliError(2701, 'Search query must be 1-200 characters');
    }
  }
  if (!index && !search) {
    throw new HarnessCliError(2701, 'At least one of --index or --search is required');
  }
  let limit = 20;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && limitIdx + 1 < args.length) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (limit < 1 || limit > 50) throw new HarnessCliError(2701, 'Limit must be 1-50');
  }
  return { index, search, limit };
}
```

**响应结构（--index）**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "knowledge",
    "indexPath": ".harness/cache/knowledge.sqlite",
    "indexedFiles": 42,
    "results": []
  },
  "warnings": []
}
```

**响应结构（--search）**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "knowledge",
    "indexPath": ".harness/cache/knowledge.sqlite",
    "indexedFiles": 42,
    "results": [
      {
        "sourcePath": ".harness/develop/archive/demo/specs/harness-review/spec.md",
        "title": "文档防腐",
        "kind": "spec",
        "snippet": "同步必须保护 managed block...",
        "score": 12.4
      }
    ]
  },
  "warnings": []
}
```

**业务逻辑**：
1. 解析 `--index`、`--search`、`--limit` 参数
2. 如果 `--index`：
   a. 扫描索引来源：`.harness/develop/`、`.harness/docs/`、`.harness/rules/`、`.harness/reports/`、`openspec/changes/**/archive`
   b. 兼容读取旧目录：`.kld-review/`、`.docsync/`
   c. 创建/打开 `.harness/cache/knowledge.sqlite`
   d. 对每个文件计算 content hash，与已有记录比较
   e. 仅更新变化的文档记录（增量索引）
   f. 删除已不存在的文件记录
   g. 返回索引统计
3. 如果 `--search`：
   a. 检查 `knowledge.sqlite` 是否存在（不存在返回 2702）
   b. 执行 FTS5 全文检索
   c. 返回最多 `--limit` 条结果，按 score 降序
   d. 每条结果包含 sourcePath、title、kind、snippet、score

---

## 5. 局部数据模型

### 5.1 数据表设计

#### 表名：knowledge_documents

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| id | INTEGER | 是 | AUTOINCREMENT | 主键 | PK |
| source_path | TEXT | 是 | - | 文件相对路径 | UNIQUE |
| title | TEXT | 是 | - | 文档标题 | |
| kind | TEXT | 是 | - | 文档类型：spec/design/tasks/report/rule | INDEX |
| content | TEXT | 是 | - | 文档全文（FTS5 索引） | FTS5 |
| content_hash | TEXT | 是 | - | SHA-256 前 16 位 | |
| indexed_at | TEXT | 是 | CURRENT_TIMESTAMP | 索引时间（ISO 8601） | |

**索引设计**：
- 主键索引：id
- 唯一索引：source_path
- 普通索引：kind
- FTS5 索引：content（全文检索）

**SQLite FTS5 建表语句**：
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_documents USING fts5(
  source_path UNINDEXED,
  title,
  kind UNINDEXED,
  content,
  content_hash UNINDEXED,
  indexed_at UNINDEXED
);
```

### 5.2 缓存设计

不适用（SQLite 本身即为持久化存储）。

### 5.3 数据流转图

```
--index:
  scanKnowledgeSources(cwd, paths) → FileInfo[]
  → openOrCreateDatabase(dbPath)
  → for each file:
      hash = sha256(content)
      existing = db.query(source_path)
      if !existing: INSERT
      else if hash != existing.hash: UPDATE
  → deleteRemovedFiles(db, currentFiles)
  → closeDatabase()
  → CliResponse({ indexedFiles })

--search:
  if !existsSync(dbPath): return error 2702
  → openDatabase(dbPath)
  → results = db.query(FTS5 MATCH, query, limit)
  → closeDatabase()
  → CliResponse({ results })
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runKnowledgeCommand(context):
  1. options = parseKnowledgeArgs(context.args)
  2. dbPath = resolve(paths.cache, 'knowledge.sqlite')
  3. if options.index:
       sources = scanKnowledgeSources(cwd, paths)
       db = openOrCreateDatabase(dbPath)
       indexedCount = 0
       for file in sources:
         hash = sha256(file.content)
         existing = db.get(file.sourcePath)
         if !existing:
           db.insert(file, hash)
           indexedCount++
         else if hash !== existing.contentHash:
           db.update(file, hash)
           indexedCount++
       // 删除已移除的文件
       db.deleteRemoved(sources.map(f => f.sourcePath))
       db.close()
  4. if options.search:
       if !existsSync(dbPath): return error 2702
       db = openDatabase(dbPath)
       results = db.search(options.search, options.limit)
       db.close()
  5. return CliResponse({ indexPath, indexedFiles, results })
```

### 6.2 索引来源扫描

```typescript
const KNOWLEDGE_SOURCES = [
  { dir: '.harness/develop', kind: 'spec' },
  { dir: '.harness/docs', kind: 'rule' },
  { dir: '.harness/rules', kind: 'rule' },
  { dir: '.harness/reports', kind: 'report' },
  { dir: 'openspec/changes', kind: 'spec' },  // 兼容旧目录
];

const LEGACY_KNOWLEDGE_SOURCES = [
  { dir: '.kld-review', kind: 'report' },
  { dir: '.docsync', kind: 'rule' },
];

function scanKnowledgeSources(cwd: string, paths: WorkspacePaths): FileInfo[] {
  const files: FileInfo[] = [];
  for (const source of [...KNOWLEDGE_SOURCES, ...LEGACY_KNOWLEDGE_SOURCES]) {
    const fullDir = resolve(cwd, source.dir);
    if (!existsSync(fullDir)) continue;
    walkDir(fullDir, (filePath) => {
      if (INDEXABLE_EXTS.includes(extname(filePath))) {
        const content = readFileSync(filePath, 'utf-8');
        const rel = relative(cwd, filePath);
        files.push({ sourcePath: rel, title: basename(filePath), kind: source.kind, content });
      }
    });
  }
  return files;
}
```

### 6.3 FTS5 搜索

```typescript
function searchDatabase(db: Database, query: string, limit: number): SearchResult[] {
  const stmt = db.prepare(`
    SELECT source_path, title, kind, snippet(knowledge_documents, 3, '<b>', '</b>', '...', 64) as snippet, rank as score
    FROM knowledge_documents
    WHERE knowledge_documents MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  return stmt.all(query, limit).map(row => ({
    sourcePath: row.source_path,
    title: row.title,
    kind: row.kind,
    snippet: row.snippet,
    score: Math.abs(row.score),  // FTS5 rank 为负数，取绝对值
  }));
}
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 鉴权方式 | 备注 |
|------|------|------|---------|------|
| better-sqlite3 | >= 9.0.0 | SQLite FTS5 本地索引 | 无 | 降级：返回 FTS 不可用错误 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| SQLite FTS5 | 全文检索 | better-sqlite3 | schemaVersion | >= 3.35.0 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| core/paths | `resolveWorkspacePaths` | cwd | WorkspacePaths | 已有 |
| core/legacy-sources | `detectLegacySources()` | cwd | LegacySource[] | 已有 |
| core/transaction | `beginTransaction`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| SQLite >= 3.35.0 | FTS5 支持 | better-sqlite3 npm 包 |
| 文件系统读写权限 | `.harness/cache/` | 本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 查询参数无效 | --search 为空或超 200 字符 | 返回错误码 2701 | "查询参数无效" |
| 索引不存在 | 未建立 knowledge.sqlite | 返回错误码 2702 | "请先运行 harness knowledge --index" |
| 索引来源无效 | 配置路径越界或不存在 | 返回错误码 2703 | "索引来源无效" |
| SQLite FTS 不可用 | 不支持 FTS5 | 返回错误码 2704 | "SQLite FTS5 不可用" |
| 索引写入失败 | knowledge.sqlite 写入失败 | 返回错误码 5701 | "索引写入失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：FTS5 不可用时降级为文件名和标题搜索（LIKE 查询）
- 索引失败时保留上一个可用 knowledge.sqlite（原子替换）

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 索引来源路径 | knowledge.sources | [".harness/develop", ".harness/docs", ".harness/rules", ".harness/reports"] | 从 knowledge.config.json 读取 |
| 忽略模式 | knowledge.ignorePatterns | ["node_modules", "dist", ".git"] | 从 knowledge.config.json 读取 |
| 结果数量上限 | knowledge.defaultLimit | 20 | 默认搜索结果数 |

### 9.2 开关配置

无。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：4 个需修改文件已明确
> - [x] **现有约束已识别**：4 个约束已列出
> - [x] **字段完整性**：12 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] 数据模型已完成（SQLite FTS5 表结构）
> - [x] **外部依赖已明确**：better-sqlite3 >= 9.0.0
> - [x] **环境权限已确认**：SQLite >= 3.35.0
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
