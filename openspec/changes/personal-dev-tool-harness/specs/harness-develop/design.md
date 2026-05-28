# 局部技术实现方案 - harness-develop

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-develop`，负责规格驱动开发流程管理，不设计 inspect、review、workspace、safety 等其他能力的内部实现。
>
> **质量红线**：本设计聚焦 `harness develop <change>` 如何落地，所有写入动作必须遵守单阶段、dry-run、check 只读和事务写入约束。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | `change` | `DevelopOptions.change` | string | ✅ 保留 | CLI 必填变更名，进入名称校验与存储解析 |
| 2 | `--propose` | `DevelopOptions.propose` | boolean | ✅ 保留 | 单阶段 proposal 标志 |
| 3 | `--spec` | `DevelopOptions.spec` | boolean | ✅ 保留 | 单阶段 spec 标志 |
| 4 | `--design` | `DevelopOptions.design` | boolean | ✅ 保留 | 单阶段 design 标志 |
| 5 | `--tasks` | `DevelopOptions.tasks` | boolean | ✅ 保留 | 单阶段 tasks 标志 |
| 6 | `--check` | `DevelopOptions.check` | boolean | ✅ 保留 | 只读一致性检查标志 |
| 7 | `--apply` | `DevelopOptions.apply` | boolean | ✅ 保留 | 实现阶段显式触发标志 |
| 8 | `--archive` | `DevelopOptions.archive` | boolean | ✅ 保留 | 归档阶段显式触发标志 |
| 9 | `--from` | `DevelopOptions.from` | path | ✅ 保留 | 从需求文档进入 proposal 阶段的输入来源 |
| 10 | `--capability` | `DevelopOptions.capability` | string | ✅ 保留 | 限定能力域，校验其存在于 proposal 能力列表 |
| 11 | `--parallel` | `DevelopOptions.parallel` | boolean | ✅ 保留 | 仅用于无共享写入的能力级并行计划 |
| 12 | `--dry-run` | `DevelopOptions.dryRun` | boolean | ✅ 保留 | 所有写文件执行器必须返回写入计划而不落盘 |
| 13 | `--json` | `DevelopOptions.json` | boolean | ✅ 保留 | 沿用 CLI 统一输出约定，返回结构化响应 |
| 14 | `code` | `HarnessResponse.code` | number | ✅ 保留 | 遵循 overview.md 统一返回体 |
| 15 | `msg` | `HarnessResponse.msg` | string | ✅ 保留 | 遵循 overview.md 统一返回体 |
| 16 | `data.change` | `DevelopResult.change` | string | ✅ 保留 | 输出当前 change |
| 17 | `data.stage` | `DevelopResult.stage` | enum | ✅ 保留 | 输出本次实际处理阶段 |
| 18 | `data.mode` | `DevelopResult.mode` | enum | ✅ 保留 | 从 proposal frontmatter 读取 full/simple |
| 19 | `data.testStrategy` | `DevelopResult.testStrategy` | enum | ✅ 保留 | 从 proposal frontmatter 读取 tdd/impl-first/none |
| 20 | `data.artifacts` | `DevelopResult.artifacts` | string[] | ✅ 保留 | 输出本次创建、计划创建或检查的文档路径 |
| 21 | `error.data.change` | `DevelopErrorData.change` | string | ✅ 保留 | 错误响应保留 change 以便自动化定位 |
| 22 | `proposal frontmatter.mode` | `ProposalMeta.mode` | enum | ✅ 保留 | 决定 full/simple 文档布局 |
| 23 | `proposal frontmatter.test-strategy` | `ProposalMeta.testStrategy` | enum | ⚠️ 重命名 | 转换为 camelCase `testStrategy`，保持 TS/JSON 字段一致 |
| 24 | `.harness/develop/changes/<change>/` | `StorageLocation.canonicalRoot` | path | ✅ 保留 | 新建变更的 canonical storage |
| 25 | `openspec/changes/<change>/` | `StorageLocation.legacyRoot` | path | ✅ 保留 | 兼容读取旧 OpenSpec 来源 |
| 26 | `.harness/state/active-change.json` | `DevelopState.activeChangePath` | path | ✅ 保留 | 记录当前活动 change 和最近阶段 |

### 1.2 完整性自检

- **用户输入字段总数**：26 个
- **设计输出字段总数**：26 个
- **差异说明**：仅 `test-strategy` 为适配 TypeScript/JSON 命名重命名为 `testStrategy`，语义不变。
- **完整性确认**：[x] 已确认所有字段都有对应处理

### 1.3 Spec 需求项覆盖表

| Spec 需求项 | 设计落点 | 覆盖方式 |
|------------|---------|---------|
| 规格驱动阶段管理 | `stage-detector.ts`、`stage-runner.ts`、`checker.ts` | 自动判断下一阶段、单阶段标志互斥、执行完成即停止 |
| Harness canonical storage | `storage-resolver.ts`、`artifact-writer.ts`、`legacy-openspec.ts` | 新建写入 `.harness/develop/changes/<change>/`，兼容读取旧 OpenSpec 来源并在结果中标记 |
| TDD 任务策略传递 | `proposal-frontmatter.ts`、`tasks-policy.ts` | 读取 proposal frontmatter，将 `testStrategy=tdd` 传给 tasks 计划生成器，保证测试任务先于实现任务 |

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| 无现有实现文件 | 无 | 无 | 纯新建 | 当前仓库未发现 `src/`、`bin/`、`lib/`、`test/` 等实现目录；本 Capability 以新建模块设计 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/develop/types.ts` | `DevelopOptions`、`DevelopResult`、`DevelopStage` | 定义 CLI 入参、阶段枚举、响应、错误数据和存储定位类型 | 无 | 所有 develop 子模块共享类型 |
| `src/capabilities/develop/command.ts` | `registerDevelopCommand()`、`runDevelopCommand()` | 挂载 `harness develop <change>` 并调用阶段编排 | CLI command handler | 仅负责编排，不直接写文档 |
| `src/capabilities/develop/change-name.ts` | `validateChangeName()` | 校验 kebab-case 和 3-80 长度 | 无 | 不合法返回错误码 `2501` |
| `src/capabilities/develop/stage-flags.ts` | `resolveRequestedStage()` | 解析 `--propose` 到 `--archive` 的互斥阶段标志 | 无 | 多阶段标志同时出现时返回参数错误 |
| `src/capabilities/develop/storage-resolver.ts` | `resolveDevelopStorage()` | 解析 canonical root、legacy root、当前来源状态 | 无 | 标记 `canonical`、`legacy`、`mixed`、`missing` |
| `src/capabilities/develop/legacy-openspec.ts` | `readLegacyOpenSpecChange()` | 读取旧 OpenSpec change 文档链 | 无 | 只读兼容来源，不默认迁移 |
| `src/capabilities/develop/stage-detector.ts` | `detectDevelopStage()`、`suggestNextStage()` | 根据已有文档判断下一步 | 无 | 无阶段标志时使用 |
| `src/capabilities/develop/stage-runner.ts` | `runDevelopStage()` | 分派 propose/spec/design/tasks/check/apply/archive 单阶段执行 | 无 | 每次只执行一个 stage，完成后停止 |
| `src/capabilities/develop/proposal-frontmatter.ts` | `readProposalMeta()` | 读取 `mode` 与 `test-strategy` | YAML frontmatter parser | 缺失或非法时进入澄清/阻断 |
| `src/capabilities/develop/tasks-policy.ts` | `buildTasksPolicy()` | 把 `testStrategy` 转换为 tasks DAG 策略 | 无 | `tdd` 时生成测试骨架、实现、验证依赖顺序 |
| `src/capabilities/develop/checker.ts` | `runDevelopCheck()`、`validateStageDependencies()` | 只读检查 proposal/spec/design/tasks 一致性 | 无 | `--check` 禁止任何写入 |
| `src/capabilities/develop/artifact-writer.ts` | `planArtifacts()`、`writeArtifactsTransactionally()` | 生成文档写入计划并事务写入 | Workspace transaction adapter | `dryRun=true` 时写入数量必须为 0 |
| `src/capabilities/develop/report-writer.ts` | `buildDevelopReport()`、`writeDevelopReport()` | 生成阶段结果与报告 | 无 | 报告包含 source、stage、artifacts、issues |
| `test/develop/develop.test.ts` | develop tests | 覆盖阶段检测、storage、TDD 策略、只读 check | Test runner | tasks 阶段应按 TDD 继续细拆 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 代码基线 | 当前仓库没有 Harness CLI 实现源码 | 不能锚定现有类/方法，只能给出拟建模块 | 所有文件标注为纯新建，后续 apply 阶段再创建 |
| SDD 阶段边界 | 当前流程要求 design 阶段只写 design.md | 不能在本阶段创建 CLI 代码或测试 | 本文只描述实现方案，不生成代码 |
| canonical storage | spec 要求新建默认写 `.harness/develop/changes/<change>/` | 写入器必须以 `.harness` 为 source of truth | `storage-resolver` 明确 canonical/legacy 来源 |
| legacy compatibility | 已有旧 OpenSpec 文档需要读取 | 读取逻辑不能破坏旧目录 | `legacy-openspec` 只读加载并在报告中标记 legacy source |
| 单阶段原则 | 指定 `--spec` 等标志后必须停止 | runner 不能链式自动进入下一阶段 | `runDevelopStage()` 每次只返回一个 `DevelopResult` |
| TDD 策略 | proposal frontmatter 可声明 `test-strategy: "tdd"` | tasks 阶段必须保留测试先行依赖 | `tasks-policy` 生成 DAG 策略并交给 tasks 阶段使用 |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| `DevelopCliView` | 终端展示 | 展示当前 change、source、stage、下一步建议 | `StageSuggestionList`、`ArtifactList` |
| `StageSuggestionList` | 终端展示 | 展示自动检测出的下一阶段和阻断原因 | 无 |
| `ArtifactList` | 终端展示 | 展示本次读取、计划写入、实际写入的文档路径 | 无 |
| `CheckResultTable` | 终端展示 | 展示 `--check` 的一致性问题、严重级别和错误码 | 无 |
| `DevelopJsonView` | JSON 输出 | 当 `--json` 为 true 时输出统一响应体 | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| `currentStage` | `DevelopStage` | `unknown` | 阶段标志解析或自动检测后更新 |
| `storageLocation` | `StorageLocation` | `missing` | canonical/legacy 路径扫描后更新 |
| `proposalMeta` | `ProposalMeta | null` | proposal 读取成功后更新 |
| `artifacts` | `DevelopArtifact[]` | `[]` | 写入计划生成、check 完成或阶段执行后更新 |
| `issues` | `DevelopIssue[]` | `[]` | 参数校验、依赖检查、文档一致性检查后更新 |
| `dryRun` | boolean | `false` | CLI 参数解析后固定 |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| `CLI: harness develop <change>` | `DevelopCliView` / `DevelopJsonView` | 本地文件系统读写权限 | 本 Capability 无浏览器前端路由 |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 用户执行 develop 命令 | `runDevelopCommand()` | `DevelopOptions` | 输出下一阶段建议、执行结果或错误码 |
| 用户加 `--json` | `formatHarnessResponse()` | `DevelopResult` / `DevelopErrorData` | 输出 `{ code, msg, data }` |
| 用户加 `--dry-run` | `planArtifacts()` | `DevelopOptions`、`StorageLocation` | 展示计划写入路径，禁止落盘 |
| 用户加 `--check` | `runDevelopCheck()` | `DevelopOptions`、文档链 | 展示一致性检查结果，禁止写入 |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Develop CLI | `CLI: harness develop <change>` | 本地进程调用 | 管理 SDD 阶段、canonical storage、只读 check 和 apply/archive 入口 |

### 4.2 接口详细设计

#### 接口 1：Develop CLI

**基本信息**：
- 路径：`CLI: harness develop <change>`
- 方法：本地进程调用
- 认证：不需要远程认证，依赖本地文件系统权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `change` | string | 是 | 变更名称 | kebab-case，长度 3-80 |
| `propose` | boolean | 否 | 只处理 proposal 阶段 | 与其他阶段参数互斥 |
| `spec` | boolean | 否 | 只处理 spec 阶段 | 与其他阶段参数互斥 |
| `design` | boolean | 否 | 只处理 design 阶段 | 与其他阶段参数互斥 |
| `tasks` | boolean | 否 | 只处理 tasks 阶段 | 与其他阶段参数互斥 |
| `check` | boolean | 否 | 只执行一致性检查 | 禁止写文件 |
| `apply` | boolean | 否 | 执行实现任务 | 必须先通过 check |
| `archive` | boolean | 否 | 归档变更 | 必须有完成状态 |
| `from` | path | 否 | 从需求文档生成 | 必须位于项目根目录内 |
| `capability` | string | 否 | 限定能力域 | 必须存在于 proposal 能力列表 |
| `parallel` | boolean | 否 | 对独立能力并行处理 | 共享文件必须串行 |
| `dryRun` | boolean | 否 | 只输出计划 | 写入文件数量必须为 0 |
| `json` | boolean | 否 | 输出 JSON | 遵循统一返回体 |

**响应结构**：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "change": "add-review-workflow",
    "stage": "tasks",
    "mode": "full",
    "testStrategy": "tdd",
    "source": "canonical",
    "artifacts": [
      ".harness/develop/changes/add-review-workflow/specs/<capability>/tasks.md"
    ]
  }
}
```

**业务逻辑**：
1. `validateChangeName()` 校验 `change`，不通过返回 `2501`。
2. `resolveRequestedStage()` 校验阶段标志互斥；无阶段标志时进入自动检测。
3. `resolveDevelopStorage()` 扫描 canonical 与 legacy 来源，标记当前文档链来源。
4. 若本次阶段依赖 proposal，调用 `readProposalMeta()` 获取 `mode` 与 `testStrategy`。
5. 若指定 `--capability`，校验该能力存在于 proposal 能力列表，不存在返回 `2503`。
6. `detectDevelopStage()` 在无阶段标志时根据缺失文档建议下一阶段。
7. `validateStageDependencies()` 校验上游文档，缺失返回 `2502` 或 `2504`。
8. `--check` 走 `runDevelopCheck()`，只读输出问题列表，禁止写入。
9. 其他阶段走 `runDevelopStage()`；`dryRun=true` 时只返回计划。
10. 输出 `DevelopResult`；失败时输出 spec 定义错误码。

---

## 5. 局部数据模型

### 5.1 数据表设计

本 Capability 不新增服务端数据库表。数据以 Markdown 文档与本地 JSON 状态文件存储。

#### 模型名：`DevelopChangeState`

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| `change` | string | 是 | 无 | 当前变更名称 | 无 |
| `stage` | enum | 是 | `unknown` | 最近一次处理或建议阶段 | 无 |
| `source` | enum | 是 | `missing` | `canonical` / `legacy` / `mixed` / `missing` | 无 |
| `canonicalRoot` | path | 是 | `.harness/develop/changes/<change>` | 新建写入根目录 | 无 |
| `legacyRoot` | path | 否 | `openspec/changes/<change>` | 兼容读取根目录 | 无 |
| `updated_at` | 时间戳 | 是 | 当前时间 | 状态更新时间，遵循 overview.md 通用字段 | 无 |

**索引设计**：
- 主键索引：无数据库表，不适用。
- 唯一索引：无。
- 普通索引：无。

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 无 | 无 | 无 | 无 | develop 阶段读取本地文件，第一版不引入缓存 |

### 5.3 数据流转图

```text
[CLI argv]
  --> [DevelopOptions]
  --> [change/stage/storage validation]
  --> [proposal meta + document chain]
  --> [stage plan or check result]
  --> [transactional artifacts / dry-run plan]
  --> [DevelopResult + report]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[parse argv]
  --> [validate change]
  --> [resolve requested stage]
  --> [resolve canonical and legacy storage]
  --> [load proposal meta when required]
  --> [validate capability and dependencies]
  --> [detect next stage if no stage flag]
  --> [run exactly one stage]
  --> [build response and report]
```

### 6.2 状态机（如有）

```text
[missing] --propose created--> [proposal]
[proposal] --spec created--> [spec]
[spec] --design created--> [design]
[design] --tasks created--> [tasks]
[tasks] --check passed--> [checked]
[checked] --apply requested--> [applied]
[applied] --archive requested--> [archived]

任意状态 --explicit single stage flag--> [run requested stage] --> [stop]
任意状态 --check--> [readonly check] --> [stop]
任意状态 --dry-run--> [plan only] --> [stop]
```

### 6.3 关键算法（如有）

#### 6.3.1 阶段标志互斥算法

1. 将 `propose/spec/design/tasks/check/apply/archive` 收集为 `requestedStages`。
2. 若 `requestedStages.length > 1`，返回参数校验错误。
3. 若存在单一阶段，返回该阶段并标记 `explicit=true`。
4. 若为空，进入自动阶段检测并标记 `explicit=false`。

#### 6.3.2 自动下一阶段检测算法

1. 优先检查 canonical root 是否存在；不存在则读取 legacy root。
2. proposal 不存在时建议 `propose`。
3. proposal 存在但目标能力 spec 缺失时建议 `spec`。
4. spec 存在但 design 缺失时建议 `design`。
5. design 存在但 tasks 缺失时建议 `tasks`。
6. tasks 存在时建议 `check`。
7. 所有建议仅返回给用户，除非当前命令明确触发该阶段。

#### 6.3.3 TDD 任务策略传递算法

1. `readProposalMeta()` 读取 frontmatter 中的 `test-strategy`。
2. 将 `test-strategy` 映射为 `TestStrategy.tdd | implFirst | none`。
3. 当值为 `tdd` 时，`buildTasksPolicy()` 输出：
   - 测试骨架任务必须先于实现任务；
   - 实现任务必须依赖对应测试任务；
   - 验证任务必须依赖实现任务；
   - apply 阶段必须执行对应验证命令。
4. 当值缺失或非法时，返回可操作错误，不静默降级。

#### 6.3.4 check 只读保护算法

1. `DevelopOptions.check === true` 时创建 `ReadonlyEffectGuard`。
2. 所有 artifact writer 在 guard 存在时只能调用 `planArtifacts()`。
3. 若任何模块请求 `writeArtifactsTransactionally()`，立即返回 `2505` 阻断。
4. 响应中记录 `writesPlanned` 与 `writesPerformed=0`。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无远程服务 | develop 阶段仅操作本地文件 | 无 | 0 毫秒连接超时 | 无 | 不适用 |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>= 20.0.0` | CLI 运行时 | 无 | 无 | 缺失时阻断 develop |
| OpenSpec CLI | `>= 1.2.0` | 兼容旧 SDD 文档链 | 无 | 无 | 不可用时使用内置 Markdown 结构校验 |
| YAML frontmatter parser | YAML 1.2 | 读取 proposal frontmatter | 无 | 无 | 缺失或解析失败时返回错误 |
| Git | `>= 2.30.0` | apply/archive 状态检查 | 无 | 无 | 非 Git 项目跳过分支检查 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 读取/写入 SDD 文档与状态 | Node fs API | 项目根目录内路径 | 禁止越界写入 |
| 事务写入适配器 | 写文档、状态和报告 | 临时文件 + rename + rollback | `dryRun`、backup 策略 | 由 workspace 能力提供，develop 只调用接口 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| workspace config | `resolveWorkspace()`、`transactionalWrite()` | 项目根目录、写入计划 | canonical root、事务写入结果 | 待建 |
| inspect | `readRepoFacts()` | 项目根目录 | design 阶段可用的 repo facts | 待建 |
| safety orchestration | `assertStageBoundary()`、`guardParallelWrites()` | stage、artifact plan | 单阶段/并行安全判定 | 待建 |
| review | `readDevelopArtifacts()` | change、stage artifacts | 完成前审查输入 | 待建 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 第一版不要求额外环境变量 | 无 |
| 密钥/证书 | 不需要密钥；文档内容不得泄露 secret、token、私钥 | 无 |
| 网络策略 | develop 阶段不建立网络连接 | 无 |
| 权限/角色 | 需要项目根目录内读写权限；`--check` 只需要读取权限 | 本地文件系统 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 参数校验异常 | `change` 非 kebab-case、长度超限或阶段标志冲突 | 返回错误码 `2501` 或统一参数错误 | 展示非法字段与修正示例 |
| proposal 缺失 | spec/design/tasks/check/apply 依赖 proposal 但找不到 | 返回 `2502` | 提示先运行 propose 阶段 |
| capability 不存在 | `--capability` 不在 proposal 能力列表 | 返回 `2503` | 展示可用能力列表 |
| 阶段依赖缺失 | design 缺 spec、tasks 缺 design、apply 缺 tasks | 返回 `2504` | 展示缺失文件与下一步命令 |
| check 未通过 | 一致性检查发现阻断问题，或只读保护发现写入请求 | 返回 `2505` | 输出问题列表和阻断原因 |
| 执行失败 | 文件系统异常、frontmatter 解析异常、未分类异常 | 返回 `5501` | 输出简短错误，详细信息进入报告 |

### 8.2 重试与降级

- 重试次数：0 次；本地文件写入失败通常需要用户处理权限或路径冲突。
- 重试间隔：不适用。
- 降级策略：
  - OpenSpec CLI 不可用时，降级为内置 Markdown 结构校验。
  - 非 Git 项目执行 apply/archive 前检查时，跳过分支检查但保留文档完整性检查。
  - legacy source 存在但 canonical 缺失时，只读加载 legacy，并在报告中提示可运行迁移 dry-run。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| canonical develop 根目录 | `develop.canonicalRoot` | `.harness/develop/changes` | 新建 change 的默认存储根 |
| legacy OpenSpec 根目录 | `develop.legacyOpenSpecRoot` | `openspec/changes` | 兼容读取旧变更 |
| 状态文件路径 | `develop.statePath` | `.harness/state/active-change.json` | 记录当前活动 change |
| 报告目录 | `develop.reportRoot` | `.harness/reports/develop` | 存放阶段报告 |
| 默认模式 | `develop.defaultMode` | `full` | proposal 缺失时的引导默认值 |
| 默认测试策略 | `develop.defaultTestStrategy` | `tdd` | proposal 缺失时的引导默认值 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `develop.enableLegacyOpenSpecRead` | 允许读取旧 OpenSpec 目录 | 开启 |
| `develop.enableAutoStageSuggestion` | 无阶段标志时给出下一步建议 | 开启 |
| `develop.enableParallelCapabilities` | 允许无共享写入的能力级并行计划 | 关闭，需显式 `--parallel` |
| `develop.requireCheckBeforeApply` | apply 前必须通过 check | 开启 |
| `develop.writeReports` | 写入 develop 阶段报告 | 开启；`--dry-run` 时只计划 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：当前确认为纯新建，并列出拟建文件、模块和函数
> - [x] **现有约束已识别**：SDD 单阶段、canonical storage、legacy read、TDD 策略和只读 check 均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：无越权设计其他 Capability 的内部逻辑，仅声明必要依赖
> - [x] **全局遵守**：遵循 overview.md 的统一返回体、错误码和时间戳约定
> - [x] 前端设计已完成（CLI 展示组件、状态、路由、交互）
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] 数据模型已完成（本地 JSON 状态、文档存储、无数据库表说明）
> - [x] **外部依赖已明确**：Node.js、OpenSpec CLI、YAML frontmatter、Git 和本地文件系统已列出
> - [x] **环境权限已确认**：本地读写权限、无密钥、无网络策略已说明
> - [x] 异常处理策略已定义（含 OpenSpec CLI 降级、非 Git 降级和 legacy source 策略）
> - [x] 包含足够的局部细节支持任务拆解
