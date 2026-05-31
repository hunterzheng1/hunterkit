## ADDED Requirements

### Requirement: Harness Skill source tree compliance
系统 MUST 生成符合《CLAUDE_CODE_CODEX_SKILLS_AGENTS_HOOKS_GUIDE.md》的单一 `harness` Skill 源结构，并且必须保持“一个用户可见 Skill，多能力路由”的产品边界。

#### Scenario: Shared Skill source contains standard files
- **WHEN** 初始化或 repair 流程生成 `.harness/adapters/shared/skills/harness/`
- **THEN** 系统 MUST 至少生成 `SKILL.md`、`references/`、`scripts/`、`assets/`，且 `SKILL.md` 必须描述 inspect、sync、develop、review、knowledge 的统一入口职责

#### Scenario: Tool adapter source remains complete
- **WHEN** 用户选择 Claude Code 或 Codex 适配
- **THEN** 系统 MUST 在 `.harness/adapters/<tool>/skills/harness/` 保留该工具需要的源模板或完整资料，且不得出现只有 `SKILL.md` 而缺少 references/scripts/assets 来源的割裂状态

#### Scenario: Runtime Skill remains a thin projection
- **WHEN** 系统写入 `.claude/skills/harness/SKILL.md` 或 `.agents/skills/harness/SKILL.md`
- **THEN** 运行时文件 MUST 只保留最小路由说明、frontmatter、repair 指针和 CLI 映射，不得复制大型 references/scripts/assets 内容到运行时根目录

### Requirement: Selected AI tool runtime projection
系统 MUST 只为用户选择的 AI 工具生成可被该工具识别的运行时投影，并且必须在安装摘要和配置中准确记录选择结果。

#### Scenario: Claude runtime projection
- **WHEN** `aiTools.claude` 为 `true`
- **THEN** 系统 MUST 生成 `.claude/skills/harness/SKILL.md`，并在需要 agent 时生成 `.claude/agents/*.md`；生成的 Skill frontmatter MUST 包含 `name`、`description`、`when_to_use`、`allowed-tools`、`paths`

#### Scenario: Codex runtime projection
- **WHEN** `aiTools.codex` 为 `true`
- **THEN** 系统 MUST 生成 `.agents/skills/harness/SKILL.md` 和 `.agents/skills/harness/agents/openai.yaml`，并在需要 custom agents 时生成 `.codex/agents/*.toml`

#### Scenario: Unselected tool runtime is not written
- **WHEN** `aiTools.codex` 为 `false`
- **THEN** 系统 MUST NOT 写入 `.agents/skills/harness/SKILL.md`、`.agents/skills/harness/agents/openai.yaml` 或 `.codex/agents/*.toml`；但安装摘要 MUST 明确展示 Codex 未选择，避免用户误判为漏装

### Requirement: Harness agent definitions are guide-quality
系统 MUST 生成可被目标 AI 工具理解的 agent 定义，而非只有名称和一句描述的占位符。

#### Scenario: Claude agent frontmatter
- **WHEN** 系统生成 `.harness/adapters/claude/agents/*.md` 或 `.claude/agents/*.md`
- **THEN** 每个 agent 文件 MUST 包含 `name`、`description`、`tools` 或等价工具约束、职责边界、输入输出格式、禁止事项和适用触发场景

#### Scenario: Codex custom agent TOML
- **WHEN** 系统生成 `.harness/adapters/codex/agents/*.toml` 或 `.codex/agents/*.toml`
- **THEN** 每个 TOML 文件 MUST 包含 agent 名称、model/effort 或等价执行配置、职责说明、工具约束、prompt/body，且内容必须与对应 Claude agent 职责一致

#### Scenario: Finding validator is actionable
- **WHEN** 系统生成 `harness-finding-validator` agent
- **THEN** 该 agent MUST 明确要求验证证据、文件行号、严重度、置信度和误报处理，不得只是泛化描述“validate findings”

### Requirement: Adapter repair verifies generated artifacts
系统 MUST 提供 adapter repair / reinstall 路径，确保已安装项目可从 `.harness/adapters/**` 重新生成运行时 Skill、Agent 和 Hook 投影。

#### Scenario: Repair detects missing runtime Skill
- **WHEN** `.harness/adapters/shared/skills/harness/SKILL.md` 存在但 `.claude/skills/harness/SKILL.md` 缺失
- **THEN** repair 或 doctor 建议 MUST 标记缺失的 Claude runtime Skill，并给出可执行的修复命令

#### Scenario: Repair detects stale runtime projection
- **WHEN** runtime projection 的 managed marker 指向的 source hash 与当前 `.harness/adapters/**` 不一致
- **THEN** 系统 MUST 标记为 drift，并在 repair 后重写 runtime projection，同时保留用户非托管内容

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `harness init` / `npx @hunterzheng/harness` / repair 内部流程 |
| 输出类型 | 文件投影与 `CliArtifact[]` 安装摘要 |
| 版本依赖 | Node.js `>=20.0.0`，commander `^12.1.0` |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2601 | Skill 源结构缺失 | shared 或 tool adapter 缺少 `SKILL.md` / references / scripts / assets |
| 2602 | Runtime Skill 投影缺失 | 已选择工具缺少 `.claude/skills/**` 或 `.agents/skills/**` |
| 2603 | Agent 定义不合规 | agent 缺少 frontmatter/TOML 必填字段 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：运行时只写薄投影，源资料保留在 `.harness/adapters/**`
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
