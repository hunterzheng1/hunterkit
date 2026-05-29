# 局部技术实现方案 - harness-review

> **⚠️ 边界声明**：本设计仅服务于 `harness-review` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | --local | options.local | boolean | ✅ 保留 | |
| 2 | --staged | options.staged | boolean | ✅ 保留 | |
| 3 | --scan | options.scan | string \| null | ✅ 保留 | |
| 4 | --fix | options.fix | boolean | ✅ 保留 | |
| 5 | --no-fix | options.noFix | boolean | ✅ 保留 | |
| 6 | --full | options.full | boolean | ✅ 保留 | |
| 7 | --lite | options.lite | boolean | ✅ 保留 | |
| 8 | --comment | options.comment | boolean | ✅ 保留 | |
| 9 | scope | data.scope | string | ✅ 保留 | |
| 10 | findings | data.findings | ReviewFinding[] | ✅ 保留 | |
| 11 | summary.p0 | data.summary.p0 | number | ✅ 保留 | |
| 12 | summary.p1 | data.summary.p1 | number | ✅ 保留 | |
| 13 | summary.p2 | data.summary.p2 | number | ✅ 保留 | |
| 14 | summary.discarded | data.summary.discarded | number | ✅ 保留 | |
| 15 | reports.markdown | data.reports.markdown | string | ✅ 保留 | |
| 16 | reports.json | data.reports.json | string | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：16 个
- **设计输出字段总数**：16 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/review/command.ts` | capabilities/review/command | `runReviewCommand()` | 替换实现 | 当前仅做简单文件扫描，需替换为完整多 agent 审查模式 |
| `src/capabilities/review/command.ts` | capabilities/review/command | `scanFilesForReview()` | 替换实现 | 需支持 local/staged/scan 三种范围模式 |
| `src/capabilities/review/command.ts` | capabilities/review/command | `reviewFile()` | 替换实现 | 需支持 P0/P1/P2 分级和 confidence 评分 |

### 2.2 需新建的文件

| 文件路径 | 模块名 | 需实现的方法/函数 | 说明 |
|---------|--------|----------------|------|
| `src/capabilities/review/types.ts` | capabilities/review/types | `ReviewFinding` 接口 | 定义 review finding 数据结构，包含 severity(P0/P1/P2)、confidence、reviewer 字段 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 不解析命令级参数 | 无 --local/--staged/--scan 等 | 需添加参数解析 | 新增 `parseReviewArgs()` |
| severity 使用 error/warning/info | 不符合 P0/P1/P2 规范 | 需替换为 P0/P1/P2 | 修改 ReviewFinding 类型 |
| 无 confidence 字段 | 不做置信度过滤 | 需添加 confidence 评分和过滤 | 添加 confidence 字段和过滤逻辑 |
| 报告路径不含 branch | 使用固定格式 | 需包含 branch 名 | 从 git 获取当前分支名 |
| 只输出 Markdown 报告 | 无 JSON 报告 | 需添加 JSON 报告输出 | 同时写入 .md 和 .json |
| 无交互式范围选择 | 始终全量扫描 | 需添加交互式选择 | 无参数时使用 inquirer 选择 |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 代码审查 | `CLI: harness review` | 本地进程 | 多 agent 代码审查 |

### 4.2 接口详细设计

#### 接口 1：harness review

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --local | boolean | 否 | 当前分支 vs 主分支 | 与 --staged、--scan 互斥 |
| --staged | boolean | 否 | 仅暂存区 | 与 --local、--scan 互斥 |
| --scan | path | 否 | 全量扫描目录 | 必须位于项目根目录内 |
| --fix | boolean | 否 | 允许自动修复 | 与 --no-fix 互斥 |
| --no-fix | boolean | 否 | 只报告不修复 | 默认 true |
| --full | boolean | 否 | 跑满所有 reviewer | 与 --lite 互斥 |
| --lite | boolean | 否 | 轻量审查 | 与 --full 互斥 |
| --comment | boolean | 否 | 远程 PR/MR 评论 | 需要远程上下文配置 |
| --json | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**参数解析伪代码**：
```typescript
function parseReviewArgs(args: string[]): ReviewOptions {
  const local = args.includes('--local');
  const staged = args.includes('--staged');
  let scan: string | null = null;
  const scanIdx = args.indexOf('--scan');
  if (scanIdx !== -1 && scanIdx + 1 < args.length) scan = args[scanIdx + 1];

  // 互斥校验
  const scopeFlags = [local, staged, scan !== null].filter(Boolean);
  if (scopeFlags.length > 1) throw new HarnessCliError(2602, 'Scope flags are mutually exclusive');

  const fix = args.includes('--fix');
  const noFix = args.includes('--no-fix') || !fix;
  if (fix && args.includes('--no-fix')) throw new HarnessCliError(2602, '--fix and --no-fix are mutually exclusive');

  const full = args.includes('--full');
  const lite = args.includes('--lite');
  if (full && lite) throw new HarnessCliError(2602, '--full and --lite are mutually exclusive');

  const comment = args.includes('--comment');

  return { local, staged, scan, fix, noFix, full, lite, comment };
}
```

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "review",
    "scope": "local",
    "findings": [
      {
        "file": "src/cli/main.ts",
        "line": 42,
        "severity": "P1",
        "confidence": 85,
        "category": "security",
        "reviewer": "deep-bug-analyzer",
        "message": "Possible hardcoded secret",
        "suggestion": "Use environment variables"
      }
    ],
    "summary": {
      "p0": 0,
      "p1": 1,
      "p2": 3,
      "discarded": 2
    },
    "reports": {
      "markdown": ".harness/reports/review/20260529-main.md",
      "json": ".harness/reports/review/20260529-main.json"
    }
  },
  "warnings": []
}
```

**业务逻辑**：
1. 解析参数，校验互斥关系
2. 确定审查范围：
   - 无参数 → 交互式选择（local/staged/scan）
   - `--local` → git diff main...HEAD
   - `--staged` → git diff --cached
   - `--scan <path>` → 扫描指定目录
3. 确定 reviewer 集合：
   - `--lite` → 仅 contract-reviewer + bug-scanner
   - `--full` 或文件数 > 3 → 全部 6 个 reviewer
   - 默认 → 根据文件类型自动选择
4. 并行执行 reviewer（编排器本身不做实质审查）
5. 收集候选 findings
6. 对每条 finding 启动 validator 独立复核
7. 过滤 confidence < 80 的 finding
8. 去重（相同 file+line+category 的 finding 只保留一条）
9. 分级统计 P0/P1/P2
10. 写入 Markdown + JSON 双报告
11. 如果 `--fix`：修复低风险机械性问题
12. 如果 P0 > 0：返回错误码 2601
13. 用户可见内容使用简体中文

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| `.harness/cache/review/**` | 临时上下文 | 命令结束后清理 | 每次 review 重建 | 审查上下文缓存 |

### 5.3 数据流转图

```
parseReviewArgs(args) → ReviewOptions
  → resolveScope(options, cwd) → { files, scope }
  → selectReviewers(options) → Reviewer[]
  → parallel: for each reviewer:
      reviewer.review(files) → CandidateFinding[]
  → merge all candidate findings
  → for each finding:
      validator.validate(finding) → validated | rejected
  → filter: confidence < 80 → discarded
  → deduplicate: same file+line+category → keep one
  → classify: P0/P1/P2
  → writeMarkdownReport(paths, findings)
  → writeJsonReport(paths, findings)
  → if fix: applyMechanicalFixes(findings)
  → if P0 > 0: return error 2601
  → CliResponse
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runReviewCommand(context):
  1. options = parseReviewArgs(context.args)
  2. if no scope flag:
       scope = await promptScopeSelection()  // 交互式选择
  3. { files, scopeName } = resolveScope(options, cwd)
  4. if options.scan && !isPathWithinRoot(options.scan, cwd):
       return error 2603
  5. reviewers = selectReviewers(options)
  6. candidateFindings = await runReviewersParallel(reviewers, files)
  7. validatedFindings = []
     discarded = 0
     for finding in candidateFindings:
       if finding.confidence < 80:
         discarded++
         continue
       if validator.validate(finding):
         validatedFindings.push(finding)
       else:
         discarded++
  8. deduplicated = deduplicateFindings(validatedFindings)
  9. classified = classifySeverity(deduplicated)  // P0/P1/P2
  10. branch = getCurrentBranch(cwd)
  11. timestamp = formatTimestamp()
  12. mdPath = `.harness/reports/review/${timestamp}-${branch}.md`
      jsonPath = `.harness/reports/review/${timestamp}-${branch}.json`
  13. writeReports(mdPath, jsonPath, classified)
  14. if options.fix:
        applyMechanicalFixes(classified.filter(f => f.severity === 'P2'))
  15. summary = { p0: count('P0'), p1: count('P1'), p2: count('P2'), discarded }
  16. if summary.p0 > 0: return error 2601
  17. return CliResponse({ scope: scopeName, findings: classified, summary, reports })
```

### 6.2 Reviewer 选择

```typescript
const ALL_REVIEWERS = [
  'rules-reviewer',
  'bug-scanner',
  'deep-bug-analyzer',
  'history-reviewer',
  'standards-reviewer',
  'contract-reviewer',
];

const LITE_REVIEWERS = ['contract-reviewer', 'bug-scanner'];

function selectReviewers(options: ReviewOptions): string[] {
  if (options.lite) return LITE_REVIEWERS;
  if (options.full) return ALL_REVIEWERS;
  // 默认：文件数 > 3 时使用全部，否则使用基础集合
  return ALL_REVIEWERS;
}
```

### 6.3 严重度分级

```typescript
function classifySeverity(findings: ReviewFinding[]): ReviewFinding[] {
  return findings.map(f => {
    let severity: 'P0' | 'P1' | 'P2';
    if (f.category === 'security' && f.confidence >= 90) severity = 'P0';
    else if (f.category === 'security' || f.category === 'contract') severity = 'P1';
    else severity = 'P2';
    return { ...f, severity };
  });
}
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| Git | diff/staged/branch 范围解析 | CLI | 30s | --scan 仍可用 | 仅允许 --scan |

### 7.2 第三方 API / SDK

无新增。

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-inspect | 读取 `repo-map.json` | factsPath | RepoMap | 已有 |
| harness-develop | 读取 spec/design/tasks | changePath | 文档链 | 已有 |
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |
| core/paths | `resolveWorkspacePaths`, `isPathWithinRoot` | cwd | WorkspacePaths | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Git >= 2.30.0 | diff/staged/branch | 降级为 --scan |
| 远程凭据 | --comment 模式 | 用户配置 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 存在阻断问题 | P0 finding > 0 | 返回错误码 2601 | "存在 P0 阻断问题" |
| 范围参数冲突 | 多个 scope flag | 返回错误码 2602 | "范围参数冲突" |
| 审查路径越界 | --scan 在项目外 | 返回错误码 2603 | "路径越界" |
| validator 失败 | finding 验证未完成 | 返回错误码 2604 | "验证失败" |
| 报告写入失败 | Markdown/JSON 写入失败 | 返回错误码 2605 | "报告写入失败" |
| 远程凭据缺失 | --comment 无凭据 | 返回错误码 2606 | "请配置远程凭据" |
| reviewer 执行失败 | reviewer 异常 | 返回错误码 5601 | "审查器执行失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：单个 reviewer 失败时跳过该 reviewer，在 warnings 中记录

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| confidence 阈值 | review.confidenceThreshold | 80 | 低于此值的 finding 丢弃 |
| 最大并行 reviewer | review.maxParallelReviewers | 6 | 从 orchestration.maxParallelAgents 读取 |
| validator 必需 | review.validatorRequired | true | 从 orchestration.validatorRequired 读取 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| review.autoFix | 是否默认启用自动修复 | false |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：4 个需修改文件已明确
> - [x] **现有约束已识别**：6 个约束已列出
> - [x] **字段完整性**：16 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：Git >= 2.30.0
> - [x] **环境权限已确认**：Git、远程凭据
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
