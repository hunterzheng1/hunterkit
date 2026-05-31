# 局部技术实现方案 - harness-review（增量）

> **⚠️ 边界声明**：本设计仅服务于 `harness-review` M1 验收边界修正，标注已完成/受限/未完成功能，不实现多 agent 并行审查。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | reviewMode 声明 | data.reviewMode | string("heuristic") | ✅ 保留 | 新增字段 |
| 2 | finding source 标注 | ReviewFinding.source | string | ✅ 保留 | 新增字段 |
| 3 | M1 受限功能 warning | response.warnings[] | string[] | ✅ 保留 | 标注多 agent 后续版本 |
| 4 | --comment 未实现 | error code 2606 | number | ✅ 保留 | 明确错误提示 |

### 1.2 完整性自检

- **用户输入字段总数**：4 个
- **设计输出字段总数**：4 个
- **差异说明**：无差异，全为增量补充
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/review/command.ts` | - | `runReviewCommand()` | 扩展逻辑 | 新增 reviewMode + source + warning + --comment 处理 |
| `src/capabilities/review/types.ts` | `ReviewFinding` | `source` 字段 | 新增参数 | 增加 source: "heuristic" 字段 |

### 2.2 M1 完成边界矩阵

| 功能 | M1 状态 | 实现方式 | reviewCommand 行为 |
|------|--------|---------|-------------------|
| --local/--staged/--scan | ✅ 已实现 | Git diff + 文件扫描 | 正常运行 |
| --full/--lite | ⚠️ 参数可用 | 选择 2 或 6 reviewer | 运行 + warning |
| --comment | ❌ 未实现 | 返回 2606 | 错误返回 |
| 6 agent 并行 | ❌ 后续版本 | 本地启发式扫描 | warning 标注 |
| validator 复核 | ❌ 后续版本 | 置信度过滤替代 | warning 标注 |
| MD + JSON 双报告 | ✅ 已实现 | 文件写入 | 正常运行 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| ReviewFinding 无 source 字段 | 当前接口 4 字段 | 需扩展为 5 字段 | 向后兼容，新增可选字段 |
| runReviewers 为模拟实现 | 本地 regex 扫描 | --full 启动 6 reviewer 但实际本地扫描 | 在 warning 中标注 |

---

## 3. 局部前端设计

N/A。

---

## 4. 局部后端接口设计

### 4.1 ReviewFinding 类型扩展

```typescript
// src/capabilities/review/types.ts
export interface ReviewFinding {
  file: string;
  line: number;
  severity: 'P0' | 'P1' | 'P2' | 'info' | 'warning';
  category: string;
  message: string;
  suggestion?: string;
  source: 'heuristic' | `agent:${string}`;  // ← 新增字段
}
```

### 4.2 runReviewCommand 修改

```typescript
// src/capabilities/review/command.ts — runReviewCommand()

// --comment 处理
if (options.comment) {
  return {
    code: 2606,
    msg: '远程评论功能后续版本支持',
    data: { command: 'review' },
    warnings: [],
  };
}

// 所有 finding 设置 source
const findings = classified.map(f => ({
  ...f,
  source: 'heuristic' as const,
}));

// M1 受限功能 warning
const m1Warnings: string[] = [];
if (reviewers.includes('rules-reviewer') || reviewers.includes('deep-bug-analyzer')) {
  m1Warnings.push('本地启发式扫描模式，多 agent 并行审查后续版本支持');
  m1Warnings.push('validator 独立复核后续版本支持');
}

// 响应增加 reviewMode
return {
  code: summary.p0 > 0 ? 2601 : 0,
  msg: summary.p0 > 0 ? `发现 ${summary.p0} 个 P0 阻断问题` : 'success',
  data: {
    command: 'review',
    reviewMode: 'heuristic',  // ← 新增
    scope: scopeName,
    findings,
    summary,
    reports: { ... },
  },
  warnings: [...m1Warnings, ...(dryRun ? ['Dry-run 模式：未写入报告'] : [])],
};
```

---

## 5. 局部数据模型

### 5.1 JSON 报告新结构

```json
{
  "schemaVersion": 1,
  "reviewMode": "heuristic",
  "scope": "local",
  "findings": [
    {
      "severity": "P1",
      "file": "src/main.ts",
      "line": 42,
      "category": "logging",
      "message": "非测试代码中的控制台输出",
      "suggestion": "使用适当的日志记录器",
      "source": "heuristic"
    }
  ],
  "summary": { "p0": 0, "p1": 1, "p2": 3, "discarded": 2 },
  "reports": { "markdown": "...", "json": "..." }
}
```

---

## 6. 模块内部逻辑

### 6.1 核心流程 — M1 review 标注

```
runReviewCommand(context)
  ├─ parseReviewArgs(args)
  ├─ resolveScope(options, cwd)
  ├─ selectReviewers(options, files.length)
  │
  ├─ [新增] --comment 检测 → 返回 2606
  │
  ├─ runReviewers(reviewers, files, cwd)
  │   └─ 所有 finding.source = "heuristic"
  │
  ├─ confidence 过滤 + 去重
  ├─ classifySeverity()
  │
  ├─ [新增] M1 受限 warnings
  │   ├─ 若 reviewers 含 agent 特有 reviewer → "多 agent 并行审查后续版本"
  │   └─ 若有 validator 过滤 → "validator 独立复核后续版本"
  │
  ├─ 写入 MD + JSON 报告（含 reviewMode + source）
  └─ 返回 response
```

### 6.2 修改点汇总

| 序号 | 文件 | 修改 | 代码量估算 |
|-----|------|------|-----------|
| 1 | `src/capabilities/review/types.ts` | ReviewFinding 加 source 字段 | ~3 行 |
| 2 | `src/capabilities/review/command.ts` | reviewMode + source + warning + 2606 | ~25 行 |

---

## 7. 外部依赖与集成

无新增外部依赖。

---

## 8. 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| --comment 未实现 | 用户传入 --comment | 返回 2606 + "远程评论功能后续版本支持" |
| JSON 报告序列化失败 | source 字段不兼容 | 降级移除 source 字段，仍输出 JSON |

---

## 9. 局部配置

无新增配置。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：2 个文件 + 4 个修改点
> - [x] **现有约束已识别**：M1 完成边界矩阵
> - [x] **字段完整性**：4 输入 → 4 输出
> - [x] **边界遵守**：仅标注，不实现多 agent
> - [x] 包含足够的局部细节支持任务拆解：核心流程 + 2 个修改点