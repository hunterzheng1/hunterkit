# spec.md - 能力规格定义（增量）

> **定位**：`harness-develop` 的实施偏移修复规格
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

无。

### 修改需求

#### 需求项：多阶段支持（propose/spec/design/tasks/check/apply/archive）

系统必须实现 `harness develop <change>` 的完整多阶段支持（含 `--propose` 参数），而非仅 propose 阶段的 stub 实现。

##### 场景：spec 阶段
- **当** 用户执行 `harness develop add-review-workflow --spec`
- **预期** 系统必须只处理 spec 阶段，生成 `.harness/develop/changes/add-review-workflow/specs/<capability>/spec.md`，并在完成后停止

##### 场景：design 阶段
- **当** 用户执行 `harness develop add-review-workflow --design`
- **预期** 系统必须读取 repo facts 和 spec，生成 `.harness/develop/changes/add-review-workflow/specs/<capability>/design.md`

##### 场景：tasks 阶段
- **当** 用户执行 `harness develop add-review-workflow --tasks`
- **预期** 系统必须根据 design 生成任务 DAG，写入 `.harness/develop/changes/add-review-workflow/specs/<capability>/tasks.md`

##### 场景：check 阶段
- **当** 用户执行 `harness develop add-review-workflow --check`
- **预期** 系统必须只读取 proposal/spec/design/tasks 并输出一致性检查结果，禁止修改代码或文档

##### 场景：apply 阶段
- **当** 用户执行 `harness develop add-review-workflow --apply`
- **预期** 系统必须按任务 DAG 执行实现，且必须先通过 check

##### 场景：archive 阶段
- **当** 用户执行 `harness develop add-review-workflow --archive`
- **预期** 系统必须归档完成的变更到 `.harness/develop/archive/`，并保留最终摘要

#### 需求项：默认自动阶段检测

系统必须在无阶段参数时自动检测已有阶段并进入下一阶段。

##### 场景：自动进入下一阶段
- **当** 用户执行 `harness develop add-review-workflow`（无阶段参数）
- **预期** 系统必须检测该 change 已有阶段文件，并向用户呈现下一步建议；缺 proposal 时必须先进入 propose，缺 spec 时必须进入 spec

##### 场景：询问下一步
- **当** 多个阶段可选
- **预期** 系统必须询问用户选择下一阶段，而非自动执行

#### 需求项：`--capability` 限定单能力域

系统必须实现 `--capability` 参数，支持限定单个能力域。

##### 场景：限定能力域
- **当** 用户执行 `harness develop add-review-workflow --spec --capability harness-review`
- **预期** 系统必须只处理 `harness-review` 能力域的 spec 阶段

##### 场景：能力域不存在
- **当** 用户执行 `harness develop add-review-workflow --capability nonexistent`
- **预期** 系统必须返回错误码 2503 并提示能力域不在 proposal 能力列表

#### 需求项：`--no-parallel` 强制串行

系统必须实现 `--no-parallel` 参数，支持强制串行处理。

##### 场景：强制串行
- **当** 用户执行 `harness develop add-review-workflow --design --no-parallel`
- **预期** 系统必须串行处理所有能力域的 design 阶段，即使 `--parallel` 可用

#### 需求项：canonical storage 路径

系统必须把新建变更默认写入 `.harness/develop/changes/<change>/`。

##### 场景：新建 change
- **当** 目标项目未存在同名 change
- **预期** 系统必须创建 `.harness/develop/changes/<change>/proposal.md` 和 `.harness/develop/changes/<change>/specs/**` 等文档结构

##### 场景：阶段文件路径
- **当** 生成 spec/design/tasks
- **预期** 系统必须写入 `.harness/develop/changes/<change>/specs/<capability>/spec.md`、`design.md`、`tasks.md`

#### 需求项：兼容读取旧 `openspec/changes/**`

系统必须兼容读取旧 `openspec/changes/**` 文档结构。

##### 场景：兼容旧 OpenSpec
- **当** 项目存在 `openspec/changes/<change>/proposal.md`
- **预期** 系统必须读取旧 OpenSpec 文档作为兼容来源，并在报告中标记 canonical storage 与 legacy source

#### 需求项：design 阶段读取 repo facts

系统必须在 design 阶段读取 repo facts。

##### 场景：design 读取 facts
- **当** 执行 `harness develop <change> --design`
- **预期** 系统必须读取 `.harness/facts/repo-map.json` 并用于 design 生成

#### 需求项：apply 阶段按任务 DAG 并行执行

系统必须在 apply 阶段按任务 DAG 并行执行无依赖任务。

##### 场景：并行执行无依赖任务
- **当** 执行 `harness develop <change> --apply --parallel`
- **预期** 系统必须识别任务 DAG 中的无依赖任务组，并行执行；共享文件修改必须串行

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
| --no-parallel | boolean | 否 | 强制串行 | `true` | 与 `--parallel` 互斥 |
| --dry-run | boolean | 否 | 只输出计划 | `true` | 写入文件数量必须为 0 |

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
| 阶段状态检测 | < 1000 毫秒 (P95) | 单个 change 文档数 < 100 |
| check 执行时间 | < 10000 毫秒 (P95) | 能力域数量 < 20 |
| 单 capability 文档写入 | < 1000 毫秒 (P95) | 文档 < 1 MB |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 512 MB | 多 capability check |
| 存储 | < 100 MB/change | proposal/spec/design/tasks/report 总量 |

### 3.3 超时配置
- 总超时：300000 毫秒，apply 阶段可由任务单独设置更长超时

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/develop/command.ts`：实现 propose/spec/design/tasks/check/apply/archive 多阶段（含 `--propose` 参数）；实现默认自动阶段检测；实现 `--capability`、`--no-parallel` 参数；阶段文件写入 `.harness/develop/changes/` canonical storage；兼容读取旧 `openspec/changes/**`；design 阶段读取 repo facts；apply 阶段按任务 DAG 并行执行无依赖任务，共享文件修改必须串行
- [ ] `src/core/paths.ts`：确保 develop canonical storage 路径正确定义
- [ ] `src/core/legacy-sources.ts`：兼容读取旧目录（`openspec/changes/**`）逻辑

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | CLI 阶段编排 | 阻断 |
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
- 敏感字段：develop 文档不得包含明文密钥或外部知识库连接信息

### 5.3 审计要求
- 日志记录：change、stage、capability、artifacts、check result

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
> - [x] 每个需求项至少有一个场景（8 个需求项，15 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
