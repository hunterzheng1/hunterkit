---
name: harness-knowledge
description: "知识库索引和搜索 - 索引项目文档（specs/reports/rules/docs），支持全文搜索历史设计、规则和报告"
argument-hint: "[--index] [--search <query>] [--limit N] [--dry-run] [--json]"
license: MIT
compatibility: Requires @hunterzheng/harness CLI (v2.0+). 可选: better-sqlite3 用于 FTS5 全文搜索。
metadata:
  author: "@hunterzheng"
  version: "1.0"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
disable-model-invocation: false
---

你是一个 Harness 知识库管理专家。激活本技能后，你将帮助用户索引项目知识文档或搜索已有的知识内容。

> **⚠️ 阶段边界约束**
>
> **knowledge** 有两种模式：
> - ✅ `--index`（写入）：扫描知识源目录，构建/更新搜索索引到 `.harness/cache/knowledge.sqlite`
> - ✅ `--search`（只读）：在已有索引上执行全文搜索
> - ❌ **禁止**：修改被索引的源文件、删除索引之外的数据
> - ⛔ **必须先 `--index` 再 `--search`**，搜索未索引的数据库会返回错误码 2702

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录。
> - 索引存储路径使用正斜杠格式。

---

## 技能定位

**knowledge** 是 Harness 的知识检索系统，为 AI 助手提供项目的"长期记忆"——索引所有 Harness 管理的规范、报告、规则和文档。

| 维度 | 内容 |
|------|------|
| 核心问题 | 项目中有哪些已有的设计、规范、报告或规则？ |
| 关键输出 | 搜索结果（含源文件路径、摘要片段、相关性得分） |
| 存储后端 | 主：SQLite FTS5（需 better-sqlite3）/ 备：JSON（子字符串匹配） |
| 写入行为 | 仅写入 `.harness/cache/knowledge.sqlite` |

## 意图路由表

| 用户意图关键词 | 触发条件 | 执行策略 |
|---------------|---------|---------|
| "构建索引" / "index" / "索引项目" | 首次或更新索引 | 运行 `harness knowledge --index`（增量，基于 hash） |
| "搜索" / "search" / "查找" / "检索" | 全文搜索 | 运行 `harness knowledge --search "<query>"` |
| "搜索上次审查" / "查找报告" | 搜索特定类型 | 运行 `harness knowledge --search "<关键词>" --limit 10` |
| "索引并搜索" / "重建索引" | 索引 + 搜索 | 先 `--index`，再 `--search`（两步操作） |
| "JSON 搜索结果" / "结构化搜索" | 程序化消费 | 运行 `harness knowledge --search "<q>" --json` |

## 知识源目录

| 源目录 | 类型 | 说明 |
|--------|------|------|
| `.harness/develop/` | spec | 开发规范和提案 |
| `.harness/docs/` | rule | 用户文档 |
| `.harness/rules/` | rule | 项目规则 |
| `.harness/reports/` | report | Review/sync 报告 |
| `openspec/changes/` | spec | 旧 OpenSpec 变更 |
| `.kld-review/` | report | 旧审查产物（可选） |
| `.docsync/` | rule | 旧 docsync（可选） |

**可索引文件类型**：`.md` `.ts` `.tsx` `.js` `.jsx` `.json` `.yaml` `.yml` `.py` `.java` `.go`

---

## 启动流程

### 1. 输入处理

| 用户意图 | 执行策略 |
|----------|----------|
| "构建知识索引" | 运行 `harness knowledge --index` |
| "搜索API设计" | 运行 `harness knowledge --search "API设计"` |
| "搜索上次的审查报告" | 运行 `harness knowledge --search "review P0" --limit 5` |
| "索引并搜索" | 先 `--index`，再 `--search` |

### 2. 构建索引

```bash
harness knowledge --index
```

**特点**：
- 增量索引：基于内容 hash 只处理变更文件
- 自动回退：better-sqlite3 不可用时使用 JSON 后备存储
- 首次索引耗时较长（取决于项目文件数量），后续增量索引很快

### 3. 执行搜索

```bash
harness knowledge --search "查询关键词" --limit 20
```

**结果包含**：
- 源文件路径
- 匹配内容摘要（snippet）
- 相关性得分（BM25 或子字符串匹配得分）

### 4. 解读结果

向用户展示搜索结果时：
1. 按得分降序排列
2. 高亮最相关的 3-5 条
3. 标注每条的源文件路径和匹配摘要
4. 如果结果为 0，提示"未找到匹配内容，尝试其他关键词或检查索引是否最新"

### 5. 下一步建议

- 如果搜索无结果：建议重新运行 `--index` 更新索引
- 如果找到相关规范：建议阅读源文件获取完整上下文
- 如果找到审查报告：建议运行 `harness review` 进行新的审查
- 如果需要开发新功能：建议运行 `harness develop <name> --propose`

---

## Guardrails

- **索引优先**：`--search` 前必须至少运行一次 `--index`（否则返回 2702）
- **增量更新**：重复 `--index` 仅处理变更文件，不重复索引
- **存储后端自适应**：优先 SQLite FTS5，不可用时自动降级 JSON（输出警告）
- **查询限制**：搜索查询长度 1-200 字符，结果数量 1-50
- **只读搜索**：`--search` 不修改任何文件
- **不索引非文本文件**：仅处理 `.md` `.ts` `.json` 等文本格式
- **独立存储**：索引数据库位于 `.harness/cache/`，与项目源码隔离