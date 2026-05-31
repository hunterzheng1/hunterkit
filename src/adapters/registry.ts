/**
 * Adapter registry - registers all AI tool adapter definitions
 * @module adapters/registry
 *
 * 为每个 AI 工具生成 8 个独立 Skill 文件 + 8 个 Slash Command（仅 Claude）
 * 对齐 .claude/skills/harness-&#42;/SKILL.md 源文件结构
 */

import type { AdapterRegistryEntry, AdapterTool } from './types.js';
import { DEFAULT_REPAIR_COMMAND } from './metadata.js';

// ============================================================
// 8 个 Skill 模板（简化版，适配目标项目）
// ============================================================

/** harness-status 模板 */
function createStatusTemplate(): string {
  return `# Harness Status

> 查询 Harness 工作空间状态 — 零依赖只读命令。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "检查状态" / "查看配置" | 运行 \`harness status\` 并解读 |
| "是否初始化" | 检查 \`initialized\` 字段 |
| "已启用哪些能力" | 聚焦 \`capabilities\` 字段 |
| "JSON 输出" | 运行 \`harness status --json\` |

## 执行

\`\`\`bash
harness status [--json]
\`\`\`

## Guardrails

- 只读约束：不执行任何写入操作
- 零依赖：未初始化的项目也能运行
- 不自动触发初始化：发现未初始化仅提示建议
`;
}

/** harness-doctor 模板 */
function createDoctorTemplate(): string {
  return `# Harness Doctor

> 诊断 Harness 环境健康 — 8 大类检查覆盖 Node.js 版本、工作空间结构、Hook 投影、Skill 源合规和安全基线。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "诊断环境" / "检查健康" | 运行 \`harness doctor\` 并逐项解读 |
| "hooks 是否生效" | 聚焦 \`projection.runtimeHooks\` |
| "适配器是否正常" | 聚焦 \`projection.runtimeSkills\` + \`skillSource\` |
| "修复建议" | 逐项展示 \`repairCommand\`，不自动执行 |

## 执行

\`\`\`bash
harness doctor [--json]
\`\`\`

## Guardrails

- 只读约束：绝不自动执行修复
- 零依赖运行：未初始化项目也能运行基础检查
- 退出码：存在 ERROR 时退出码为 1
`;
}

/** harness-inspect 模板 */
function createInspectTemplate(): string {
  return `# Harness Inspect

> 项目结构扫描 — 生成 repo-map.json、module-map.md 和 rules.generated.md。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "扫描项目" / "分析结构" | 运行 \`harness inspect\`（增量模式） |
| "全量扫描" / "强制扫描" | 运行 \`harness inspect --full\` |
| "扫描指定目录" | 运行 \`harness inspect --path <dir>\` |
| "生成编码规则" | 运行 \`harness inspect --rules\` |

## 三种产物

| 产物 | 路径 | 说明 |
|------|------|------|
| repo-map.json | \`.harness/facts/repo-map.json\` | 结构化项目事实 |
| module-map.md | \`.harness/generated/module-map.md\` | 可读模块映射 |
| rules.generated.md | \`.harness/generated/rules.generated.md\` | 自动推导规则（--rules） |

## 执行

\`\`\`bash
harness inspect [--full] [--path <dir>] [--rules]
\`\`\`

## Guardrails

- 写入范围限制：仅 .harness/facts/ 和 .harness/generated/
- 不覆盖人工规则：不会修改 .harness/rules/
- 自动增量：默认不覆盖已有数据（除非 --full）
- 不自动触发下游：完成后不自动运行 review/sync
`;
}

/** harness-sync 模板 */
function createSyncTemplate(): string {
  return `# Harness Sync

> 同步 managed block 到根文档 — 写入 README/AGENTS/CLAUDE 的托管区块。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "同步文档" / "更新 managed block" | 先检查 repo-map.json，再运行 \`harness sync\` |
| "检查是否漂移" | 运行 \`harness sync --check\`（只读） |
| "只更新 README" | 运行 \`harness sync --docs readme\` |
| "预览同步" | 运行 \`harness sync --dry-run\` |

## 前置依赖

**必须先运行 \`harness inspect\`** 生成 repo-map.json。

## 执行

\`\`\`bash
harness sync [--check] [--fast] [--docs <list>] [--dry-run]
\`\`\`

## Guardrails

- 不覆盖用户内容：仅修改 managed block（<!-- harness:start --> ... <!-- harness:end -->）
- 事务写入：所有写入通过事务系统原子提交
- --check 只读：不写入文件，漂移时返回 2401
`;
}

/** harness-review 模板 */
function createReviewTemplate(): string {
  return `# Harness Review

> 6 个 Reviewer 启发式扫描源代码，生成双格式审查报告。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "审查代码" / "review" | 确认范围后运行 \`harness review\` |
| "快速检查" | 运行 \`harness review --lite\` |
| "深度审查" / "全面审查" | 运行 \`harness review --full\` |
| "审查本地变更" | 运行 \`harness review --local --full\` |
| "审查暂存区" | 运行 \`harness review --staged\` |
| "自动修复" | 运行 \`harness review --fix\`（仅 P2） |

## 6 个 Reviewer

| Reviewer | 检测内容 |
|----------|---------|
| rules-reviewer | TODO/FIXME/HACK/XXX 注释 |
| bug-scanner | 非测试代码中的调试输出 |
| deep-bug-analyzer | 硬编码密钥 |
| history-reviewer | 高频修改文件风险 |
| standards-reviewer | 代码风格、命名规范 |
| contract-reviewer | 导出缺少 @contract 注释 |

## 执行

\`\`\`bash
harness review [--local|--staged|--scan <path>] [--lite|--full] [--fix] [--dry-run]
\`\`\`

## Guardrails

- 独立运行：不依赖 inspect
- 写入限制：仅 .harness/reports/review/
- 置信度过滤：< 80 的发现自动丢弃
- P0 阻断：security + confidence >= 90 触发非零退出码

## Supporting Files

- 详见 \`reference.md\` 了解 6 个 Reviewer 的检测正则和置信度计算
`;
}

/** harness-develop 模板 */
function createDevelopTemplate(): string {
  return `# Harness Develop

> SDD（Specification-Driven Development）工作流 — 管理规范的完整生命周期。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "创建提案" / "propose" | 验证名称 → 运行 \`harness develop <name> --propose\` |
| "查看变更状态" | 运行 \`harness develop <name>\` |
| "预览" | 运行 \`harness develop <name> --propose --dry-run\` |

## 7 个阶段

| 阶段 | 标志 | M1 状态 |
|------|------|--------|
| 1. propose | --propose | ✅ 可用 |
| 2. spec | --spec | ⏳ 后续版本 |
| 3. design | --design | ⏳ 后续版本 |
| 4. tasks | --tasks | ⏳ 后续版本 |
| 5. check | --check | ⏳ 后续版本 |
| 6. apply | --apply | ⛔ 阻断（需 check 先完成） |
| 7. archive | --archive | ⏳ 后续版本 |

## 执行

\`\`\`bash
harness develop <change-name> [--propose] [--from <stage>] [--capability <name>]
\`\`\`

## Guardrails

- 单阶段执行：每次只执行一个阶段
- 变更名称：kebab-case，3-80 字符
- 完成后立即停止：不自动进入下一阶段
- M1 限制透明：告知用户当前仅 --propose 可用

## Supporting Files

- 详见 \`reference.md\` 了解 7 个阶段的输入/输出/边界约束
`;
}

/** harness-knowledge 模板 */
function createKnowledgeTemplate(): string {
  return `# Harness Knowledge

> 知识库索引和搜索 — 全文搜索历史设计、规则和报告。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "构建索引" / "索引项目" | 运行 \`harness knowledge --index\` |
| "搜索" / "查找" | 运行 \`harness knowledge --search "<query>"\` |
| "索引并搜索" | 先 --index，再 --search |

## 知识源目录

| 源目录 | 类型 |
|--------|------|
| .harness/develop/ | spec |
| .harness/docs/ | rule |
| .harness/rules/ | rule |
| .harness/reports/ | report |
| openspec/changes/ | spec |

## 执行

\`\`\`bash
harness knowledge --index           # 构建索引
harness knowledge --search "<q>"    # 全文搜索
\`\`\`

## Guardrails

- 索引优先：搜索前必须至少运行一次 --index
- 增量更新：重复 --index 仅处理变更文件
- 存储隔离：索引数据库位于 .harness/cache/
`;
}

/** harness-config 模板 */
function createConfigTemplate(): string {
  return `# Harness Config

> 配置迁移和适配器修复 — 从旧工具迁移或重新生成 AI 工具适配器投影。

## 意图路由表

| 用户意图 | 执行策略 |
|---------|---------|
| "从 docsync 迁移" | 运行 \`harness config --migrate-docsync\` |
| "修复适配器" / "repair" | 运行 \`harness config --repair-adapters\` |
| "只修复 Claude" | 运行 \`harness config --repair-adapters --ai-tools claude\` |
| "预览修复" | 运行 \`harness config --repair-adapters --dry-run\` |

## 两大模式

### 迁移（Migration）
- --migrate-docsync：从旧 .docsync/ 迁移
- --migrate-sdd：从旧 kld-sdd/ 迁移
- --migrate-review：从旧 kld-review/ 迁移

### 修复（Repair）
- --repair-adapters：重新生成所有运行时投影
- --ai-tools <list>：指定工具（claude,codex,copilot,cursor）

## 执行

\`\`\`bash
harness config --repair-adapters [--ai-tools <list>] [--dry-run]
\`\`\`

## Guardrails

- 事务安全：所有写入通过事务执行
- 冲突保护：非托管文件不被覆盖
- 修复幂等：多次运行结果一致
`;
}

// ============================================================
// Agent 模板（harness Subagent 定义）
// ============================================================

function createCodeReviewerAgentTemplate(): string {
  return `你是一个 Harness 代码审查执行引擎。在隔离上下文中运行 \`harness review\` 命令，对代码进行启发式扫描。

## 审查流程

1. 确认范围：根据传入参数确定审查范围（--local / --staged / --scan <path> / 全量）
2. 执行审查：运行 \`harness review [范围] [--lite|--full]\`
3. 收集结果：读取 .harness/reports/review/ 目录下的最新报告
4. 返回摘要：P0（阻断）/ P1（重要）/ P2（建议）

## 6 个 Reviewer

| Reviewer | 检测内容 |
|----------|---------|
| rules-reviewer | TODO/FIXME/HACK/XXX 注释 |
| bug-scanner | 非测试代码中的调试输出 |
| deep-bug-analyzer | 硬编码密钥 |
| history-reviewer | 高频修改文件风险 |
| standards-reviewer | 代码风格、命名规范 |
| contract-reviewer | 导出缺少 @contract 注释 |

## 规则

- 不修改项目源代码（--fix 仅修复 P2 级别）
- 不修改 .harness/config/ 配置
- 置信度 < 80 的发现自动丢弃
- 仅审查 .ts/.tsx/.js/.jsx/.py/.java/.go/.rs 文件
`;
}

function createCodeResearcherAgentTemplate(): string {
  return `你是一个 Harness 项目结构研究引擎。在隔离上下文中运行 \`harness inspect\` 命令，扫描项目并生成事实数据。

## 扫描流程

1. 确认工作空间：验证 .harness/config/harness.config.json 存在
2. 执行扫描：运行 \`harness inspect [--full] [--path <dir>] [--rules]\`
3. 收集产物：读取 repo-map.json、module-map.md、rules.generated.md
4. 返回摘要：语言、构建文件、文档、Agent 配置、CI 配置

## 产物说明

| 产物 | 路径 | 说明 |
|------|------|------|
| repo-map.json | .harness/facts/repo-map.json | 结构化项目事实 |
| module-map.md | .harness/generated/module-map.md | 可读模块映射 |
| rules.generated.md | .harness/generated/rules.generated.md | 自动推导规则 |

## 规则

- 只读为主：仅写入 .harness/facts/ 和 .harness/generated/
- 不修改项目源代码或配置
- 不覆盖人工维护的规则文件
- 不自动触发下游 review/sync 流程
`;
}

// ============================================================
// Skill 名称 → 模板 映射表
// ============================================================

const SKILL_TEMPLATES: Record<string, () => string> = {
  'harness-status': createStatusTemplate,
  'harness-doctor': createDoctorTemplate,
  'harness-inspect': createInspectTemplate,
  'harness-sync': createSyncTemplate,
  'harness-review': createReviewTemplate,
  'harness-develop': createDevelopTemplate,
  'harness-knowledge': createKnowledgeTemplate,
  'harness-config': createConfigTemplate,
};

const SKILL_NAMES = Object.keys(SKILL_TEMPLATES);

// ============================================================
// 其他模板（非 Skill 条目）
// ============================================================

/** Codex agent metadata template */
const CODEX_AGENT_TEMPLATE = `interface:
  display_name: Harness
  short_description: Unified local CLI for inspect, sync, develop, review, and knowledge workflows
  default_prompt: Use Harness to run the requested project workflow.

policy:
  allow_implicit_invocation: false
`;

/** Copilot instructions template */
const COPILOT_INSTRUCTIONS_TEMPLATE = `# GitHub Copilot Instructions

This repository uses Harness for AI-assisted development.

## Available Commands

\`\`\`bash
harness inspect    # Scan project structure
harness sync       # Sync documents
harness develop    # Run development workflow
harness review     # Run code review
harness knowledge  # Manage knowledge index
harness status     # Show workspace status
harness doctor     # Diagnose environment
harness config     # Manage configuration
\`\`\`

## Key Directories

- \`.harness/\` - Harness workspace root
- \`.harness/config/\` - Configuration files
- \`.harness/facts/\` - Project facts database

## Guidelines

1. Always check \`harness status\` before making changes
2. Use \`harness review\` before committing code
3. Respect managed document boundaries (look for \`<!-- harness-managed -->\` markers)
`;

/**
 * Create the adapter registry with all platform definitions
 *
 * 对每个工具（claude/codex/cursor）生成 8 个独立 Skill + 2 个 Agent
 * - Copilot: 保持单文件指令格式
 */
export function createAdapterRegistry(): AdapterRegistryEntry[] {
  const entries: AdapterRegistryEntry[] = [];

  // ============================================================
  // Claude: 8 个 Skill + 2 个 Agent
  // ============================================================
  for (const skillName of SKILL_NAMES) {
    entries.push({
      tool: 'claude',
      sourcePath: `.harness/adapters/claude/skills/${skillName}/SKILL.md`,
      projectionPath: `.claude/skills/${skillName}/SKILL.md`,
      templateContent: SKILL_TEMPLATES[skillName](),
      kind: 'source',
      sourceKind: 'skill',
      skillName,
      repairCommand: DEFAULT_REPAIR_COMMAND,
    });
  }

  // Claude Agents
  entries.push({
    tool: 'claude',
    sourcePath: '.harness/adapters/claude/agents/harness-code-reviewer.md',
    projectionPath: '.claude/agents/harness-code-reviewer.md',
    templateContent: createCodeReviewerAgentTemplate(),
    kind: 'source',
    sourceKind: 'agent',
    repairCommand: DEFAULT_REPAIR_COMMAND,
  });

  entries.push({
    tool: 'claude',
    sourcePath: '.harness/adapters/claude/agents/harness-code-researcher.md',
    projectionPath: '.claude/agents/harness-code-researcher.md',
    templateContent: createCodeResearcherAgentTemplate(),
    kind: 'source',
    sourceKind: 'agent',
    repairCommand: DEFAULT_REPAIR_COMMAND,
  });

  // ============================================================
  // Codex: 8 个 Skill（.agents/skills/harness-*/）
  // ============================================================
  for (const skillName of SKILL_NAMES) {
    entries.push({
      tool: 'codex',
      sourcePath: `.harness/adapters/codex/skills/${skillName}/SKILL.md`,
      projectionPath: `.agents/skills/${skillName}/SKILL.md`,
      templateContent: SKILL_TEMPLATES[skillName](),
      kind: 'source',
      sourceKind: 'skill',
      skillName,
      repairCommand: DEFAULT_REPAIR_COMMAND,
    });
  }

  // Codex agent metadata（保持不变）
  entries.push({
    tool: 'codex',
    sourcePath: '.harness/adapters/codex/skills/harness/agents/openai.yaml',
    projectionPath: '.agents/skills/harness/agents/openai.yaml',
    templateContent: CODEX_AGENT_TEMPLATE,
    kind: 'source',
    sourceKind: 'metadata',
    repairCommand: DEFAULT_REPAIR_COMMAND,
  });

  // ============================================================
  // Copilot: 保持单文件指令格式
  // ============================================================
  entries.push({
    tool: 'copilot',
    sourcePath: '.harness/adapters/copilot/skills/harness/SKILL.md',
    projectionPath: '.github/copilot-instructions.md',
    templateContent: COPILOT_INSTRUCTIONS_TEMPLATE,
    kind: 'source',
    sourceKind: 'skill',
    repairCommand: DEFAULT_REPAIR_COMMAND,
  });

  // ============================================================
  // Cursor: 8 个 Skill（.cursor/skills/harness-*/）
  // ============================================================
  for (const skillName of SKILL_NAMES) {
    entries.push({
      tool: 'cursor',
      sourcePath: `.harness/adapters/cursor/skills/${skillName}/SKILL.md`,
      projectionPath: `.cursor/skills/${skillName}/SKILL.md`,
      templateContent: SKILL_TEMPLATES[skillName](),
      kind: 'source',
      sourceKind: 'skill',
      skillName,
      repairCommand: DEFAULT_REPAIR_COMMAND,
    });
  }

  return entries;
}

/**
 * Filter registry entries by tool
 */
export function filterByTool(entries: AdapterRegistryEntry[], tools: AdapterTool[]): AdapterRegistryEntry[] {
  if (tools.length === 0) return entries;
  return entries.filter(e => tools.includes(e.tool));
}