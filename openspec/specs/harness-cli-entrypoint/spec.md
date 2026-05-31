## ADDED Requirements

### Requirement: Wizard selection summary is explicit
系统 MUST 在交互式向导中清晰回显用户选择，避免 AI 工具选择结果为空或安装摘要无法判断。

#### Scenario: AI tool selection line
- **WHEN** 用户完成“选择 AI 工具”步骤
- **THEN** 向导 MUST 显示已选择的工具名称列表，例如 `Claude Code`、`Codex`；如果没有选择任何工具，必须阻断并提示至少选择一个 AI 工具

#### Scenario: Final install summary
- **WHEN** 初始化成功输出 `[OK] success`
- **THEN** summary MUST 包含 `Selected AI tools`、`Selected capabilities`、`Hook strength`、`Write strategy`、`Runtime projections written`、`Runtime projections skipped` 六类信息

### Requirement: No-argument npx remains the canonical install entry
系统 MUST 保持 `npx @hunterzheng/harness` 无参数作为唯一推荐安装入口，并让所有细节由向导收集。

#### Scenario: First run wizard
- **WHEN** 用户在目标项目第一次执行 `npx @hunterzheng/harness`
- **THEN** 系统 MUST 进入交互式初始化向导，而不是要求用户传入长参数串

#### Scenario: README usage wording
- **WHEN** README 或 Skill 中描述安装方式
- **THEN** 文案 MUST 说明“在 AI 工具 CLI 中让工具执行 `npx @hunterzheng/harness`”，不得要求用户手动在普通命令行中完成日常 workflow

### Requirement: Install artifacts classify source and runtime
系统 MUST 在 CLI 安装结果中区分 `.harness/adapters/**` 源文件和 AI 工具 runtime projection。

#### Scenario: Artifact type classification
- **WHEN** 初始化完成列出 artifacts
- **THEN** 每条 artifact MUST 标注 `source`、`runtime`、`workspace`、`report` 或 `config` 类型；`.harness/adapters/**` 不得被误标为已生效 runtime hook

#### Scenario: Skipped runtime artifacts are visible
- **WHEN** 某个 AI 工具未选择
- **THEN** summary MUST 在 skipped artifacts 中说明未生成该工具 runtime projection 的原因是 `tool not selected`

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `npx @hunterzheng/harness` / `harness init` |
| 输出类型 | 交互式文本；`--json` 时为标准 CLI JSON |
| 版本依赖 | Node.js `>=20.0.0`，commander `^12.1.0` |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 1010 | No AI tool selected | 向导未选择任何 AI 工具 |
| 1011 | Install summary incomplete | 安装摘要缺少选择或 artifact 分类 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：summary 必须列出 6 类信息
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
