---
name: "Harness: Knowledge"
description: "知识库索引和搜索 - 索引项目文档并支持全文搜索历史设计、规则和报告"
argument-hint: "[--index] [--search <query>] [--limit N] [--dry-run] [--json]"
skill: harness-knowledge
---

构建项目知识索引或搜索已有知识内容。支持 SQLite FTS5（优先）和 JSON（后备）两种存储后端。

> **跨平台执行规则**
> - 先确认终端工作目录是项目根目录
> - 必须先 `--index` 再 `--search`
> - 可选依赖：better-sqlite3（提供 FTS5 全文搜索）

### 执行步骤

1. 首次使用：运行 `harness knowledge --index` 构建索引
2. 搜索：运行 `harness knowledge --search "关键词" --limit 20`
3. 更新索引：再次运行 `harness knowledge --index`（增量更新）
4. 结果按相关性得分排序展示