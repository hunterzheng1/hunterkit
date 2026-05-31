# spec.md - 能力规格定义（增量）

> **定位**：`harness-develop` — 状态呈现修正，避免把未实现阶段包装成已完成能力
> **增量说明**：本文档为对 `openspec/specs/harness-develop/spec.md` 的增量修改
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：未实现阶段明确返回状态

系统必须在 develop 阶段执行时，对未实现阶段返回明确的 `not implemented` 状态而非静默成功。

##### 场景：spec 阶段未实现
- **当** 用户执行 `harness develop <change> --spec`
- **预期** 系统必须返回 code 0（非错误），但 `data.status` 必须为 `not_implemented`，`warnings` 必须包含 "Spec stage not yet implemented. 后续版本支持"

##### 场景：design 阶段未实现
- **当** 用户执行 `harness develop <change> --design`
- **预期** 系统必须返回 code 0，`data.status` 为 `not_implemented`，`warnings` 包含 "Design stage not yet implemented. 后续版本支持"

##### 场景：tasks 阶段未实现
- **当** 用户执行 `harness develop <change> --tasks`
- **预期** 系统必须返回 code 0，`data.status` 为 `not_implemented`，`warnings` 包含 "Tasks stage not yet implemented. 后续版本支持"

##### 场景：check 阶段未实现
- **当** 用户执行 `harness develop <change> --check`
- **预期** 系统必须返回 code 0，`data.status` 为 `not_implemented`，`warnings` 包含 "Check stage not yet implemented. 后续版本支持"

##### 场景：apply 阶段未实现
- **当** 用户执行 `harness develop <change> --apply`
- **预期** 系统必须返回 code 2505（未通过 check），并提示 "apply 阶段必须先通过 check — check 尚未实现，apply 不可用"

##### 场景：archive 阶段未实现
- **当** 用户执行 `harness develop <change> --archive`
- **预期** 系统必须返回 code 0，`data.status` 为 `not_implemented`，`warnings` 包含 "Archive stage not yet implemented. 后续版本支持"

#### 需求项：develop 命令 M1 完成定义

系统必须明确声明 `harness develop` 的 M1 完成边界：propose 阶段可用（proposal.md 模板生成），其他阶段全部标记为后续版本。

##### 场景：propose 阶段可用
- **当** 用户执行 `harness develop <change> --propose`
- **预期** 系统必须生成模板 proposal.md 到 `.harness/develop/changes/<change>/proposal.md`，返回 `data.status: "completed"`，产物路径在 `artifacts` 中

##### 场景：status 命令输出 develop 能力状态
- **当** 用户执行 `harness status`
- **预期** `develop` 能力状态必须展示：propose ✅、spec ❌（后续版本）、design ❌（后续版本）、tasks ❌（后续版本）、check ❌（后续版本）、apply ❌（后续版本）、archive ❌（后续版本）

#### 需求项：旧 OpenSpec 文档的兼容性声明

系统必须在读取旧 `openspec/changes/**` 时明确告知用户兼容模式，并提示迁移建议。

##### 场景：检测到 legacy 文档
- **当** develop 检测到 `storage.status === 'legacy'`
- **预期** 系统必须在 `warnings` 中标注"检测到旧 OpenSpec 文档（openspec/changes/），建议使用 `harness config --migrate-sdd --dry-run` 预览迁移"

##### 场景：canonical + legacy 同时存在
- **当** develop 检测到 `storage.status === 'mixed'`
- **预期** 系统必须在 `warnings` 中标注"检测到 canonical 和 legacy 文档同时存在，建议完成迁移后删除旧目录"

### 修改需求

无。

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 M1 阶段状态矩阵

| 阶段 | M1 状态 | 响应行为 | 返回 data.status |
|------|--------|---------|-----------------|
| propose | ✅ 已实现 | 生成模板 proposal.md | `completed` |
| spec | ❌ 未实现 | 警告 + 返回 | `not_implemented` |
| design | ❌ 未实现 | 警告 + 返回 | `not_implemented` |
| tasks | ❌ 未实现 | 警告 + 返回 | `not_implemented` |
| check | ❌ 未实现 | 警告 + 返回 | `not_implemented` |
| apply | ❌ 未实现 | 错误 + 返回 2505 | `not_implemented` |
| archive | ❌ 未实现 | 警告 + 返回 | `not_implemented` |

#### 响应结构示例（未实现阶段）

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "command": "develop",
    "change": "demo-change",
    "stage": "spec",
    "status": "not_implemented"
  },
  "warnings": ["Spec stage not yet implemented. 后续版本支持"]
}
```

---

## 3. 物理约束

在原 spec 基础上无变更。

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/capabilities/develop/command.ts`：未实现阶段返回明确 `data.status: "not_implemented"`；apply 阶段返回 2505 而非静默成功；legacy/mixed 存储检测时在 warnings 中添加迁移建议
- [ ] `src/commands/status.ts`：status 命令展示 develop 各阶段状态矩阵

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（3 个新增需求项，9 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息