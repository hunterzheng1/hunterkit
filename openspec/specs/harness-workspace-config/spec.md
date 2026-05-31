## ADDED Requirements

### Requirement: Installation artifact health model
系统 MUST 在 workspace config 和状态文件中记录安装产物健康信息，使 doctor 能判断 Skill、Agent、Hook、文档投影是否与配置一致。

#### Scenario: Install state records selected tools
- **WHEN** 初始化完成
- **THEN** `.harness/state/install.json` MUST 记录用户选择的 AI 工具、能力列表、Hook 强度、写入策略、生成的 runtime artifacts 和 skipped artifacts，且每条 artifact 必须包含路径、类型、tool、managed 标记

#### Scenario: Config and artifacts are consistent
- **WHEN** `harness doctor --json` 读取 `.harness/config/harness.config.json`
- **THEN** doctor MUST 校验 `aiTools.*` 与 runtime artifacts 一致；若 `aiTools.claude=true` 但 `.claude/skills/harness/SKILL.md` 缺失，必须报告不健康

### Requirement: Doctor detects projection gaps
系统 MUST 扩展 doctor，使其发现当前安装实测暴露的结构缺口，而不是只检查 `.harness` 目录和主配置存在。

#### Scenario: Missing runtime hooks
- **WHEN** source hooks 存在但 `.claude/hooks/`、`.claude/settings.json`、`.codex/hooks/` 或 `.codex/hooks.json` 缺失
- **THEN** doctor MUST 输出 `projection.runtimeHooks` 诊断项，状态为 `ERROR` 或 `WARN`，并说明缺失路径

#### Scenario: Missing Skill source structure
- **WHEN** `.harness/adapters/shared/skills/harness/` 缺少 `SKILL.md`、`references/`、`scripts/` 或 `assets/`
- **THEN** doctor MUST 输出 `skillSource` 诊断项，状态为 `ERROR`

#### Scenario: Stale root documentation
- **WHEN** `AGENTS.md` 仍包含 DocSync 日常命令且缺少 Harness managed block
- **THEN** doctor MUST 输出 `managedDocs` 诊断项，状态为 `ERROR`，并给出 `harness sync --repair` 或等价修复建议

### Requirement: Doctor JSON is actionable
系统 MUST 让 `doctor --json` 的输出可用于自动化验收和 TDD 测试。

#### Scenario: Doctor JSON structure
- **WHEN** 用户执行 `harness doctor --json`
- **THEN** 输出 MUST 是合法 JSON，且 `data.checks[]` 中每项必须包含 `id`、`status`、`severity`、`message`、`paths[]`、`repairCommand`

#### Scenario: Doctor nonzero on error
- **WHEN** doctor 发现 ERROR 级别的安装产物缺口
- **THEN** 命令 MUST 返回非 0 退出码，并在 JSON 中保留所有 warning 和 error，而不是只返回第一个问题

### Requirement: Safety configuration baseline
系统 MUST 将 safety baseline 纳入配置 schema 校验，避免完整质量门配置缩水。

#### Scenario: Secret patterns schema check
- **WHEN** 读取或生成 `harness.config.json`
- **THEN** schema 校验 MUST 要求 `safety.secretPatterns` 覆盖实施方案基线；缺失项必须在 doctor 中列为 `ERROR`

#### Scenario: Local config remains private
- **WHEN** 存在 `.harness/config/*.local.json`
- **THEN** doctor MUST 确认该文件不会被安装摘要、sync 报告或发布包列为可提交产物

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `harness status` / `harness doctor --json` |
| 输出类型 | 标准 CLI JSON：`code`、`msg`、`data`、`warnings` |
| 版本依赖 | Node.js `>=20.0.0` |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2110 | Artifact health error | runtime projection 与 config 不一致 |
| 2111 | Skill source invalid | Skill 源结构缺失或不合规 |
| 2112 | Managed docs invalid | 根文档缺少 Harness block 或仍暴露旧命令 |
| 2113 | Safety baseline invalid | safety 配置少于基线 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：doctor JSON 必须列出 paths 和 repairCommand
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
