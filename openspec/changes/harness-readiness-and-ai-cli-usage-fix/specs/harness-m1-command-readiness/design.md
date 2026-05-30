# 局部技术实现方案 - harness-m1-command-readiness

> **⚠️ 边界声明**：本设计仅服务于 `harness-m1-command-readiness`，聚焦 M1 验收命令 inspect/sync/review/status/doctor/adapter 的可运行验证与修复。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | inspect 可运行 | CLI inspect 命令验证 | command | ✅ 保留 | --json / --dry-run 均验证 |
| 2 | sync 可运行 | CLI sync --check 验证 | command | ✅ 保留 | 含 JSON 输出 |
| 3 | review 双报告输出 | CLI review --local 验证 | command | ✅ 保留 | MD + JSON 报告 |
| 4 | status 状态完整 | CLI status 输出 | command | ✅ 保留 | 含 JSON 输出 |
| 5 | doctor 诊断正常 | CLI doctor 输出 | command | ✅ 保留 | 环境诊断全覆盖 |
| 6 | adapter 投影可生成 | config --repair-adapters | command | ✅ 保留 | Skill 文件验证 |

### 1.2 完整性自检

- **用户输入字段总数**：6 个
- **设计输出字段总数**：6 个
- **差异说明**：无差异
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/inspect/command.ts` | - | `runInspectCommand()` | 扩展逻辑 | 确保 fixture 上可运行，补全 facts 输出 |
| `src/capabilities/sync/command.ts` | - | `runSyncCommand()` | 扩展逻辑 | 确保 --check 模式正常 |
| `src/capabilities/review/command.ts` | - | `runReviewCommand()` | 扩展逻辑 | reviewMode 标注 + 中文报告 |
| `src/commands/status.ts` | - | `runStatusCommand()` | 扩展逻辑 | 增加能力状态矩阵展示 |
| `src/commands/doctor.ts` | - | `runDoctorCommand()` | 扩展逻辑 | 确保诊断输出完整 |
| `src/commands/config.ts` | - | `runConfigCommand()` | 扩展逻辑 | 确保 --repair-adapters 可运行 |

### 2.2 需新建的文件

| 文件路径 | 类/模块名 | 职责 | 继承/实现 | 说明 |
|---------|----------|------|---------|------|
| `test/fixtures/m1-test-project/` | - | M1 验收 fixture | N/A | 小型测试项目用于 M1 命令验收 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| review 输出 reviewMode 缺失 | 当前响应无 reviewMode 字段 | 无法区分启发式/agent 模式 | 新增 reviewMode: "heuristic" |
| status 无能力状态矩阵 | status 只显示基本信息 | 用户无法了解各能力完成度 | 扩展 status 输出 |
| adapter 投影需 CLI 入口 | --repair-adapters 在 config 下 | 需 config handler 支持此参数 | 确保 config.ts 路由此子命令 |

---

## 3. 局部前端设计

N/A — CLI 工具，无前端组件。

---

## 4. 局部后端接口设计

### 4.1 M1 验收命令清单

| 命令 | 参数 | 预期退出码 | 预期产物 | 性能约束 |
|------|------|-----------|---------|---------|
| inspect | 无 | 0 | `.harness/facts/repo-map.json` | < 30s |
| inspect | --json | 0 | stdout JSON | < 30s |
| inspect | --dry-run | 0 | 无文件写入 | < 30s |
| sync | --check | 0 | 同步状态输出 | < 30s |
| sync | --check --json | 0 | stdout JSON | < 30s |
| review | --local | 0 | MD + JSON 报告 | < 60s |
| review | --local --dry-run | 0 | 无文件写入 | < 60s |
| status | 无 | 0 | 工作空间状态 | < 10s |
| status | --json | 0 | stdout JSON | < 10s |
| doctor | 无 | 0 | 环境诊断 | < 10s |
| doctor | --json | 0 | stdout JSON | < 10s |
| config | --repair-adapters | 0 | 投影文件重生成 | < 30s |

### 4.2 status 输出扩展设计

```json
// harness status --json 扩展输出
{
  "code": 0,
  "msg": "success",
  "data": {
    "project": { "name": "demo", "type": "node" },
    "workspace": { "path": ".harness/", "initialized": true },
    "capabilities": {
      "inspect": { "status": "available", "m1": true },
      "sync": { "status": "available", "m1": true },
      "review": { "status": "available", "m1": true, "reviewMode": "heuristic" },
      "develop": {
        "status": "partial",
        "stages": {
          "propose": "available",
          "spec": "next_version",
          "design": "next_version",
          "tasks": "next_version",
          "check": "next_version",
          "apply": "next_version",
          "archive": "next_version"
        }
      },
      "knowledge": { "status": "available", "m1": true, "storageBackend": "json-fallback" },
      "safety": { "status": "partial", "hooks": "template", "dispatcher": "next_version" }
    },
    "hooks": {
      "claude": { "installed": true, "status": "template" },
      "codex": { "installed": false, "status": "not_installed" }
    }
  }
}
```

---

## 5. 局部数据模型

### 5.1 M1 验收状态枚举

```typescript
type M1Status = 'available' | 'partial' | 'next_version';

interface CapabilityStatus {
  status: M1Status;
  m1: boolean;
  reviewMode?: 'heuristic' | 'agent';
  storageBackend?: 'sqlite-fts5' | 'json-fallback';
  stages?: Record<string, M1Status>;
}
```

### 5.2 fixture 项目结构

```
test/fixtures/m1-test-project/
├── .harness/
│   └── config/
│       └── harness.config.json     # 预配置
├── src/
│   ├── index.ts                    # 简单源码
│   └── utils.ts
└── package.json
```

---

## 6. 模块内部逻辑

### 6.1 核心流程 — M1 验收执行

```
[1. inspect 验收]
  → 初始化 fixture 项目
  → 执行 harness inspect → 验证 facts 文件生成
  → 执行 harness inspect --json → 验证 stdout JSON
  → 执行 harness inspect --dry-run → 验证无文件写入

[2. sync 验收]
  → 执行 harness sync --check → 验证 drift 状态
  → 执行 harness sync --check --json → 验证 stdout JSON

[3. review 验收]
  → 执行 harness review --local → 验证：
    - 退出码 0 或 2601（P0 时）
    - .harness/reports/review/<ts>-<branch>.md 存在
    - .harness/reports/review/<ts>-<branch>.json 存在
    - JSON 报告包含 reviewMode: "heuristic"
    - 报告内容为简体中文
  → 执行 harness review --local --dry-run → 验证无文件写入

[4. status 验收]
  → 执行 harness status → 验证输出含能力状态
  → 执行 harness status --json → 验证 capabilities 节点

[5. doctor 验收]
  → 执行 harness doctor → 验证诊断输出
  → 执行 harness doctor --json → 验证 environment/workspace 节点

[6. adapter 验收]
  → 执行 harness config --repair-adapters → 验证投影文件生成
  → 验证 .claude/skills/harness/SKILL.md 存在
  → 验证 frontmatter 完整
```

### 6.2 验收通过条件

```
全部 12 条验收命令：
  ✅ 退出码 0（或明确文档化的非 0 如 review P0）
  ✅ --dry-run 命令零文件写入
  ✅ --json 命令 stdout 为合法 JSON
  ✅ review 双报告文件存在且中文
```

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

无。

### 7.2 第三方 API / SDK

| 名称 | 版本 | 用途 | 鉴权方式 | 备注 |
|------|------|------|---------|------|
| vitest | ^2.0.0 | M1 验收测试 | N/A | 用 vitest 框架组织验收用例 |

### 7.3 中间件 & 基础设施

无。

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| `src/cli/main.ts` | `main(argv, env, io)` | 命令参数 | exitCode | 已有 |
| `src/capabilities/inspect/command.ts` | `runInspectCommand(ctx)` | CommandContext | CliResponse | 已有 |
| `src/capabilities/sync/command.ts` | `runSyncCommand(ctx)` | CommandContext | CliResponse | 已有 |
| `src/capabilities/review/command.ts` | `runReviewCommand(ctx)` | CommandContext | CliResponse | 已有 |
| `src/commands/status.ts` | `runStatusCommand(ctx)` | CommandContext | CliResponse | 已有 |
| `src/commands/doctor.ts` | `runDoctorCommand(ctx)` | CommandContext | CliResponse | 已有 |
| `src/commands/config.ts` | `runConfigCommand(ctx)` | CommandContext | CliResponse | 已有 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| Node.js >= 20.0.0 | 运行时 | 系统环境 |
| Git >= 2.30.0 | review diff 需要 | 系统环境 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| 命令执行失败 | handler 抛异常 | 记录退出码和错误 | 验收测试失败 |
| 产物缺失 | 命令声称成功但文件不存在 | 标记为 M1 验收失败 | FAIL 日志 |
| 性能超时 | 命令执行超时 | 记录耗时 | WARN 日志 |
| dry-run 写入 | 干运行模式下写入文件 | 标记为 M1 验收失败 | FAIL 日志 |

### 8.2 重试与降级

- 验收命令不重试（确定性测试）
- non-Git 环境下 review --local 降级为全量扫描

---

## 9. 局部配置

N/A — 无新增配置项。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：6 个修改文件 + 1 个 fixture 目录
> - [x] **现有约束已识别**：reviewMode 缺失、status 扩展
> - [x] **字段完整性**：6 输入 → 6 输出，无丢弃
> - [x] **边界遵守**：仅 M1 验收命令，不涉及深度能力实现
> - [x] **全局遵守**：验收命令使用现有 CLI 入口
> - [x] 前端设计已完成：N/A
> - [x] 后端接口已完成：12 条验收命令 + status 扩展设计
> - [x] 数据模型已完成：M1Status 枚举 + fixture 结构
> - [x] **外部依赖已明确**：vitest + Git
> - [x] **环境权限已确认**：Node.js >= 20, Git >= 2.30
> - [x] 异常处理策略已定义：4 类异常 + 降级方案
> - [x] 包含足够的局部细节支持任务拆解：6 步验收流程 + 12 条命令清单