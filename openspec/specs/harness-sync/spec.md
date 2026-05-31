## ADDED Requirements

### Requirement: Harness managed root documentation
系统 MUST 在初始化和 sync 时将目标项目根文档收敛到 Harness managed block，移除旧 DocSync 日常命令暴露。

#### Scenario: AGENTS managed block
- **WHEN** 用户选择写入项目配置并启用 sync 能力
- **THEN** 系统 MUST 在 `AGENTS.md` 中写入或更新 Harness managed block，内容必须指向 `harness` Skill 和 inspect/sync/develop/review/knowledge 工作流，不得继续展示 `/docsync:init`、`/docsync:sync` 作为日常入口

#### Scenario: CLAUDE short entry
- **WHEN** 用户选择 Claude Code
- **THEN** 系统 MUST 在 `CLAUDE.md` 中写入短入口，指向 `.claude/skills/harness/SKILL.md`，并保留用户已有非托管内容

#### Scenario: Codex short entry
- **WHEN** 用户选择 Codex
- **THEN** 系统 MUST 在 `AGENTS.md` 或 Codex 项目入口文档中写入 `.agents/skills/harness/SKILL.md` 指针，并说明通过 AI 工具 CLI 触发 harness 工作流

### Requirement: Legacy source names are hidden from daily UX
系统 MUST 在用户可见文档中隐藏 DocSync、GSD、kld-sdd、kld-review 等内部来源命令名。

#### Scenario: README daily usage
- **WHEN** sync 更新 README 或 AGENTS managed block
- **THEN** 用户可见的安装和日常使用章节 MUST 只展示 `npx @hunterzheng/harness`、`harness inspect`、`harness sync`、`harness develop`、`harness review`、`harness knowledge` 或 AI 工具自然语言触发方式

#### Scenario: Internal source explanation
- **WHEN** 文档需要解释能力来源
- **THEN** 内部来源名 MUST 只出现在“内部来源/迁移说明/开发者说明”上下文中，不得作为用户要执行的命令或 Skill 名称出现

### Requirement: Managed block preservation
系统 MUST 只更新 Harness managed block，不得覆盖用户手写内容或旧项目自定义说明。

#### Scenario: Preserve user content
- **WHEN** `AGENTS.md` 或 `CLAUDE.md` 已存在用户手写章节
- **THEN** sync MUST 只替换 `<!-- harness:start -->` 到 `<!-- harness:end -->` 之间的内容；若需要替换旧 `docsync` block，必须在报告中记录迁移动作

#### Scenario: Report migrated legacy block
- **WHEN** sync 将 `<!-- docsync:start -->` block 迁移为 Harness managed block
- **THEN** 系统 MUST 在 `.harness/reports/sync/<timestamp>-sync.md` 中记录原 block 名称、目标 block 名称、受影响文件和是否保留用户内容

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `harness sync` / 初始化流程内部 sync |
| 输出类型 | Managed documents、sync report、JSON drift report |
| 版本依赖 | Node.js `>=20.0.0` |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2405 | Legacy block migration conflict | 旧 docsync block 与用户内容无法安全区分 |
| 2406 | Harness managed block missing | 初始化后应写入的 Harness block 不存在 |
| 2407 | Internal source exposed | 用户可见文档仍暴露旧来源命令名 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：只更新 managed block
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
