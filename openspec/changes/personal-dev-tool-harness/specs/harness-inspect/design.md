# 局部技术实现方案 - harness-inspect

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
| 1 | `--full` | `InspectOptions.full` | boolean | ✅ 保留 | 控制全量扫描；首次无 facts 时由 planner 自动提升 |
| 2 | `--path` | `InspectOptions.path` | path/string | ✅ 保留 | 限定扫描范围，必须通过 cwd 内路径校验 |
| 3 | `--rules` | `InspectOptions.rules` | boolean | ✅ 保留 | 控制是否生成 `rules.generated.md` |
| 4 | `--json` | `InspectOptions.json` | boolean | ✅ 保留 | 控制机器可读输出 |
| 5 | `--dry-run` | `InspectOptions.dryRun` | boolean | ⚠️ 重命名 | CLI flag 转为 camelCase 内部字段 |
| 6 | `factsPath` | `InspectResult.factsPath` | path/string | ✅ 保留 | `.harness/facts/repo-map.json` 输出路径 |
| 7 | `moduleMapPath` | `InspectResult.moduleMapPath` | path/string | ✅ 保留 | `.harness/generated/module-map.md` 输出路径 |
| 8 | `rulesPath` | `InspectResult.rulesPath` | path/string/null | ✅ 保留 | `.harness/generated/rules.generated.md` 输出路径，未启用 rules 时为 null |
| 9 | `scope.full` | `InspectScope.full` | boolean | ✅ 保留 | 响应中声明实际扫描模式 |
| 10 | `scope.path` | `InspectScope.path` | path/string/null | ✅ 保留 | 响应中声明实际扫描路径 |
| 11 | `reviewRequired` | `InspectResult.reviewRequired` | ReviewRequiredItem[] | ✅ 保留 | 待确认事实列表 |
| 12 | `schemaVersion` | `RepoMap.schemaVersion` | number | ✅ 保留 | facts JSON 版本 |
| 13 | `root` | `RepoMap.root` | path/string | ✅ 保留 | 项目根目录 |
| 14 | `languages` | `RepoMap.languages` | string[] | ✅ 保留 | 识别出的语言集合 |
| 15 | `packageManagers` | `RepoMap.packageManagers` | string[] | ✅ 保留 | 识别出的包管理器 |
| 16 | `buildFiles` | `RepoMap.buildFiles` | BuildFileFact[] | ✅ 保留 | package、Maven、Gradle 等构建文件 |
| 17 | `docs` | `RepoMap.docs` | DocumentFact[] | ✅ 保留 | README、AGENTS、CLAUDE 等文档事实 |
| 18 | `agentFiles` | `RepoMap.agentFiles` | AgentFileFact[] | ✅ 保留 | AI agent/skill/hook 文件事实 |
| 19 | `ci` | `RepoMap.ci` | CiFact[] | ✅ 保留 | CI workflow 文件事实 |
| 20 | `modules` | `RepoMap.modules` | ModuleFact[] | ✅ 保留 | 模块结构事实 |
| 21 | `generatedAt` | `RepoMap.generatedAt` | ISO 8601 string | ✅ 保留 | facts 生成时间戳 |
| 22 | `path` | `InspectErrorData.path` | path/string | ✅ 保留 | 错误响应中用于展示非法或缺失路径 |

**状态说明**：
- ✅ 保留：字段名和类型与用户输入一致
- ⚠️ 重命名：字段重命名（必须说明理由）
- 🔀 合并：多字段合并为一个（必须说明理由）
- ❌ 移除：字段被移除（必须有充分理由且经用户确认）

### 1.2 完整性自检

- **用户输入字段总数**：22 个
- **设计输出字段总数**：22 个
- **差异说明**：仅 `--dry-run` 在内部使用 camelCase；其余 CLI、响应和 facts 字段均按 spec 语义保留
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
| `src/capabilities/inspect/types.ts` | `InspectOptions` / `InspectScope` / `RepoMap` / `ModuleFact` / `ReviewRequiredItem` | 定义 inspect 输入、输出和 facts 数据结构 | TypeScript type module | 与字段追溯表保持一致 |
| `src/capabilities/inspect/command.ts` | `runInspectCommand()` | 处理 `harness inspect` CLI 调用 | Command handler | 解析参数、调用 scanner pipeline、输出 `CliResponse` |
| `src/capabilities/inspect/scope.ts` | `resolveInspectScope()` | 校验 `--path`、决定 full/path 扫描范围 | Scope planner | 防止路径越界 |
| `src/capabilities/inspect/file-walker.ts` | `walkProjectFiles()` | 遍历项目文件并应用 ignore/secretPatterns | File scanner | 支持 full 和 scoped path |
| `src/capabilities/inspect/scanners/build-scanner.ts` | `scanBuildFiles()` | 识别 package、Maven、Gradle 等构建文件 | Scanner plugin | 输出 `BuildFileFact[]` |
| `src/capabilities/inspect/scanners/docs-scanner.ts` | `scanDocs()` | 识别 README、AGENTS、CLAUDE、Copilot instructions 等文档 | Scanner plugin | 输出 `DocumentFact[]` |
| `src/capabilities/inspect/scanners/agent-scanner.ts` | `scanAgentFiles()` | 识别 `.claude`、`.agents`、`.codex`、`.github` 等 agent 文件 | Scanner plugin | 输出 `AgentFileFact[]` |
| `src/capabilities/inspect/scanners/ci-scanner.ts` | `scanCiFiles()` | 识别 GitHub Actions 等 CI workflow | Scanner plugin | 输出 `CiFact[]` |
| `src/capabilities/inspect/module-detector.ts` | `detectModules()` | 从源码目录、包结构、构建文件推导模块 | Module detector | 不确定信息输出 `REVIEW_REQUIRED` |
| `src/capabilities/inspect/repo-map-writer.ts` | `writeRepoMap()` | 写入 `.harness/facts/repo-map.json` | Output writer | 必须通过 transaction |
| `src/capabilities/inspect/module-map-renderer.ts` | `renderModuleMap()` | 生成 `.harness/generated/module-map.md` | Markdown renderer | 面向人类阅读 |
| `src/capabilities/inspect/rules-renderer.ts` | `renderRulesGenerated()` | 生成 `.harness/generated/rules.generated.md` | Markdown renderer | 未确认事实标记 `REVIEW_REQUIRED` |
| `test/inspect/inspect.test.ts` | inspect tests | 验证 scope、facts schema、rules、dry-run、secret filtering | Node test suite | TDD 阶段先写红灯测试 |

### 2.3 现有逻辑约束

> 影响本次设计的现有系统约束（如：已有事务边界、线程模型、日志规范、已有设计模式等）

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 当前仓库是 SDD 文档工作区 | 已存在 `.agents/`、`.claude/`、`.codex/`、`.docsync/`、`openspec/`、`skywalk-sdd/`，未发现源码包 | inspect 需要识别 agent/docs/legacy 目录，同时不能假设存在源码项目 | scanner pipeline 支持 facts 不完整场景并输出 `REVIEW_REQUIRED` |
| 默认不读取敏感内容 | spec 要求遵守 safety.secretPatterns | file walker 必须先过滤敏感文件，再交给 scanner | `walkProjectFiles()` 统一应用 secretPatterns 和 ignore |
| facts 给多个 capability 复用 | sync/review/knowledge/develop 会读取 repo-map | facts schema 必须稳定且向后兼容 | `RepoMap.schemaVersion=1`，新增字段只追加 |
| `--dry-run` 写入为 0 | inspect 可能写 facts、module map、rules | dry-run 必须只返回 planned artifacts | writer 层检查 `InspectOptions.dryRun` |
| 路径限定不能越界 | `--path` 可由用户输入 | 需要规范化路径并校验在 cwd 内 | `resolveInspectScope()` 使用 resolved absolute path 比较 |

---

## 3. 局部前端设计

> 仅针对当前 Capability 的前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `InspectSummaryView` | 终端展示 | 展示扫描范围、输出路径、模块数、REVIEW_REQUIRED 数量 | `InspectResult` |
| `InspectDryRunView` | 终端展示 | 展示 dry-run 计划和将写入的 artifacts | `PlannedArtifact[]` |
| `InspectErrorView` | 终端展示 | 展示路径错误、越界、写入失败、扫描器错误 | `HarnessCliError` |
| `ReviewRequiredView` | 终端展示 | 展示需要用户确认的事实项 | `ReviewRequiredItem[]` |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `scope.full` | boolean | `false` | 解析 `--full` 或首次无 facts 自动提升后更新 |
| `scope.path` | string/null | `null` | `--path` 通过校验后更新 |
| `scannedFilesCount` | number | `0` | file walker 完成后更新 |
| `moduleCount` | number | `0` | `detectModules()` 完成后更新 |
| `reviewRequired` | ReviewRequiredItem[] | `[]` | scanner 或 detector 发现不确定事实时追加 |
| `artifacts` | PlannedArtifact[] | `[]` | writer/renderers 计算输出路径后更新 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness inspect` | `InspectSummaryView` | 本地读写权限 | 默认扫描并写 facts/module map |
| `CLI: harness inspect --full --rules` | `InspectSummaryView` | 本地读写权限 | 全量扫描并写 rules |
| `CLI: harness inspect --path <path> --json` | 无页面，JSON 输出 | 本地读权限和可选写权限 | 限定路径扫描，stdout 纯 JSON |
| `CLI: harness inspect --dry-run` | `InspectDryRunView` | 本地读权限 | 不写文件，只展示计划 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 全量扫描 | `runInspectCommand()` | `full=true`、`rules`、`dryRun` | 展示 output artifacts 和 reviewRequired |
| 限定路径扫描 | `resolveInspectScope()` | `path`、`cwd` | 成功进入 scanner；越界返回 2302 |
| 生成规则建议 | `renderRulesGenerated()` | `RepoMap`、`reviewRequired` | 写入或计划 `.harness/generated/rules.generated.md` |
| 输出 JSON | `CliResponse` | `InspectResult` | 返回 factsPath、moduleMapPath、rulesPath、scope、reviewRequired |

---

## 4. 局部后端接口设计

> 仅针对当前 Capability 的接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Inspect 命令 | `CLI: harness inspect` | 本地进程调用 | 执行项目扫描并输出 facts/module map/rules |
| 范围解析 | `resolveInspectScope()` | 函数调用 | 校验 full/path 范围和路径安全 |
| 文件遍历 | `walkProjectFiles()` | 函数调用 | 遍历允许扫描的文件集合 |
| Scanner pipeline | `runInspectScanners()` | 函数调用 | 聚合构建、文档、agent、CI、模块事实 |
| Output writers | `writeRepoMap()` / `renderModuleMap()` / `renderRulesGenerated()` | 函数调用 | 生成 JSON/Markdown artifacts |

### 4.2 接口详细设计

#### 接口 1：Inspect 命令

**基本信息**：
- 路径：`CLI: harness inspect`
- 方法：本地进程调用
- 认证：不需要远程认证，使用本地文件系统权限

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `--full` | boolean | 否 | 全量扫描 | 默认 false；首次无 facts 时等价 true |
| `--path` | path/string | 否 | 限定扫描目录 | 必须位于 `--cwd` 内 |
| `--rules` | boolean | 否 | 生成规则建议 | 为 true 时生成 rulesPath |
| `--json` | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |
| `--dry-run` | boolean | 否 | 不写文件 | 写入文件数量必须为 0 |

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "factsPath": ".harness/facts/repo-map.json",
    "moduleMapPath": ".harness/generated/module-map.md",
    "rulesPath": ".harness/generated/rules.generated.md",
    "scope": {
      "full": true,
      "path": null
    },
    "reviewRequired": []
  }
}
```

**业务逻辑**：
1. `runInspectCommand()` 从 `CommandContext` 获取 cwd、global options 和 inspect flags。
2. 调用 `resolveInspectScope()` 校验 `--path`，决定 full/path scan。
3. 调用 `walkProjectFiles()` 遍历文件并应用 ignore 和 secretPatterns。
4. 调用 scanner pipeline 生成 BuildFileFact、DocumentFact、AgentFileFact、CiFact。
5. 调用 `detectModules()` 生成 ModuleFact，并收集不确定事实到 reviewRequired。
6. 组装 RepoMap，调用 writer/renderers 计算 artifacts。
7. `dryRun=true` 时只返回 planned artifacts；否则 transaction 写入 JSON/Markdown。

#### 接口 2：范围解析

**基本信息**：
- 路径：`Function: resolveInspectScope(options, workspacePaths)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | path/string | 是 | 项目根目录 | 必须存在 |
| `path` | path/string/null | 否 | 限定扫描路径 | resolve 后必须在 cwd 内 |
| `full` | boolean | 否 | 是否全量扫描 | path 存在时 full 只影响上下文补充，不扩大越界范围 |

**响应结构**：
```json
{
  "full": false,
  "path": "src/payment",
  "absoluteRoot": "E:/repo/demo",
  "absoluteScanRoot": "E:/repo/demo/src/payment"
}
```

**业务逻辑**：
1. 规范化 cwd 和 path。
2. path 为空时 scanRoot=cwd。
3. path 非空时计算 absoluteScanRoot。
4. 若 absoluteScanRoot 不以 absoluteRoot 为前缀，抛出 2302。
5. 若 path 不存在，抛出 2301。

#### 接口 3：RepoMap 写入

**基本信息**：
- 路径：`Function: writeRepoMap(repoMap, outputs, transaction)`
- 方法：函数调用
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `repoMap` | RepoMap | 是 | 规范化 facts | 必须包含 schemaVersion、root、generatedAt |
| `outputs` | InspectOutputPaths | 是 | 输出路径 | 必须位于 `.harness/facts` 或 `.harness/generated` |
| `dryRun` | boolean | 是 | 是否预览 | true 时不得写文件 |

**响应结构**：
```json
{
  "factsPath": ".harness/facts/repo-map.json",
  "moduleMapPath": ".harness/generated/module-map.md",
  "rulesPath": null,
  "written": 2
}
```

**业务逻辑**：
1. 校验 repoMap schemaVersion=1。
2. 若 facts JSON 序列化后超过 5 MB，调用 `summarizeLargeFacts()` 生成摘要字段和 REVIEW_REQUIRED。
3. 通过 transaction stage 写入 facts 和 Markdown artifacts。
4. 任一写入失败返回 2303 或 2304，并 rollback。

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
| 无 | 无 | 无 | 无 | inspect 不引入缓存；facts 作为持久输出而非缓存 |

### 5.3 数据流转图

```
[cwd + inspect flags]
  --> [resolveInspectScope]
  --> [walkProjectFiles + secret filtering]
  --> [build/docs/agent/ci scanners]
  --> [detectModules]
  --> [RepoMap + reviewRequired]
  --> [module-map/rules renderers]
  --> [transaction write or dry-run response]
```

**文件数据模型**：

| 文件路径 | 数据类型 | 必填 | 默认值 | 说明 |
|---------|---------|------|--------|------|
| `.harness/facts/repo-map.json` | JSON object | 是 | `schemaVersion: 1` | 机器可读项目事实 |
| `.harness/generated/module-map.md` | Markdown | 是 | 无 | 人类可读模块图 |
| `.harness/generated/rules.generated.md` | Markdown | `--rules` 时是 | 无 | agent 规则建议 |

**RepoMap 核心字段**：

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 |
|-------|---------|------|--------|------|
| `schemaVersion` | number | 是 | `1` | facts schema 版本 |
| `root` | string | 是 | cwd | 项目根目录 |
| `languages` | string[] | 是 | `[]` | 识别语言 |
| `packageManagers` | string[] | 是 | `[]` | 识别包管理器 |
| `buildFiles` | BuildFileFact[] | 是 | `[]` | 构建文件事实 |
| `docs` | DocumentFact[] | 是 | `[]` | 文档事实 |
| `agentFiles` | AgentFileFact[] | 是 | `[]` | agent/skill/hook 文件事实 |
| `ci` | CiFact[] | 是 | `[]` | CI workflow 事实 |
| `modules` | ModuleFact[] | 是 | `[]` | 模块事实 |
| `generatedAt` | ISO 8601 string | 是 | 当前时间 | 生成时间 |

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[runInspectCommand]
  --> [parse InspectOptions]
  --> [resolveInspectScope]
  --> [walkProjectFiles]
  --> [run scanner plugins]
  --> [detectModules]
  --> [build RepoMap]
  --> [renderModuleMap]
  --> [rules? renderRulesGenerated]
  --> [dry-run?]
      --> yes: [return planned artifacts]
      --> no:  [write via transaction]
  --> [return InspectResult]
```

**Spec 需求项覆盖表**：

| Spec 需求项 | 设计覆盖位置 | 覆盖说明 |
|------------|-------------|---------|
| 项目事实扫描 | `runInspectCommand()`、`walkProjectFiles()`、scanner plugins、`detectModules()` | 覆盖 full/path 扫描、构建/源码/文档/agent/CI/legacy 事实识别 |
| 规则与模块图输出 | `renderModuleMap()`、`renderRulesGenerated()`、`ReviewRequiredView` | 覆盖 module-map、rules.generated 和 `REVIEW_REQUIRED` 标记 |
| 机器可读事实契约 | `RepoMap` 数据模型、`writeRepoMap()`、schemaVersion 约束 | 覆盖 repo-map.json 稳定字段和下游读取契约 |

### 6.2 状态机（如有）

```
[START]
  -- path invalid --> [ERROR_2301_OR_2302]
  -- path valid --> [SCANNING]

[SCANNING]
  -- scanners success --> [FACTS_READY]
  -- scanner failure --> [ERROR_5301]

[FACTS_READY]
  -- dry-run --> [PLAN_READY]
  -- write facts success --> [ARTIFACTS_WRITTEN]
  -- write facts failure --> [ERROR_2303_OR_2304]
```

### 6.3 关键算法（如有）

**文件过滤算法**
1. 从 workspace config 读取 ignore 和 `safety.secretPatterns`。
2. 合并固定忽略目录：`.git`、`.harness/cache`、大型 context 输出。
3. 遍历文件时先判断是否命中 secretPatterns。
4. 命中敏感模式时不得读取内容，只允许记录“已按模式跳过”的统计。
5. 非敏感文件按 scanner 需要读取文件名、相对路径和必要轻量内容。

**模块识别算法**
1. 优先从 package/workspace/build 文件识别模块根。
2. 其次从常见源码目录如 `src`、`apps`、`packages`、`services` 识别候选模块。
3. 对缺少构建文件但有明确目录结构的模块标记 confidence=`medium`。
4. 对无法确认语言、入口或依赖关系的模块生成 `REVIEW_REQUIRED`。

**facts 大小控制算法**
1. 序列化 repoMap 后检查字节大小。
2. 小于等于 5 MB 时直接写入。
3. 大于 5 MB 时保留摘要字段、模块聚合、计数和 source path，省略超大详细列表。
4. 被摘要化的部分加入 `reviewRequired`，提示用户必要时运行限定路径扫描。

---

## 7. 外部依赖与集成

> **⚠️ 必填**：列出本 Capability 依赖的所有外部系统、服务和基础设施，确保上下游关系透明、可追踪。
> AI 无法自动推断项目的外部依赖，**请用户补充完整**。

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | inspect 不调用远程服务 | 无 | 0 毫秒连接超时 | 无 | 无 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | >= 20.0.0 | 文件遍历、路径解析、JSON/Markdown 输出 | 无 | 无 | 低于版本阻断 inspect |
| Git | >= 2.30.0 | git facts、ignored 文件识别 | 本地 Git 权限 | 无 | 非 Git 项目跳过 Git facts |
| npm package-lock | lockfileVersion >= 2 | Node 项目和包管理器识别 | 无 | 无 | 无 lockfile 时仅记录 package.json |
| Maven POM | modelVersion >= 4.0.0 | Java 项目识别 | 无 | 无 | 无法确认时标记 REVIEW_REQUIRED |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 遍历项目并写 `.harness/facts`、`.harness/generated` | Node fs API | `--cwd` 和 `--path` | 写入走 transaction |
| `.gitignore` / Git ignored rules | 避免扫描 ignored 和敏感输出 | Git 或内置 ignore 读取 | Git 可用时读取 ignored 文件 | Git 不可用则使用内置规则 |

### 7.4 内部跨模块依赖

> 本 Capability 需要调用项目内其他模块的能力（注意：仅声明依赖，不设计对方逻辑）

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `harness-cli-entrypoint` | `CommandContext` | `--full`、`--path`、`--rules`、`--dry-run`、`--json` | inspect 命令上下文 | 待建 |
| `harness-workspace-config` | `resolveWorkspacePaths()`、transaction、config read | cwd、output operations | `.harness/facts`、`.harness/generated` 路径和写入事务 | 待建 |
| `harness-safety-orchestration` | safety config read | secretPatterns、dangerous path rules | 文件过滤策略 | 待建 |
| `harness-sync` | facts consumer | repo-map.json、rules.generated.md | 文档同步输入 | 待建 |
| `harness-review` | facts consumer | module-map、module facts | review 范围建议 | 待建 |
| `harness-knowledge` | generated artifacts consumer | facts、module map、rules | knowledge 索引输入 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 本 Capability 不需要业务密钥；`CI` 可影响输出颜色或严格度 | 从 `process.env` 读取 |
| 密钥/证书 | 不需要；命中 secretPatterns 的文件不得读取内容 | 无 |
| 网络策略 | 本地运行不需要网络 | 无 |
| 权限/角色 | 需要读取项目目录；非 dry-run 时需要写 `.harness/facts` 和 `.harness/generated` 权限 | 本地用户权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 扫描目标不存在 | `--cwd` 或 `--path` 不存在 | 返回 2301，不启动扫描 | 用户看到缺失路径 |
| 路径越界 | `--path` resolve 后不在 cwd 内 | 返回 2302，不读取路径 | 用户看到越界路径 |
| facts 写入失败 | repo-map 写入失败 | 返回 2303，transaction rollback | 用户看到 factsPath 和 rollback 状态 |
| 规则生成失败 | `--rules` 输出失败 | 返回 2304，transaction rollback | 用户看到 rulesPath 和失败原因 |
| 扫描器内部错误 | 文件遍历或 scanner plugin 异常 | 返回 5301，保留安全错误摘要 | 用户看到 scanner 名称和建议重跑限定路径 |
| 敏感文件命中 | 文件路径命中 secretPatterns | 跳过内容读取并记录统计 | 用户只看到模式级跳过说明 |

### 8.2 重试与降级

- 重试次数：0 次；文件扫描和写入失败不自动重试
- 重试间隔：0 毫秒
- 降级策略：Git 不可用时跳过 Git facts；Maven/npm lock 解析失败时保留路径事实并加入 `REVIEW_REQUIRED`

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| facts 输出路径 | `inspect.outputs.factsPath` | `.harness/facts/repo-map.json` | RepoMap JSON 输出 |
| module map 输出路径 | `inspect.outputs.moduleMapPath` | `.harness/generated/module-map.md` | 模块图输出 |
| rules 输出路径 | `inspect.outputs.rulesPath` | `.harness/generated/rules.generated.md` | 规则建议输出 |
| facts 大小上限 | `inspect.maxFactsBytes` | `5242880` | 5 MB，超出摘要化 |
| 默认忽略目录 | `inspect.defaultIgnoredDirs` | `.git,.harness/cache` | 不参与扫描 |
| 敏感文件模式 | `safety.secretPatterns` | `.env*`、key、token、secret 等 | 来自 workspace config |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--full` | 强制全量扫描 | 关闭，首次无 facts 自动等价开启 |
| `--path` | 限定扫描目录 | 未设置 |
| `--rules` | 同时生成规则建议 | 关闭 |
| `--dry-run` | 只输出计划，不写 artifacts | 关闭 |
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
