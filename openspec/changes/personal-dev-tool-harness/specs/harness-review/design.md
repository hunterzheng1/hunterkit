# 局部技术实现方案 - harness-review

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-review`，负责代码审查范围解析、reviewer 编排、finding 验证、报告输出和受控机械修复，不设计 inspect、develop、workspace、safety 等其他能力的内部实现。
>
> **质量红线**：本设计聚焦 `harness review` 如何落地；`--no-fix` 默认只写报告，`--fix` 仅允许低风险机械修复，所有 finding 必须经过 validator 复核、置信度过滤和去重。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `--local` | `ReviewOptions.local` | boolean | ✅ 保留 | 当前分支相对主分支的审查范围 |
| 2 | `--staged` | `ReviewOptions.staged` | boolean | ✅ 保留 | Git 暂存区审查范围 |
| 3 | `--scan` | `ReviewOptions.scan` | path | ✅ 保留 | 指定目录或文件扫描范围 |
| 4 | `--fix` | `ReviewOptions.fix` | boolean | ✅ 保留 | 允许低风险机械修复 |
| 5 | `--no-fix` | `ReviewOptions.noFix` | boolean | ⚠️ 重命名 | 转为 camelCase，语义保持只报告不修复 |
| 6 | `--full` | `ReviewOptions.full` | boolean | ✅ 保留 | 跑满所有 reviewer |
| 7 | `--lite` | `ReviewOptions.lite` | boolean | ✅ 保留 | 轻量审查模式 |
| 8 | `--comment` | `ReviewOptions.comment` | boolean | ✅ 保留 | 远程 PR/MR 评论开关 |
| 9 | `--json` | `ReviewOptions.json` | boolean | ✅ 保留 | stdout 输出合法 JSON |
| 10 | `scope` | `ReviewResult.scope` | enum | ✅ 保留 | 输出 `local`、`staged`、`scan`、`remote` |
| 11 | `findings` | `ReviewResult.findings` | `ReviewFinding[]` | ✅ 保留 | 输出通过 validator 的 finding |
| 12 | `summary.p0` | `ReviewSummary.p0` | number | ✅ 保留 | P0 finding 数量 |
| 13 | `summary.p1` | `ReviewSummary.p1` | number | ✅ 保留 | P1 finding 数量 |
| 14 | `summary.p2` | `ReviewSummary.p2` | number | ✅ 保留 | P2 finding 数量 |
| 15 | `summary.discarded` | `ReviewSummary.discarded` | number | ✅ 保留 | 因低置信、validator 拒绝或去重丢弃数量 |
| 16 | `reports.markdown` | `ReviewReports.markdown` | path | ✅ 保留 | Markdown 报告路径 |
| 17 | `reports.json` | `ReviewReports.json` | path | ✅ 保留 | JSON 报告路径 |
| 18 | `error.data.p0` | `ReviewErrorData.p0` | number | ✅ 保留 | 阻断问题数量 |
| 19 | `error.data.reportPath` | `ReviewErrorData.reportPath` | path | ✅ 保留 | 阻断报告路径 |
| 20 | `review file list` | `ReviewScope.files` | path[] | ✅ 保留 | scope 解析后的审查文件列表 |
| 21 | `base 引用` | `ReviewScope.baseRef` | string | ✅ 保留 | local/remote diff 基准引用 |
| 22 | `head 引用` | `ReviewScope.headRef` | string | ✅ 保留 | local/remote diff head 引用 |
| 23 | `scope=staged` | `ReviewScope.kind` | enum | ✅ 保留 | 暂存区审查必须标记为 staged |
| 24 | `finding confidence` | `ReviewFinding.confidence` | number | ✅ 保留 | validator 过滤阈值字段，范围 0-100 |
| 25 | `validator 拒绝统计` | `ReviewFilterStats.validatorRejected` | number | ✅ 保留 | JSON 报告中过滤统计 |
| 26 | `低置信统计` | `ReviewFilterStats.lowConfidence` | number | ✅ 保留 | JSON 报告中过滤统计 |
| 27 | `修复文件` | `ReviewFixResult.files` | path[] | ✅ 保留 | `--fix` 报告每个修复文件 |
| 28 | `修复原因` | `ReviewFixResult.reason` | string | ✅ 保留 | `--fix` 报告机械修复原因 |
| 29 | `验证状态` | `ReviewFixResult.validationStatus` | enum | ✅ 保留 | `--fix` 报告修复后的验证状态 |
| 30 | `schemaVersion` | `ReviewJsonReport.schemaVersion` | string | ✅ 保留 | JSON 报告兼容性字段 |

### 1.2 完整性自检

- **用户输入字段总数**：30 个
- **设计输出字段总数**：30 个
- **差异说明**：仅 `--no-fix` 转换为 `noFix` 以适配 TypeScript/JSON 命名，语义不变。
- **完整性确认**：[x] 已确认所有字段都有对应处理

### 1.3 Spec 需求项覆盖表

| Spec 需求项 | 设计落点 | 覆盖方式 |
|------------|---------|---------|
| 审查范围解析 | `scope-resolver.ts`、`git-range.ts`、`path-guard.ts` | 解析 local/staged/scan/remote 范围，输出 files、baseRef、headRef 并阻断越界路径 |
| 多 agent 审查与 finding 验证 | `reviewer-planner.ts`、`reviewer-runner.ts`、`validator.ts`、`confidence-filter.ts`、`deduper.ts` | 按 full/lite/文件数量选择 reviewer，并对 finding 复核、过滤、去重 |
| 报告与修复策略 | `report-writer.ts`、`fix-planner.ts`、`fix-applier.ts` | 输出 Markdown + JSON 双报告；`--no-fix` 禁止源码修改，`--fix` 仅处理低风险机械修复 |

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无现有实现文件 | 无 | 无 | 纯新建 | 当前仓库未发现 `src/`、`bin/`、`lib/`、`test/` 等实现目录；本 Capability 以新建模块设计 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/review/types.ts` | `ReviewOptions`、`ReviewScope`、`ReviewFinding`、`ReviewResult` | 定义 CLI 入参、scope、finding、报告和错误数据类型 | 无 | 所有 review 子模块共享类型 |
| `src/capabilities/review/command.ts` | `registerReviewCommand()`、`runReviewCommand()` | 挂载 `harness review` 并编排审查流程 | CLI command handler | 负责参数解析与统一响应 |
| `src/capabilities/review/options-validator.ts` | `validateReviewOptions()` | 校验 scope/fix/full-lite 参数互斥 | 无 | 返回 `2602` 或参数错误 |
| `src/capabilities/review/scope-resolver.ts` | `resolveReviewScope()` | 汇总 local/staged/scan/remote 范围解析 | 无 | 输出审查文件列表、baseRef、headRef |
| `src/capabilities/review/git-range.ts` | `resolveLocalRange()`、`resolveStagedRange()` | 通过 Git 获取分支 diff 与暂存区文件 | Git adapter | Git 不可用时仅允许 scan |
| `src/capabilities/review/path-guard.ts` | `assertPathInsideProject()` | 防止 `--scan` 越界读取项目根目录外路径 | 无 | 越界返回 `2603` |
| `src/capabilities/review/context-builder.ts` | `buildReviewContext()` | 根据 scope 构建 diff、文件片段和必要上下文 | 无 | 过滤 secret 命中文件内容 |
| `src/capabilities/review/reviewer-planner.ts` | `planReviewers()` | 按 full/lite/文件数选择 reviewer 维度 | 无 | 超过 3 文件或 `--full` 时启用多 reviewer |
| `src/capabilities/review/reviewer-runner.ts` | `runReviewers()` | 并行执行 reviewer 并收集候选 finding | Safety orchestration adapter | 控制并发、超时和失败隔离 |
| `src/capabilities/review/finding-normalizer.ts` | `normalizeFinding()` | 归一化 reviewer 输出为统一 finding schema | Harness reviewer contract v1 | 保证 JSON 报告稳定 |
| `src/capabilities/review/validator.ts` | `validateFindings()` | 对候选 finding 进行复核 | Validator contract v1 | 未完成返回 `2604` |
| `src/capabilities/review/confidence-filter.ts` | `filterByConfidence()` | 丢弃 confidence < 80 或 validator 拒绝的 finding | 无 | 记录 discarded 统计 |
| `src/capabilities/review/deduper.ts` | `dedupeFindings()` | 按文件、行号、规则、语义指纹去重 | 无 | 保留最高严重度/置信度 finding |
| `src/capabilities/review/fix-planner.ts` | `planMechanicalFixes()` | 从 finding 中筛选可自动修复的低风险机械问题 | 无 | `--no-fix` 时不调用写入 |
| `src/capabilities/review/fix-applier.ts` | `applyMechanicalFixes()` | 事务写入受控修复并记录验证状态 | Workspace transaction adapter | 只能修改审查范围内文件 |
| `src/capabilities/review/report-writer.ts` | `writeReviewReports()` | 生成 Markdown + JSON 双报告 | 无 | 报告默认写入 `.harness/reports/review/` |
| `src/capabilities/review/remote-commenter.ts` | `postRemoteComments()` | 在远程 PR/MR 场景发表评论 | Remote adapter | 需要用户已配置凭据 |
| `test/review/review.test.ts` | review tests | 覆盖 scope、validator、报告、fix 边界 | Test runner | tasks 阶段按 TDD 继续细拆 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 代码基线 | 当前仓库没有 Harness CLI 实现源码 | 不能锚定已有类/方法 | 所有代码锚点标注为纯新建 |
| 默认安全策略 | spec 要求 `--no-fix` 默认 true | 默认执行不能修改源码或文档 | `noFix=true` 时只允许写报告 |
| 修复边界 | `--fix` 仅允许低风险机械修复 | 不能做语义重构或跨范围修改 | `fix-planner` 只接受明确规则、单文件、可验证问题 |
| 范围安全 | `--scan` 必须位于项目根目录内 | 路径解析必须先 canonicalize 再比较 | `path-guard` 阻断越界返回 `2603` |
| finding 质量 | 低置信或 validator 拒绝必须丢弃 | reviewer 输出不能直接进入报告 | `validator`、`confidence-filter`、`deduper` 串行处理 |
| 双报告 | Markdown + JSON 都必须输出 | 报告写入需要原子性与 schemaVersion | `report-writer` 使用事务写入并输出稳定 schema |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `ReviewCliView` | 终端展示 | 展示 scope、reviewer 执行状态、finding 摘要和报告路径 | `FindingSummaryTable`、`ReportPathList` |
| `FindingSummaryTable` | 终端展示 | 展示 P0/P1/P2 和 discarded 统计 | 无 |
| `ReportPathList` | 终端展示 | 展示 Markdown/JSON 报告路径 | 无 |
| `FixSummaryTable` | 终端展示 | 展示 `--fix` 修改文件、原因和验证状态 | 无 |
| `ReviewJsonView` | JSON 输出 | 当 `--json` 为 true 时输出统一响应体 | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `scope` | `ReviewScope | null` | `null` | 参数校验与范围解析完成后更新 |
| `reviewMode` | `full | lite` | `lite` | 根据 `--full`、`--lite` 和文件数量计算 |
| `candidateFindings` | `ReviewFinding[]` | `[]` | reviewer 执行完成后更新 |
| `validatedFindings` | `ReviewFinding[]` | `[]` | validator、confidence filter、dedupe 完成后更新 |
| `filterStats` | `ReviewFilterStats` | 全 0 | 每次丢弃 finding 时更新 |
| `fixResults` | `ReviewFixResult[]` | `[]` | `--fix` 执行完成后更新 |
| `reports` | `ReviewReports | null` | `null` | 双报告写入完成后更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness review` | `ReviewCliView` / `ReviewJsonView` | 本地 Git 与文件系统权限 | 本 Capability 无浏览器前端路由 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 用户执行 local 审查 | `runReviewCommand()` | `ReviewOptions.local=true` | 输出 base/head、文件列表、报告路径 |
| 用户执行 staged 审查 | `runReviewCommand()` | `ReviewOptions.staged=true` | 输出 `scope=staged` 的报告 |
| 用户执行 scan 审查 | `runReviewCommand()` | `ReviewOptions.scan` | 输出扫描文件列表或越界错误 |
| 用户执行 JSON 模式 | `formatHarnessResponse()` | `ReviewResult` / `ReviewErrorData` | stdout 输出合法 JSON |
| 用户执行 fix 模式 | `applyMechanicalFixes()` | `ReviewFinding[]`、`ReviewOptions.fix=true` | 输出修复摘要和验证状态 |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Review CLI | `CLI: harness review` | 本地进程调用 | 解析审查范围、执行 reviewer/validator、输出报告并受控修复 |

### 4.2 接口详细设计

#### 接口 1：Review CLI

**基本信息**：
- 路径：`CLI: harness review`
- 方法：本地进程调用
- 认证：本地审查无需远程认证；`--comment` 依赖用户已配置的远程凭据

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `local` | boolean | 否 | 当前分支 vs 主分支 | 与 `staged`、`scan` 互斥 |
| `staged` | boolean | 否 | 仅暂存区 | 与 `local`、`scan` 互斥 |
| `scan` | path | 否 | 全量扫描目录或文件 | 必须位于项目根目录内 |
| `fix` | boolean | 否 | 允许自动修复 | 与 `noFix` 互斥 |
| `noFix` | boolean | 否 | 只报告不修复 | 默认 true |
| `full` | boolean | 否 | 跑满所有 reviewer | 与 `lite` 互斥 |
| `lite` | boolean | 否 | 轻量审查 | 与 `full` 互斥 |
| `comment` | boolean | 否 | 远程 PR/MR 发表评论 | 需要远程上下文配置 |
| `json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**响应结构**：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "scope": "local",
    "findings": [],
    "summary": {
      "p0": 0,
      "p1": 0,
      "p2": 0,
      "discarded": 3
    },
    "reports": {
      "markdown": ".harness/reports/review/20260528-branch.md",
      "json": ".harness/reports/review/20260528-branch.json"
    }
  }
}
```

**业务逻辑**：
1. `validateReviewOptions()` 校验 `local/staged/scan` 互斥和 `fix/noFix`、`full/lite` 互斥。
2. `resolveReviewScope()` 解析审查范围；`scan` 先经 `assertPathInsideProject()` 防越界。
3. `buildReviewContext()` 读取 diff、文件摘要、规则与必要上下文，并过滤敏感内容。
4. `planReviewers()` 根据文件数量、`full/lite` 生成 reviewer 计划。
5. `runReviewers()` 并行执行 reviewer，单个 reviewer 失败时记录 issue，不直接使全部失败。
6. `normalizeFinding()` 将 reviewer 输出转为统一 schema。
7. `validateFindings()` 复核每条 candidate finding；未完成返回 `2604`。
8. `filterByConfidence()` 丢弃 confidence < 80 或 validator 拒绝的 finding。
9. `dedupeFindings()` 去重，保留最高严重度与最高置信度版本。
10. `--fix` 时调用 `planMechanicalFixes()` 与 `applyMechanicalFixes()`；`--no-fix` 时禁止写源码。
11. `writeReviewReports()` 原子写入 Markdown + JSON 报告。
12. 若 P0 finding 数量大于 0，返回 `2601` 并包含报告路径；否则返回成功。

---

## 5. 局部数据模型

### 5.1 数据表设计

本 Capability 不新增服务端数据库表。数据以本地 Markdown/JSON 报告和临时上下文文件存储。

#### 模型名：`ReviewJsonReport`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `schemaVersion` | string | 是 | `review.v1` | JSON 报告版本 | 无 |
| `scope` | enum | 是 | 无 | `local`、`staged`、`scan`、`remote` | 无 |
| `baseRef` | string | 否 | null | local/remote 基准引用 | 无 |
| `headRef` | string | 否 | null | local/remote head 引用 | 无 |
| `files` | path[] | 是 | `[]` | 审查文件列表 | 无 |
| `findings` | `ReviewFinding[]` | 是 | `[]` | 已验证 finding | 无 |
| `summary` | `ReviewSummary` | 是 | 全 0 | P0/P1/P2/discarded 统计 | 无 |
| `filterStats` | `ReviewFilterStats` | 是 | 全 0 | 低置信、validator 拒绝、去重统计 | 无 |
| `fixResults` | `ReviewFixResult[]` | 否 | `[]` | `--fix` 结果 | 无 |
| `created_at` | 时间戳 | 是 | 当前时间 | 报告创建时间，遵循 overview.md 通用字段 | 无 |

**索引设计**：
- 主键索引：无数据库表，不适用。
- 唯一索引：无。
- 普通索引：无。

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| `.harness/cache/review/<runId>/context.json` | JSON | 命令结束后可清理 | 每次 review 重新生成 | 保存脱敏后的审查上下文 |
| `.harness/cache/review/<runId>/candidates.json` | JSON | 命令结束后可清理 | reviewer 完成后写入 | 调试 validator 前的候选 findings |

### 5.3 数据流转图

```text
[CLI argv]
  --> [ReviewOptions]
  --> [scope resolver + path guard]
  --> [review context]
  --> [reviewer planner]
  --> [parallel reviewers]
  --> [finding normalize]
  --> [validator]
  --> [confidence filter + dedupe]
  --> [optional mechanical fix]
  --> [Markdown report + JSON report]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[parse options]
  --> [validate mutually exclusive flags]
  --> [resolve local/staged/scan/remote scope]
  --> [build sanitized context]
  --> [plan full or lite reviewers]
  --> [run reviewers with bounded concurrency]
  --> [validate and filter findings]
  --> [dedupe findings]
  --> [apply optional mechanical fixes]
  --> [write reports]
  --> [return success or blocking issue error]
```

### 6.2 状态机（如有）

```text
[initialized]
  --scope resolved--> [scoped]
  --context built--> [context_ready]
  --reviewers done--> [candidate_findings]
  --validator done--> [validated_findings]
  --filter done--> [reportable_findings]
  --no-fix--> [reports_written]
  --fix planned--> [fix_planned]
  --fix applied--> [fix_applied]
  --reports written--> [completed]

[any state] --validation error--> [failed_with_error_code]
```

### 6.3 关键算法（如有）

#### 6.3.1 Scope 解析算法

1. 收集 `local/staged/scan` 标志，若数量大于 1 返回 `2602`。
2. `local=true` 时通过 Git 解析主分支基准与当前 head，输出 diff 文件列表。
3. `staged=true` 时读取 Git index，输出暂存区文件列表并设置 `scope=staged`。
4. `scan` 存在时对路径执行 normalize、resolve、root prefix 比较；越界返回 `2603`。
5. 未提供范围时默认走 `local`，若 Git 不可用则提示用户使用 `--scan`。

#### 6.3.2 Reviewer 计划算法

1. `full=true` 或审查文件数超过 3 时选择完整 reviewer 集合。
2. `lite=true` 时只选择规则审查与浅层 bug reviewer。
3. 完整集合包含规则审查、浅层 bug、深层 bug、历史回归、团队标准、契约一致性。
4. reviewer 输入必须只包含脱敏上下文和 scope 内文件。
5. 并发由 safety orchestration 控制；共享文件修改不在 reviewer 阶段发生。

#### 6.3.3 Finding 验证过滤算法

1. 对 reviewer 输出逐条调用 `normalizeFinding()`，缺少文件、位置、严重度或证据的 candidate 直接丢弃。
2. `validateFindings()` 对每条 finding 做上下文复核，产出 accepted/rejected 与 validator reason。
3. `filterByConfidence()` 丢弃 `confidence < 80` 或 validator rejected 的 finding。
4. `dedupeFindings()` 以 `file + lineRange + ruleId + semanticFingerprint` 去重。
5. JSON 报告记录 `lowConfidence`、`validatorRejected`、`deduplicated` 和总 `discarded`。

#### 6.3.4 Fix 边界算法

1. `noFix=true` 或未显式传入 `fix=true` 时，禁止调用 `fix-applier`。
2. `fix=true` 时只允许自动修复：
   - 格式化、拼写、明显未使用 import 等机械问题；
   - 单文件局部修改；
   - 有明确验证命令或静态检查可确认。
3. P0/P1 业务逻辑 finding 默认不自动修复，只在报告中给出建议。
4. 修复写入必须通过 transaction；失败时回滚并记录验证状态。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 远程 PR/MR 平台 | `--comment` 发表评论 | 用户已配置 CLI/SDK | 60000 毫秒 | 远程评论失败，但本地报告仍可生成 | 跳过评论并在报告记录 warning |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>= 20.0.0` | review CLI 和报告生成 | 无 | 无 | 缺失时阻断 review |
| Git | `>= 2.30.0` | diff、staged、branch 范围解析 | 无 | 无 | 不可用时仅允许 `--scan` |
| JSON | ECMA-404 | review 机器报告 | 无 | 无 | `--json` stdout 必须合法 |
| Harness reviewer contract | v1 | reviewer/validator 输出结构 | 无 | 无 | agent 不可用时降级单进程 lite 审查 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读取源码、写报告、写临时上下文 | Node fs API | 项目根目录内路径 | 禁止越界读取 |
| 事务写入适配器 | 写报告和受控修复 | 临时文件 + rename + rollback | `fix`、`noFix` | 由 workspace 能力提供，review 调用接口 |
| agent 编排适配器 | 并行 reviewer 与 validator | 本地进程/agent contract | 并发上限、超时 | 由 safety orchestration 控制 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-inspect | `readModuleMap()`、`readRules()` | 项目根目录、scope files | module map、rules、secretPatterns | 待建 |
| harness-develop | `readDevelopArtifacts()` | change 或 scope | spec/design/tasks 摘要 | 待建 |
| harness-safety-orchestration | `runBoundedAgents()`、`assertFixBoundary()` | reviewer plan、fix plan | 并发结果、安全判定 | 待建 |
| harness-workspace-config | `resolveWorkspace()`、`transactionalWrite()` | 报告计划、修复计划 | `.harness/reports/review/**` 写入结果 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 第一版本地 review 不要求额外环境变量；远程评论可复用用户已有平台配置 | 用户本机配置 |
| 密钥/证书 | 不读取或输出 token/key；远程凭据只由平台 CLI/SDK 间接使用 | 用户本机凭据 |
| 网络策略 | 默认 review 不联网；`--comment` 需要访问远程 PR/MR 平台 | 用户显式开启 |
| 权限/角色 | 读取审查范围文件；写 `.harness/reports/review/**`；`--fix` 写范围内源码 | 本地文件系统与 Git 权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 阻断 finding | P0 finding 数量大于 0 | 写报告后返回 `2601` | 输出 P0 数量与报告路径 |
| 范围参数冲突 | `--local`、`--staged`、`--scan` 同时出现 | 返回 `2602` | 提示保留一个 scope 参数 |
| 审查路径越界 | `--scan` 指向项目根目录外 | 返回 `2603` | 显示被拒绝路径与项目根目录 |
| validator 失败 | finding 复核流程未完成 | 返回 `2604` | 提示 validator 失败，不输出未验证 finding |
| 报告写入失败 | Markdown 或 JSON 报告无法写入 | 返回 `2605` | 提示报告路径与文件系统错误 |
| reviewer 执行失败 | reviewer agent 或本地审查器异常 | 返回 `5601` 或降级 warning | lite 降级可继续，全部失败则阻断 |
| 修复失败 | `--fix` 事务写入或验证失败 | 回滚修复并写入失败状态 | 报告列出失败文件与原因 |

### 8.2 重试与降级

- 重试次数：report writer 0 次；远程评论可重试 1 次；reviewer 单体失败不重试。
- 重试间隔：远程评论失败后等待 1000 毫秒重试一次。
- 降级策略：
  - Git 不可用时，仅允许 `--scan`，local/staged 返回可操作错误。
  - agent 协议不可用时，降级为单进程 lite 审查，并在报告中记录 warning。
  - 远程评论失败时，本地 Markdown + JSON 报告仍保留。
  - JSON 报告写入失败时返回 `2605`，不能只输出 Markdown 后声称成功。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 报告目录 | `review.reportRoot` | `.harness/reports/review` | Markdown + JSON 双报告输出目录 |
| 临时上下文目录 | `review.cacheRoot` | `.harness/cache/review` | 脱敏上下文和候选 finding 临时目录 |
| 置信度阈值 | `review.minConfidence` | `80` | 低于该值的 finding 必须丢弃 |
| lite 文件阈值 | `review.fullThresholdFiles` | `3` | 超过 3 文件默认进入 full planner |
| reviewer 总超时 | `review.totalTimeoutMs` | `600000` | 总审查超时 |
| validator 单条超时 | `review.validatorTimeoutMs` | `30000` | 单条 finding 复核超时 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `review.defaultNoFix` | 默认只报告不修复 | 开启 |
| `review.enableMechanicalFix` | 允许 `--fix` 机械修复 | 关闭，需显式 `--fix` |
| `review.enableRemoteComment` | 允许远程 PR/MR 评论 | 关闭，需显式 `--comment` |
| `review.enableAgentParallelism` | 启用多 reviewer 并行 | 开启，受 full/lite 规则限制 |
| `review.redactSecrets` | 报告与上下文中过滤敏感内容 | 开启 |
| `review.requireValidator` | finding 必须经过 validator 复核 | 开启 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：当前确认为纯新建，并列出拟建文件、模块和函数
> - [x] **现有约束已识别**：默认 no-fix、fix 边界、路径越界、validator 与双报告均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的内部逻辑，仅声明必要依赖
> - [x] **全局遵守**：遵循 overview.md 的统一返回体、错误码和时间戳约定
> - [x] 前端设计已完成（CLI 展示组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（本地 JSON 报告、缓存和无数据库表说明）
> - [x] **外部依赖已明确**：Node.js、Git、JSON、reviewer contract、远程评论和本地文件系统已列出
> - [x] **环境权限已确认**：本地读写、Git、远程评论凭据、无默认网络已说明
> - [x] 异常处理策略已定义（含 agent 降级、远程评论降级和 JSON 报告失败处理）
> - [x] 包含足够的局部细节支持任务拆解
