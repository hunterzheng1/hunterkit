# Harness Develop — 7 个 SDD 阶段详细说明

> 本文档是 `SKILL.md` 的辅助参考文件，仅在需要了解具体阶段细节时读取。
> 详见 SKILL.md → **Supporting Files** 章节的渐进披露规则。

---

## 阶段概览

```
propose → spec → design → tasks → check → apply → archive
```

| 阶段 | 标志 | M1 状态 | 核心问题 | 输出物 |
|------|------|--------|---------|--------|
| 1. propose | `--propose` | ✅ 可用 | Why - 为什么做 | `.harness/develop/changes/<name>/proposal.md` |
| 2. spec | `--spec` | ⏳ 后续版本 | What - 做什么 | `openspec/changes/<name>/specs/*/spec.md` |
| 3. design | `--design` | ⏳ 后续版本 | How - 怎么做 | `openspec/changes/<name>/design.md` |
| 4. tasks | `--tasks` | ⏳ 后续版本 | Steps - 分步实施 | `openspec/changes/<name>/tasks.md` |
| 5. check | `--check` | ⏳ 后续版本 | Quality - 质量门禁 | 检查报告 |
| 6. apply | `--apply` | ⛔ 阻断 | Execute - 执行实施 | 代码变更 |
| 7. archive | `--archive` | ⏳ 后续版本 | Record - 归档度量 | 归档记录 |

---

## 阶段 1: Propose（提案）

**标志**：`--propose`
**M1 状态**：✅ 可用
**核心问题**：Why — 为什么要做这个变更？

**输入**：
- 变更名称（kebab-case，3-80 字符）
- 用户描述的业务需求
- 可选的上下文文件

**输出**：
- `.harness/develop/changes/<name>/proposal.md`
- YAML frontmatter：`mode`（full/simple/auto）、`test-strategy`（tdd/impl-first/none）
- 章节：需求背景、业务目标、能力分解、影响范围、约束条件、质量红线

**阶段边界**：
- ✅ 允许：创建/编辑 proposal.md、读取代码/文档作为上下文
- ❌ 禁止：修改代码文件、执行代码生成、运行测试
- ⛔ 完成后**必须立即停止**，不自动进入下一阶段

**下一步提示**：
- 如果项目有 OpenSpec 集成：使用 `/opsx:spec` 创建技术契约
- 如果需要项目上下文：运行 `harness inspect` 获取项目事实

---

## 阶段 2: Spec（技术契约）

**标志**：`--spec`
**M1 状态**：⏳ 后续版本支持

**核心问题**：What — 具体做什么（业务场景 + 技术规范）

**当前处理**：
告知用户："spec 阶段将在后续版本支持"，建议使用 `/opsx:spec` 或手动编写 `openspec/changes/<name>/specs/<capability>/spec.md`

---

## 阶段 3: Design（技术设计）

**标志**：`--design`
**M1 状态**：⏳ 后续版本支持

**核心问题**：How — 怎么做（技术方案 + 架构决策）

**当前处理**：
告知用户："design 阶段将在后续版本支持"

---

## 阶段 4: Tasks（任务拆解）

**标志**：`--tasks`
**M1 状态**：⏳ 后续版本支持

**核心问题**：Steps — 分步骤实施计划

**当前处理**：
告知用户："tasks 阶段将在后续版本支持"

---

## 阶段 5: Check（质量门禁）

**标志**：`--check`
**M1 状态**：⏳ 后续版本支持

**核心问题**：Quality — 是否满足质量红线

**当前处理**：
告知用户："check 阶段将在后续版本支持"

---

## 阶段 6: Apply（执行实施）

**标志**：`--apply`
**M1 状态**：⛔ 阻断

**阻断原因**：需要 `--check` 先完成（错误码 2505），当前 check 尚未实现

**当前处理**：
告知用户："apply 阶段需要 check 先完成（错误码 2505），当前 check 尚未实现"

---

## 阶段 7: Archive（归档）

**标志**：`--archive`
**M1 状态**：⏳ 后续版本支持

**核心问题**：Record — 归档变更记录与度量

**当前处理**：
告知用户："archive 阶段将在后续版本支持"

---

## 可选参数

| 参数 | 说明 |
|------|------|
| `--from <stage>` | 从指定阶段开始（跳过之前的阶段） |
| `--capability <name>` | 限定到单个能力域 |
| `--parallel` / `--no-parallel` | 并行执行（默认 `--parallel`，后续版本支持多 agent） |
| `--dry-run` | 预览不写入 |

---

## 存储双模式

| 模式 | 路径 | 说明 |
|------|------|------|
| 主模式 | `.harness/develop/changes/<name>/` | Harness 原生格式 |
| 兼容模式 | `openspec/changes/<name>/` | OpenSpec 兼容格式 |

系统会优先检查 `.harness/develop/changes/` 目录，若不存在则兼容 `openspec/changes/` 旧格式。

---

## 变更名称规范

- 格式：kebab-case（`[a-z0-9]+(-[a-z0-9]+)*`）
- 长度：3-80 字符
- 示例：
  - ✅ `add-user-auth`
  - ✅ `fix-login-timeout`
  - ✅ `harness-install-artifact-compliance-fix`
  - ❌ `Add User Auth`（含空格和大写）
  - ❌ `add`（太短，< 3 字符）