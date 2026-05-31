# spec.md - 能力规格定义（增量）

> **定位**：`harness-review` — M1 review 验收边界修正，明确本地报告版必须真实输出 Markdown + JSON
> **增量说明**：本文档为对 `openspec/specs/harness-review/spec.md` 的增量修改
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：M1 review 完成定义声明

系统必须在 review 命令和文档中明确标注 M1 阶段的完成边界，避免用户误以为所有 spec 需求已完整实现。

##### 场景：M1 已实现功能
- **当** 用户执行 `harness review --local`
- **预期** 系统必须真实执行：范围参数解析（--local/--staged/--scan）、审查文件扫描（本地启发式）、finding 生成（regex 模式匹配）、严重度分级（P0/P1/P2）、置信度过滤（< 80 丢弃）、去重、Markdown + JSON 双报告写入、dry-run 零写入

##### 场景：M1 受限功能
- **当** 用户执行 `harness review --full` 或 `harness review --lite`
- **预期** 系统必须执行参数解析和 reviewer 选择（lite: 2 个 reviewer，full: 6 个），但 reviewer 实际执行仍为本地启发式扫描（非真实多 agent 并行），必须在响应 `warnings` 中标注"本地启发式扫描模式，多 agent 并行审查后续版本"

##### 场景：M1 未实现功能
- **当** 用户执行 `harness review --comment`
- **预期** 系统必须返回错误码 2606 并提示"远程评论功能后续版本支持"，不得静默跳过或返回假成功

#### 需求项：review 输出中标注问题来源

系统必须在 review 输出中标注每条 finding 的审查来源，区分本地启发式扫描和未来多 agent 审查。

##### 场景：finding 来源标注
- **当** review 生成 finding
- **预期** 每条 finding 必须包含 `source` 字段，值为 `heuristic`（本地启发式）或 `agent:<name>`（未来 agent 审查），M1 阶段所有 finding 的 `source` 必须为 `heuristic`

##### 场景：JSON 报告 schema 版本
- **当** 生成 JSON 报告
- **预期** 报告 `schemaVersion` 必须为 1，`reviewMode` 字段必须为 `heuristic`（M1 阶段）

### 修改需求

#### 需求项：6 个并行 review agent + N 个 finding validator

编排器本身不做实质审查，系统必须实现 6 个并行 review agent 和 N 个 finding validator。review agent 必须读完整相关源码而非仅看 diff。

**增量修改**：将完整实现从 M1 降级为后续版本，M1 阶段保留本地启发式扫描。

##### 场景：M1 并行审查（修改）
- **当** 审查范围超过 3 个文件或用户传入 `--full`
- **预期** M1 阶段系统必须选择全部 6 个 reviewer 类型，但每个 reviewer 的内部实现为本地启发式扫描；必须在 `warnings` 中标注"本地启发式扫描模式，多 agent 并行审查后续版本"

##### 场景：finding validator（修改）
- **当** reviewer 生成候选 finding
- **预期** M1 阶段系统必须执行置信度过滤（< 80 丢弃）和去重，但无需独立的 validator agent 复核；必须在 `warnings` 中标注"validator 独立复核后续版本"

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 M1 完成边界矩阵

| 功能 | M1 状态 | 实现方式 | 输出 |
|------|--------|---------|------|
| --local/--staged/--scan 范围 | ✅ 已实现 | Git diff + 文件扫描 | 文件列表 + scope |
| --full/--lite reviewer 选择 | ✅ 已实现 | 参数解析 | 2 或 6 reviewer |
| --fix/--no-fix | ⚠️ 受限 | --no-fix 默认，--fix 仅本地机械修复 | 修复建议 |
| --comment 远程评论 | ❌ 未实现 | 返回 2606 | 错误提示 |
| P0/P1/P2 严重度 | ✅ 已实现 | 规则分类 | 分级 finding |
| 置信度过滤 + 去重 | ✅ 已实现 | confidence < 80 丢弃 | 过滤统计 |
| MD + JSON 双报告 | ✅ 已实现 | 文件写入 | `<ts>-<branch>.md/.json` |
| 6 agent 并行审查 | ❌ 后续版本 | 本地启发式扫描 | 假 agent 实现 |
| validator 独立复核 | ❌ 后续版本 | 置信度过滤替代 | 假 validator |
| 交互式范围选择 | ✅ 已实现 | 无参数时菜单 | 范围选择 |

### 2.2 新增 JSON 报告字段

```json
{
  "schemaVersion": 1,
  "reviewMode": "heuristic",
  "scope": "local",
  "findings": [
    {
      "severity": "P0",
      "file": "src/main.ts",
      "line": 42,
      "category": "security",
      "message": "可能的硬编码密钥",
      "suggestion": "使用环境变量",
      "source": "heuristic",
      "confidence": 95
    }
  ],
  "summary": { "p0": 1, "p1": 0, "p2": 3, "discarded": 2 },
  "reports": { "markdown": "...", "json": "..." },
  "warnings": ["本地启发式扫描模式，多 agent 并行审查后续版本"]
}
```

---

## 3. 物理约束

在原 spec 基础上无变更。M1 阶段本地启发式扫描性能约束不变。

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/review/command.ts`：在 `data` 响应中增加 `reviewMode: "heuristic"` 字段；在 warnings 中添加 M1 受限标注；`--comment` 返回 2606
- [ ] `src/capabilities/review/types.ts`：ReviewFinding 增加 `source` 字段

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（2 新增 + 1 修改 = 3 个需求项，7 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息