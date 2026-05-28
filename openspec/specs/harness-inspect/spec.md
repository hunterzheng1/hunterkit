# spec.md - 能力规格定义

> **定位**：单个能力（capability）的技术规格定义，用于 `specs/<capability>/spec.md`
>
> **【质量红线】严禁描述模糊；约束必须量化；缺失必要参数时 opsx-check 必须报错拦截
>
>> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：项目事实扫描

系统必须通过 `harness inspect` 扫描目标项目结构，并生成稳定的 repo facts、module map 和规则建议，供 sync、develop、review、knowledge 等能力复用。

##### 场景：首次全量扫描
- **当** 用户执行 `harness inspect --full --rules`
- **预期** 系统必须扫描构建文件、源码目录、文档目录、AI agent 文件、CI workflow 和已知 Harness/旧来源目录，并生成 `.harness/facts/repo-map.json`

##### 场景：限定路径扫描
- **当** 用户执行 `harness inspect --path src/payment --json`
- **预期** 系统必须只扫描指定路径及其必要上下文，并在 JSON 中标记 `scope.path` 为 `src/payment`

#### 需求项：规则与模块图输出

系统必须将扫描结果转换为人类可读的模块图和 agent 规则建议，并区分确认事实与待确认事实。

##### 场景：生成规则建议
- **当** 用户执行 `harness inspect --rules`
- **预期** 系统必须写入 `.harness/generated/rules.generated.md`，并将不确定事实标记为 `REVIEW_REQUIRED`

##### 场景：生成模块图
- **当** 项目包含可识别模块或包结构
- **预期** 系统必须写入 `.harness/generated/module-map.md`，并列出模块名、路径、主要语言、构建入口和依赖关系

#### 需求项：机器可读事实契约

系统必须保证 `.harness/facts/repo-map.json` 结构稳定，供其他 Harness capability 读取。

##### 场景：facts 被下游读取
- **当** sync、develop、review 或 knowledge 读取 repo facts
- **预期** 系统必须提供 `schemaVersion`、`root`、`languages`、`packageManagers`、`buildFiles`、`docs`、`agentFiles`、`ci`、`modules`、`generatedAt` 字段

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness inspect`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --full | boolean | 否 | 全量扫描 | `true` | 默认 `false`；首次无 facts 时等价于 `true` |
| --path | path | 否 | 限定扫描目录 | `src/payment` | 必须位于 `--cwd` 内 |
| --rules | boolean | 否 | 生成规则建议 | `true` | 为 `true` 时写入 rules.generated.md |
| --json | boolean | 否 | JSON 输出 | `true` | stdout 必须是合法 JSON |
| --dry-run | boolean | 否 | 仅预览输出路径 | `true` | 为 `true` 时写入文件数量必须为 0 |

#### 响应结构

**成功响应 (0)**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "factsPath": ".harness/facts/repo-map.json",
    "moduleMapPath": ".harness/generated/module-map.md",
    "rulesPath": ".harness/generated/rules.generated.md",
    "scope": {
      "full": true,
      "path": null
    },
    "reviewRequired": []
  }
}
```

**错误响应**
```json
{
  "code": 2302,
  "msg": "scan path outside workspace",
  "data": {
    "path": "../outside"
  }
}
```

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2301 | 扫描目标不存在 | `--cwd` 或 `--path` 不存在 |
| 2302 | 路径越界 | `--path` 解析后不在项目根目录内 |
| 2303 | facts 写入失败 | `.harness/facts/repo-map.json` 写入失败 |
| 2304 | 规则生成失败 | `--rules` 输出失败 |
| 5301 | 扫描器内部错误 | 文件遍历或解析过程异常 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| 小型项目扫描时间 | < 5000 毫秒 (P95) | 文件数小于 5000 |
| 限定路径扫描时间 | < 3000 毫秒 (P95) | 文件数小于 1000 |
| facts JSON 大小 | < 5 MB | 超出时必须摘要化或分页记录 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | < 512 MB | 全量扫描文件数小于 20000 |
| CPU | 平均 < 85% | 扫描期间 |
| 存储 | < 20 MB | facts、module map、rules 输出总量 |

### 3.3 超时配置
- 连接超时：0 毫秒，本地扫描不建立网络连接
- 读取超时：30000 毫秒
- 总超时：180000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `harness-workspace-config`：写入 `.harness/facts` 和 `.harness/generated`
- [ ] `harness-sync`：读取 facts 和 rules 生成文档同步内容
- [ ] `harness-review`：读取 module map 选择 review 范围
- [ ] `harness-knowledge`：索引 generated facts 与规则摘要

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 文件遍历与 JSON 输出 | 阻断 inspect |
| 版本控制 | Git | >= 2.30.0 | git facts、ignored 文件识别 | 非 Git 项目跳过 Git facts |
| 包管理器识别 | npm package-lock | lockfileVersion >= 2 | Node 项目识别 | 仅记录 package.json |
| Java 构建识别 | Maven POM | modelVersion >= 4.0.0 | Java 项目识别 | 标记为 REVIEW_REQUIRED |

### 4.3 数据存储
- [ ] JSON facts（版本 1）：`.harness/facts/repo-map.json`，项目事实
- [ ] Markdown 模块图：`.harness/generated/module-map.md`，人类可读结构
- [ ] Markdown 规则建议：`.harness/generated/rules.generated.md`，agent 规则候选

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：默认读取项目结构；必须遵守 safety.secretPatterns 和 ignore 配置

### 5.2 数据安全
- 敏感字段：`.env*`、证书、私钥、token、secret、本地配置
- 加密要求：facts 中不得存储敏感文件内容；仅允许记录被忽略文件的模式级信息

### 5.3 审计要求
- 日志记录：扫描 scope、文件计数、忽略模式、输出路径、REVIEW_REQUIRED 数量
- 操作追踪：每次写入 facts 必须记录 generatedAt 和 Harness 版本

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是
- 版本控制策略：repo-map.json 必须包含 `schemaVersion`；新增字段必须保持旧消费者可忽略

### 6.2 数据兼容性
- 数据迁移方案：旧 `.docsync/` facts 可作为输入，但新 facts 必须写入 `.harness/facts/repo-map.json`
- 回滚策略：写入 facts、module map、rules 必须由 transaction 回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「必须」强制要求，而非「应该」「可以」
> - [x] 所有接口参数已量化（类型、必填、范围、示例）
> - [x] 物理约束已量化（并发、超时、性能指标）
> - [x] 错误码已定义
> - [x] **技术选型已包含版本信息**（框架、数据库、缓存、中间件等）
> - [x] 若跳过 proposal.md，影响范围已在此补齐
