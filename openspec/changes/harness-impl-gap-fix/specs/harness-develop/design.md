# 局部技术实现方案 - harness-develop

> **⚠️ 边界声明**：本设计仅服务于 `harness-develop` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | change | data.change | string | ✅ 保留 | |
| 2 | --propose | options.propose | boolean | ✅ 保留 | |
| 3 | --spec | options.spec | boolean | ✅ 保留 | |
| 4 | --design | options.design | boolean | ✅ 保留 | |
| 5 | --tasks | options.tasks | boolean | ✅ 保留 | |
| 6 | --check | options.check | boolean | ✅ 保留 | |
| 7 | --apply | options.apply | boolean | ✅ 保留 | |
| 8 | --archive | options.archive | boolean | ✅ 保留 | |
| 9 | --from | options.from | string \| null | ✅ 保留 | |
| 10 | --capability | options.capability | string \| null | ✅ 保留 | |
| 11 | --parallel | options.parallel | boolean | ✅ 保留 | |
| 12 | --no-parallel | options.noParallel | boolean | ✅ 保留 | |
| 13 | stage | data.stage | DevelopStage | ✅ 保留 | |
| 14 | artifacts | data.artifacts | string[] | ✅ 保留 | |
| 15 | storageStatus | data.storageStatus | string | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：15 个
- **设计输出字段总数**：15 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/develop/command.ts` | capabilities/develop/command | `runDevelopCommand()` | 替换实现 | 当前仅实现 propose 阶段，需扩展为完整多阶段 |
| `src/capabilities/develop/command.ts` | capabilities/develop/command | `detectStage()` | 扩展逻辑 | 需支持所有 7 个阶段的检测 |
| `src/capabilities/develop/command.ts` | capabilities/develop/command | 新增 `parseDevelopArgs()` | 新增方法 | 解析命令级参数 |
| `src/core/paths.ts` | core/paths | `resolveWorkspacePaths()` | 扩展逻辑 | 添加 `developChanges` 路径辅助方法 |
| `src/core/legacy-sources.ts` | core/legacy-sources | `detectLegacySources()` | 扩展逻辑 | 兼容读取 `openspec/changes/**` |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| `detectStage` 只检测到 check | 不检测 apply/archive | 需扩展检测逻辑 | 添加 apply/archive 阶段检测 |
| 不解析命令级参数 | 无 `--spec`/`--design` 等 | 需添加参数解析 | 新增 `parseDevelopArgs()` |
| `change` 从 `context.command` 提取 | 不可靠 | 需从 `context.args` 提取 | 修改提取逻辑 |
| 不读取 repo facts | design 阶段不使用 facts | 需添加 facts 读取 | 在 design 阶段调用 `loadFacts()` |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 开发流程 | `CLI: harness develop <change>` | 本地进程 | 统一管理开发阶段 |

### 4.2 接口详细设计

#### 接口 1：harness develop <change>

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| change | string | 是 | 变更名称 | kebab-case，长度 3-80 |
| --propose | boolean | 否 | 只处理 proposal 阶段 | 与其他阶段参数互斥 |
| --spec | boolean | 否 | 只处理 spec 阶段 | 与其他阶段参数互斥 |
| --design | boolean | 否 | 只处理 design 阶段 | 与其他阶段参数互斥 |
| --tasks | boolean | 否 | 只处理 tasks 阶段 | 与其他阶段参数互斥 |
| --check | boolean | 否 | 只执行一致性检查 | 禁止写文件 |
| --apply | boolean | 否 | 执行实现任务 | 必须先通过 check |
| --archive | boolean | 否 | 归档变更 | 必须有完成状态 |
| --from | path | 否 | 从需求文档生成 | 必须位于项目根目录内 |
| --capability | string | 否 | 限定能力域 | 必须存在于 proposal 能力列表 |
| --parallel | boolean | 否 | 对独立能力并行处理 | 共享文件必须串行 |
| --no-parallel | boolean | 否 | 强制串行 | 与 --parallel 互斥 |
| --dry-run | boolean | 否 | 只输出计划 | 写入文件数量必须为 0 |

**参数解析伪代码**：
```typescript
function parseDevelopArgs(args: string[]): { change: string; options: DevelopOptions } {
  const change = args[0];
  if (!change) throw new HarnessCliError(2501, 'Change name is required');
  const validationError = validateChangeName(change);
  if (validationError) throw new HarnessCliError(2501, validationError);

  const stageFlags = ['--propose', '--spec', '--design', '--tasks', '--check', '--apply', '--archive'];
  const activeStages = stageFlags.filter(f => args.includes(f));
  if (activeStages.length > 1) throw new HarnessCliError(2501, 'Stage flags are mutually exclusive');

  let capability: string | null = null;
  const capIdx = args.indexOf('--capability');
  if (capIdx !== -1 && capIdx + 1 < args.length) capability = args[capIdx + 1];

  let from: string | null = null;
  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && fromIdx + 1 < args.length) from = args[fromIdx + 1];

  return {
    change,
    options: {
      stage: activeStages[0]?.replace('--', '') as DevelopStage | undefined,
      from,
      capability,
      parallel: args.includes('--parallel') && !args.includes('--no-parallel'),
    },
  };
}
```

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "develop",
    "change": "add-review-workflow",
    "stage": "spec",
    "mode": "full",
    "testStrategy": "tdd",
    "artifacts": [
      ".harness/develop/changes/add-review-workflow/specs/harness-review/spec.md"
    ],
    "storageStatus": "canonical"
  },
  "warnings": []
}
```

**业务逻辑**：
1. 解析 change 名称和阶段参数
2. 解析存储位置（canonical vs legacy）
3. 如果无阶段参数：自动检测当前阶段
4. 根据目标阶段执行对应逻辑：
   - **propose**：生成 proposal.md
   - **spec**：为每个 capability 生成 spec.md
   - **design**：读取 repo facts，为每个 capability 生成 design.md
   - **tasks**：根据 design 生成任务 DAG（tasks.md）
   - **check**：只读验证一致性
   - **apply**：按 DAG 执行任务（并行无依赖任务，串行共享文件）
   - **archive**：移动到 `.harness/develop/archive/`
5. 如果 `--capability` 限定：只处理指定能力域
6. 返回产物列表

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
parseDevelopArgs(args) → { change, options }
  → resolveStorage(cwd, change) → StorageLocation
  → if no stage flag: detectStage(storage) → DevelopStage
  → switch (stage):
      case 'propose': generateProposal()
      case 'spec': generateSpecs(capabilities)
      case 'design': loadFacts() → generateDesigns(capabilities)
      case 'tasks': generateTasks(designs)
      case 'check': validateConsistency()
      case 'apply': executeTasks(dag, parallel)
      case 'archive': moveToArchive()
  → CliResponse
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runDevelopCommand(context):
  1. { change, options } = parseDevelopArgs(context.args)
  2. storage = resolveStorage(cwd, change)
  3. stage = options.stage ?? detectStage(storage)
  4. artifacts = []
  5. switch (stage):
       case 'propose':
         artifacts = runProposeStage(storage, options, dryRun)
       case 'spec':
         artifacts = runSpecStage(storage, options, dryRun)
       case 'design':
         facts = loadFacts(paths)
         artifacts = runDesignStage(storage, facts, options, dryRun)
       case 'tasks':
         artifacts = runTasksStage(storage, options, dryRun)
       case 'check':
         result = runCheckStage(storage, options)
         if result.hasBlockingIssues: return error 2505
       case 'apply':
         artifacts = runApplyStage(storage, options, dryRun)
       case 'archive':
         artifacts = runArchiveStage(storage, options, dryRun)
  6. return CliResponse({ change, stage, artifacts, storageStatus })
```

### 6.2 阶段检测

```typescript
function detectStage(storage: StorageLocation): DevelopStage {
  const root = storage.status === 'legacy' ? storage.legacyRoot : storage.canonicalRoot;
  const specsDir = join(root, 'specs');

  if (!existsSync(join(root, 'proposal.md'))) return 'propose';
  if (!existsSync(specsDir)) return 'spec';

  const specs = readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  const allHaveDesign = specs.every(s => existsSync(join(specsDir, s.name, 'design.md')));
  if (!allHaveDesign) return 'design';

  const allHaveTasks = specs.every(s => existsSync(join(specsDir, s.name, 'tasks.md')));
  if (!allHaveTasks) return 'tasks';

  // 检查是否已归档
  const archivePath = resolve(cwd, '.harness/develop/archive', change);
  if (existsSync(archivePath)) return 'archive';

  return 'check';
}
```

### 6.3 apply 阶段 DAG 并行

```typescript
function runApplyStage(storage, options, dryRun): string[] {
  const tasks = loadTasks(storage);
  const dag = buildTaskDAG(tasks);
  const completed = new Set<string>();
  const artifacts: string[] = [];

  while (completed.size < dag.nodes.length) {
    // 找出所有无依赖或依赖已完成的任务
    const ready = dag.nodes.filter(n =>
      !completed.has(n.id) &&
      n.dependencies.every(d => completed.has(d))
    );

    if (ready.length === 0) break; // 无可用任务（可能存在循环依赖）

    if (options.parallel && ready.length > 1) {
      // 并行执行无依赖任务（共享文件修改必须串行）
      const groups = groupByFileConflict(ready);
      for (const group of groups) {
        for (const task of group) {
          artifacts.push(...executeTask(task, dryRun));
          completed.add(task.id);
        }
      }
    } else {
      // 串行执行
      for (const task of ready) {
        artifacts.push(...executeTask(task, dryRun));
        completed.add(task.id);
      }
    }
  }
  return artifacts;
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
| core/paths | `resolveWorkspacePaths` | cwd | WorkspacePaths | 已有 |
| core/legacy-sources | `detectLegacySources()` | cwd | LegacySource[] | 已有 |
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Git >= 2.30.0 | apply/archive 变更状态检查 | 非 Git 项目跳过分支检查 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| change 名称无效 | 非 kebab-case 或长度超限 | 返回错误码 2501 | "变更名称无效" |
| proposal 缺失 | spec/design/tasks 阶段缺少 proposal | 返回错误码 2502 | "请先运行 --propose" |
| capability 不存在 | --capability 不在 proposal 列表 | 返回错误码 2503 | "能力域不存在: {name}" |
| 阶段依赖缺失 | design/tasks/apply 缺少上游文档 | 返回错误码 2504 | "缺少上游文档" |
| check 未通过 | 一致性检查存在阻断问题 | 返回错误码 2505 | "一致性检查未通过" |
| develop 执行失败 | 阶段处理出现未分类异常 | 返回错误码 5501 | "执行失败: {message}" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：`--parallel` 失败时自动降级为串行执行

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| canonical storage 路径 | develop.canonicalBase | ".harness/develop/changes" | 固定 |
| 最大并行 agent 数 | orchestration.maxParallelAgents | 6 | 从 harness.config.json 读取 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| orchestration.subagents | 是否启用 subagent 并行 | "auto" |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：5 个需修改文件已明确
> - [x] **现有约束已识别**：4 个约束已列出
> - [x] **字段完整性**：15 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：Git >= 2.30.0
> - [x] **环境权限已确认**：文件系统读写权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
