# 局部技术实现方案 - harness-develop（增量）

> **⚠️ 边界声明**：本设计仅服务于 `harness-develop` 状态呈现修正，确保未实现阶段明确标注 `not_implemented` 而非静默成功。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | 未实现阶段 data.status | data.status | string("not_implemented"\|"completed") | ✅ 保留 | 每个阶段返回正确状态 |
| 2 | apply 阶段错误 2505 | error.code | number | ✅ 保留 | 未通过 check 阻断 |
| 3 | legacy/mixed 迁移建议 | response.warnings[] | string[] | ✅ 保留 | 兼容模式提示 |
| 4 | status 展示阶段矩阵 | capabilities.develop.stages | object | ✅ 保留 | status 命令扩展 |

### 1.2 完整性自检

- **用户输入字段总数**：4 个
- **设计输出字段总数**：4 个
- **差异说明**：无差异
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/develop/command.ts` | - | `runDevelopCommand()` | 替换实现 | 未实现阶段返回明确状态 |
| `src/capabilities/develop/types.ts` | - | `DevelopStage` | 扩展逻辑 | 增加阶段状态枚举 |
| `src/commands/status.ts` | - | `runStatusCommand()` | 扩展逻辑 | 展示 develop 阶段矩阵 |

### 2.2 M1 阶段状态矩阵

| 阶段 | M1 状态 | 响应 code | data.status | warning |
|------|--------|----------|-------------|---------|
| propose | ✅ 已实现 | 0 | `completed` | — |
| spec | ❌ 未实现 | 0 | `not_implemented` | "Spec stage not yet implemented" |
| design | ❌ 未实现 | 0 | `not_implemented` | "Design stage not yet implemented" |
| tasks | ❌ 未实现 | 0 | `not_implemented` | "Tasks stage not yet implemented" |
| check | ❌ 未实现 | 0 | `not_implemented` | "Check stage not yet implemented" |
| apply | ❌ 未实现 | 2505 | `not_implemented` | "check 尚未实现，apply 不可用" |
| archive | ❌ 未实现 | 0 | `not_implemented` | "Archive stage not yet implemented" |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 未实现阶段返回 code 0 + 简单 warning | "not yet implemented" warning | 用户无法区分已完成/未完成 | 增加 data.status + 精确化 warning 文本 |
| apply 阶段应阻断 | 当前仅 warning，非错误 | 用户可能误以为已执行 | 改为返回 2505 |

---

## 3. 局部前端设计

N/A。

---

## 4. 局部后端接口设计

### 4.1 develop 阶段响应标准化

```typescript
// src/capabilities/develop/command.ts — 未实现阶段通用响应

function notImplementedStage(change: string, stage: DevelopStage): CliResponse {
  const applyBlocked = stage === 'apply';
  return {
    code: applyBlocked ? 2505 : 0,
    msg: applyBlocked
      ? `apply 阶段必须先通过 check — check 尚未实现，apply 不可用`
      : 'success',
    data: {
      command: 'develop',
      change,
      stage,
      status: 'not_implemented',
    },
    warnings: [
      `${stage.charAt(0).toUpperCase() + stage.slice(1)} stage not yet implemented. 后续版本支持`,
    ],
  };
}
```

### 4.2 runDevelopCommand 修改

```typescript
// 每个未实现阶段的 case 改为调用 notImplementedStage

case 'spec':
  // 检查 proposal 是否存在
  if (!existsSync(join(...))) {
    return { code: 2502, msg: 'Proposal not found...', ... };
  }
  return notImplementedStage(change, 'spec');  // ← 替换 TODO + warning

case 'apply':
  return notImplementedStage(change, 'apply');  // ← 替换 TODO + warning（返回 2505）
```

### 4.3 status 命令扩展

```typescript
// src/commands/status.ts — develop 能力状态

function getDevelopStatus(): object {
  return {
    status: 'partial',
    stages: {
      propose: 'available',
      spec: 'next_version',
      design: 'next_version',
      tasks: 'next_version',
      check: 'next_version',
      apply: 'next_version',
      archive: 'next_version',
    },
  };
}
```

---

## 5. 局部数据模型

### 5.1 阶段状态类型

```typescript
// src/capabilities/develop/types.ts
type StageStatus = 'completed' | 'not_implemented' | 'in_progress';
```

---

## 6. 模块内部逻辑

### 6.1 核心流程 — develop 状态修正

```
runDevelopCommand(context)
  ├─ parseDevelopArgs(args)
  ├─ resolveStorage(cwd, change)
  ├─ stage = options.stage || detectStage(storage)
  │
  ├─ switch (stage)
  │   ├─ 'propose' → 模板生成 → { status: "completed" }
  │   ├─ 'spec'     → notImplementedStage(change, 'spec')      // code 0
  │   ├─ 'design'   → notImplementedStage(change, 'design')    // code 0
  │   ├─ 'tasks'    → notImplementedStage(change, 'tasks')     // code 0
  │   ├─ 'check'    → notImplementedStage(change, 'check')     // code 0
  │   ├─ 'apply'    → notImplementedStage(change, 'apply')     // code 2505
  │   └─ 'archive'  → notImplementedStage(change, 'archive')   // code 0
  │
  └─ [新增] legacy/mixed 检测 → warning 迁移建议
```

### 6.2 修改点汇总

| 序号 | 文件 | 修改 | 代码量估算 |
|-----|------|------|-----------|
| 1 | `src/capabilities/develop/command.ts` | 替换 6 个未实现阶段的 TODO | ~30 行 |
| 2 | `src/capabilities/develop/types.ts` | 新增 StageStatus 类型 | ~3 行 |
| 3 | `src/commands/status.ts` | 新增 develop 阶段矩阵输出 | ~15 行 |

---

## 7. 外部依赖与集成

无新增外部依赖。

---

## 8. 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| apply 未实现 | 用户执行 --apply | 返回 2505 错误 + "check 尚未实现" |
| 阶段参数冲突 | 多个 stage flag | 返回 2501 错误（已有逻辑，不变） |

---

## 9. 局部配置

无新增配置。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：3 个文件 + 3 个修改点
> - [x] **现有约束已识别**：M1 阶段状态矩阵
> - [x] **字段完整性**：4 输入 → 4 输出
> - [x] **边界遵守**：仅修正状态，不实现未完成阶段
> - [x] 包含足够的局部细节支持任务拆解：核心流程 + 3 个修改点