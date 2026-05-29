# 局部技术实现方案 - harness-cli-entrypoint

> **⚠️ 边界声明**：本设计仅服务于 `harness-cli-entrypoint` Capability，严禁越权设计。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | Spec 输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | wizardAnswers.projectPath | wizardAnswers.projectPath | string | ✅ 保留 | |
| 2 | wizardAnswers.aiTools | wizardAnswers.aiTools | string[] | ✅ 保留 | |
| 3 | wizardAnswers.capabilities | wizardAnswers.capabilities | string[] | ✅ 保留 | |
| 4 | wizardAnswers.projectType | wizardAnswers.projectType | string | ✅ 保留 | |
| 5 | wizardAnswers.writeStrategy | wizardAnswers.writeStrategy | string | ✅ 保留 | |
| 6 | wizardAnswers.hookStrength | wizardAnswers.hookStrength | string | ✅ 保留 | |

### 1.2 完整性自检
- **Spec 输入字段总数**：6 个
- **设计输出字段总数**：6 个
- **差异说明**：无差异
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|--------|----------------|---------|------|
| `src/cli/interactive.ts` | cli/interactive | `runInitWizard()` | 替换实现 | 当前为 stub，需替换为完整 6 步向导 |
| `src/cli/interactive.ts` | cli/interactive | `runOperationMenu()` | 扩展逻辑 | 当前仅返回命令列表，需添加交互式选择 |
| `src/cli/global-options.ts` | cli/global-options | `parseGlobalOptions()` | 扩展逻辑 | 需支持命令级参数透传（`--json` 等） |
| `src/cli/main.ts` | cli/main | `main()` | 扩展逻辑 | 初始化时调用文档生成和 Skill 投影安装 |

### 2.2 需新建的文件

无。所有修改在现有文件上进行。

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| `runInitWizard` 为 stub | 返回固定响应 | 需完全替换 | 保留函数签名，替换内部实现 |
| `runOperationMenu` 仅返回命令列表 | 无交互选择 | 需添加 `@inquirer/prompts` 选择 | 保留现有返回结构，添加交互层 |
| `parseGlobalOptions` 仅解析全局参数 | 不解析命令级参数 | 命令级参数由各 handler 自行解析 | 遵循现有架构，不在 global-options 中解析命令级参数 |

---

## 3. 局部前端设计

不适用（CLI 工具，无前端 UI）。

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 交互式向导 | `CLI: npx @hunterzheng/harness`（无参数，未初始化） | 本地进程 | 6 步向导 |
| 操作菜单 | `CLI: npx @hunterzheng/harness`（无参数，已初始化） | 本地进程 | 命令选择菜单 |

### 4.2 接口详细设计

#### 接口 1：交互式向导

**基本信息**：
- 路径：`CLI: npx @hunterzheng/harness`（无参数）
- 方法：本地进程调用
- 认证：不需要

**请求参数**：无（通过交互式问答收集）

**向导步骤流程**：
```
步骤1: select({ message: "确认目标项目", choices: [当前目录, 指定路径] })
  → wizardAnswers.projectPath
步骤2: checkbox({ message: "选择 AI 工具", choices: [Claude Code, Codex, 两者, 暂不安装] })
  → wizardAnswers.aiTools
步骤3: checkbox({ message: "选择工作流能力", choices: [基础文档, 功能开发, 代码审查, 知识库, 全部] })
  → wizardAnswers.capabilities
步骤4: select({ message: "选择项目类型", choices: [自动检测, Node, Java, 混合] })
  → wizardAnswers.projectType
步骤5: select({ message: "选择写入策略", choices: [只预览, 写入项目配置] })
  → wizardAnswers.writeStrategy
步骤6: select({ message: "选择 Hook 强度", choices: [不安装, 仅危险命令阻断, 完整质量门] })
  → wizardAnswers.hookStrength
```

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "init",
    "mode": "wizard",
    "wizardAnswers": {
      "projectPath": "E:/repo/demo",
      "aiTools": ["claude", "codex"],
      "capabilities": ["inspect", "sync", "develop", "review", "knowledge"],
      "projectType": "node",
      "writeStrategy": "write",
      "hookStrength": "full"
    },
    "artifacts": [
      "AGENTS.md",
      "CLAUDE.md",
      ".claude/skills/harness/SKILL.md",
      ".harness/config/harness.config.json"
    ]
  },
  "warnings": []
}
```

**业务逻辑**：
1. 检测 `.harness/config/harness.config.json` 是否存在 → 不存在则进入向导
2. 依次执行 6 步问答，收集 `wizardAnswers`
3. 根据 `writeStrategy` 判断是否为 dry-run
4. 调用 `ensureWorkspace()` 创建工作区目录结构
5. 调用 `writeHarnessConfig()` 写入配置
6. 调用 adapter 模块生成 AGENTS.md、CLAUDE.md、Skill 投影
7. 返回产物列表

#### 接口 2：操作菜单

**响应结构**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "menu",
    "selectedCommand": "inspect",
    "result": { /* 命令执行结果 */ }
  },
  "warnings": []
}
```

**业务逻辑**：
1. 从 `registry.list()` 获取可用命令列表
2. 使用 `@inquirer/prompts` 的 `select` 展示命令菜单
3. 用户选择后，构造 `CommandContext` 并调用对应 handler
4. 返回命令执行结果

---

## 5. 局部数据模型

### 5.1 数据表设计

不适用（CLI 工具，无数据库表）。

### 5.2 缓存设计

不适用。

### 5.3 数据流转图

```
用户输入(argv) → parseGlobalOptions() → 无命令?
  → 是: runInteractiveEntrypoint()
    → 未初始化: runInitWizard() → ensureWorkspace() → 生成产物 → CliResponse
    → 已初始化: runOperationMenu() → handler.run() → CliResponse
  → 否: registry.resolve() → handler.run() → CliResponse
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
runInitWizard(context):
  1. answers = await promptWizardSteps()  // 6 步问答
  2. config = buildConfigFromAnswers(answers)  // 构建 HarnessConfig
  3. if answers.writeStrategy === 'preview':
       context.globalOptions.dryRun = true
  4. result = ensureWorkspace(request, config)  // 创建工作区
  5. generateDocuments(paths, config)  // 生成 AGENTS.md/CLAUDE.md
  6. generateSkillProjections(paths, config)  // 生成 Skill 投影
  7. return CliResponse(artifacts)
```

### 6.2 状态机

```
[未初始化] --向导完成--> [已初始化]
[已初始化] --无参数--> [操作菜单]
[操作菜单] --选择命令--> [命令执行]
[命令执行] --完成--> [操作菜单]
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无（纯本地 CLI）。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 鉴权方式 | 备注 |
|------|------|------|---------|------|
| @inquirer/prompts | >= 5.0.0 | 向导问题和菜单选择 | 无 | 降级为命令行参数模式 |

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| harness-workspace-config | `ensureWorkspace()` | WorkspaceRequest, HarnessConfig | EnsureWorkspaceResult | 已有 |
| harness-adapter-skill-runtime | `ensureAdapterSources()`, `applyProjectionWrites()` | cwd, entries | AdapterProjectionStatus[] | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Node.js >= 20.0.0 | 运行时 | npm |
| 文件系统写权限 | `.harness/` 和投影路径 | 本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 向导中断 | 用户 Ctrl+C | 返回错误码 1003 | "向导已取消" |
| 向导输入无效 | 输入不在允许选项内 | 返回错误码 1004 | "无效选择，请重新输入" |
| 菜单选择无效 | 选择未注册命令 | 返回错误码 2002 | "未知命令" |

### 8.2 重试与降级

- 重试次数：0（向导不重试，直接报错）
- 降级策略：`@inquirer/prompts` 不可用时降级为非交互模式（从命令行参数读取）

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 向导步骤数 | wizard.steps | 6 | 固定 6 步 |
| 默认项目类型 | project.type | "auto" | 自动检测 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| interactive.enabled | 是否启用交互式模式 | true |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：4 个需修改文件已明确
> - [x] **现有约束已识别**：3 个约束已列出并有应对策略
> - [x] **字段完整性**：6 个字段全部保留
> - [x] **边界遵守**：无越权设计
> - [x] **全局遵守**：遵循 overview.md 的三体结构和错误码规范
> - [x] 后端接口已完成（路径、参数、响应、逻辑）
> - [x] **外部依赖已明确**：@inquirer/prompts >= 5.0.0
> - [x] **环境权限已确认**：Node.js >= 20.0.0，文件系统写权限
> - [x] 异常处理策略已定义
> - [x] 包含足够的局部细节支持任务拆解
