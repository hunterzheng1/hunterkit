# spec.md - 能力规格定义（增量）

> **定位**：`harness-adapter-skill-runtime` 的实施偏移修复规格
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

无。

### 修改需求

#### 需求项：Skill 投影 frontmatter 完整性

系统必须为 Claude/Codex 投影文件生成完整的 frontmatter，而非缺失。

##### 场景：Claude SKILL.md frontmatter
- **当** 用户选择 Claude Code 并完成初始化
- **预期** 系统必须生成 `.claude/skills/harness/SKILL.md`，包含完整 frontmatter：`name`、`description`、`when_to_use`、`argument-hint`、`user-invocable`、`disable-model-invocation`、`allowed-tools`、`model`、`effort`、`paths`

##### 场景：Codex SKILL.md frontmatter
- **当** 用户选择 Codex 并完成初始化
- **预期** 系统必须生成 `.agents/skills/harness/SKILL.md`，包含 `name`、`description` frontmatter

#### 需求项：Skill 源文件 references/scripts/assets 目录

系统必须在 `.harness/adapters/shared/skills/harness/` 下生成完整的 references、scripts、assets 目录。

##### 场景：生成 references 目录
- **当** 初始化完成
- **预期** 系统必须生成 `references/command-contract.md`、`references/document-contract.md`、`references/agent-orchestration.md`、`references/safety.md` 四个参考文档

##### 场景：生成 scripts 目录
- **当** 初始化完成
- **预期** 系统必须生成 `scripts/validate-workspace.mjs`、`scripts/run-harness.mjs`、`scripts/parse-result.mjs` 三个脚本文件

##### 场景：生成 assets 目录
- **当** 初始化完成
- **预期** 系统必须生成 `assets/AGENTS.block.md`、`assets/CLAUDE.template.md`、`assets/review-report.template.md` 三个模板文件

#### 需求项：Copilot/Cursor adapter 实现

系统必须实现 Copilot 和 Cursor adapter，生成对应的投影文件。

##### 场景：生成 Copilot 指令文件
- **当** 用户选择 Copilot 适配
- **预期** 系统必须生成 `.github/copilot-instructions.md`，包含仓库级编码规则和 Harness 命令引用

##### 场景：生成 Codex agent 定义
- **当** 用户选择 Codex 适配
- **预期** 系统必须生成 `.agents/skills/harness/agents/openai.yaml`，包含 `interface`（`display_name`、`short_description`、`default_prompt`）和 `policy`（`allow_implicit_invocation: false`）

#### 需求项：`--repair-adapters` 实现

系统必须实现 `harness config --repair-adapters` 命令，根据 `.harness/adapters/**` 重新生成所有运行时投影。

##### 场景：修复全部投影
- **当** 用户执行 `harness config --repair-adapters`
- **预期** 系统必须根据 `.harness/adapters/**` 重新生成 `.claude/`、`.agents/`、`.codex/`、`.github/` 中的必要投影，并报告修复文件列表

##### 场景：修复指定工具投影
- **当** 用户执行 `harness config --repair-adapters --ai-tools claude,codex`
- **预期** 系统必须只修复 Claude 和 Codex 的投影文件

#### 需求项：`--migrate-*` 四个迁移参数消除硬编码

系统必须逐一实现 `--migrate-docsync`、`--migrate-sdd`、`--migrate-review`、`--migrate-docs` 四个迁移参数，消除硬编码。

##### 场景：DocSync 迁移
- **当** 用户执行 `harness config --migrate-docsync --dry-run`
- **预期** 系统必须输出 `.docsync/` 到 `.harness/` 的迁移计划，包含来源文件、目标路径、冲突文件列表

##### 场景：SDD 迁移
- **当** 用户执行 `harness config --migrate-sdd --dry-run`
- **预期** 系统必须输出 `openspec/changes/**` 到 `.harness/develop/changes/**` 的迁移计划

##### 场景：Review 迁移
- **当** 用户执行 `harness config --migrate-review --dry-run`
- **预期** 系统必须输出 `.kld-review/` 到 `.harness/reports/review/` 的迁移计划

##### 场景：Docs 迁移
- **当** 用户执行 `harness config --migrate-docs --dry-run`
- **预期** 系统必须输出 `docs/adr/**` 到 `.harness/docs/adr/` 的迁移计划

### 移除需求

无。

---

## 2. 技术契约（SDD 扩展）

### 2.1 接口定义

#### 接口基本信息
- **路径**：`CLI: harness config --repair-adapters` / `CLI: harness config --migrate-*`
- **方法**：本地进程调用
- **内容类型**：终端文本；`--json` 时为 `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例值 | 约束条件 |
|-------|------|------|------|--------|----------|
| --repair-adapters | boolean | 否 | 重新生成运行时投影 | `true` | 仅 `config` 命令有效 |
| --ai-tools | string[] | 否 | 限定生成目标 | `claude,codex` | 枚举：`claude`、`codex`、`copilot`、`cursor` |
| --migrate-docsync | boolean | 否 | DocSync 迁移 | `true` | 配合 `--dry-run` 预览 |
| --migrate-sdd | boolean | 否 | SDD 迁移 | `true` | 配合 `--dry-run` 预览 |
| --migrate-review | boolean | 否 | Review 迁移 | `true` | 配合 `--dry-run` 预览 |
| --migrate-docs | boolean | 否 | Docs 迁移 | `true` | 配合 `--dry-run` 预览 |

#### 错误码定义
| 错误码 | 含义 | 触发条件 |
|-------|------|----------|
| 2205 | frontmatter 生成失败 | SKILL.md frontmatter 写入失败 |
| 2206 | references/scripts/assets 生成失败 | 源文件目录创建失败 |
| 2207 | Copilot 投影生成失败 | `.github/copilot-instructions.md` 写入失败 |
| 2208 | openai.yaml 生成失败 | Codex agent 定义写入失败 |

---

## 3. 物理约束

### 3.1 性能约束
| 指标 | 约束值 | 说明 |
|------|-------|------|
| frontmatter 生成 | < 500 毫秒 (P95) | 单个 SKILL.md |
| references/scripts/assets 生成 | < 2000 毫秒 (P95) | 全部源文件 |
| repair-adapters 全量修复 | < 5000 毫秒 (P95) | 投影文件数 < 200 |
| migrate 预览 | < 5000 毫秒 (P95) | 旧目录文件数 < 1000 |

### 3.2 资源约束
| 资源 | 限制 | 说明 |
|------|------|------|
| 存储 | < 20 MB | 源文件和投影总量 |

### 3.3 超时配置
- 总超时：30000 毫秒

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/adapters/projection-renderer.ts`：完善 frontmatter 生成
- [ ] `src/adapters/registry.ts`：添加 Copilot/Cursor adapter 定义
- [ ] `src/adapters/projection-writer.ts`：生成 `openai.yaml` 和 `copilot-instructions.md`
- [ ] `src/commands/config.ts`：实现 `--repair-adapters` 和 `--migrate-*`

### 4.2 外部依赖

| 组件类型 | 组件名称 | 版本 | 用途 | 降级策略 |
|---------|---------|------|------|---------|
| 运行时 | Node.js | >= 20.0.0 | 文件生成 | 阻断 |
| 配置格式 | YAML | 1.2 | openai.yaml | 回退 Markdown |

### 4.3 数据存储
- [ ] Markdown：`.claude/skills/harness/SKILL.md`（含 frontmatter）
- [ ] Markdown：`.agents/skills/harness/SKILL.md`（含 frontmatter）
- [ ] YAML：`.agents/skills/harness/agents/openai.yaml`
- [ ] Markdown：`.github/copilot-instructions.md`
- [ ] Markdown：`.harness/adapters/shared/skills/harness/references/*.md`
- [ ] JavaScript：`.harness/adapters/shared/skills/harness/scripts/*.mjs`
- [ ] Markdown：`.harness/adapters/shared/skills/harness/assets/*.md`

---

## 5. 安全与合规

### 5.1 权限要求
- 认证方式：本地文件系统权限
- 授权范围：`.harness/adapters/**` 和平台投影路径

### 5.2 数据安全
- 敏感字段：投影文件不得包含密钥或 token

### 5.3 审计要求
- 日志记录：生成/修复的文件列表、迁移计划

---

## 6. 兼容性

### 6.1 接口兼容性
- 是否向后兼容：是

### 6.2 数据兼容性
- 数据迁移方案：`--migrate-*` 命令先 dry-run 再执行
- 回滚策略：通过 transaction 回滚

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（5 个需求项，12 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 物理约束已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息
