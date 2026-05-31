# spec.md - 能力规格定义（增量）

> **定位**：`harness-knowledge` — 第一版本地索引边界修正，避免 JSON fallback 冒充 SQLite FTS5 完整实现
> **增量说明**：本文档为对 `openspec/specs/harness-knowledge/spec.md` 的增量修改
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：存储后端明确声明

系统必须在 knowledge 命令输出中明确声明当前使用的存储后端类型，不得让 JSON fallback 行为冒充 SQLite FTS5。

##### 场景：声明存储后端
- **当** 用户执行 `harness knowledge --index`
- **预期** 系统必须在响应 `data` 中包含 `storageBackend` 字段：值为 `sqlite-fts5`（SQLite FTS5 可用时）或 `json-fallback`（SQLite 不可用时的降级模式）

##### 场景：JSON fallback 标注
- **当** 系统使用 JSON fallback 作为存储后端
- **预期** 必须在 `warnings` 中明确标注："当前使用 JSON 文件存储（降级模式），全文检索精度和性能受限。安装 better-sqlite3 以启用 SQLite FTS5 完整索引"

##### 场景：SQLite FTS5 标注
- **当** 系统成功使用 SQLite FTS5
- **预期** `data.storageBackend` 必须为 `sqlite-fts5`，`data.indexPath` 必须指向 `.harness/cache/knowledge.sqlite`

#### 需求项：JSON fallback 写入路径修正

系统必须确保 JSON fallback 的写入路径为 `.harness/cache/knowledge.json`，不得写入 `.harness/cache/knowledge.sqlite` 路径（避免伪装为 SQLite 文件）。

##### 场景：JSON fallback 路径
- **当** SQLite FTS5 不可用，系统使用 JSON fallback
- **预期** 索引数据必须写入 `.harness/cache/knowledge.json`（JSON 文件），不得写入 `.harness/cache/knowledge.sqlite` 路径

##### 场景：JSON fallback 搜索行为
- **当** 使用 JSON fallback 执行 `harness knowledge --search "关键词"`
- **预期** 系统必须使用 `String.includes` 或等价全文匹配方法搜索；`warnings` 必须包含"JSON fallback 模式下使用简单文本匹配，非 FTS5 全文检索"

#### 需求项：knowledge 命令 M1 完成定义

系统必须明确声明 knowledge 的 M1 完成边界。

##### 场景：M1 已实现功能
- **当** 用户执行 knowledge 相关命令
- **预期** M1 阶段已实现：`--index`（文件扫描和索引构建）、`--search`（关键词检索）、`--json`（JSON 输出）、`--dry-run`（预览模式）、增量索引（基于 mtime 和 hash）、Base 参数验证（限制数量/质量检查）

##### 场景：M1 未实现功能
- **当** M1 阶段尝试使用未实现功能
- **预期** M1 阶段未实现：SQLite FTS5 深度集成高级功能（BM25 排序优化、片段生成器自定义）；`--limit` 参数的大范围定制（> 50）；多索引源优先级合并排序；跨知识库分布式检索

### 修改需求

#### 需求项：迁移到 SQLite FTS5

系统必须将 knowledge 命令从 JSON 文件迁移到 SQLite FTS5。

**增量修改**：M1 阶段保留 JSON fallback 作为降级方案，不得强制 SQLite FTS5 作为唯一存储后端。JSON fallback 必须明确标注身份。

##### 场景：首次索引（修改）
- **当** 用户执行 `harness knowledge --index`
- **预期** 系统必须尝试使用 SQLite FTS5（通过 better-sqlite3），若不可用则使用 JSON fallback；`data.storageBackend` 必须准确反映实际使用的后端

##### 场景：SQLite FTS5 不可用（修改）
- **当** 本地 SQLite 不支持 FTS5
- **预期** 系统必须降级为 JSON fallback，非返回错误码 2704；必须在 `warnings` 中标注降级信息；返回 code 0（非致命错误）

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 存储后端选择逻辑

```
try:
  better-sqlite3 available → SQLite FTS5 → storageBackend = "sqlite-fts5"
catch:
  JSON file → storageBackend = "json-fallback" + warning
```

### 2.2 响应结构补充字段

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "storageBackend": "sqlite-fts5 | json-fallback",
    "indexPath": ".harness/cache/knowledge.sqlite | .harness/cache/knowledge.json",
    "indexedFiles": 42,
    "results": [...]
  },
  "warnings": [
    "JSON fallback 模式下使用简单文本匹配，非 FTS5 全文检索"
  ]
}
```

---

## 3. 物理约束

在原 spec 基础上无变更。JSON fallback 搜索性能可适当放宽至 < 5000 毫秒。

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/knowledge/command.ts`：增加 `storageBackend` 声明；JSON fallback 写入 `.json` 路径而非 `.sqlite`；降级模式下 warning 标注；SQLite 不可用时降级为 JSON 而非返回 2704 错误
- [ ] `src/capabilities/knowledge/types.ts`：KnowledgeResult 增加 `storageBackend` 字段

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（3 新增 + 1 修改 = 4 个需求项，9 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息