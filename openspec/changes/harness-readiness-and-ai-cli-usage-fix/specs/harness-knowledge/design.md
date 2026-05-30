# 局部技术实现方案 - harness-knowledge（增量）

> **⚠️ 边界声明**：本设计仅服务于 `harness-knowledge` 边界修正，确保 JSON fallback 不冒充 SQLite FTS5，存储后端身份明确。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | storageBackend 声明 | data.storageBackend | string | ✅ 保留 | "sqlite-fts5" \| "json-fallback" |
| 2 | JSON fallback 路径 | data.indexPath | string | ⚠️ 重命名 | .sqlite → .json（fallback 模式） |
| 3 | JSON fallback warning | response.warnings[] | string[] | ✅ 保留 | 降级模式标注 |
| 4 | SQLite 不可用降级 | behavior | — | ✅ 保留 | 降级为 JSON 而非返回 2704 |

### 1.2 完整性自检

- **用户输入字段总数**：4 个
- **设计输出字段总数**：4 个
- **差异说明**：indexPath 在 fallback 模式从 .sqlite 改为 .json
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/knowledge/command.ts` | - | `runKnowledgeCommand()` | 扩展逻辑 | storageBackend + JSON fallback 路径 |
| `src/capabilities/knowledge/types.ts` | - | `KnowledgeResult` | 扩展逻辑 | 增加 storageBackend 字段 |

### 2.2 存储后端选择逻辑

```
try:
  // 尝试加载 better-sqlite3
  require('better-sqlite3')
  → storageBackend = "sqlite-fts5"
  → indexPath = ".harness/cache/knowledge.sqlite"
  → 使用 FTS5 全文检索
catch:
  → storageBackend = "json-fallback"
  → indexPath = ".harness/cache/knowledge.json"
  → warnings.push("JSON fallback 模式...")
  → 使用 String.includes 简单匹配
```

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| SQLite 不可用返回 2704 | 错误返回，阻断所有 knowledge 功能 | 用户无法使用基础搜索 | 改为降级为 JSON fallback |
| JSON 写入路径可能混淆 | 可能写入 .sqlite 路径 | 伪装为 SQLite 文件 | 强制 JSON fallback 写入 .json |
| 无 storageBackend 声明 | 用户无法知道实际后端 | 运维和调试困难 | 响应中增加声明 |

---

## 3. 局部前端设计

N/A。

---

## 4. 局部后端接口设计

### 4.1 索引构建增强

```typescript
// src/capabilities/knowledge/command.ts

async function buildIndex(cwd: string, dryRun: boolean): Promise<IndexResult> {
  let backend: 'sqlite-fts5' | 'json-fallback';
  let indexPath: string;

  try {
    // 尝试 better-sqlite3
    require.resolve('better-sqlite3');
    backend = 'sqlite-fts5';
    indexPath = '.harness/cache/knowledge.sqlite';
    // SQLite FTS5 索引构建...
  } catch {
    // 降级为 JSON
    backend = 'json-fallback';
    indexPath = '.harness/cache/knowledge.json';
    // JSON 文件索引构建...
  }

  return { backend, indexPath, indexedFiles: count };
}
```

### 4.2 搜索增强

```typescript
async function search(
  query: string, cwd: string
): Promise<{ results: SearchResult[]; backend: string }> {
  if (existsSync('.harness/cache/knowledge.sqlite')) {
    // SQLite FTS5 全文检索
    return { results: fts5Search(query), backend: 'sqlite-fts5' };
  }
  // JSON fallback 简单文本匹配
  return { results: jsonSearch(query), backend: 'json-fallback' };
}
```

### 4.3 runKnowledgeCommand 响应增强

```typescript
return {
  code: 0,
  msg: 'success',
  data: {
    command: 'knowledge',
    storageBackend: backend,  // ← 新增
    indexPath,
    indexedFiles,
    results,
  },
  warnings: backend === 'json-fallback'
    ? ['JSON fallback 模式下使用简单文本匹配，非 FTS5 全文检索。安装 better-sqlite3 以启用完整索引。']
    : [],
};
```

---

## 5. 局部数据模型

### 5.1 JSON fallback 结构

```json
// .harness/cache/knowledge.json
{
  "schemaVersion": 1,
  "storageBackend": "json-fallback",
  "documents": [
    {
      "sourcePath": ".harness/develop/archive/demo/spec.md",
      "title": "能力规格定义",
      "kind": "spec",
      "content": "...",
      "contentHash": "sha256:abc123"
    }
  ]
}
```

---

## 6. 模块内部逻辑

### 6.1 核心流程 — 后端检测与降级

```
runKnowledgeCommand(context)
  ├─ parseKnowledgeArgs(args)
  │
  ├─ --index 分支
  │   ├─ try: better-sqlite3 available?
  │   │   ├─ YES → SQLite FTS5 索引
  │   │   │   → storageBackend = "sqlite-fts5"
  │   │   │   → indexPath = ".harness/cache/knowledge.sqlite"
  │   │   └─ NO  → JSON 文件索引
  │   │       → storageBackend = "json-fallback"
  │   │       → indexPath = ".harness/cache/knowledge.json"
  │   │       → warnings.push("JSON fallback 模式...")
  │   └─ 返回 data.storageBackend + warnings
  │
  └─ --search 分支
      ├─ 检测 knowledge.sqlite 存在 → FTS5 搜索
      └─ 否则 → knowledge.json 搜索（String.includes）
          → warnings.push("简单文本匹配...")
```

### 6.2 修改点汇总

| 序号 | 文件 | 修改 | 代码量估算 |
|-----|------|------|-----------|
| 1 | `src/capabilities/knowledge/command.ts` | storageBackend + JSON path + try/catch 降级 | ~30 行 |
| 2 | `src/capabilities/knowledge/types.ts` | search 响应类型加 storageBackend | ~3 行 |

---

## 7. 外部依赖与集成

| 名称 | 版本 | 用途 | 降级策略 |
|------|------|------|---------|
| better-sqlite3 | ^11.0.0 | SQLite FTS5 全文检索（可选） | JSON fallback |

---

## 8. 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| SQLite 不可用 | better-sqlite3 加载失败 | 降级 JSON fallback，不返回错误 |
| JSON 文件损坏 | knowledge.json 格式错误 | 重新索引 |
| 搜索无结果 | 查询无匹配 | 返回空 results，code 0 |

---

## 9. 局部配置

无新增配置。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：2 个文件 + 2 个修改点
> - [x] **现有约束已识别**：2704 错误改为降级
> - [x] **字段完整性**：4 输入 → 4 输出
> - [x] **边界遵守**：仅修正存储后端声明
> - [x] **外部依赖已明确**：better-sqlite3 可选
> - [x] 异常处理策略已定义：3 类异常 + 降级方案
> - [x] 包含足够的局部细节支持任务拆解：核心流程 + 2 个修改点