# 实施任务拆解 - harness-workspace-config

> **定位**：单一 Capability 的 AI 编码引擎执行单元
> 
> **⚠️ 边界声明**：本任务清单仅服务于当前 Capability，严禁跨模块任务。
> 
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-workspace-config/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-workspace-config/design.md` | 当前能力设计 |

### 1.2 实现范围

- 安装产物健康模型：配置期望 + 状态快照 + 诊断
- Doctor 结构化 JSON 输出：`DoctorCheck[]` 替代 `Record<string,string>`
- Doctor 投影缺口检测：runtime hooks、Skill source、managed docs
- Safety 配置基线校验：secretPatterns 覆盖
- Local config 隐私保护
- `harness status` 健康摘要

### 1.3 技术栈

- 语言：TypeScript 5.5+
- 测试：vitest ^2.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行)                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ TASK-WSC-01   │  │ TASK-WSC-02   │  │ TASK-WSC-03          │   │
│  │ 安装状态/健康  │  │ Doctor JSON   │  │ Safety 基线/隐私     │   │
│  │ 测试 (骨架)    │  │ 测试 (骨架)    │  │ 测试 (骨架)          │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          │                  │                      │               │
│          v                  v                      v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │ │
│  │  │ TASK-WSC-04   │  │ TASK-WSC-05   │  │ TASK-WSC-06      │  │ │
│  │  │ 安装状态实现   │  │ Doctor 重构    │  │ Safety 基线/隐私  │  │ │
│  │  │ 依赖: 01      │  │ 依赖: 02      │  │ 实现              │  │ │
│  │  └───────┬───────┘  └───────┬───────┘  │ 依赖: 03          │  │ │
│  │          │                  │          └────────┬─────────┘  │ │
│  │          │                  │                   │             │ │
│  │          v                  v                   v             │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌───────────────┐  ┌──────────────────────────────────┐ │ │ │
│  │  │  │ TASK-WSC-07   │  │ TASK-WSC-08                      │ │ │ │
│  │  │  │ Config schema  │  │ Status 命令扩展                   │ │ │ │
│  │  │  │ 扩展           │  │ 依赖: 04,05                      │ │ │ │
│  │  │  │ 依赖: 04,06   │  │                                   │ │ │ │
│  │  │  └───────┬───────┘  └──────────────┬───────────────────┘ │ │ │
│  │  │          │                          │                      │ │ │
│  │  │          v                          v                      │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-WSC-09                                       │ │ │ │ │
│  │  │  │  │ 全量测试验证                                       │ │ │ │ │
│  │  │  │  │ 依赖: 07,08                                       │ │ │ │ │
│  │  │  │  └──────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-WSC-01, TASK-WSC-02, TASK-WSC-03 | ✅ 是 | 无 |
| 层级 2 | TASK-WSC-04, TASK-WSC-05, TASK-WSC-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-WSC-07, TASK-WSC-08 | ✅ 是 | 层级 2 |
| 层级 4 | TASK-WSC-09 | - | 层级 3 |

---

## 3. 原子任务清单

### [TASK-WSC-01] 安装状态与健康模型测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 install state 和 artifact health model 测试骨架。

#### 实现步骤
1. 创建 `test/core/artifact-health.test.ts` 测试骨架
2. 编写 `install state records selected tools and capabilities` 测试
3. 编写 `artifact health detects missing runtime projection` 测试
4. 编写 `config and artifacts consistency check` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Installation artifact health model
- design.md 章节：2.2 新建 artifact-health.ts

---

### [TASK-WSC-02] Doctor JSON 结构化测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 doctor JSON 输出测试骨架，验证 `DoctorCheck[]` 结构和非零退出码。

#### 实现步骤
1. 创建 `test/commands/doctor-json.test.ts` 测试骨架
2. 编写 `doctor --json outputs valid JSON with checks array` 测试
3. 编写 `doctor returns nonzero on ERROR severity` 测试
4. 编写 `doctor preserves all warnings and errors` 测试
5. 编写 `doctor check contains id/status/severity/message/paths/repairCommand` 测试
6. 测试预期失败

#### 验收标准
- [x] 4 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Doctor JSON is actionable
- design.md 章节：2.2 新建 doctor-json.test.ts

---

### [TASK-WSC-03] Safety 基线/隐私测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 safety baseline 和 local config privacy 测试骨架。

#### 实现步骤
1. 在 `test/core/workspace-config.test.ts` 新增测试骨架
2. 编写 `secretPatterns baseline completeness check fails when missing` 测试
3. 编写 `local config files excluded from reportable artifacts` 测试
4. 编写 `doctor detects local config in published artifacts` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试预期失败

#### 关联设计
- spec.md 章节：Safety configuration baseline、Local config remains private
- design.md 章节：2.2 新建 safety-baseline.ts

---

### [TASK-WSC-04] 安装状态与健康模型实现

- **类型**: 接口层
- **依赖**: TASK-WSC-01
- **状态**: [x] 已完成

#### 任务描述
实现 install state 类型化存储和 artifact health model。

#### 实现步骤
1. 创建 `src/core/install-state.ts`：构建、读取、更新 `.harness/state/install.json`
2. 创建 `src/core/artifact-health.ts`：根据 config、install state、registry 计算 expected/actual artifacts
3. 修改 `src/core/workspace.ts`：`ensureWorkspace()` 写入 richer install.json
4. 运行 TASK-WSC-01 测试确认

#### 验收标准
- [x] install.json 记录 selected tools、capabilities、hookStrength、writePolicy、artifacts、skipped
- [x] artifact health 正确检测缺失/一致/不一致
- [x] TASK-WSC-01 测试通过

#### 关联设计
- spec.md 章节：Installation artifact health model
- design.md 章节：2.2 新建 install-state.ts、artifact-health.ts

---

### [TASK-WSC-05] Doctor 重构实现

- **类型**: 接口层
- **依赖**: TASK-WSC-02
- **状态**: [x] 已完成

#### 任务描述
将 doctor 从 `Record<string,string>` 重构为 `DoctorCheck[]` 聚合器，增加投影缺口检测。

#### 实现步骤
1. 创建 `src/core/doctor-checks.ts`：聚合基础、artifact、skillSource、managedDocs、safety、local privacy 检查
2. 修改 `src/commands/doctor.ts`：`runDoctorCommand()` 返回 `DoctorCheck[]`
3. 新增诊断项：`projection.runtimeHooks`、`projection.runtimeSkills`、`skillSource`、`managedDocs`
4. 每个 check 包含 `id`、`status`、`severity`、`message`、`paths[]`、`repairCommand`
5. 聚合所有 ERROR 后返回非 0 退出码
6. 运行 TASK-WSC-02 测试确认

#### 验收标准
- [x] doctor JSON 包含 `data.checks: DoctorCheck[]`
- [x] 每个 check 有 id/status/severity/message/paths/repairCommand
- [x] ERROR 时返回非 0
- [x] 所有 warning 和 error 保留在输出中
- [x] TASK-WSC-02 测试通过

#### 关联设计
- spec.md 章节：Doctor detects projection gaps、Doctor JSON is actionable
- design.md 章节：2.1 doctor.ts 替换实现

---

### [TASK-WSC-06] Safety 基线/隐私实现

- **类型**: 接口层
- **依赖**: TASK-WSC-03
- **状态**: [x] 已完成

#### 任务描述
实现 safety baseline 校验和 local config 隐私保护。

#### 实现步骤
1. 创建 `src/core/safety-baseline.ts`：导出 secret pattern 基线和校验函数
2. 修改 `src/core/config-schema.ts`：`createDefaultConfig()` 写入完整 safety baseline
3. 修改 `src/core/config.ts`：`mergeLocalConfig()` 返回 local 文件路径和 ignored keys
4. 添加 doctor 检查项：`safetyBaseline`、`localConfigPrivacy`
5. 运行 TASK-WSC-03 测试确认

#### 验收标准
- [x] `secretPatterns` 覆盖基线（`.env`、`*.pem`、`*.key` 等）
- [x] local config 排除在 reportable artifacts 外
- [x] TASK-WSC-03 测试通过

#### 关联设计
- spec.md 章节：Safety configuration baseline、Local config remains private
- design.md 章节：2.2 新建 safety-baseline.ts

---

### [TASK-WSC-07] Config Schema 扩展

- **类型**: 配置
- **依赖**: TASK-WSC-04, TASK-WSC-06
- **状态**: [x] 已完成

#### 任务描述
扩展 config schema 校验，增加 `installation`、`documents` marker、`safety` baseline 相关类型。

#### 实现步骤
1. 修改 `src/core/types.ts`：新增 `HarnessConfig.installation`、`InstallStateSnapshot`、`InstallArtifactRecord`、`DoctorCheck`
2. 修改 `src/core/config-schema.ts`：`validateHarnessConfig()` 校验 baseline 覆盖
3. 修改 `src/core/config.ts`：`loadHarnessConfig()` validation errors 带 code/path
4. 运行测试确认

#### 验收标准
- [x] config schema 校验 safety baseline 覆盖
- [x] validation errors 包含 code/path
- [x] 类型定义完整

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.1 config-schema 修改

---

### [TASK-WSC-08] Status 命令扩展

- **类型**: 接口层
- **依赖**: TASK-WSC-04, TASK-WSC-05
- **状态**: [x] 已完成

#### 任务描述
扩展 `harness status` 展示安装健康摘要。

#### 实现步骤
1. 修改 `src/commands/status.ts`：`readWorkspaceStatus()` 加载 health summary
2. 输出 selected tools、artifact counts、health status
3. 运行测试确认

#### 验收标准
- [x] status 展示安装健康摘要
- [x] status 展示 selected tools 和 artifact counts
- [x] 不替代 doctor 明细

#### 关联设计
- spec.md 章节：全部
- design.md 章节：2.1 status.ts 扩展

---

### [TASK-WSC-09] 全量测试验证

- **类型**: 测试-验证
- **依赖**: TASK-WSC-07, TASK-WSC-08
- **状态**: [x] 已完成

#### 任务描述
运行全量测试，确认 workspace config 相关测试全部通过。

#### 实现步骤
1. 运行 `npm run test`
2. 运行 `npm run typecheck`
3. 运行 `npm run lint`
4. 修复任何失败

#### 验收标准
- [x] `npm run test` 全部通过
- [x] `npm run typecheck` 无错误
- [x] `npm run lint` 无错误

#### 关联设计
- spec.md 章节：全部（4 个 Requirement，10 个 Scenario）

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-WSC-01 | 单元测试 | 安装状态 | install.json 完整性 |
| TASK-WSC-02 | 单元测试 | Doctor JSON | checks[] 结构 |
| TASK-WSC-03 | 单元测试 | Safety/隐私 | baseline 覆盖、local 排除 |
| TASK-WSC-04 | 单元测试 | 健康模型 | artifact 一致性 |
| TASK-WSC-05 | 单元测试 | Doctor 重构 | DoctorCheck[] 输出 |
| TASK-WSC-06 | 单元测试 | Safety/隐私 | 校验/过滤 |
| TASK-WSC-07 | 单元测试 | Schema | 校验通过/失败 |
| TASK-WSC-08 | 单元测试 | Status | 健康摘要 |
| TASK-WSC-09 | 全量测试 | 端到端 | 全部通过 |

---

## 5. 外部依赖

| 依赖项 | 类型 | 提供方 | 状态 | 备注 |
|-------|------|-------|------|------|
| Adapter registry | 内部 | harness-adapter-skill-runtime | ⏳ 等待 | doctor 推导 expected runtime |
| Safety capability | 内部 | harness-safety-orchestration | ⏳ 等待 | 共用 baseline |

---

## 6. 交付物

### 6.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/core/install-state.ts` | 安装状态服务 | TASK-WSC-04 |
| `src/core/artifact-health.ts` | 产物健康模型 | TASK-WSC-04 |
| `src/core/doctor-checks.ts` | Doctor 检查聚合 | TASK-WSC-05 |
| `src/core/safety-baseline.ts` | Safety 基线 | TASK-WSC-06 |
| `src/core/types.ts` | 类型扩展 | TASK-WSC-07 |
| `src/core/config-schema.ts` | Schema 扩展 | TASK-WSC-07 |
| `src/core/config.ts` | Config 加载扩展 | TASK-WSC-07 |
| `src/core/workspace.ts` | 工作区扩展 | TASK-WSC-04 |
| `src/commands/doctor.ts` | Doctor 重构 | TASK-WSC-05 |
| `src/commands/status.ts` | Status 扩展 | TASK-WSC-08 |

### 6.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/core/artifact-health.test.ts` | 健康模型测试 | TASK-WSC-01 |
| `test/commands/doctor-json.test.ts` | Doctor JSON 测试 | TASK-WSC-02 |
| `test/core/workspace-config.test.ts` | 配置测试扩展 | TASK-WSC-03 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（4 个 Requirement，10 个 Scenario）
> - [x] 任务清单 100% 覆盖 design.md 定义（50 个字段映射、18 个修改/新建文件）
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖