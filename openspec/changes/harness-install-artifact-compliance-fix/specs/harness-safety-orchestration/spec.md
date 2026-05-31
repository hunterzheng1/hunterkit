## ADDED Requirements

### Requirement: Full quality gate runtime hook projection
系统 MUST 在用户选择“完整质量门”时生成 AI 工具实际可识别的 Hook 运行时投影，而不仅生成 `.harness/adapters/**` 下的源文件。

#### Scenario: Claude full quality gate projection
- **WHEN** 用户选择 Claude Code 且 Hook 强度为完整质量门
- **THEN** 系统 MUST 生成 `.harness/adapters/claude/settings.json`、`.harness/adapters/claude/hooks/*.sh`、`.claude/settings.json`、`.claude/hooks/*.sh`，且 `.claude/settings.json` MUST 引用 `.claude/hooks/` 下的运行时脚本

#### Scenario: Codex full quality gate projection
- **WHEN** 用户选择 Codex 且 Hook 强度为完整质量门
- **THEN** 系统 MUST 生成 `.harness/adapters/codex/hooks.json`、`.harness/adapters/codex/hooks/*.sh`、`.codex/hooks.json`、`.codex/hooks/*.sh`，且 `.codex/hooks.json` MUST 引用 `.codex/hooks/` 下的运行时脚本

#### Scenario: Source-only hooks are diagnosed
- **WHEN** `.harness/adapters/<tool>/hooks/` 存在但对应 runtime hook 目录或配置缺失
- **THEN** `harness doctor` MUST 返回 warning 或 error，并说明 Hook 当前不会被 AI 工具实际触发

### Requirement: Safety defaults match implementation plan
系统 MUST 在初始化配置中写入完整的默认安全规则，避免完整质量门只覆盖少量 secret pattern。

#### Scenario: Default secret patterns
- **WHEN** 系统生成 `.harness/config/harness.config.json`
- **THEN** `safety.secretPatterns` MUST 至少包含 `.env`、`.env.*`、`.env*`、`*.pem`、`*.key`、`*.p12`、`*.jks`、`*token*`、`*secret*`

#### Scenario: Default dangerous command policy
- **WHEN** 系统生成安全配置或 Hook 脚本
- **THEN** dangerous command 阻断策略 MUST 覆盖递归删除、强制 reset、凭据输出、密钥文件读取、未确认发布或推送等高风险操作，并在 Hook 文档中列出策略名称

### Requirement: Hook scripts are executable and cross-platform aware
系统 MUST 确保生成的 Hook 脚本在目标平台上具备可执行性和清晰降级策略。

#### Scenario: POSIX hook scripts
- **WHEN** 系统在 Windows、macOS 或 Linux 项目中生成 `.sh` Hook
- **THEN** 每个 `.sh` 文件 MUST 包含 shebang、managed marker、用途注释和项目根目录解析逻辑；在非 POSIX shell 不可用时，doctor MUST 给出降级提示

#### Scenario: Hook runtime scripts match source scripts
- **WHEN** Hook source 文件和 runtime 文件都存在
- **THEN** 系统 MUST 通过 hash 或 managed marker 校验二者一致性，并在漂移时要求 repair

### Requirement: Hook trust and activation guidance
系统 MUST 在安装摘要与 doctor 中明确 Hook 是否已经可被 AI 工具信任和激活。

#### Scenario: Codex hook trust reminder
- **WHEN** 用户选择 Codex hooks
- **THEN** 安装摘要和 doctor MUST 提示需要在 Codex 中检查并信任项目本地 hooks，且指出 `.codex/hooks.json` 路径

#### Scenario: Claude hook activation summary
- **WHEN** 用户选择 Claude hooks
- **THEN** 安装摘要和 doctor MUST 列出 `.claude/settings.json` 中已注册的 Hook 事件名称、脚本路径和启用状态

---

## SDD Extension

### Interface Contract

| 项目 | 契约 |
|------|------|
| CLI path | `harness init` / `harness doctor` |
| 输出类型 | Hook source files、runtime projection、doctor diagnostics |
| 版本依赖 | Node.js `>=20.0.0`，Git `>=2.30.0`（用于部分安全检查） |

### Error Codes

| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2701 | Hook runtime projection missing | 已选择完整质量门但 runtime hook 文件缺失 |
| 2702 | Safety defaults incomplete | `secretPatterns` 或危险命令策略少于基线 |
| 2703 | Hook projection drift | source 与 runtime hook hash 不一致 |

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景
> - [x] 使用「MUST / 必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化：Hook runtime 必须与所选工具和质量门一致
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
