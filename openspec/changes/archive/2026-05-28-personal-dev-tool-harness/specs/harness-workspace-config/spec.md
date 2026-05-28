# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：工作区创建与根目录最小化

系统必须将 Harness 自有配置、事实、报告、开发文档、知识库、adapter 源文件默认写入 `.harness/`，并只在项目根目录生成 AI 工具或平台必须识别的轻量投影。

##### 场景：初始化工作区
- **当** 用户完成 Harness 初始化并确认写入
- **预期** 系统必须创建 `.harness/config`、`.harness/state`、`.harness/facts`、`.harness/generated`、`.harness/adapters`、`.harness/reports`、`.harness/cache` 等目录

##### 场景：根目录投影
- **当** 用户选择安装 Claude、Codex、Copilot 或 Cursor 适配
- **预期** 系统必须只在 `.claude/`、`.agents/`、`.codex/`、`.github/` 等固定识别路径写入必要薄投影，并把完整源模板保留在 `.harness/adapters/**`

#### 需求项：配置模型与能力开关

系统必须提供 `.harness/config/harness.config.json` 作为主配置文件，并记录项目类型、AI 工具、能力开关、文档策略、编排策略和安全策略。

##### 场景：读取有效配置
- **当** 命令需要读取 Harness 配置
- **预期** 系统必须校验 `schemaVersion`、`project`、`aiTools`、`capabilities`、`documents`、`orchestration`、`safety` 字段，缺失必填字段时必须失败

##### 场景：本地私有配置
- **当** 存在 `.harness/config/*.local.json`
- **预期** 系统必须允许本地配置覆盖非敏感运行参数，并禁止将 `*.local.json` 写入报告、cache 或发布包

#### 需求项：事务写入与兼容读取

系统必须对所有写文件能力提供 dry-run、transaction、backup 和 rollback，并兼容读取 `.docsync/`、`openspec/changes/**`、`.kld-review/`、`skywalk-sdd/` 等旧来源目录。

##### 场景：事务成功
- **当** 写入命令完成所有文件写入
- **预期** 系统必须记录 transaction id、写入文件列表、摘要和报告路径

##### 场景：事务失败
- **当** 任一写入步骤失败
- **预期** 系统必须回滚本次 transaction 已写入或已修改的文件，并返回失败报告

##### 场景：兼容旧目录
- **当** 项目存在 `.docsync/`、`openspec/changes/**`、`.kld-review/` 或 `skywalk-sdd/`
- **预期** 系统必须将其作为只读兼容来源，除非用户显式执行迁移命令

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness config` / `CLI: harness status` / `CLI: harness doctor`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --cwd | path | 否 | 目标项目根目录 | `E:/repo/demo` | 必须是存在目录 |
| --migrate-docsync | boolean | 否 | 预览或执行 DocSync 迁移 | `true` | 必须配合 `config` 命令 |
| --migrate-sdd | boolean | 否 | 预览或执行旧 SDD 迁移 | `true` | 必须配合 `config` 命令 |
| --migrate-review | boolean | 否 | 预览或执行旧 review 迁移 | `true` | 必须配合 `config` 命令 |
| --dry-run | boolean | 否 | 预览写入和迁移 | `true` | 为 `true` 时写入文件数量必须为 0 |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |

#### 响应结构

**成功响应 (0)**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "workspace": ".harness",
    "schemaVersion": 1,
    "initialized": true,
    "capabilities": {
      "inspect": true,
      "sync": true,
      "develop": true,
      "review": true,
      "knowledge": false
    }
  }
}
```

**错误响应**
```json
{
  "code": 2101,
  "msg": "invalid harness config",
  "data": {
    "path": ".harness/config/harness.config.json",
    "missing": ["schemaVersion"]
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2101 | 配置无效 | 主配置缺少必填字段或类型错误 |
| 2102 | 工作区不完整 | `.harness/` 必要目录缺失 |
| 2103 | 事务失败 | 写入过程中失败且已触发回滚 |
| 2104 | 迁移冲突 | 新旧目录存在同名目标且无法自动合并 |
| 5101 | 回滚失败 | transaction rollback 未能恢复原状态 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| 配置读取时间 | < 200 毫秒 (P95) | 主配置小于 128 KB |
| 工作区初始化时间 | < 3000 毫秒 (P95) | 不含用户交互时间 |
| dry-run 迁移预览时间 | < 5000 毫秒 (P95) | 旧目录文件数小于 1000 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 256 MB | 配置和状态读取 |
| CPU | 平均 < 70% | 5 秒窗口内 |
| 存储 | < 50 MB | 不含 review 报告和 knowledge.sqlite |

### 3.3 超时配置
- 连接超时：0 毫秒，本地文件系统能力不建立网络连接
- 读取超时：30000 毫秒
- 总超时：120000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-cli-entrypoint`：解析 cwd、dry-run、json 等全局参数
- [ ] `harness-adapter-skill-runtime`：读取 adapter 源目录与投影状态
- [ ] `harness-develop`：使用 `.harness/develop/changes/**` 作为 canonical storage
- [ ] `harness-safety-orchestration`：提供 transaction、protected content 与敏感文件过滤

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 文件系统读写与 JSON 校验 | 阻断写入并提示安装 |
| 包管理器 | npm | >= 10.0.0 | 初始化命令分发 | 提示使用本地构建产物 |
| 数据格式 | JSON Schema | draft-07 | 配置结构校验 | 使用内置最小校验器 |
| 版本控制 | Git | >= 2.30.0 | 检测 ignored 文件和变更状态 | 非 Git 项目仅跳过 Git 检测 |

### 4.3 数据存储
- [ ] JSON 配置（版本 1）：`.harness/config/harness.config.json`，主配置
- [ ] JSON 本地配置（版本 1）：`.harness/config/*.local.json`，本机覆盖，默认 ignored
- [ ] JSON 状态（版本 1）：`.harness/state/*.json`，安装、facts、active change、capabilities 状态
- [ ] Markdown/JSON 报告：`.harness/reports/**`，命令报告和审计摘要

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：写入 `.harness/**` 与平台必须识别的轻量投影路径；其他路径必须由具体 capability 明确声明

### 5.2 数据安全
- 敏感字段：`*.local.json`、`.env*`、`*token*`、`*secret*`、证书和私钥文件
- 加密要求：本地配置不强制加密；系统必须避免将敏感字段复制到报告、cache、adapter 投影或发布包

### 5.3 审计要求
- 日志记录：transaction id、写入路径、备份路径、回滚状态
- 操作追踪：迁移命令必须记录来源目录、目标目录、冲突文件和用户选择

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：`schemaVersion` 必须用于配置迁移；未知高版本配置必须只读失败并提示升级

### 6.2 数据兼容性
- 数据迁移方案：显式迁移命令必须先 dry-run 输出迁移计划，再由用户确认写入
- 回滚策略：每次迁移必须生成 transaction，失败时按 transaction 回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
