# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：审查范围解析

系统必须通过 `harness review` 支持本地分支、暂存区、指定目录、全量扫描和远程 PR/MR 场景的范围解析。

##### 场景：本地分支审查
- **当** 用户执行 `harness review --local --no-fix --json`
- **预期** 系统必须解析当前分支相对主分支的变更范围，并输出审查文件列表、基准引用和 head 引用

##### 场景：暂存区审查
- **当** 用户执行 `harness review --staged`
- **预期** 系统必须只审查 Git 暂存区文件，并在报告中标记 scope 为 `staged`

##### 场景：目录扫描审查
- **当** 用户执行 `harness review --scan src/payment`
- **预期** 系统必须扫描指定目录相关源码和必要上下文，并禁止越界读取项目根目录外路径

#### 需求项：多 agent 审查与 finding 验证

系统必须按规则审查、浅层 bug、深层 bug、历史回归、团队标准、契约一致性等维度并行审查，并对每条 finding 进行 validator 复核。

##### 场景：标准审查流程
- **当** 审查范围超过 3 个文件或用户传入 `--full`
- **预期** 系统必须并行启动多个 reviewer，并对候选 finding 进行 validator 复核、置信度过滤和去重

##### 场景：低置信 finding
- **当** finding confidence 小于 80 或 validator 拒绝
- **预期** 系统必须丢弃该 finding，并在 JSON 报告中记录过滤统计

#### 需求项：报告与修复策略

系统必须输出 Markdown + JSON 双报告，并根据 `--fix`、`--no-fix` 控制是否允许自动修复机械性问题。

##### 场景：只报告不修复
- **当** 用户执行 `harness review --no-fix`
- **预期** 系统必须只写报告，禁止修改源码或文档

##### 场景：允许自动修复
- **当** 用户执行 `harness review --fix`
- **预期** 系统必须只修复低风险机械性问题，并在报告中列出每个修复文件、修复原因和验证状态

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness review`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --local | boolean | 否 | 当前分支 vs 主分支 | `true` | 与 `--staged`、`--scan` 互斥 |
| --staged | boolean | 否 | 仅暂存区 | `true` | 与 `--local`、`--scan` 互斥 |
| --scan | path | 否 | 全量扫描目录 | `src/payment` | 必须位于项目根目录内 |
| --fix | boolean | 否 | 允许自动修复 | `true` | 与 `--no-fix` 互斥 |
| --no-fix | boolean | 否 | 只报告不修复 | `true` | 默认 `true` |
| --full | boolean | 否 | 跑满所有 reviewer | `true` | 会增加执行时间 |
| --lite | boolean | 否 | 轻量审查 | `true` | 与 `--full` 互斥 |
| --comment | boolean | 否 | 远程 PR/MR 发表评论 | `true` | 需要远程上下文配置 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 响应结构

**成功响应 (0)**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "scope": "local",
    "findings": [],
    "summary": {
      "p0": 0,
      "p1": 0,
      "p2": 0,
      "discarded": 3
    },
    "reports": {
      "markdown": ".harness/reports/review/20260528-branch.md",
      "json": ".harness/reports/review/20260528-branch.json"
    }
  }
}
```

**错误响应**
```json
{
  "code": 2601,
  "msg": "review found blocking issues",
  "data": {
    "p0": 1,
    "reportPath": ".harness/reports/review/20260528-branch.md"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2601 | 存在阻断问题 | P0 finding 数量大于 0 |
| 2602 | 范围参数冲突 | `--local`、`--staged`、`--scan` 同时出现 |
| 2603 | 审查路径越界 | `--scan` 指向项目根目录外 |
| 2604 | validator 失败 | finding 验证流程未完成 |
| 2605 | 报告写入失败 | Markdown 或 JSON 报告无法写入 |
| 5601 | reviewer 执行失败 | reviewer agent 或本地审查器异常 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| lite 审查时间 | < 60000 毫秒 (P95) | 文件数小于 20 |
| full 审查时间 | < 300000 毫秒 (P95) | 文件数小于 100 |
| finding validator 时间 | < 30000 毫秒/条 | 单条 finding 复核 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 1024 MB | 多 reviewer 并行 |
| CPU | 平均 < 90% | reviewer 并行期间 |
| 存储 | < 100 MB/次 | Markdown、JSON、临时上下文和修复摘要 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地 review 默认不建立网络连接
- 读取超时：60000 毫秒
- 总超时：600000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-inspect`：读取 module map 和 rules
- [ ] `harness-develop`：读取 spec/design/tasks 做契约一致性审查
- [ ] `harness-safety-orchestration`：执行 reviewer 并行、validator 和 fix 边界
- [ ] `harness-workspace-config`：写入 `.harness/reports/review/**`

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | review CLI 和报告生成 | 阻断 review |
| 版本控制 | Git | >= 2.30.0 | diff、staged、branch 范围解析 | 仅允许 `--scan` |
| 数据格式 | JSON | ECMA-404 | review 机器报告 | 仅输出 Markdown 时返回警告 |
| Agent 协议 | Harness reviewer contract | v1 | reviewer/validator 输出结构 | 降级为单进程 lite 审查 |

### 4.3 数据存储
- [ ] Markdown 报告：`.harness/reports/review/<timestamp>-<branch>.md`
- [ ] JSON 报告：`.harness/reports/review/<timestamp>-<branch>.json`
- [ ] 临时上下文：`.harness/cache/review/**`，命令结束后必须清理或标记可忽略

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地 Git 和文件系统权限；远程评论需要用户已配置的远程凭据
- 授权范围：`--no-fix` 禁止写源码；`--fix` 仅允许写审查范围内低风险机械修复

### 5.2 数据安全
- 敏感字段：secretPatterns 命中文件、review 上下文中的 token/key
- 加密要求：报告不得包含敏感文件内容；远程评论必须过滤本地绝对私密路径

### 5.3 审计要求
- 日志记录：scope、reviewer 列表、validator 结果、finding 统计、报告路径
- 操作追踪：`--fix` 必须记录每个修改文件、对应 finding、修复摘要和验证状态

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：review JSON 报告必须包含 schemaVersion；新增 finding 字段必须向后兼容

### 6.2 数据兼容性
- 数据迁移方案：旧 `.kld-review/` 报告可作为 knowledge 输入，新报告默认写入 `.harness/reports/review/`
- 回滚策略：`--fix` 修改必须通过 transaction，失败时回滚本次修复

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
