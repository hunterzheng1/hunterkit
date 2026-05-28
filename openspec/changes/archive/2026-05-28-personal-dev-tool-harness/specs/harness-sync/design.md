# 局部技术实现方案 - harness-sync

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **⚠️ 边界声明**：本设计仅服务于当前 Capability，严禁越权设计或覆盖其他模块逻辑。
>
> **【质量红线】专注"本业务如何落地"；严禁写入全局中间件或框架选型；必须为任务拆解提供足够局部细节

---

## 1. 字段完整性追溯表

> **⛔ 核心红线**：用户在 Spec 中输入的所有字段必须在此表中体现，严禁无故丢弃！

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `--check` | `SyncOptions.check` | boolean | ✅ 保留 | 控制只检查漂移、不写目标文档 |
| 2 | `--fast` | `SyncOptions.fast` | boolean | ✅ 保留 | 控制 Git facts 快速范围判断 |
| 3 | `--docs` | `SyncOptions.docs` | DocumentKind[] | ✅ 保留 | 限定 readme/agents/claude/copilot |
| 4 | `--dry-run` | `SyncOptions.dryRun` | boolean | ⚠️ 重命名 | CLI flag 转为 camelCase 内部字段 |
| 5 | `--json` | `SyncOptions.json` | boolean | ✅ 保留 | 控制机器可读输出 |
| 6 | `mode` | `SyncResult.mode` | enum string | ✅ 保留 | 枚举：`sync`、`check`、`dry-run` |
| 7 | `drift` | `SyncResult.drift` | boolean | ✅ 保留 | 表示目标文档是否存在漂移 |
| 8 | `documents[].path` | `SyncDocumentResult.path` | path/string | ✅ 保留 | 被检查或写入的文档路径 |
| 9 | `documents[].status` | `SyncDocumentResult.status` | enum string | ✅ 保留 | 枚举：`up-to-date`、`planned`、`written`、`drifted`、`blocked` |
| 10 | `reportPath` | `SyncResult.reportPath` | path/string | ✅ 保留 | `.harness/reports/sync/<timestamp>-sync.md` |
| 11 | `documents`（错误响应） | `SyncErrorData.documents` | string[] | ✅ 保留 | 漂移或冲突文件列表 |
| 12 | `readme` | `DocumentKind.readme` | enum | ✅ 保留 | README.md 文档类型 |
| 13 | `agents` | `DocumentKind.agents` | enum | ✅ 保留 | AGENTS.md 文档类型 |
| 14 | `claude` | `DocumentKind.claude` | enum | ✅ 保留 | CLAUDE.md 文档类型 |
| 15 | `copilot` | `DocumentKind.copilot` | enum | ✅ 保留 | `.github/copilot-instructions.md` 文档类型 |
| 16 | `REVIEW_REQUIRED` | `ReviewRequiredMarker` | string marker | ✅ 保留 | 未确认事实标记 |
| 17 | `repo facts` | `RepoMapInput` | object | ✅ 保留 | 从 inspect 读取的事实输入 |
| 18 | `rules` | `RulesInput` | Markdown/string | ✅ 保留 | 从 inspect generated rules 读取的规则输入 |

**状态说明**：
- ✅ 保留：字段名和类型与用户输入一致
- ⚠️ 重命名：字段重命名（必须说明理由）
- 🔀 合并：多字段合并为一个（必须说明理由）
- ❌ 移除：字段被移除（必须有充分理由且经用户确认）

### 1.2 完整性自检

- **用户输入字段总数**：18 个
- **设计输出字段总数**：18 个
- **差异说明**：仅 `--dry-run` 在内部使用 camelCase；文档枚举、响应字段和 `REVIEW_REQUIRED` 标记均按 spec 语义保留
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

> **⚠️ 重要**：大多数需求是在已有系统上改造/扩展，不是从零开始。
> AI 无法知道“要改哪里”，如果本 Capability 涉及对现有代码的修改，**请用户补充完整**。
> 纯新建项目可跳过此章节。

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无 | 无 | 无 | 纯新建 | 当前工作区未发现 `package.json`、`src/`、`bin/`、`lib/` 或 `dist`，本 Capability 不修改现有代码 |

**修改类型说明**：
- 扩展逻辑：在现有方法中添加新逻辑分支
- 新增参数：修改方法签名或请求/响应结构
- 重构抽取：抽取公共逻辑为新方法
- 替换实现：用新实现替换原有逻辑

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/sync/types.ts` | `SyncOptions` / `DocumentKind` / `SyncResult` / `SyncDocumentResult` | 定义 sync 输入、输出和文档类型 | TypeScript type module | 与字段追溯表保持一致 |
| `src/capabilities/sync/command.ts` | `runSyncCommand()` | 处理 `harness sync` CLI 调用 | Command handler | 解析参数、调用 plan/check/write pipeline |
| `src/capabilities/sync/document-registry.ts` | `createDocumentRegistry()` | 注册 readme/agents/claude/copilot 文档目标和模板策略 | Document registry | 不设计 adapter 业务，只声明文档目标 |
| `src/capabilities/sync/input-loader.ts` | `loadSyncInputs()` | 读取 repo facts、module map、rules、config | Input loader | facts 缺失时返回 2404 |
| `src/capabilities/sync/fast-scope.ts` | `resolveFastSyncScope()` | 使用 Git 变更判断是否可 fast check 或必须升级完整检查 | Fast scope planner | Git 不可用时降级完整检查 |
| `src/capabilities/sync/document-planner.ts` | `planDocumentSync()` | 生成每个文档的目标内容、managed block diff、漂移状态 | Sync planner | `--check` 和 `--dry-run` 共用 |
| `src/capabilities/sync/managed-blocks.ts` | `replaceManagedBlock()` / `extractManagedBlock()` | 管理 Harness generated block | Managed block utility | 保护非托管用户内容 |
| `src/capabilities/sync/protected-content.ts` | `validateProtectedContent()` | 检测写入是否覆盖非托管内容 | Safety validator | 冲突返回 2403 |
| `src/capabilities/sync/renderers/readme.ts` | `renderReadmeBlock()` | 生成 README managed block | Renderer | 只生成 Harness 管理区域 |
| `src/capabilities/sync/renderers/agents.ts` | `renderAgentsBlock()` | 生成 AGENTS managed block | Renderer | 注入 facts/rules 摘要 |
| `src/capabilities/sync/renderers/claude.ts` | `renderClaudeBlock()` | 生成 CLAUDE managed block 或 Skill 指针 | Renderer | 仅文档指针，不设计 Claude adapter |
| `src/capabilities/sync/renderers/copilot.ts` | `renderCopilotInstructions()` | 生成 Copilot instructions managed block | Renderer | 可选文档 |
| `src/capabilities/sync/report-writer.ts` | `writeSyncReport()` | 写入 Markdown + JSON 同 stem 报告 | Report writer | 报告写入失败返回 5401 |
| `test/sync/sync.test.ts` | sync tests | 验证 docs 枚举、drift、fast escalation、protected content、dry-run、reports | Node test suite | TDD 阶段先写红灯测试 |

### 2.3 现有逻辑约束

> 影响本次设计的现有系统约束（如：已有事务边界、线程模型、日志规范、已有设计模式等）

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 当前仓库已有根目录工具文档/目录 | `.agents/`、`.claude/`、`.codex/` 存在，但未发现源码包 | sync 必须保留非托管内容，不能盲目覆盖工具目录 | 只写 managed block 或显式文档目标 |
| facts 是 inspect 输出 | sync 依赖 `.harness/facts/repo-map.json` 和 generated rules | facts 缺失需阻断或提示先运行 inspect | `loadSyncInputs()` 返回 2404 |
| `--check` 和 `--dry-run` 写入为 0 | spec 强制只检查/预览 | planner 与 writer 分离 | check/dry-run 只生成 diff 和报告计划 |
| 快速检查需能升级 | 高风险变更自动完整检查 | 需要明确高风险文件分类 | `resolveFastSyncScope()` 返回 upgrade reason |
| 未确认事实不可写成确定事实 | inspect 可能输出 REVIEW_REQUIRED | renderers 必须保留标记和说明 | `ReviewRequiredMarker` 进入文档和报告 |

---

## 3. 局部前端设计

> 仅针对当前 Capability 的前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `SyncSummaryView` | 终端展示 | 展示 sync/check 模式、漂移状态、文档列表、报告路径 | `SyncResult` |
| `SyncDriftView` | 终端展示 | 展示 `--check` 下发现的漂移文件和摘要 | `SyncDocumentResult[]` |
| `SyncDryRunView` | 终端展示 | 展示将写入的 managed block 和报告计划 | `SyncPlan` |
| `ProtectedContentConflictView` | 终端展示 | 展示会覆盖非托管内容的文件和冲突片段摘要 | `ProtectedContentConflict[]` |
| `ReviewRequiredSummaryView` | 终端展示 | 展示未确认事实进入文档的位置 | `ReviewRequiredMarker[]` |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `mode` | `"sync" \| "check" \| "dry-run"` | `"sync"` | 解析 `--check`、`--dry-run` 后更新 |
| `selectedDocs` | DocumentKind[] | 来自配置 managed 文档 | 解析 `--docs` 后更新 |
| `drift` | boolean | `false` | `planDocumentSync()` 对比后更新 |
| `fastUpgraded` | boolean | `false` | `resolveFastSyncScope()` 检测高风险变更后更新 |
| `reviewRequired` | ReviewRequiredMarker[] | `[]` | 读取 facts/rules 后更新 |
| `reportPath` | string/null | `null` | `writeSyncReport()` 或 report plan 生成后更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness sync` | `SyncSummaryView` | 本地读写权限 | 生成并写入 managed block 与报告 |
| `CLI: harness sync --check --json` | 无页面，JSON 输出 | 本地读权限 | 检查漂移，漂移时非 0 |
| `CLI: harness sync --fast` | `SyncSummaryView` | 本地读权限和可选写权限 | fast scope 判断，必要时升级完整检查 |
| `CLI: harness sync --docs readme,agents --dry-run` | `SyncDryRunView` | 本地读权限 | 只预览 README/AGENTS 计划 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 默认同步 | `runSyncCommand()` | `SyncOptions` | 写入文档 managed block，返回 `SyncResult` |
| CI 漂移检查 | `planDocumentSync()` | `check=true` | drift=false 返回 0；drift=true 返回 2401 |
| 限定文档 | `createDocumentRegistry().filter(docs)` | `--docs` | 非法枚举返回 2402 |
| 保护内容冲突 | `validateProtectedContent()` | 目标文档和 planned content | 返回 2403，不写文件 |
| 写报告 | `writeSyncReport()` | plan、result、warnings | 输出 Markdown + JSON 报告路径 |

---

## 4. 局部后端接口设计

> 仅针对当前 Capability 的接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Sync 命令 | `CLI: harness sync` | 本地进程调用 | 同步或检查 managed 文档 |
| 输入加载 | `loadSyncInputs()` | 函数调用 | 读取 facts、rules、config、目标文档 |
| 文档计划 | `planDocumentSync()` | 函数调用 | 计算目标内容、diff、drift、冲突 |
| Managed block | `replaceManagedBlock()` | 函数调用 | 插入或替换 Harness managed block |
| 报告写入 | `writeSyncReport()` | 函数调用 | 生成 Markdown + JSON 报告 |

### 4.2 接口详细设计

#### 接口 1：Sync 命令

**基本信息**：
- 路径：`CLI: harness sync`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--check` | boolean | 否 | 只检查漂移 | 写入文件数量必须为 0 |
| `--fast` | boolean | 否 | 使用 Git facts 快速判断影响范围 | 高风险变更必须升级完整检查 |
| `--docs` | string[] | 否 | 限定文档集合 | 枚举：`readme`、`agents`、`claude`、`copilot` |
| `--dry-run` | boolean | 否 | 展示将修改内容 | 写入文件数量必须为 0 |
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "mode": "check",
    "drift": false,
    "documents": [
      {
        "path": "AGENTS.md",
        "status": "up-to-date"
      }
    ],
    "reportPath": ".harness/reports/sync/20260528-sync.md"
  }
}
```

**业务逻辑**：
1. `runSyncCommand()` 解析 `SyncOptions`。
2. 校验 `--docs` 枚举，不合法返回 2402。
3. `--fast` 时调用 `resolveFastSyncScope()`，高风险变更时记录 upgrade reason 并切换完整检查。
4. 调用 `loadSyncInputs()` 读取 repo facts、module map、rules、managed 文档配置。
5. 调用 `planDocumentSync()` 为每个文档生成 planned content、diff、drift、status。
6. `--check` 或 `--dry-run` 时不写目标文档；漂移存在且 `--check` 返回 2401。
7. 非 check/dry-run 时通过 transaction 写入 managed block。
8. 调用 `writeSyncReport()` 生成 Markdown + JSON 报告。

#### 接口 2：文档计划

**基本信息**：
- 路径：`Function: planDocumentSync(inputs, options)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `inputs.repoMap` | RepoMapInput | 是 | inspect facts | 必须包含 schemaVersion |
| `inputs.rules` | RulesInput | 否 | rules.generated.md 内容 | 缺失时允许生成 REVIEW_REQUIRED |
| `inputs.documents` | TargetDocument[] | 是 | 目标文档当前内容 | 文档数小于 10 |
| `options.docs` | DocumentKind[] | 是 | 选中文档 | 只允许合法枚举 |

**响应结构**：
```json
{
  "documents": [
    {
      "path": "AGENTS.md",
      "status": "drifted",
      "managedBlockChanged": true,
      "reviewRequired": []
    }
  ],
  "drift": true
}
```

**业务逻辑**：
1. 根据 DocumentKind 找到 renderer。
2. renderer 从 repoMap/rules/config 生成 managed block。
3. `replaceManagedBlock()` 只替换 Harness managed block。
4. `validateProtectedContent()` 确认非托管内容未被改动。
5. 对比 current content 与 planned content，设置 drift/status。

#### 接口 3：报告写入

**基本信息**：
- 路径：`Function: writeSyncReport(result, plan, context)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `result` | SyncResult | 是 | 同步结果 | 必须包含 mode、drift、documents |
| `plan` | SyncPlan | 是 | 文档计划和 diff 摘要 | 不得包含敏感文件内容 |
| `context` | CommandContext | 是 | cwd、dryRun、json | report path 必须位于 `.harness/reports/sync` |

**响应结构**：
```json
{
  "markdown": ".harness/reports/sync/20260528-sync.md",
  "json": ".harness/reports/sync/20260528-sync.json"
}
```

**业务逻辑**：
1. 构建同 stem Markdown 和 JSON 报告路径。
2. Markdown 报告写入 mode、drift、documents、upgrade reason、reviewRequired、冲突摘要。
3. JSON 报告写入机器可读完整结构，但不得包含敏感文件正文。
4. 写入失败返回 5401。

---

## 5. 局部数据模型

> 仅针对当前 Capability 的数据设计，遵循 overview.md 的全局约定

### 5.1 数据表设计

#### 表名：无

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| 无 | 无 | 否 | 无 | 本 Capability 不新增数据库表 | 无 |

**索引设计**：
- 主键索引：无
- 唯一索引：无
- 普通索引：无

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 无 | 无 | 无 | 无 | sync 不引入缓存；报告是持久审计产物 |

### 5.3 数据流转图

```
[SyncOptions + HarnessConfig.documents]
  --> [load repo facts / module map / rules]
  --> [select DocumentKind targets]
  --> [render managed blocks]
  --> [replace managed block + validate protected content]
  --> [drift result + report]
  --> [transaction write or check/dry-run response]
```

**文件数据模型**：

| 文件路径 | 数据类型 | 必填 | 默认值 | 说明 |
|---------|---------|------|--------|------|
| `README.md` | Markdown | 配置声明时是 | 无 | 人类用户文档，sync 只更新 managed block |
| `AGENTS.md` | Markdown | 配置声明时是 | 无 | 跨 agent 规则入口，sync 只更新 managed block |
| `CLAUDE.md` | Markdown | 选择 Claude 时是 | 无 | Claude 专属短入口，sync 只更新 managed block |
| `.github/copilot-instructions.md` | Markdown | 选择 Copilot 时是 | 无 | Copilot instructions，sync 只更新 managed block |
| `.harness/reports/sync/<timestamp>-sync.md` | Markdown | 是 | 无 | 人类可读 sync 报告 |
| `.harness/reports/sync/<timestamp>-sync.json` | JSON | 是 | 无 | 机器可读 sync 报告 |

**SyncResult 核心字段**：

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 |
|-------|---------|------|--------|------|
| `mode` | enum string | 是 | `sync` | `sync`、`check`、`dry-run` |
| `drift` | boolean | 是 | `false` | 是否存在漂移 |
| `documents` | SyncDocumentResult[] | 是 | `[]` | 每个文档的路径和状态 |
| `reportPath` | string | 是 | 生成路径 | Markdown 报告路径 |
| `reviewRequired` | ReviewRequiredMarker[] | 否 | `[]` | 未确认事实标记 |

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[runSyncCommand]
  --> [parse SyncOptions]
  --> [validate docs enum]
  --> [fast? resolveFastSyncScope]
  --> [loadSyncInputs]
  --> [planDocumentSync]
  --> [check/dry-run?]
      --> yes: [write/plan report only]
      --> no:  [write managed blocks via transaction]
  --> [writeSyncReport]
  --> [return SyncResult or drift error]
```

**Spec 需求项覆盖表**：

| Spec 需求项 | 设计覆盖位置 | 覆盖说明 |
|------------|-------------|---------|
| 文档同步范围 | `document-registry`、renderers、`replaceManagedBlock()`、`validateProtectedContent()` | 覆盖 README/AGENTS/CLAUDE/Copilot 文档和 managed block 写入边界 |
| 漂移检查与报告 | `planDocumentSync()`、`resolveFastSyncScope()`、`writeSyncReport()` | 覆盖 check、fast、dry-run、漂移非 0 和结构化报告 |
| 未确认事实标注 | `ReviewRequiredMarker`、renderers、`ReviewRequiredSummaryView` | 覆盖 `REVIEW_REQUIRED` 在文档和报告中的保留与说明 |

### 6.2 状态机（如有）

```
[START]
  -- invalid docs --> [ERROR_2402]
  -- facts missing --> [ERROR_2404]
  -- inputs loaded --> [PLAN_READY]

[PLAN_READY]
  -- protected conflict --> [ERROR_2403]
  -- check and drift --> [ERROR_2401]
  -- check and no drift --> [CHECK_PASS]
  -- dry-run --> [DRY_RUN_READY]
  -- sync write success --> [SYNC_WRITTEN]
  -- report write failure --> [ERROR_5401]
```

### 6.3 关键算法（如有）

**Fast 检查升级算法**
1. 读取 Git 变更文件列表。
2. 若 Git 不可用，记录 warning 并降级为完整检查。
3. 若变更命中 package/build/CI/agent/SDD/facts/rules 文件，设置 `fastUpgraded=true`。
4. 报告中记录 upgrade reason。
5. 非高风险变更时只检查受影响文档。

**Managed block 替换算法**
1. renderer 生成目标 managed block。
2. 查找 `<!-- harness:start -->` 与 `<!-- harness:end -->`。
3. 若存在完整 block，仅替换 block 内部内容。
4. 若不存在 block，将 block 插入到文档约定位置。
5. 插入或替换后调用 `validateProtectedContent()`，确认 block 外内容 byte-for-byte 不变。

**REVIEW_REQUIRED 保留算法**
1. 从 repoMap.reviewRequired、rules content 和 renderer 输入收集未确认事实。
2. renderer 不得将未确认事实转写为确定语句。
3. 文档中使用 `REVIEW_REQUIRED` 标记和简短说明。
4. 报告中列出每个 marker 的来源字段和目标文档。

---

## 7. 外部依赖与集成

> **⚠️ 必填**：列出本 Capability 依赖的所有外部系统、服务和基础设施，确保上下游关系透明、可追踪。
> AI 无法自动推断项目的外部依赖，**请用户补充完整**。

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | sync 不调用远程服务 | 无 | 0 毫秒连接超时 | 无 | 无 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | >= 20.0.0 | 文档读写、diff 生成、JSON 报告 | 无 | 无 | 低于版本阻断 sync |
| Git | >= 2.30.0 | `--fast` 影响范围判断 | 本地 Git 权限 | 无 | 不可用时降级完整检查 |
| CommonMark Markdown | 0.30 | README/AGENTS/CLAUDE 解析语义 | 无 | 无 | 第一版以 managed block 文本替换为主 |
| JSON | ECMA-404 | sync JSON 报告 | 无 | 无 | 报告必须可被机器读取 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读取/写入 managed 文档和报告 | Node fs API | `documents.managed`、`.harness/reports/sync` | 写入走 transaction |
| Git working tree | fast scope 和漂移上下文 | Git CLI 或本地 Git facts | 当前分支变更文件 | 不可用不阻断完整 sync |

### 7.4 内部跨模块依赖

> 本 Capability 需要调用项目内其他模块的能力（注意：仅声明依赖，不设计对方逻辑）

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `harness-cli-entrypoint` | `CommandContext` | `--check`、`--fast`、`--docs`、`--dry-run`、`--json` | sync 命令上下文 | 待建 |
| `harness-workspace-config` | config read、transaction、report paths | managed docs、generatedBlockPrefix | 写入边界与配置 | 待建 |
| `harness-inspect` | repo-map、module-map、rules | `.harness/facts/repo-map.json`、`.harness/generated/**` | facts/rules 输入 | 待建 |
| `harness-adapter-skill-runtime` | adapter pointers | Claude/Codex/Copilot 状态 | 文档中生成 Skill/adapter 指针 | 待建 |
| `harness-safety-orchestration` | protected content and secret filtering | target docs、planned content | 是否允许写入 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | `CI` 可用于默认无色输出和严格 check；不需要业务密钥 | 从 `process.env` 读取 |
| 密钥/证书 | 不需要；sync 不得读取或输出敏感文件内容 | 无 |
| 网络策略 | 本地运行不需要网络 | 无 |
| 权限/角色 | 需要读取目标文档、facts、rules；非 check/dry-run 时需要写 managed 文档和 sync 报告权限 | 本地用户权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 文档漂移 | `--check` 发现 planned content 与当前文档不同 | 返回 2401，写报告，不写目标文档 | 用户看到漂移文件和报告路径 |
| 文档选择无效 | `--docs` 包含未知枚举 | 返回 2402，不读取或写入文档 | 用户看到允许枚举 |
| 保护内容冲突 | managed block 外内容会被修改 | 返回 2403，阻断写入 | 用户看到冲突文件和处理建议 |
| facts 缺失 | repo-map 不存在且无法自动生成 | 返回 2404，提示先运行 inspect | 用户看到缺失 factsPath |
| 报告写入失败 | sync 报告写入失败 | 返回 5401，目标文档写入依赖 transaction 状态处理 | 用户看到 report path 和失败原因 |
| 敏感内容命中 | renderer 输入或文档计划包含 secretPatterns | 阻断写入敏感内容并输出安全摘要 | 用户看到敏感模式命中，不展示正文 |

### 8.2 重试与降级

- 重试次数：0 次；文档写入和报告写入失败不自动重试
- 重试间隔：0 毫秒
- 降级策略：Git 不可用时 `--fast` 降级为完整检查；Markdown 解析失败时降级为纯文本 managed block 替换

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| managed 文档列表 | `documents.managed` | `["README.md","AGENTS.md","CLAUDE.md"]` | 默认同步文档集合 |
| generated block 前缀 | `documents.generatedBlockPrefix` | `"harness"` | managed block 标记前缀 |
| sync 报告目录 | `sync.reportDir` | `.harness/reports/sync` | Markdown + JSON 报告输出 |
| 默认 docs 枚举 | `sync.defaultDocs` | 来自 `documents.managed` | 未传 `--docs` 时使用 |
| fast 高风险模式 | `sync.fastHighRiskPatterns` | package/build/CI/agent/SDD/facts/rules | 命中时升级完整检查 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--check` | 只检查漂移，不写目标文档 | 关闭 |
| `--fast` | 使用 Git 变更快速判断影响范围 | 关闭 |
| `--docs` | 限定文档集合 | 未设置 |
| `--dry-run` | 只输出写入计划 | 关闭 |
| `--json` | 输出机器可读结果 | 关闭 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：需修改的文件、类、方法已明确（或确认为纯新建）
> - [x] **现有约束已识别**：影响设计的现有系统约束已列出并有应对策略
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的逻辑
> - [x] **全局遵守**：遵循 overview.md 的数据字典和接口规范
> - [x] 前端设计已完成（组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（表结构、索引、缓存）
> - [x] **外部依赖已明确**：所有外部服务、第三方 API、中间件、跨模块依赖已列出
> - [x] **环境权限已确认**：所需环境变量、密钥、网络策略已说明
> - [x] 异常处理策略已定义（含外部依赖失败的降级方案）
> - [x] 包含足够的局部细节支持任务拆解
