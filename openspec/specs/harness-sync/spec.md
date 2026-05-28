# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：文档同步范围

系统必须通过 `harness sync` 同步 README、AGENTS、CLAUDE、Copilot instructions 等项目文档，并默认只更新 Harness managed block 或用户确认区域。

##### 场景：同步默认文档
- **当** 用户执行 `harness sync`
- **预期** 系统必须读取 repo facts、rules 和配置，生成或更新配置中声明的 managed 文档，并保留非托管用户内容

##### 场景：限定同步文档
- **当** 用户执行 `harness sync --docs readme,agents --dry-run`
- **预期** 系统必须只计算 README 与 AGENTS 的同步计划，且写入文件数量必须为 0

#### 需求项：漂移检查与报告

系统必须支持 `--check`、`--fast`、`--dry-run`，并为每次同步或检查生成结构化报告。

##### 场景：CI 漂移检查
- **当** 用户执行 `harness sync --check --json`
- **预期** 系统必须检查目标文档是否与当前 facts/rules 一致，并在存在漂移时返回非 0 退出码和漂移文件列表

##### 场景：快速检查升级
- **当** `--fast` 检测到高风险变更，例如 package、构建、CI、agent 规则或 SDD 文档变更
- **预期** 系统必须自动升级为完整检查，并在报告中记录升级原因

#### 需求项：未确认事实标注

系统必须将无法从仓库事实中确定的内容标记为 `REVIEW_REQUIRED`，并禁止把推测内容写成已确认事实。

##### 场景：扫描结果不完整
- **当** inspect facts 中存在 `reviewRequired` 项
- **预期** sync 输出必须在文档或报告中标注 `REVIEW_REQUIRED`，并说明需要用户确认的字段

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness sync`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --check | boolean | 否 | 只检查漂移 | `true` | 为 `true` 时写入文件数量必须为 0 |
| --fast | boolean | 否 | 使用 git facts 快速判断范围 | `true` | 高风险变更必须升级为完整检查 |
| --docs | string[] | 否 | 限定文档集合 | `readme,agents,claude` | 枚举：`readme`、`agents`、`claude`、`copilot` |
| --dry-run | boolean | 否 | 展示将修改内容 | `true` | 为 `true` 时写入文件数量必须为 0 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 响应结构

**成功响应 (0)**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "mode": "check",
    "drift": false,
    "documents": [
      {
        "path": "AGENTS.md",
        "status": "up-to-date"
      }
    ],
    "reportPath": ".harness/reports/sync/20260528-sync.md"
  }
}
```

**错误响应**
```json
{
  "code": 2401,
  "msg": "documentation drift detected",
  "data": {
    "documents": ["AGENTS.md"],
    "reportPath": ".harness/reports/sync/20260528-sync.md"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2401 | 文档漂移 | `--check` 发现目标文档需要更新 |
| 2402 | 文档选择无效 | `--docs` 包含未知文档类型 |
| 2403 | 保护内容冲突 | 写入会覆盖非托管用户内容 |
| 2404 | facts 缺失 | `.harness/facts/repo-map.json` 不存在且无法自动生成 |
| 5401 | 报告写入失败 | sync 报告无法写入 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| fast 检查时间 | < 3000 毫秒 (P95) | Git 变更文件数小于 200 |
| 完整同步计划时间 | < 8000 毫秒 (P95) | managed 文档数小于 10 |
| 单文档写入时间 | < 1000 毫秒 (P95) | 文档小于 1 MB |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 256 MB | 文档总量小于 10 MB |
| CPU | 平均 < 70% | 5 秒窗口内 |
| 存储 | < 20 MB/次 | 单次 sync 报告和备份总量 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地同步不建立网络连接
- 读取超时：30000 毫秒
- 总超时：120000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-inspect`：读取 repo facts、module map、rules
- [ ] `harness-workspace-config`：读取 managed 文档和 generated block 配置
- [ ] `harness-adapter-skill-runtime`：同步 CLAUDE/Codex 等 adapter 指针
- [ ] `harness-safety-orchestration`：保护用户内容和 transaction 写入

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 文档读写和 diff 生成 | 阻断 sync |
| 版本控制 | Git | >= 2.30.0 | `--fast` 影响范围判断 | 自动降级为完整检查 |
| 文档格式 | CommonMark Markdown | 0.30 | README/AGENTS/CLAUDE 解析 | 使用纯文本 block 替换 |
| 数据格式 | JSON | ECMA-404 | sync 报告 JSON | 阻断 JSON 报告写入 |

### 4.3 数据存储
- [ ] Markdown 文档：`README.md`、`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`
- [ ] Markdown 报告：`.harness/reports/sync/<timestamp>-sync.md`
- [ ] JSON 报告：`.harness/reports/sync/<timestamp>-sync.json`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：仅写配置中声明的 managed 文档和 generated block

### 5.2 数据安全
- 敏感字段：secretPatterns 命中的文件、token、key、本地配置
- 加密要求：sync 不得把敏感文件内容写入 README、AGENTS、CLAUDE 或报告

### 5.3 审计要求
- 日志记录：文档列表、漂移状态、写入路径、报告路径
- 操作追踪：每个 generated block 必须记录来源 facts 版本或 generatedAt

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：managed block 前后标记必须稳定；新增文档类型不得改变既有 `--docs` 语义

### 6.2 数据兼容性
- 数据迁移方案：已有 `.docsync/` 规则只作为输入，默认不迁移目录
- 回滚策略：写入文档必须通过 transaction 和 backup 回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
