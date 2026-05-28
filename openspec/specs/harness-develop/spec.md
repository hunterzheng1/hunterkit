# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：规格驱动阶段管理

系统必须通过 `harness develop <change>` 统一管理 propose、spec、design、tasks、check、apply、archive 阶段，并根据已有文档判断下一步。

##### 场景：自动进入下一阶段
- **当** 用户执行 `harness develop add-review-workflow`
- **预期** 系统必须检测该 change 已有阶段文件，并向用户呈现下一步建议；缺 proposal 时必须先进入 propose，缺 spec 时必须进入 spec

##### 场景：指定单阶段
- **当** 用户执行 `harness develop add-review-workflow --spec`
- **预期** 系统必须只处理 spec 阶段，并在完成后停止，禁止自动进入 design 或 tasks

#### 需求项：Harness canonical storage

系统必须把新建变更默认写入 `.harness/develop/changes/<change>/`，并兼容读取旧 `openspec/changes/**`。

##### 场景：新建 change
- **当** 目标项目未存在同名 change
- **预期** 系统必须创建 `.harness/develop/changes/<change>/proposal.md` 和 `.harness/develop/changes/<change>/specs/**` 等文档结构

##### 场景：兼容旧 OpenSpec
- **当** 项目存在 `openspec/changes/<change>/proposal.md`
- **预期** 系统必须读取旧 OpenSpec 文档作为兼容来源，并在报告中标记 canonical storage 与 legacy source

#### 需求项：TDD 任务策略传递

系统必须读取 proposal frontmatter 中的 `test-strategy`，并在 tasks 阶段生成与该策略一致的任务 DAG。

##### 场景：TDD 策略
- **当** proposal frontmatter 为 `test-strategy: "tdd"`
- **预期** tasks 阶段必须生成测试骨架、实现代码、测试验证的依赖顺序，且实现任务必须依赖对应测试任务

##### 场景：只读检查
- **当** 用户执行 `harness develop <change> --check`
- **预期** 系统必须只读取 proposal/spec/design/tasks 并输出一致性检查结果，禁止修改代码或文档

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness develop <change>`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| change | string | 是 | 变更名称 | `add-review-workflow` | kebab-case，长度 3-80 |
| --propose | boolean | 否 | 只处理 proposal 阶段 | `true` | 与其他阶段参数互斥 |
| --spec | boolean | 否 | 只处理 spec 阶段 | `true` | 与其他阶段参数互斥 |
| --design | boolean | 否 | 只处理 design 阶段 | `true` | 与其他阶段参数互斥 |
| --tasks | boolean | 否 | 只处理 tasks 阶段 | `true` | 与其他阶段参数互斥 |
| --check | boolean | 否 | 只执行一致性检查 | `true` | 禁止写文件 |
| --apply | boolean | 否 | 执行实现任务 | `true` | 必须先通过 check |
| --archive | boolean | 否 | 归档变更 | `true` | 必须有完成状态 |
| --from | path | 否 | 从需求文档生成 | `requirements/demo.md` | 必须位于项目根目录内 |
| --capability | string | 否 | 限定能力域 | `harness-review` | 必须存在于 proposal 能力列表 |
| --parallel | boolean | 否 | 对独立能力并行处理 | `true` | 共享文件必须串行 |
| --dry-run | boolean | 否 | 只输出计划 | `true` | 写入文件数量必须为 0 |

#### 响应结构

**成功响应 (0)**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "change": "add-review-workflow",
    "stage": "spec",
    "mode": "full",
    "testStrategy": "tdd",
    "artifacts": [
      ".harness/develop/changes/add-review-workflow/specs/harness-review/spec.md"
    ]
  }
}
```

**错误响应**
```json
{
  "code": 2502,
  "msg": "missing proposal",
  "data": {
    "change": "add-review-workflow"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2501 | change 名称无效 | 非 kebab-case 或长度超限 |
| 2502 | proposal 缺失 | spec/design/tasks 阶段缺少 proposal |
| 2503 | capability 不存在 | `--capability` 不在 proposal 能力列表 |
| 2504 | 阶段依赖缺失 | design/tasks/apply 缺少上游文档 |
| 2505 | check 未通过 | 一致性检查存在阻断问题 |
| 5501 | develop 执行失败 | 阶段处理出现未分类异常 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| 阶段状态检测 | < 1000 毫秒 (P95) | 单个 change 文档数小于 100 |
| check 执行时间 | < 10000 毫秒 (P95) | 能力域数量小于 20 |
| 单 capability 文档写入 | < 1000 毫秒 (P95) | 文档小于 1 MB |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 512 MB | 多 capability check |
| CPU | 平均 < 80% | 10 秒窗口内 |
| 存储 | < 100 MB/change | proposal/spec/design/tasks/report 总量 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地 develop 阶段不建立网络连接
- 读取超时：30000 毫秒
- 总超时：300000 毫秒，apply 阶段可由任务单独设置更长超时

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-workspace-config`：提供 canonical storage、state 和 transaction
- [ ] `harness-inspect`：design 阶段读取 repo facts
- [ ] `harness-safety-orchestration`：控制单阶段边界、并行任务和 apply 安全
- [ ] `harness-review`：完成前审查可读取 develop 文档链

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | CLI 阶段编排 | 阻断 develop |
| 文档契约 | OpenSpec CLI | >= 1.2.0 | 兼容 SDD 文档链 | 使用内置 Markdown 结构校验 |
| 数据格式 | YAML frontmatter | 1.2 | proposal 配置读取 | 缺失时进入澄清流程 |
| 版本控制 | Git | >= 2.30.0 | apply/archive 变更状态检查 | 非 Git 项目跳过分支检查 |

### 4.3 数据存储
- [ ] Markdown 文档：`.harness/develop/changes/<change>/proposal.md`
- [ ] Markdown 文档：`.harness/develop/changes/<change>/specs/<capability>/spec.md`
- [ ] Markdown 文档：`.harness/develop/changes/<change>/specs/<capability>/design.md`
- [ ] Markdown 文档：`.harness/develop/changes/<change>/specs/<capability>/tasks.md`
- [ ] JSON 状态：`.harness/state/active-change.json`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：spec/design/tasks 阶段只能写文档；apply 阶段必须由用户主动触发

### 5.2 数据安全
- 敏感字段：需求上下文中的 secret、token、私钥、本地配置
- 加密要求：develop 文档不得包含明文密钥或外部知识库连接信息

### 5.3 审计要求
- 日志记录：change、stage、capability、artifacts、check result
- 操作追踪：每个阶段必须生成报告或状态记录，archive 必须保留最终摘要

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：旧 `openspec/changes/**` 可读取；新文档默认写入 `.harness/develop/changes/**`

### 6.2 数据兼容性
- 数据迁移方案：显式 `harness config --migrate-sdd --dry-run` 生成迁移计划
- 回滚策略：文档写入必须通过 transaction；archive 必须保留原 change 快照

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
