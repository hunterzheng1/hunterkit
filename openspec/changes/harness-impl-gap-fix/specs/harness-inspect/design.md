# 局部技术实现方案 - harness-inspect

> **⚠️ 边界声明**：本设计仅服务于 `harness-inspect` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | --full | scope.full | boolean | ✅ 保留 | |
| 2 | --path | scope.path | string \| null | ✅ 保留 | |
| 3 | --rules | options.rules | boolean | ✅ 保留 | |
| 4 | --json | globalOptions.json | boolean | ✅ 保留 | 全局参数 |
| 5 | factsPath | data.factsPath | string | ✅ 保留 | |
| 6 | moduleMapPath | data.moduleMapPath | string | ✅ 保留 | |
| 7 | rulesPath | data.rulesPath | string | ✅ 保留 | |
| 8 | reviewRequired | data.reviewRequired | string[] | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：8 个
- **设计输出字段总数**：8 个
- **差异说明**：无差异

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/capabilities/inspect/command.ts` | capabilities/inspect/command | `runInspectCommand()` | 扩展逻辑 | 添加 `--full`、`--path`、`--rules` 参数解析 |
| `src/capabilities/inspect/scanner.ts` | capabilities/inspect/scanner | `scanProject()` | 扩展逻辑 | 支持 `--path` 限定扫描范围 |

### 2.2 需新建的文件

无。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| `scope` 硬编码为 `{ full: true, path: null }` | 不解析命令参数 | 需从 `context.args` 解析 | 添加参数解析逻辑 |
| `scanProject` 始终全量扫描 | 不支持路径限定 | 需添加 path 过滤 | 在扫描循环中添加路径前缀检查 |
| 始终写入 rules.generated.md | 不受 `--rules` 控制 | 需条件化写入 | 仅在 `--rules` 为 true 时写入 |

---

## 3. 局部前端设计

不适用。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 项目扫描 | `CLI: harness inspect` | 本地进程 | 扫描项目生成 facts |

### 4.2 接口详细设计

#### 接口 1：harness inspect

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| --full | boolean | 否 | 全量扫描 | 默认 false；首次无 facts 时等价于 true |
| --path | path | 否 | 限定扫描目录 | 必须位于 --cwd 内 |
| --rules | boolean | 否 | 生成规则建议 | 为 true 时写入 rules.generated.md |
| --json | boolean | 否 | JSON 输出 | stdout 必须是合法 JSON |

**参数解析伪代码**：
```typescript
function parseInspectArgs(args: string[]): InspectOptions {
  const full = args.includes('--full');
  const rules = args.includes('--rules');
  let path: string | null = null;
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && pathIdx + 1 < args.length) {
    path = args[pathIdx + 1];
  }
  // 首次无 facts 时自动等价 --full
  if (!full && !path && !existsSync(factsPath)) {
    return { scope: { full: true, path: null }, rules };
  }
  return { scope: { full, path }, rules };
}
```

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "inspect",
    "factsPath": ".harness/facts/repo-map.json",
    "moduleMapPath": ".harness/generated/module-map.md",
    "rulesPath": ".harness/generated/rules.generated.md",
    "scope": { "full": true, "path": null },
    "languages": ["typescript"],
    "fileCount": 42,
    "reviewRequired": []
  },
  "warnings": []
}
```

**业务逻辑**：
1. 解析 `--full`、`--path`、`--rules` 参数
2. 校验 `--path` 位于 `--cwd` 内（否则返回 2302）
3. 调用 `scanProject(cwd, scope)` 执行扫描
4. 写入 `repo-map.json` 和 `module-map.md`
5. 仅当 `--rules` 为 true 时写入 `rules.generated.md`
6. 返回结果

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
parseInspectArgs(args) → InspectOptions
  → scanProject(cwd, scope) → RepoMap
  → stageWrite(repo-map.json)
  → stageWrite(module-map.md)
  → if rules: stageWrite(rules.generated.md)
  → commitTransaction()
  → CliResponse
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runInspectCommand(context):
  1. options = parseInspectArgs(context.args)
  2. if options.scope.path:
       if !isPathWithinRoot(options.scope.path, cwd): return error 2302
  3. repoMap = scanProject(cwd, options.scope)
  4. tx = beginTransaction(cwd, dryRun)
  5. stageWrite(tx, factsPath, JSON.stringify(repoMap))
  6. stageWrite(tx, moduleMapPath, generateModuleMap(repoMap))
  7. if options.rules:
       stageWrite(tx, rulesPath, generateRules(repoMap))
  8. commitTransaction(tx)
  9. return CliResponse(data)
```

### 6.2 路径限定扫描

```
scanProject(cwd, scope):
  scanRoot = scope.path ? resolve(cwd, scope.path) : cwd
  // 只扫描 scanRoot 下的文件
  walkDir(scanRoot, (file) => {
    if scope.path && !file.startsWith(scanRoot): skip
    // ... 正常扫描逻辑
  })
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
| core/paths | `resolveWorkspacePaths`, `isPathWithinRoot` | cwd | WorkspacePaths | 已有 |
| core/transaction | `beginTransaction`, `stageWrite`, `commitTransaction` | cwd, dryRun | Transaction | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Git >= 2.30.0 | git facts 扫描 | 降级：跳过 Git facts |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 扫描目标不存在 | --cwd 或 --path 不存在 | 返回错误码 2301 | "路径不存在: {path}" |
| 路径越界 | --path 不在项目根目录内 | 返回错误码 2302 | "路径越界: {path}" |
| facts 写入失败 | repo-map.json 写入失败 | 返回错误码 2303 | "facts 写入失败" |
| 规则生成失败 | rules.generated.md 写入失败 | 返回错误码 2304 | "规则生成失败" |

### 8.2 重试与降级

- 重试次数：0
- 降级策略：Git 不可用时跳过 git facts，仅扫描文件系统

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| facts 大小上限 | inspect.maxFactsSize | 5 MB | 超出时摘要化 |

### 9.2 开关配置

无。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：2 个需修改文件已明确
> - [x] **现有约束已识别**：3 个约束已列出
> - [x] **字段完整性**：8 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 规范
> - [x] 后端接口已完成
> - [x] **外部依赖已明确**：Git >= 2.30.0
> - [x] **环境权限已确认**：文件系统读权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
