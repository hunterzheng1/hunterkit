# 实施任务拆解 - harness-knowledge（增量）

> **边界声明**：增量修改，仅涉及 knowledge 命令的存储后端身份声明和 JSON fallback 路径修正。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-knowledge/spec.md` | 4 需求项 9 场景 |
| 技术方案 | `specs/harness-knowledge/design.md` | 2 文件 2 修改点 |

### 1.2 实现范围

增加 `storageBackend` 声明、JSON fallback 写入 `.json` 路径、SQLite 不可用时降级而非返回 2704。

### 1.3 技术栈

TypeScript 5.5+ / better-sqlite3 11+

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1: [TASK-KNW-01] 编写 knowledge 存储后端测试
层级 2: [TASK-KNW-02] 实现 storageBackend 声明 + JSON fallback 降级
        [TASK-KNW-03] 修正 JSON fallback 写入路径（.json 非 .sqlite）
层级 3: [TASK-KNW-04] 运行测试验证
```

---

## 3. 原子任务清单

### [TASK-KNW-01] 编写 knowledge 存储后端测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 编写测试验证 storageBackend 声明和 JSON fallback 路径
- **输出**: `test/knowledge-backend.test.ts`

- **实现步骤**:
  1. 测试 SQLite 可用时 `storageBackend === "sqlite-fts5"`
  2. 测试 JSON fallback 时 `storageBackend === "json-fallback"`
  3. 测试 JSON fallback 写入 `.json` 路径
  4. 测试 JSON fallback warnings 含降级提示

- **验收标准**:
  - [ ] 4 个测试用例存在（预期部分失败）

---

### [TASK-KNW-02] 实现 storageBackend 声明 + JSON fallback 降级

- **类型**: 接口层
- **依赖**: TASK-KNW-01
- **状态**: [ ] 未完成

- **任务描述**: 在 knowledge 响应中增加 `storageBackend` 字段，SQLite 不可用时降级而非返回 2704
- **输入**: `src/capabilities/knowledge/command.ts`, `types.ts`
- **输出**: 修正后的命令

- **实现步骤**:
  1. 尝试 `require.resolve('better-sqlite3')`
  2. 成功 → `storageBackend = "sqlite-fts5"`，正常流程
  3. 失败 → `storageBackend = "json-fallback"`，降级为 JSON，warnings 标注
  4. 响应 `data` 含 `storageBackend`

- **验收标准**:
  - [ ] `data.storageBackend` 字段存在
  - [ ] SQLite 不可用时返回 code 0（非 2704）
  - [ ] warnings 含 JSON fallback 提示
  - [ ] `npm run typecheck` 通过

- **关联设计**: design.md §4.1

---

### [TASK-KNW-03] 修正 JSON fallback 写入路径

- **类型**: 接口层
- **依赖**: TASK-KNW-01
- **状态**: [ ] 未完成

- **任务描述**: JSON fallback 时写入 `.harness/cache/knowledge.json` 而非 `.sqlite`
- **输入**: `src/capabilities/knowledge/command.ts`
- **输出**: 路径修正

- **实现步骤**:
  1. fallback 分支设 `indexPath = '.harness/cache/knowledge.json'`
  2. 搜索时检测文件后缀（.json → 简单匹配，.sqlite → FTS5）
  3. 更新 `data.indexPath` 反映实际路径

- **验收标准**:
  - [ ] fallback 模式下生成 `knowledge.json` 非 `knowledge.sqlite`
  - [ ] search 能正确读取 fallback 文件

- **关联设计**: design.md §4.2 & §5.1

---

### [TASK-KNW-04] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-KNW-02, TASK-KNW-03
- **状态**: [ ] 未完成

- **验收标准**:
  - [ ] `test/knowledge-backend.test.ts` 4/4 通过
  - [ ] `npm run typecheck` 通过

---

## 4. 交付物

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/knowledge/command.ts` | storageBackend + path | TASK-KNW-02,03 |
| `src/capabilities/knowledge/types.ts` | storageBackend 类型 | TASK-KNW-02 |
| `test/knowledge-backend.test.ts` | 存储后端测试 | TASK-KNW-01 |

---

> **质量红线检查清单**
> - [x] 每个任务 ≤ 5 分钟
> - [x] 100% 覆盖 spec.md（4 需求项 → 4 任务）
> - [x] 100% 覆盖 design.md（2 修改点 → 4 任务）
> - [x] 无循环依赖