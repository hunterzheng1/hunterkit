# 局部技术实现方案 - harness-sync

> **⚠️ 边界声明**：本设计仅服务于 `harness-sync` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | --check | options.check | boolean | ✅ 保留 | |
| 2 | --fast | options.fast | boolean | ✅ 保留 | |
| 3 | --docs | options.docs | string[] | ✅ 保留 | |
| 4 | --dry-run | globalOptions.dryRun | boolean | ✅ 保留 | 全局参数 |
| 5 | mode | data.mode | string | ✅ 保留 | |
| 6 | drift | data.drift | boolean | ✅ 保留 | |
| 7 | documents | data.documents | SyncDocumentResult[] | ✅ 保留 | |
| 8 | reportPath | data.reportPath | string | ✅ 保留 | |
| 9 | REVIEW_REQUIRED | data.reviewRequired | string[] | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：9 个
- **设计输出字段总数**：9 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/sync/command.ts` | capabilities/sync/command | `runSyncCommand()` | 扩展逻辑 | 添加 `--check`、`--fast`、`--docs` 参数解析；添加漂移检测；添加 REVIEW_REQUIRED 标注 |
| `src/adapters/drift-detector.ts` | adapters/drift-detector | `checkAdapterDrift()` | 扩展逻辑 | 支持文档级漂移检测（不仅限于 adapter 投影） |
| `src/core/legacy-sources.ts` | core/legacy-sources | `detectLegacySources()` | 扩展逻辑 | 兼容读取 `.docsync/` 规则 |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 不解析命令级参数 | 始终同步全部 4 种文档 | 需从 args 解析 `--check`/`--fast`/`--docs` | 添加参数解析 |
| 无漂移检测 | 始终执行同步 | `--check` 模式需只检查不写入 | 添加 diff 比较逻辑 |
| 无 `--fast` 快速判断 | 始终完整同步 | 需使用 git diff 判断影响范围 | 添加 git diff 逻辑 |
| 无 REVIEW_REQUIRED 标注 | 不标注不确定事实 | 需在输出中标注 | 从 facts.reviewRequired 读取 |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 文档同步 | `CLI: harness sync` | 本地进程 | 同步文档和 agent 说明 |

### 4.2 接口详细设计

#### 接口 1：harness sync

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --check | boolean | 否 | 只检查漂移 | 为 true 时写入文件数量必须为 0 |
| --fast | boolean | 否 | git facts 快速判断 | 高风险变更必须升级为完整检查 |
| --docs | string[] | 否 | 限定文档集合 | 枚举：readme/agents/claude/copilot |
| --dry-run | boolean | 否 | 展示将修改内容 | 写入文件数量必须为 0 |
| --json | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**参数解析伪代码**：
```typescript
function parseSyncArgs(args: string[]): SyncOptions {
  const check = args.includes('--check');
  const fast = args.includes('--fast');
  let docs: DocumentKind[] | null = null;
  const docsIdx = args.indexOf('--docs');
  if (docsIdx !== -1 && docsIdx + 1 < args.length) {
    docs = args[docsIdx + 1].split(',') as DocumentKind[];
    // 校验枚举值
    for (const d of docs) {
      if (!['readme', 'agents', 'claude', 'copilot'].includes(d)) {
        throw new HarnessCliError(2402, `Unknown document type: ${d}`);
      }
    }
  }
  return { check, fast, docs };
}
```

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "sync",
    "mode": "check",
    "drift": true,
    "documents": [
      { "path": "AGENTS.md", "kind": "agents", "status": "drifted" },
      { "path": "README.md", "kind": "readme", "status": "up-to-date" }
    ],
    "reportPath": ".harness/reports/sync/20260529-sync.md",
    "reviewRequired": ["project.description"]
  },
  "warnings": []
}
```

**业务逻辑**：
1. 解析 `--check`、`--fast`、`--docs` 参数
2. 读取 `repo-map.json` facts（不存在则返回 2404）
3. 如果 `--fast`：使用 git diff 判断变更范围
   - 如果检测到高风险变更（package/build/CI/agent rules/SDD 文档），自动升级为完整检查
4. 确定目标文档列表（`--docs` 限定或全部 4 种）
5. 对每个目标文档计算期望内容，与现有内容比较
6. 如果 `--check`：只报告漂移状态，不写入文件
7. 否则：通过 transaction 写入更新
8. 写入 sync 报告到 `.harness/reports/sync/<timestamp>-sync.md`
9. 从 facts.reviewRequired 读取不确定事实，标注 REVIEW_REQUIRED

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
parseSyncArgs(args) → SyncOptions
  → loadFacts(paths) → RepoMap
  → if fast: gitDiff(cwd) → changedFiles
    → if highRisk: upgrade to full check
  → for each targetDoc:
      computeExpected(doc, facts) → expectedContent
      compare(existing, expected) → SyncDocumentResult
  → if !check: transaction write
  → writeReport(paths, results)
  → CliResponse
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runSyncCommand(context):
  1. options = parseSyncArgs(context.args)
  2. facts = loadFacts(paths)  // 不存在返回 2404
  3. kinds = options.docs ?? ['readme', 'agents', 'claude', 'copilot']
  4. if options.fast:
       changedFiles = gitDiff(cwd)
       if isHighRiskChange(changedFiles):
         options.fast = false  // 升级为完整检查
         warnings.push('Upgraded to full check due to high-risk changes')
  5. documents = []
  6. for kind in kinds:
       expected = generateManagedBlock(kind, facts)
       existing = readFile(docPath)
       if expected !== existing:
         if options.check:
           documents.push({ path, kind, status: 'drifted' })
         else:
           stageWrite(tx, docPath, expected)
           documents.push({ path, kind, status: 'written' })
       else:
         documents.push({ path, kind, status: 'up-to-date' })
  7. drift = documents.some(d => d.status === 'drifted')
  8. if !check: commitTransaction(tx)
  9. writeReport(paths, documents)
  10. return CliResponse({ mode, drift, documents, reportPath, reviewRequired })
```

### 6.2 高风险变更检测

```typescript
const HIGH_RISK_PATTERNS = [
  'package.json', 'package-lock.json',
  'tsconfig.json', 'pom.xml', 'build.gradle',
  '.github/workflows/', '.gitlab-ci.yml',
  'AGENTS.md', 'CLAUDE.md', '.claude/',
  'openspec/', '.harness/develop/',
];

function isHighRiskChange(changedFiles: string[]): boolean {
  return changedFiles.some(f => HIGH_RISK_PATTERNS.some(p => f.includes(p)));
}
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

无新增。

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-inspect | 读取 `repo-map.json` | factsPath | RepoMap | 已有 |
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |
| core/legacy-sources | `detectLegacySources()` | cwd | LegacySource[] | 已有 |
| adapters/drift-detector | `checkAdapterDrift()` | cwd, entry | AdapterProjectionStatus | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Git >= 2.30.0 | `--fast` 模式需要 git diff | 降级为完整检查 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 文档漂移 | --check 发现漂移 | 返回错误码 2401 | "文档漂移: {files}" |
| 文档选择无效 | --docs 包含未知类型 | 返回错误码 2402 | "未知文档类型: {type}" |
| 保护内容冲突 | 写入会覆盖用户内容 | 返回错误码 2403 | "保护内容冲突: {path}" |
| facts 缺失 | repo-map.json 不存在 | 返回错误码 2404 | "请先运行 harness inspect" |
| 报告写入失败 | sync 报告无法写入 | 返回错误码 5401 | "报告写入失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：Git 不可用时 `--fast` 自动降级为完整检查

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| managed block 前缀 | documents.generatedBlockPrefix | "harness" | 从 harness.config.json 读取 |
| managed 文档列表 | documents.managed | ["README.md", "AGENTS.md", "CLAUDE.md"] | 从 harness.config.json 读取 |

### 9.2 开关配置

无。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：3 个需修改文件已明确
> - [x] **现有约束已识别**：4 个约束已列出
> - [x] **字段完整性**：9 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：Git >= 2.30.0
> - [x] **环境权限已确认**：文件系统读写权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
