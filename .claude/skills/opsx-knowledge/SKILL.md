---
name: opsx-knowledge
description: "Queries RAGFlow business knowledge base for MM/CO domain terms during SDD workflows. Use when encountering unclear business nouns, internal ERP terminology, MM/CO module concepts, or domain rules in propose/spec/design/apply. Results are advisory only and must not override SDD documents or user input."
argument-hint: "[question] [--module=mm|co|auto]"
license: MIT
metadata:
  author: sdd-team
  version: "1.0"
allowed-tools:
  - Bash
  - Read
---

# SDD 业务知识库检索（RAGFlow）

为 SDD 工作流提供 **MM / CO 模块** 的业务知识检索。检索结果 **只做建议参考**，不得作为强制约束写入 spec 红线。

## RAGFlow 知识库配置

```env
RAGFLOW_BASE_URL=http://10.29.219.26:9380
RAGFLOW_API_KEY=ragflow-6xxy9RUUtRiE9N6gzpTLfQbY00tnGGKWsEuBR53zp0U
```

| 模块 | dataset_id |
|------|------------|
| MM模块 | `12eda67a4ffb11f19cb713ede57b176f` |
| CO模块 | `02841d1e4ffb11f19cb713ede57b176f` |

配置已写死在 `scripts/config.json`，脚本会自动读取。

---

## 使用原则（强制）

1. **可选**：仅当业务名词/领域含义不清时才查询
2. **非强制**：不得因知识库结果覆盖 proposal / spec / design / 用户确认内容
3. **冲突处理**：与用户输入、现有代码、openspec 文档冲突时，以用户 / 文档 / 代码为准
4. **引用格式**：输出中标注 `📚 知识库建议：...`，禁止写成“必须 / 规定 / 红线”
5. **失败降级**：内网不可达、超时、无结果时 **继续 SDD 主流程**，仅提示“未查询到知识库”

---

## 何时查询

**适合查询：**
- 不明业务名词（如“物料凭证”“评估类”“成本中心”）
- MM / CO 模块内部术语
- propose / spec / design 阶段需要补充领域背景

**不必查询：**
- 通用技术概念
- 文档已明确定义
- 用户已给出权威解释

模块判断细则见 [references/modules.md](references/modules.md)。

---

## 执行步骤

### 1. 判断模块

按上下文自行判断查询 **MM**、**CO**，或两者都查：

| 信号 | 倾向模块 |
|------|----------|
| 物料、库存、采购、MRP、BOM、仓库 | MM |
| 成本、费用、预算、核算、CO-PA、成本中心 | CO |
| proposal/spec 的 capability 名称或路径 | 按模块归属 |
| 无法判断 | 跳过查询，不阻塞主流程 |

### 2. 调用检索脚本

在项目根目录执行（使用 skill 目录变量，与 gitnexus 子 skill 脚本引用方式一致）：

```bash
node ${CLAUDE_SKILL_DIR}/scripts/retrieve.cjs --question="物料凭证是什么" --module=mm
node ${CLAUDE_SKILL_DIR}/scripts/retrieve.cjs --question="成本中心与利润中心的区别" --module=co
node ${CLAUDE_SKILL_DIR}/scripts/retrieve.cjs --question="..." --module=auto
```

`${CLAUDE_SKILL_DIR}` 由 Claude Code 注入，指向本 skill 目录（如 `.claude/skills/opsx-knowledge/`）。

`--module` 取值：
- `mm` / `co`：指定模块
- `auto`：按 question 关键词自动匹配（默认）

### 3. 处理结果

**成功（`ok: true`）**：读取 `chunks`，提炼 1-3 条建议，标注来源模块。

**失败（`ok: false`）**：不 retry 阻塞主流程，继续原有 SDD 步骤。

输出模板：

```markdown
📚 知识库建议（MM模块，仅供参考）：
- ...
- ...

说明：以上来自 RAGFlow 知识库，不作为 SDD 契约；如与 spec / 用户输入冲突，以 spec / 用户输入为准。
```

---

## API 参考

内网 RAGFlow retrieval 接口：

```bash
curl --request POST \
  --url http://10.29.219.26:9380/api/v1/retrieval \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer ragflow-6xxy9RUUtRiE9N6gzpTLfQbY00tnGGKWsEuBR53zp0U' \
  --data '{
    "question": "What is advantage of ragflow?",
    "dataset_ids": ["12eda67a4ffb11f19cb713ede57b176f"]
  }'
```

日常优先使用 `scripts/retrieve.cjs`，不要手写 curl。

---

## 与其他 SDD Skill 的关系

- **opsx-propose / opsx-spec / opsx-design / opsx-apply**：遇到业务名词时可 **可选** 调用本 skill
- **opsx-check**：不得把知识库内容当作质量红线依据
- 本 skill **不修改** 任何 openspec 文档，只提供参考信息
