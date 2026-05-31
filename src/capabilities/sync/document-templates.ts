/**
 * Document templates - managed block content for root documents
 * @module capabilities/sync/document-templates
 *
 * Centralized templates for AGENTS.md, CLAUDE.md, Codex entry, and README
 * managed blocks. Ensures consistent wording across init and sync.
 */

/**
 * Render the AGENTS.md managed block
 */
export function renderAgentsManagedBlock(): string {
  return `## Harness 工作流入口

本项目使用 **Harness** 统一 CLI 管理 AI 辅助开发。通过单一 \`harness\` Skill 使用以下能力：

| 能力 | AI 自然语言触发 | CLI 等效命令 |
|------|---------------|-------------|
| 项目检查 | "帮我了解这个项目" / "扫描项目结构" | \`harness inspect\` |
| 文档同步 | "同步文档" / "更新 AGENTS" | \`harness sync\` |
| 功能开发 | "开发一个新功能" / "继续实现" | \`harness develop <change>\` |
| 代码审查 | "帮我审查代码" / "review 这个 PR" | \`harness review --local\` |
| 知识搜索 | "搜索项目知识库" / "查找历史设计" | \`harness knowledge --search\` |
| 项目诊断 | "检查项目状态" / "运行诊断" | \`harness doctor\` |

### 安装与初始化

在 AI 工具 CLI 中让工具执行：

\`\`\`bash
npx @hunterzheng/harness
\`\`\`

### 内部来源说明

本 Skill 整合了以下内部工具链能力，用户通过 \`harness\` 统一入口使用：

- \`docsync\` → sync（文档同步）
- \`kld-sdd\` → develop（规格驱动开发）
- \`kld-review\` → review（代码审查）
- \`gsd\` →（已合并到 inspect + develop）`;
}

/**
 * Render the CLAUDE.md short entry
 */
export function renderClaudeShortEntry(): string {
  return `## Harness

本项目使用 Harness 统一 CLI。通过 \`harness\` Skill 使用所有能力。

详细说明见：\`.claude/skills/harness/SKILL.md\`

初始化：在 Claude Code CLI 中执行 \`npx @hunterzheng/harness\``;
}

/**
 * Render the Codex entry (for AGENTS.md)
 */
export function renderCodexShortEntry(): string {
  return `## Codex Integration

本项目通过 \`.agents/skills/harness/SKILL.md\` 提供 Harness Skill。
在 AGENTS.md 中通过自然语言触发 \`harness\` 相关操作。`;
}

/**
 * Render README daily usage section
 */
export function renderReadmeUsageBlock(): string {
  return `## 日常使用

在 AI 工具 CLI 中通过 \`harness\` Skill 使用所有功能：

| 想做什么 | 对话中直接说 |
|---------|------------|
| 了解项目结构 | "帮我 inspect 一下项目" |
| 同步文档 | "sync 项目文档" |
| Code Review | "review 我的代码" |
| 功能开发 | "创建新功能 change" |
| 搜索知识 | "搜索项目中关于 XX 的设计" |

**初始化**（仅首次）：
\`\`\`bash
npx @hunterzheng/harness
\`\`\``;
}