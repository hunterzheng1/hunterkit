# spec.md - 能力规格定义（增量）

> **定位**：`harness-adapter-skill-runtime` — Skill/adapter 口径统一，让用户自然语言和 AI 工具 CLI 触发统一 Harness CLI
> **增量说明**：本文档为对 `openspec/specs/harness-adapter-skill-runtime/spec.md` 的增量修改
> **【质量红线】严禁描述模糊；约束必须量化
> **【格式要求】** 需求项使用 `####`（4个#），场景必须使用 `#####`（5个#）

---

## 1. 需求规格（官方格式）

### 新增需求

#### 需求项：Skill frontmatter 不暴露内部来源名

系统必须确保 Skill 投影文件的 frontmatter `description` 和 body 中不暴露 DocSync、GSD、kld-sdd、kld-review 等内部来源项目名。

##### 场景：Claude SKILL.md 描述审计
- **当** 生成 `.claude/skills/harness/SKILL.md`
- **预期** `description` 字段必须使用 "个人开发工具统一 CLI 入口" 或等价描述，不得出现 `docsync`、`gsd`、`kld-sdd`、`kld-review` 字样

##### 场景：Codex SKILL.md 描述审计
- **当** 生成 `.agents/skills/harness/SKILL.md`
- **预期** `description` 字段必须使用对外统一描述，不含内部来源项目名

##### 场景：references 文件描述审计
- **当** 生成 `references/*.md` 参考文档
- **预期** 文档中的能力来源说明不得出现 `docsync`、`gsd`、`kld-sdd`、`kld-review` 作为对外命令名

#### 需求项：Skill 引导 AI 工具 CLI 触发而非手动 shell

系统必须确保 Skill 的 body 和 description 引导 AI 工具在对话中触发 Harness 命令，而非引导用户手动在终端输入命令。

##### 场景：Skill body 示例格式
- **当** AI 工具加载 SKILL.md
- **预期** body 中的使用示例必须写成 "当用户说「审查代码」时，执行 `harness review --local`"，而非 "在终端输入 `harness review --local`"

##### 场景：Skill when_to_use 描述
- **当** AI 工具评估是否触发 Skill
- **预期** `when_to_use` 字段必须描述用户意图触发场景（如 "用户请求代码审查时"），而非 "用户在终端输入 review 命令时"

### 修改需求

#### 需求项：Skill 投影 frontmatter 完整性

系统必须为 Claude/Codex 投影文件生成完整的 frontmatter，而非缺失。

**增量修改**：补充 internal source 名称屏蔽约束。

##### 场景：Claude SKILL.md frontmatter（补充约束）
- **当** 用户选择 Claude Code 并完成初始化
- **预期** 系统生成 `name`、`description`、`when_to_use`、`argument-hint`、`user-invocable`、`disable-model-invocation`、`allowed-tools`、`model`、`effort`、`paths` — 其中 `description` 和 `when_to_use` 不得包含内部来源项目名

#### 需求项：Copilot/Cursor adapter 实现

系统必须实现 Copilot 和 Cursor adapter，生成对应的投影文件。

**增量修改**：新增 adapter 内容审计约束 — Copilot/Cursor 投影文件同样遵循内部名称屏蔽规则。

##### 场景：生成 Copilot 指令文件（补充约束）
- **当** 用户选择 Copilot 适配
- **预期** `.github/copilot-instructions.md` 中的能力描述和命令引用不得出现内部来源项目名

---

## 3. 技术契约（SDD 扩展）

### 内部名称屏蔽规则

| 屏蔽词 | 替换词 |
|-------|-------|
| `docsync` | `sync`（同步） |
| `gsd` | 不可出现 |
| `kld-sdd` | `develop`（开发工作流） |
| `kld-review` | `review`（代码审查） |

**适用范围**：所有投影文件的用户可见文本，包括 SKILL.md、references/*.md、agent 定义文件、copilot-instructions.md。

---

## 4. 影响模块

### 4.1 内部依赖
- [ ] `src/adapters/projection-renderer.ts`：frontmatter 生成时过滤内部来源名
- [ ] `src/adapters/projection-writer.ts`：生成投影文件时应用名称屏蔽规则
- [ ] `src/adapters/source-manager.ts`：源模板文件（references/scripts/assets）内容审计后更新
- [ ] `.harness/adapters/shared/skills/harness/references/*.md`：更新已有 references 文件
- [ ] `.harness/adapters/shared/skills/harness/assets/*.md`：更新已有 assets 模板文件

---

> **质量红线检查清单**
> - [x] 每个需求项至少有一个场景（2 新增 + 2 修改 = 4 个需求项，8 个场景）
> - [x] 使用「必须」强制要求
> - [x] 所有接口参数已量化
> - [x] 错误码已定义
> - [x] 技术选型已包含版本信息