# 实施任务拆解 - harness-adapter-skill-runtime（增量）

> **边界声明**：增量修改，仅涉及内部来源名称屏蔽和 Skill 口径统一。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-adapter-skill-runtime/spec.md` | 4 需求项 8 场景 |
| 技术方案 | `specs/harness-adapter-skill-runtime/design.md` | 7 文件 3 修改点 |

### 1.2 实现范围

实现 `sanitizeInternalNames()` 过滤函数，审计并更新 references/assets 模板文件，统一 Skill body AI CLI 口径。

### 1.3 技术栈

TypeScript 5.5+ / Markdown

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1: [TASK-SKL-01] 编写名称屏蔽测试
层级 2: [TASK-SKL-02] 实现 sanitizeInternalNames 过滤函数
        [TASK-SKL-03] 审计并更新 references/assets 模板文件
层级 3: [TASK-SKL-04] 集成到 projection-renderer
层级 4: [TASK-SKL-05] 运行测试 + --repair-adapters 验证
```

---

## 3. 原子任务清单

### [TASK-SKL-01] 编写名称屏蔽测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 编写测试验证 sanitizeInternalNames 过滤正确
- **输出**: `test/name-sanitizer.test.ts`

- **实现步骤**:
  1. 测试 docsync → sync 替换
  2. 测试 gsd 完全删除
  3. 测试 kld-sdd → develop 替换
  4. 测试 kld-review → review 替换
  5. 测试词边界（不误伤正常单词）

- **验收标准**:
  - [ ] 5 个测试用例存在（预期失败）

---

### [TASK-SKL-02] 实现 sanitizeInternalNames 过滤函数

- **类型**: 接口层
- **依赖**: TASK-SKL-01
- **状态**: [ ] 未完成

- **任务描述**: 在 `src/adapters/projection-renderer.ts` 新增名称过滤函数
- **输出**: `sanitizeInternalNames()` 函数

- **实现步骤**:
  1. 定义 `INTERNAL_NAME_MAP`
  2. 实现正则替换（含 `\b` 词边界）
  3. 清理多余空白

- **验收标准**:
  - [ ] 测试通过（5/5）
  - [ ] `npm run typecheck` 通过

- **关联设计**: design.md §4.1

---

### [TASK-SKL-03] 审计并更新 references/assets 模板文件

- **类型**: 配置
- **依赖**: TASK-SKL-01
- **状态**: [ ] 未完成

- **任务描述**: 审计 6 个模板文件，替换内部来源名
- **输入**: `.harness/adapters/shared/skills/harness/references/*.md`（4 文件）
        + `.harness/adapters/shared/skills/harness/assets/*.md`（2 文件）
- **输出**: 更新后的 6 个文件

- **实现步骤**:
  1. grep 搜索 `docsync`/`gsd`/`kld-sdd`/`kld-review`
  2. 逐文件替换
  3. 更新 Skill body 示例为 AI CLI 口径

- **验收标准**:
  - [ ] 6 个文件不含内部来源名
  - [ ] Skill 示例改为"当用户说...时"格式

---

### [TASK-SKL-04] 集成到 projection-renderer

- **类型**: 接口层
- **依赖**: TASK-SKL-02
- **状态**: [ ] 未完成

- **任务描述**: 在 `renderFrontmatter()` 和投影写入流程中调用过滤函数
- **输入**: `src/adapters/projection-renderer.ts`, `src/adapters/projection-writer.ts`
- **输出**: 集成过滤的渲染器

- **实现步骤**:
  1. 在 `renderFrontmatter()` 返回前调用 `sanitizeInternalNames()`
  2. 在 `renderBody()` 返回前调用过滤

- **验收标准**:
  - [ ] 生成的 SKILL.md 不含内部来源名
  - [ ] 全量投影生成正常

---

### [TASK-SKL-05] 运行测试 + --repair-adapters 验证

- **类型**: 测试-验证
- **依赖**: TASK-SKL-04
- **状态**: [ ] 未完成

- **验收标准**:
  - [ ] `test/name-sanitizer.test.ts` 5/5 通过
  - [ ] `node dist/bin/harness.js config --repair-adapters` 后投影文件不含内部名
  - [ ] `npm run lint` + `npm run typecheck` 通过

---

> **质量红线检查清单**
> - [x] 每个任务 ≤ 5 分钟
> - [x] 100% 覆盖 spec.md（4 需求项 → 5 任务）
> - [x] 100% 覆盖 design.md（3 修改点 → 5 任务）
> - [x] 无循环依赖