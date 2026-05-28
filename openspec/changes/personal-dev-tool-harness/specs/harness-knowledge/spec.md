# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：本地知识索引

系统必须通过 `harness knowledge --index` 将历史 specs、ADR、rules、reports 和 archive 文档索引到本地 SQLite FTS5 数据库。

##### 场景：首次索引
- **当** 用户执行 `harness knowledge --index`
- **预期** 系统必须扫描 `.harness/develop`、`.harness/docs`、`.harness/rules`、`.harness/reports`、`openspec/changes/**/archive` 等知识来源，并写入 `.harness/cache/knowledge.sqlite`

##### 场景：增量索引
- **当** 用户重复执行 `harness knowledge --index`
- **预期** 系统必须根据文件路径、mtime 和内容 hash 只更新发生变化的文档记录

#### 需求项：知识检索

系统必须通过 `harness knowledge --search <query>` 返回带 source path、片段、类型和相关度分数的检索结果。

##### 场景：关键词检索
- **当** 用户执行 `harness knowledge --search "文档防腐" --json`
- **预期** 系统必须返回最多 20 条结果，每条结果必须包含 `sourcePath`、`title`、`kind`、`snippet`、`score`

##### 场景：无索引检索
- **当** 用户在知识库不存在时执行 `--search`
- **预期** 系统必须提示先执行 `harness knowledge --index`，并返回明确错误码

#### 需求项：本地与隐私边界

系统必须保证第一版知识库只使用本地 SQLite FTS5，不调用远程向量库或外部知识库服务。

##### 场景：存在本地私有配置
- **当** `.harness/config/knowledge.config.json` 或 `*.local.json` 配置远程服务
- **预期** 第一版 `knowledge` 命令必须忽略远程服务配置，并在报告中说明当前只支持本地 FTS5

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness knowledge`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --index | boolean | 否 | 建立或刷新索引 | `true` | 与 `--search` 至少传一个 |
| --search | string | 否 | 检索查询 | `文档防腐` | 长度 1-200；与 `--index` 可同时使用，先索引后检索 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |
| --limit | number | 否 | 结果数量 | `20` | 范围 1-50；默认 20 |
| --dry-run | boolean | 否 | 预览索引来源 | `true` | 为 `true` 时不得写 knowledge.sqlite |

#### 响应结构

**成功响应 (0)**
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

**错误响应**
```json
{
  "code": 2702,
  "msg": "knowledge index missing",
  "data": {
    "indexPath": ".harness/cache/knowledge.sqlite"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2701 | 查询参数无效 | `--search` 为空或超过 200 字符 |
| 2702 | 索引不存在 | 未建立 knowledge.sqlite 且执行搜索 |
| 2703 | 索引来源无效 | 配置的知识来源路径越界或不存在 |
| 2704 | SQLite FTS 不可用 | 本地 SQLite 不支持 FTS5 |
| 5701 | 索引写入失败 | knowledge.sqlite 写入失败 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| 首次索引时间 | < 60000 毫秒 (P95) | 文档数小于 5000 |
| 增量索引时间 | < 10000 毫秒 (P95) | 变更文档数小于 200 |
| 搜索响应时间 | < 1000 毫秒 (P95) | 索引文档数小于 50000 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 512 MB | 索引文档总量小于 500 MB |
| CPU | 平均 < 85% | 索引期间 |
| 存储 | < 1 GB | `.harness/cache/knowledge.sqlite` 上限 |

### 3.3 超时配置
- 连接超时：0 毫秒，第一版不建立网络连接
- 读取超时：60000 毫秒
- 总超时：300000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-workspace-config`：读取 cache 路径和 knowledge 配置
- [ ] `harness-develop`：索引 proposal/spec/design/tasks/archive
- [ ] `harness-sync`：索引 rules 和文档同步报告
- [ ] `harness-review`：索引审查报告和 finding 摘要

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | CLI 和文件扫描 | 阻断 knowledge |
| 数据库 | SQLite | >= 3.35.0 | FTS5 本地索引 | 返回 FTS 不可用错误 |
| 搜索扩展 | SQLite FTS5 | >= 3.35.0 | 全文检索 | 降级为文件名和标题搜索 |
| 文档格式 | CommonMark Markdown | 0.30 | Markdown 文档切片 | 纯文本切片 |

### 4.3 数据存储
- [ ] SQLite 数据库（SQLite >= 3.35.0）：`.harness/cache/knowledge.sqlite`，FTS5 索引和文档元数据
- [ ] JSON 配置：`.harness/config/knowledge.config.json`，索引来源和忽略规则

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：只读取配置允许的知识来源路径，默认不读取 secretPatterns 命中文件

### 5.2 数据安全
- 敏感字段：token、secret、私钥、证书、本地连接配置
- 加密要求：knowledge.sqlite 不加密；因此必须禁止索引敏感文件内容

### 5.3 审计要求
- 日志记录：索引来源、文件数量、跳过数量、数据库路径、搜索查询长度
- 操作追踪：索引结果必须记录每个 sourcePath 的 hash 和 indexedAt

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：knowledge.sqlite 必须包含 schemaVersion；不兼容 schema 必须触发重建或迁移提示

### 6.2 数据兼容性
- 数据迁移方案：旧 openspec archive、`.kld-review/` 报告、`.docsync/` 规则可作为只读索引来源
- 回滚策略：索引失败必须保留上一个可用 knowledge.sqlite，临时数据库写入完成后再原子替换

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
