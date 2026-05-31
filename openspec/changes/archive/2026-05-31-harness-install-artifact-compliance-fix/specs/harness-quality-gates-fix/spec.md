## ADDED Requirements

### Requirement: Installation artifact compliance tests
系统 MUST 用 TDD 覆盖完整安装产物合规性，防止 `.harness` 骨架存在但 runtime projection 不可用。

#### Scenario: Claude full install fixture
- **WHEN** 测试在临时项目中模拟选择 Claude Code、inspect/sync/develop/review/knowledge、写入项目配置、完整质量门
- **THEN** 测试 MUST 断言 `.harness/adapters/shared/skills/harness/SKILL.md`、`.claude/skills/harness/SKILL.md`、`.claude/settings.json`、`.claude/hooks/`、Harness managed root docs 全部存在且内容合规

#### Scenario: Codex full install fixture
- **WHEN** 测试在临时项目中模拟选择 Codex、inspect/sync/develop/review/knowledge、写入项目配置、完整质量门
- **THEN** 测试 MUST 断言 `.agents/skills/harness/SKILL.md`、`.agents/skills/harness/agents/openai.yaml`、`.codex/hooks.json`、`.codex/hooks/`、`.codex/agents/` 全部存在且内容合规

#### Scenario: Unselected tool fixture
- **WHEN** 测试只选择 Claude Code 而不选择 Codex
- **THEN** 测试 MUST 断言 Codex runtime projection 不存在，同时安装摘要和 config 明确记录 `codex=false`

### Requirement: Doctor negative tests cover real gaps
系统 MUST 增加 doctor 负例测试，覆盖用户实测暴露的问题。

#### Scenario: Missing runtime hook negative test
- **WHEN** fixture 中存在 `.harness/adapters/claude/hooks/` 但删除 `.claude/hooks/` 和 `.claude/settings.json`
- **THEN** `harness doctor --json` 测试 MUST 断言返回非 0，并包含 `projection.runtimeHooks` 错误

#### Scenario: Stale DocSync docs negative test
- **WHEN** fixture 的 `AGENTS.md` 仍包含 `<!-- docsync:start -->` 和 `/docsync:sync`
- **THEN** `harness doctor --json` 测试 MUST 断言返回非 0，并包含 `managedDocs` 错误

#### Scenario: Incomplete Skill structure negative test
- **WHEN** fixture 中 `.harness/adapters/shared/skills/harness/` 缺少 `SKILL.md`
- **THEN** `harness doctor --json` 测试 MUST 断言返回非 0，并包含 `skillSource` 错误

### Requirement: Packaged npx artifact is verified
系统 MUST 在发布前验证 npm 包中包含安装所需的模板和投影生成资源。

#### Scenario: npm pack contains adapter templates
- **WHEN** 执行 `npm pack --dry-run`
- **THEN** 输出 MUST 包含生成 Skill、Agent、Hook、managed docs 所需的模板或编译后资源，不得只包含 CLI 代码而遗漏 adapter 资源

#### Scenario: Published package dogfood
- **WHEN** 使用打包产物在临时目标项目中执行等价于 `npx @hunterzheng/harness` 的初始化
- **THEN** 测试 MUST 使用打包产物而不是源码路径完成安装，并通过 artifact compliance assertions

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `npm test` / fixture-driven install tests / `npm pack --dry-run` |
| 输出类型 | Vitest 测试结果、pack 内容清单 |
| 版本依赖 | Node.js `>=20.0.0`，vitest `^2.0.0`，npm `>=10.0.0` |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 3010 | Install compliance test failed | fixture 安装产物不符合规范 |
| 3011 | Doctor negative test failed | doctor 未识别真实缺口 |
| 3012 | Packaged template missing | npm 包缺少 adapter/template 资源 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：测试必须覆盖 Claude、Codex、未选择工具、doctor 负例、pack dogfood
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
