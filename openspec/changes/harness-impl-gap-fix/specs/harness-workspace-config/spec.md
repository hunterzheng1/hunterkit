# spec.md - 能力规格定义（增量）

> **定位**：`harness-workspace-config` 的实施偏移修复规格
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

无。

### 修改需求

#### 需求项：工作区目录完整性

系统必须在初始化时创建 `.harness/` 下的全部必要子目录，包括首次实施中遗漏的目录。

##### 场景：创建遗漏目录
- **当** 用户完成 Harness 初始化
- **预期** 系统必须创建 `.harness/docs/`、`.harness/rules/`、`.harness/events/`、`.harness/develop/archive/`、`.harness/develop/templates/`、`.harness/reports/sync/`、`.harness/reports/develop/`、`.harness/reports/review/` 目录

##### 场景：目录幂等创建
- **当** 部分目录已存在
- **预期** 系统必须跳过已存在目录，只创建缺失目录，且不得报错

#### 需求项：配置文件完整性

系统必须生成完整的配置文件集合，包括首次实施中遗漏的配置文件。

##### 场景：生成 review 配置
- **当** 用户初始化且启用 review 能力
- **预期** 系统必须生成 `.harness/config/review.config.json`，包含 reviewer 列表、confidence 阈值（默认 80）、fix 策略等字段

##### 场景：生成 knowledge 配置
- **当** 用户初始化且启用 knowledge 能力
- **预期** 系统必须生成 `.harness/config/knowledge.config.json`，包含索引来源路径、忽略规则等字段

##### 场景：本地私有配置
- **当** 用户需要本地覆盖配置
- **预期** 系统必须允许创建 `.harness/config/*.local.json`，并确保 `*.local.json` 不出现在报告、cache 或发布包中

#### 需求项：主配置字段完整性

系统必须确保 `harness.config.json` 包含所有必要字段。

##### 场景：generatedBlockPrefix 字段
- **当** 系统生成或读取 `harness.config.json`
- **预期** 系统必须校验 `documents.generatedBlockPrefix` 字段存在且值为 `"harness"`；缺失时必须报错并提示修复

##### 场景：完整配置校验
- **当** 命令读取 `harness.config.json`
- **预期** 系统必须校验 `schemaVersion`、`project`、`aiTools`、`capabilities`、`documents`（含 `managed` 和 `generatedBlockPrefix`）、`orchestration`、`safety` 字段完整

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness config` / 初始化流程内部调用
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --cwd | path | 否 | 目标项目根目录 | `E:/repo/demo` | 必须是存在目录 |

#### 新增目录清单

```text
.harness/docs/
.harness/rules/
.harness/events/
.harness/develop/archive/
.harness/develop/templates/
.harness/reports/sync/
.harness/reports/develop/
.harness/reports/review/
```

#### 新增配置文件

| 文件路径 | 用途 | 必填字段 |
|---------|------|---------|
| `.harness/config/review.config.json` | review 配置 | `reviewers`、`confidenceThreshold`、`fixPolicy` |
| `.harness/config/knowledge.config.json` | knowledge 配置 | `sources`、`ignorePatterns` |
| `.harness/config/*.local.json` | 本地覆盖 | 任意（用户自定义） |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2105 | 目录创建失败 | 文件系统权限不足或磁盘满 |
| 2106 | 配置文件缺失字段 | `generatedBlockPrefix` 等必填字段不存在 |
| 2107 | 配置文件生成失败 | 写入 `review.config.json` 或 `knowledge.config.json` 失败 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| 目录创建时间 | < 500 毫秒 (P95) | 8 个目录 |
| 配置文件生成时间 | < 300 毫秒 (P95) | 3 个配置文件 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 存储 | < 1 MB | 新增目录和配置文件总量 |

### 3.3 超时配置
- 总超时：5000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/core/workspace.ts`：补全目录创建逻辑
- [ ] `src/core/config-schema.ts`：补全配置 schema 校验

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 文件系统操作 | 阻断初始化 |

### 4.3 数据存储
- [ ] JSON 配置：`.harness/config/review.config.json`
- [ ] JSON 配置：`.harness/config/knowledge.config.json`
- [ ] JSON 配置：`.harness/config/*.local.json`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：`.harness/` 下目录和配置文件

### 5.2 数据安全
- 敏感字段：`*.local.json` 不得出现在报告或发布包中

### 5.3 审计要求
- 日志记录：创建的目录列表、配置文件路径

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是

### 6.2 数据兼容性
- 数据迁移方案：已有目录跳过，缺失目录补建
- 回滚策略：通过 transaction 回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（3 个需求项，7 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
