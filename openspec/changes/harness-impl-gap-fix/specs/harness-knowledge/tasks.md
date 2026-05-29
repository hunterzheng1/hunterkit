# 实施任务拆解 - harness-knowledge

> **定位**：单一 Capability 的 AI 编码引擎执行单元
>
> **⚠️ 边界声明**：本任务清单仅服务于 `harness-knowledge` Capability，严禁跨模块任务。
>
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

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

- 迁移存储层从 JSON 文件到 SQLite FTS5
- 实现 `--index` 索引构建/刷新（索引 openspec archive、ADR、rules、reports）
- 实现 `--search` FTS5 全文搜索
- 实现增量索引（content hash 比较）
- 搜索结果带 source path/snippet/score
- 兼容读取旧目录作为索引来源

### 1.3 技术栈

- 语言：TypeScript (ESM)
- 依赖：better-sqlite3 >= 9.0.0、SQLite >= 3.35.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动 (TDD)`

### 2.1 拓扑图

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1 (测试骨架，可并行)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ TASK-KN-01 ✅│  │ TASK-KN-02 ✅│  │ TASK-KN-03 ✅│       │
│  │ 参数解析测试  │  │ 索引构建测试  │  │ 搜索功能测试  │       │
│  │ 骨架         │  │ 骨架         │  │ 骨架         │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         v                 v                 v               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  层级 2 (实现代码)                                       ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ TASK-KN-04 ✅│  │ TASK-KN-05 ✅│  │ TASK-KN-06 ✅│  ││
│  │  │ 参数解析实现  │  │ SQLite FTS5  │  │ 索引构建实现  │  ││
│  │  │             │  │ schema+迁移  │  │             │  ││
│  │  │ 依赖: 01    │  │ 依赖: 02    │  │ 依赖: 02,05 │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ││
│  │         │                 │                 │           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  层级 3 (搜索+验证)                                  │││
│  │  │  ┌──────────────┐  ┌──────────────┐                │││
│  │  │  │ TASK-KN-07 ✅│  │ TASK-KN-08 ✅│                │││
│  │  │  │ FTS5搜索实现 │  │ 测试验证     │                │││
│  │  │  │ 依赖: 03,06 │  │ 依赖: 07    │                │││
│  │  │  └──────────────┘  └──────────────┘                │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-KN-01, TASK-KN-02, TASK-KN-03 | ✅ 是 | 无 |
| 层级 2 | TASK-KN-04 | - | TASK-KN-01 |
| 层级 2 | TASK-KN-05 | - | TASK-KN-02 |
| 层级 2 | TASK-KN-06 | - | TASK-KN-05 |
| 层级 3 | TASK-KN-07 | - | TASK-KN-03, TASK-KN-06 |
| 层级 3 | TASK-KN-08 | - | TASK-KN-07 |

---

## 3. 原子任务清单

### [TASK-KN-01] 编写参数解析单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 `parseKnowledgeArgs()` 创建测试骨架，覆盖 `--index`、`--search`、`--limit` 参数解析和校验。

#### 输入
- `src/capabilities/knowledge/command.ts` 函数签名

#### 输出
- `test/capabilities/knowledge.test.ts` 追加测试

#### 实现步骤
1. 追加 `describe('parseKnowledgeArgs')` 块
2. 编写测试：`--index` 解析
3. 编写测试：`--search "query"` 解析
4. 编写测试：`--search` 空字符串或超 200 字符返回 2701
5. 编写测试：`--limit` 范围校验（1-50）
6. 编写测试：`--index` 和 `--search` 至少传一个（返回 2701）

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--index 索引构建」「--search 搜索」
- design.md 章节：§4.2 参数解析伪代码

---

### [TASK-KN-02] 编写索引构建单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 SQLite FTS5 索引构建、增量索引和索引来源扫描创建测试骨架。

#### 输入
- `scanKnowledgeSources()` 和数据库操作函数签名

#### 输出
- `test/capabilities/knowledge.test.ts` 追加测试

#### 实现步骤
1. 编写测试：索引来源扫描（develop/docs/rules/reports + legacy）
2. 编写测试：首次索引（全部 INSERT）
3. 编写测试：增量索引（content hash 变化才 UPDATE）
4. 编写测试：已删除文件记录清理
5. 编写测试：`--dry-run` 不写 knowledge.sqlite

#### 验收标准
- [ ] 包含 5 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--index 索引构建」「增量索引」
- design.md 章节：§5.1、§6.1、§6.2

---

### [TASK-KN-03] 编写搜索功能单元测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
为 FTS5 全文搜索、搜索结果格式和降级搜索创建测试骨架。

#### 输入
- `searchDatabase()` 函数签名

#### 输出
- `test/capabilities/knowledge.test.ts` 追加测试

#### 实现步骤
1. 编写测试：FTS5 搜索返回正确结果
2. 编写测试：结果包含 sourcePath/title/kind/snippet/score
3. 编写测试：结果按 score 降序排列
4. 编写测试：`--limit` 限制结果数量
5. 编写测试：索引不存在返回 2702
6. 编写测试：FTS5 不可用时降级为 LIKE 查询

#### 验收标准
- [ ] 包含 6 个测试用例骨架

#### 关联设计
- spec.md 章节：需求项「--search 搜索」「搜索结果格式」
- design.md 章节：§6.3

---

### [TASK-KN-04] 实现 parseKnowledgeArgs 参数解析

- **类型**: 接口层
- **依赖**: TASK-KN-01
- **状态**: [x] 已完成

#### 任务描述
在 `command.ts` 中新增 `parseKnowledgeArgs()` 函数。

#### 输入
- `context.args` 字符串数组

#### 输出
- `KnowledgeOptions` 对象

#### 实现步骤
1. 解析 `--index` 布尔标志
2. 解析 `--search <query>` 带值参数，校验长度 1-200
3. 解析 `--limit <n>` 带值参数，校验范围 1-50，默认 20
4. 校验 `--index` 和 `--search` 至少传一个
5. 无效参数返回 2701

#### 验收标准
- [ ] 全部参数正确解析
- [ ] 校验正确
- [ ] TASK-KN-01 测试通过

#### 关联设计
- spec.md 章节：全部参数需求项
- design.md 章节：§4.2

---

### [TASK-KN-05] 实现 SQLite FTS5 schema 和存储层迁移

- **类型**: 数据层
- **依赖**: TASK-KN-02
- **状态**: [x] 已完成

#### 任务描述
替换 JSON 文件存储为 SQLite FTS5；创建 `knowledge_documents` 虚拟表；实现数据库 CRUD 操作。

#### 输入
- 现有 JSON 文件存储逻辑

#### 输出
- SQLite FTS5 存储层

#### 实现步骤
1. 添加 `better-sqlite3` 依赖到 `package.json`
2. 实现 `openOrCreateDatabase(dbPath)` 函数
3. 创建 FTS5 虚拟表 `knowledge_documents`
4. 实现 `insert`/`update`/`delete`/`get` 操作
5. 修改输出路径为 `.harness/cache/knowledge.sqlite`
6. 替换 `KnowledgeIndex` 类型定义
7. 保留旧 JSON 文件作为备份

#### 验收标准
- [ ] FTS5 虚拟表创建成功
- [ ] CRUD 操作正确
- [ ] 旧 JSON 文件保留为备份
- [ ] TASK-KN-02 中数据库测试通过

#### 关联设计
- spec.md 章节：需求项「SQLite FTS5 迁移」
- design.md 章节：§5.1 数据表设计

---

### [TASK-KN-06] 实现 --index 索引构建/刷新

- **类型**: 接口层
- **依赖**: TASK-KN-05
- **状态**: [x] 已完成

#### 任务描述
实现 `scanKnowledgeSources()` 扫描索引来源；实现增量索引逻辑（content hash 比较）。

#### 输入
- `KnowledgeOptions` 对象

#### 输出
- 索引统计（indexedFiles）

#### 实现步骤
1. 实现 `scanKnowledgeSources()`：扫描 `.harness/develop/`、`.harness/docs/`、`.harness/rules/`、`.harness/reports/`、`openspec/changes/**/archive`
2. 兼容读取旧目录：`.kld-review/`、`.docsync/`（通过 `legacy-sources.ts`）
3. 对每个文件计算 SHA-256 content hash
4. 与已有记录比较：新文件 INSERT，变化文件 UPDATE
5. 删除已不存在的文件记录
6. `--dry-run` 时不写 knowledge.sqlite

#### 验收标准
- [ ] 索引来源扫描正确
- [ ] 增量索引正确（只更新变化的）
- [ ] 已删除文件记录清理
- [ ] `--dry-run` 不写入
- [ ] TASK-KN-02 测试通过

#### 关联设计
- spec.md 章节：需求项「--index 索引构建」「增量索引」
- design.md 章节：§6.1、§6.2

---

### [TASK-KN-07] 实现 --search FTS5 全文搜索

- **类型**: 接口层
- **依赖**: TASK-KN-03, TASK-KN-06
- **状态**: [x] 已完成

#### 任务描述
实现 `searchDatabase()` FTS5 全文搜索；返回带 sourcePath/title/kind/snippet/score 的结果。

#### 输入
- `query` 字符串和 `limit` 数值

#### 输出
- `SearchResult[]`

#### 实现步骤
1. 检查 `knowledge.sqlite` 是否存在（不存在返回 2702）
2. 执行 FTS5 MATCH 查询
3. 使用 `snippet()` 函数生成摘要
4. 使用 `rank` 作为 score（取绝对值）
5. 按 score 降序排列，限制 `--limit` 条
6. FTS5 不可用时降级为 LIKE 查询（返回 2704 警告）

#### 验收标准
- [ ] FTS5 搜索结果正确
- [ ] 结果包含 sourcePath/title/kind/snippet/score
- [ ] 按 score 降序
- [ ] 索引不存在返回 2702
- [ ] FTS5 不可用降级
- [ ] TASK-KN-03 测试通过

#### 关联设计
- spec.md 章节：需求项「--search 搜索」「搜索结果格式」
- design.md 章节：§6.3

---

### [TASK-KN-08] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-KN-07
- **状态**: [x] 已完成

#### 任务描述
运行全部 knowledge 相关测试，确保所有断言通过。

#### 输入
- 层级 1-3 的全部实现

#### 输出
- 全部测试通过

#### 实现步骤
1. 补全所有 `TODO` 断言
2. 运行 `npx vitest run test/capabilities/knowledge.test.ts`
3. 修复失败用例

#### 验收标准
- [ ] 全部 16 个测试通过
- [ ] 无 TypeScript 编译错误

#### 关联设计
- spec.md 章节：全部需求项
- design.md 章节：§8 异常处理

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-KN-01 | 参数解析 | --index/--search/--limit/校验 | options 字段正确 |
| TASK-KN-02 | 索引构建 | 来源扫描/首次/增量/清理/dry-run | indexedFiles、数据库内容 |
| TASK-KN-03 | 搜索 | FTS5/结果格式/score/limit/降级 | results 数组正确 |

### 4.2 集成测试场景

| 场景 | 前置条件 | 操作步骤 | 预期结果 |
|-----|---------|---------|---------|
| 首次索引 | 有 develop/docs | --index | knowledge.sqlite 创建 |
| 增量索引 | 已有索引 | 修改文件后 --index | 只更新变化的 |
| 搜索 | 已有索引 | --search "query" | 返回匹配结果 |
| 索引缺失 | 无索引 | --search "query" | 返回 2702 |

### 4.3 手动验证清单

- [ ] `harness knowledge --index` 构建索引
- [ ] `harness knowledge --search "review"` 搜索
- [ ] 搜索结果包含 sourcePath/snippet/score

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| better-sqlite3 >= 9.0.0 | 第三方包 | npm | ⏳ 需安装 | 降级：返回 FTS 不可用 |
| core/paths | 内部模块 | resolveWorkspacePaths | ✅ 就绪 | |
| core/legacy-sources | 内部模块 | detectLegacySources | ✅ 就绪 | |
| core/transaction | 内部模块 | beginTransaction | ✅ 就绪 | |

---

## 6. 代码规范

### 6.1 命名规范

- 表名：snake_case（如 `knowledge_documents`）
- 方法名：camelCase（如 `openOrCreateDatabase`）

### 6.2 代码风格

- 缩进：2 空格
- 注释：中文注释
- SQL 关键字：大写

---

## 7. 交付物

### 7.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/knowledge/command.ts` | 参数解析+索引+搜索 | TASK-KN-04, 06, 07 |
| `src/capabilities/knowledge/types.ts` | 类型定义迁移 | TASK-KN-05 |
| `package.json` | 添加 better-sqlite3 | TASK-KN-05 |

### 7.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/knowledge.test.ts` | knowledge 全部测试 | TASK-KN-01~03, TASK-KN-08 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖
