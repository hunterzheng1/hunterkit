# 实施任务拆解 - harness-sync

> **定位**：单一 Capability 的 AI 编码引擎执行单元
> 
> **⚠️ 边界声明**：本任务清单仅服务于当前 Capability，严禁跨模块任务。
> 
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-sync/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-sync/design.md` | 当前能力设计 |

### 1.2 实现范围

- Managed block 收敛：marker 从 `harness-managed:start` 迁移到 `harness:start`
- 根文档生成：AGENTS.md、CLAUDE.md、Codex 入口文档
- 旧来源名隐藏：DocSync、GSD、kld-sdd、kld-review 不再暴露
- Managed block 用户内容保护：只替换 managed block，不覆盖用户手写
- 旧 block 迁移：`docsync` block → Harness block
- Sync 报告：记录迁移、暴露、保留内容

### 1.3 技术栈

- 语言：TypeScript 5.5+
- 测试：vitest ^2.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行)                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ TASK-SYN-01   │  │ TASK-SYN-02   │  │ TASK-SYN-03          │   │
│  │ Managed block  │  │ 旧来源名隐藏   │  │ 用户内容保护/迁移     │   │
│  │ 测试 (骨架)    │  │ 测试 (骨架)    │  │ 测试 (骨架)          │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          │                  │                      │               │
│          v                  v                      v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │ │
│  │  │ TASK-SYN-04   │  │ TASK-SYN-05   │  │ TASK-SYN-06      │  │ │
│  │  │ Managed block  │  │ 内部来源扫描   │  │ Block 迁移/保护   │  │ │
│  │  │ 模板实现       │  │ 实现           │  │ 实现              │  │ │
│  │  │ 依赖: 01      │  │ 依赖: 02      │  │ 依赖: 03          │  │ │
│  │  └───────┬───────┘  └───────┬───────┘  └────────┬─────────┘  │ │
│  │          │                  │                    │             │ │
│  │          v                  v                    v             │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌───────────────┐  ┌──────────────────────────────────┐ │ │ │
│  │  │  │ TASK-SYN-07   │  │ TASK-SYN-08                      │ │ │ │
│  │  │  │ Sync 命令重构  │  │ Init 文档写入委托                │ │ │ │
│  │  │  │ 依赖: 04,05,06│  │ 依赖: 04,06                      │ │ │ │
│  │  │  └───────┬───────┘  └──────────────┬───────────────────┘ │ │ │
│  │  │          │                          │                      │ │ │
│  │  │          v                          v                      │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-SYN-09                                       │ │ │ │ │
│  │  │  │  │ 全量测试验证                                       │ │ │ │ │
│  │  │  │  │ 依赖: 07,08                                       │ │ │ │ │
│  │  │  │  └──────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-SYN-01, TASK-SYN-02, TASK-SYN-03 | ✅ 是 | 无 |
| 层级 2 | TASK-SYN-04, TASK-SYN-05, TASK-SYN-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-SYN-07, TASK-SYN-08 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-SYN-09 | - | 层级 3 |

---

## 3. 原子任务清单

### [TASK-SYN-01] Managed Block 测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 managed block 测试骨架，验证 AGENTS.md、CLAUDE.md、Codex 入口文档生成。

#### 实现步骤
1. 创建 `test/capabilities/sync-managed-block.test.ts`
2. 编写 `AGENTS.md gets harness managed block` 测试
3. 编写 `CLAUDE.md gets short entry pointing to harness skill` 测试
4. 编写 `Codex entry document gets agents skill pointer` 测试
5. 编写 `managed block uses <!-- harness:start --> marker` 测试
6. 测试预期失败

#### 验收标准
- [x] 4 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Harness managed root documentation
- design.md 章节：2.2 新建 document-templates.ts

---

### [TASK-SYN-02] 旧来源名隐藏测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写内部来源名暴露检测测试骨架。

#### 实现步骤
1. 创建 `test/capabilities/sync-internal-source-guard.test.ts`
2. 编写 `README daily usage does not expose DocSync` 测试
3. 编写 `AGENTS.md does not expose GSD/kld-sdd/kld-review` 测试
4. 编写 `internal source names only in migration context` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Legacy source names are hidden from daily UX
- design.md 章节：2.2 新建 internal-source-guard.ts

---

### [TASK-SYN-03] 用户内容保护/迁移测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 managed block 用户内容保护和旧 block 迁移测试骨架。

#### 实现步骤
1. 在 `test/capabilities/sync-managed-block.test.ts` 新增测试
2. 编写 `preserves user-written content outside managed block` 测试
3. 编写 `migrates docsync block to harness block` 测试
4. 编写 `migration report records legacy block info` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Managed block preservation
- design.md 章节：2.2 新建 managed-block.ts

---

### [TASK-SYN-04] Managed Block 模板实现

- **类型**: 接口层
- **依赖**: TASK-SYN-01
- **状态**: [x] 已完成

#### 任务描述
创建 document templates 和 managed block 服务。

#### 实现步骤
1. 创建 `src/capabilities/sync/document-templates.ts`：渲染 AGENTS/CLAUDE/Codex/README managed block
2. 创建 `src/capabilities/sync/managed-block.ts`：upsert、迁移、冲突检测
3. 实现 `renderAgentsManagedBlock()`：指向 harness Skill 和 inspect/sync/develop/review/knowledge
4. 实现 `renderClaudeShortEntry()`：指向 `.claude/skills/harness/SKILL.md`
5. 实现 `renderCodexShortEntry()`：指向 `.agents/skills/harness/SKILL.md`
6. Marker 使用 `<!-- harness:start -->` / `<!-- harness:end -->`
7. 运行 TASK-SYN-01 测试确认

#### 验收标准
- [x] AGENTS.md managed block 正确渲染
- [x] CLAUDE.md 短入口正确渲染
- [x] Codex 入口文档正确渲染
- [x] 使用统一 marker 格式
- [x] TASK-SYN-01 测试通过

#### 关联设计
- spec.md 章节：Harness managed root documentation
- design.md 章节：2.2 新建 document-templates.ts、managed-block.ts

---

### [TASK-SYN-05] 内部来源扫描实现

- **类型**: 接口层
- **依赖**: TASK-SYN-02
- **状态**: [x] 已完成

#### 任务描述
创建内部来源命令名扫描器，检测 DocSync 等旧名称泄露。

#### 实现步骤
1. 创建 `src/capabilities/sync/internal-source-guard.ts`
2. 实现 `scanForInternalNames()`：扫描 DocSync、GSD、kld-sdd、kld-review 等
3. 区分 daily UX 和 internal explanation 上下文
4. 触发 2407 错误码
5. 运行 TASK-SYN-02 测试确认

#### 验收标准
- [x] 检测到 README 中的 `/docsync:init` 等旧命令
- [x] 不误报 internal explanation 上下文中的来源名
- [x] 触发 2407
- [x] TASK-SYN-02 测试通过

#### 关联设计
- spec.md 章节：Legacy source names are hidden from daily UX
- design.md 章节：2.2 新建 internal-source-guard.ts

---

### [TASK-SYN-06] Block 迁移与用户内容保护实现

- **类型**: 接口层
- **依赖**: TASK-SYN-03
- **状态**: [x] 已完成

#### 任务描述
实现旧 docsync block 迁移和用户内容保护逻辑。

#### 实现步骤
1. 在 `managed-block.ts` 中实现 `migrateLegacyManagedBlock()`
2. 检测 `<!-- docsync:start -->` marker，替换为 `<!-- harness:start -->`
3. 实现 `upsertManagedBlock()`：只替换 managed block 区间
4. 保留 managed block 之外的用户内容
5. 记录迁移动作到 sync report
6. 运行 TASK-SYN-03 测试确认

#### 验收标准
- [x] docsync block 正确迁移为 harness block
- [x] 用户手写内容不被覆盖
- [x] 迁移记录到 sync report
- [x] TASK-SYN-03 测试通过

#### 关联设计
- spec.md 章节：Managed block preservation
- design.md 章节：2.3 约束项

---

### [TASK-SYN-07] Sync 命令重构

- **类型**: 接口层
- **依赖**: TASK-SYN-04, TASK-SYN-05, TASK-SYN-06
- **状态**: [x] 已完成

#### 任务描述
重构 `runSyncCommand()` 使用新的 managed block 和内部来源扫描服务。

#### 实现步骤
1. 修改 `src/capabilities/sync/command.ts`：`runSyncCommand()` 调用新服务
2. 修改 `generateManagedBlock()` 委托到 `document-templates.ts`
3. 修改 `generateReportContent()` 记录 migrations、exposures、preservedUserContent
4. 修改 `src/capabilities/sync/types.ts` 增加新类型
5. 运行测试确认

#### 验收标准
- [x] sync 命令使用新 managed block 服务
- [x] sync 报告包含 migration 和 exposure 信息
- [x] 向后兼容 `--check`、`--fast`、`--docs` 参数

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.1 sync/command.ts 重构

---

### [TASK-SYN-08] Init 文档写入委托

- **类型**: 接口层
- **依赖**: TASK-SYN-04, TASK-SYN-06
- **状态**: [x] 已完成

#### 任务描述
修改 `executePostWizardIntegration()` 不再直接 `writeFileSync` 写根文档，委托到 sync 文档服务。

#### 实现步骤
1. 修改 `src/cli/main.ts`：`executePostWizardIntegration()` 调用 managed document 服务
2. 更新 source-manager 中的 AGENTS/CLAUDE 模板与 sync 模板一致
3. 运行测试确认

#### 验收标准
- [x] init 写根文档走 managed block 服务
- [x] 用户内容保护生效
- [x] 内部来源名净化生效

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.1 main.ts 替换实现

---

### [TASK-SYN-09] 全量测试验证

- **类型**: 测试-验证
- **依赖**: TASK-SYN-07, TASK-SYN-08
- **状态**: [x] 已完成

#### 任务描述
运行全量测试，确认 sync 相关测试全部通过。

#### 实现步骤
1. 运行 `npm run test`
2. 运行 `npm run typecheck`
3. 运行 `npm run lint`
4. 修复任何失败

#### 验收标准
- [x] `npm run test` 全部通过
- [x] `npm run typecheck` 无错误
- [x] `npm run lint` 无错误

#### 关联设计
- spec.md 章节：全部（3 个 Requirement，8 个 Scenario）

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-SYN-01 | 单元测试 | Managed block | AGENTS/CLAUDE/Codex 生成 |
| TASK-SYN-02 | 单元测试 | 旧来源名 | DocSync 等不暴露 |
| TASK-SYN-03 | 单元测试 | 保护/迁移 | 用户内容保留、block 迁移 |
| TASK-SYN-04 | 单元测试 | 模板 | 正确渲染 |
| TASK-SYN-05 | 单元测试 | 扫描 | 2407 触发 |
| TASK-SYN-06 | 单元测试 | 迁移 | docsync→harness |
| TASK-SYN-07 | 单元测试 | Sync 命令 | 端到端 |
| TASK-SYN-08 | 单元测试 | Init 委托 | 文档写入 |
| TASK-SYN-09 | 全量测试 | 端到端 | 全部通过 |

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| 投影渲染器 | 内部 | harness-adapter-skill-runtime | ⏳ 等待 | 复用 sanitizeInternalNames |
| CLI entrypoint | 内部 | harness-cli-entrypoint | ⏳ 等待 | init 调用 sync 服务 |

---

## 6. 交付物

### 6.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/sync/managed-block.ts` | Managed block 服务 | TASK-SYN-04 |
| `src/capabilities/sync/document-templates.ts` | 文档模板 | TASK-SYN-04 |
| `src/capabilities/sync/internal-source-guard.ts` | 内部来源扫描 | TASK-SYN-05 |
| `src/capabilities/sync/command.ts` | Sync 命令重构 | TASK-SYN-07 |
| `src/capabilities/sync/types.ts` | 类型扩展 | TASK-SYN-07 |
| `src/cli/main.ts` | Init 文档委托 | TASK-SYN-08 |

### 6.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/sync-managed-block.test.ts` | Managed block 测试 | TASK-SYN-01,03 |
| `test/capabilities/sync-internal-source-guard.test.ts` | 来源扫描测试 | TASK-SYN-02 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（3 个 Requirement，8 个 Scenario）
> - [x] 任务清单 100% 覆盖 design.md 定义
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖