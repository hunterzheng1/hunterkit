/**
 * Projection renderer - renders source templates into runtime projections
 * @module adapters/projection-renderer
 *
 * 为每个 Skill 生成独立 frontmatter，对齐 .claude/skills/harness-&#42;/SKILL.md 源文件
 */

import type { AdapterRegistryEntry } from './types.js';
import { buildManagedMetadata, renderMetadataComment } from './metadata.js';

/** Managed marker injected into projections */
export const MANAGED_MARKER = '<!-- harness-managed: do not edit manually -->';

/** 内部来源名称屏蔽映射 — sanitize Internal source names */
export const INTERNAL_NAME_MAP: Record<string, string> = {
  'docsync': 'sync',
  'gsd': '',
  'kld-sdd': 'develop',
  'kld-review': 'review',
};

/** 过滤内部来源名称 */
export function sanitizeInternalNames(text: string): string {
  let result = text;
  for (const [internal, external] of Object.entries(INTERNAL_NAME_MAP)) {
    if (external === '') {
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), '');
    } else {
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), external);
    }
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ============================================================
// Claude Skill 独立 frontmatter（按 skillName）
// ============================================================

const CLAUDE_SKILL_FRONTMATTER: Record<string, string> = {
  'harness-status': `---
name: harness-status
description: "查询 Harness 工作空间状态 — 查看初始化状态、已启用能力、schema 版本。零依赖只读命令，任何时候都可以运行。"
argument-hint: "[--json]"
user-invocable: true
disable-model-invocation: false
model: haiku
allowed-tools: Bash, Read
---`,

  'harness-doctor': `---
name: harness-doctor
description: "诊断 Harness 环境健康 — 检查 Node.js 版本、工作空间结构、Hook 投影一致性、Skill 源合规和安全基线"
argument-hint: "[--json]"
user-invocable: true
disable-model-invocation: false
model: haiku
allowed-tools: Bash, Read, Glob
---`,

  'harness-inspect': `---
name: harness-inspect
description: "项目结构扫描 — 生成 repo-map.json、module-map.md 和 rules.generated.md。通常是 Harness 项目的第一步操作。"
argument-hint: "[--full] [--path <dir>] [--rules]"
user-invocable: true
disable-model-invocation: true
model: sonnet
context: fork
agent: harness-code-researcher
allowed-tools: Bash, Read, Glob
---`,

  'harness-sync': `---
name: harness-sync
description: "同步 managed block 到根文档 — 将 Harness 工作流入口写入 README/AGENTS/CLAUDE 的托管区块"
argument-hint: "[--check] [--fast] [--docs <list>] [--dry-run]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Glob
---`,

  'harness-review': `---
name: harness-review
description: "代码审查 — 6 个 Reviewer 启发式扫描源代码，生成双格式（Markdown + JSON）审查报告。独立运行，M1 阶段仅本地启发式扫描。"
argument-hint: "[--local|--staged|--scan <path>] [--lite|--full] [--fix|--no-fix] [--dry-run]"
user-invocable: true
disable-model-invocation: false
model: sonnet
context: fork
agent: harness-code-reviewer
allowed-tools: Bash, Read, Glob, Grep
---`,

  'harness-develop': `---
name: harness-develop
description: "SDD（规范驱动开发）工作流 — 管理规范的完整生命周期：propose → spec → design → tasks → check → apply → archive"
argument-hint: "<change-name> [--propose|--spec|--design|--tasks|--check|--apply|--archive] [--from <stage>] [--capability <name>]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Glob
---`,

  'harness-knowledge': `---
name: harness-knowledge
description: "知识库索引和搜索 — 索引项目文档（specs/reports/rules/docs），支持全文搜索历史设计、规则和报告"
argument-hint: "[--index] [--search <query>] [--limit N] [--dry-run] [--json]"
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Glob, Grep
---`,

  'harness-config': `---
name: harness-config
description: "配置迁移和适配器修复 — 从旧工具迁移到 Harness 或重新生成 AI 工具适配器投影"
argument-hint: "[--migrate-docsync|--migrate-sdd|--migrate-review|--migrate-docs] [--repair-adapters] [--ai-tools <list>]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Glob
---`,
};

// ============================================================
// Claude Slash Command frontmatter（按 skillName）
// ============================================================

const CLAUDE_COMMAND_FRONTMATTER: Record<string, string> = {
  'harness-status': `---
name: "Harness: Status"
description: "查询工作空间状态 — 查看初始化状态和已启用能力"
argument-hint: "[--json]"
skill: harness-status
---`,

  'harness-doctor': `---
name: "Harness: Doctor"
description: "诊断环境健康 — 8 大类检查覆盖 Node.js、工作空间、Hook 投影、Skill 源合规、安全基线"
argument-hint: "[--json]"
skill: harness-doctor
---`,

  'harness-inspect': `---
name: "Harness: Inspect"
description: "扫描项目结构 — 生成 repo-map.json、module-map.md 和自动推导规则"
argument-hint: "[--full] [--path <dir>] [--rules]"
skill: harness-inspect
---`,

  'harness-sync': `---
name: "Harness: Sync"
description: "同步根文档 managed block — 将 Harness 工作流入口写入 README/AGENTS/CLAUDE"
argument-hint: "[--check] [--fast] [--docs <list>] [--dry-run]"
skill: harness-sync
---`,

  'harness-review': `---
name: "Harness: Review"
description: "启发式代码审查 — 6 个 reviewer 扫描代码查找安全漏洞、TODO、硬编码密钥等问题"
argument-hint: "[--local|--staged|--scan <path>] [--lite|--full] [--fix] [--dry-run] [--json]"
skill: harness-review
---`,

  'harness-develop': `---
name: "Harness: Develop"
description: "SDD 工作流 — 创建新变更提案（M1 阶段仅 --propose 可用）"
argument-hint: "<change-name> [--propose] [--from <stage>] [--capability <name>]"
skill: harness-develop
---`,

  'harness-knowledge': `---
name: "Harness: Knowledge"
description: "知识库搜索 — 索引项目文档并全文搜索历史设计、规则和报告"
argument-hint: "[--index] [--search <query>] [--limit N]"
skill: harness-knowledge
---`,

  'harness-config': `---
name: "Harness: Config"
description: "配置管理 — 从旧工具迁移或重新生成 AI 工具适配器投影"
argument-hint: "[--migrate-*] [--repair-adapters] [--ai-tools <list>]"
skill: harness-config
---`,
};

// ============================================================
// Codex Skill frontmatter（简化版）
// ============================================================

const CODEX_SKILL_FRONTMATTER: Record<string, string> = {
  'harness-status': `---
name: harness-status
description: Query Harness workspace status — initialization state, enabled capabilities, schema version.
---`,
  'harness-doctor': `---
name: harness-doctor
description: Diagnose Harness environment health — Node.js version, workspace structure, hooks, skill sources, safety baseline.
---`,
  'harness-inspect': `---
name: harness-inspect
description: Scan project structure — generate repo-map.json, module-map.md, and rules.generated.md.
---`,
  'harness-sync': `---
name: harness-sync
description: Sync managed blocks to root docs — write harness workflow entries to README/AGENTS/CLAUDE.
---`,
  'harness-review': `---
name: harness-review
description: Code review — 6 heuristic reviewers scan source code for security, contracts, standards, and history.
---`,
  'harness-develop': `---
name: harness-develop
description: SDD workflow — manage the full spec lifecycle: propose → spec → design → tasks → check → apply → archive.
---`,
  'harness-knowledge': `---
name: harness-knowledge
description: Knowledge index and search — full-text search project docs, specs, rules, and reports.
---`,
  'harness-config': `---
name: harness-config
description: Configuration migration and adapter repair — migrate from old tools or regenerate AI tool adapter projections.
---`,
};

/**
 * Render a projection from a source template
 */
export function renderProjection(entry: AdapterRegistryEntry, sourceContent: string): string {
  const lines: string[] = [];
  const skillName = entry.skillName;

  // Generate frontmatter based on tool type and source kind
  if (entry.tool === 'claude') {
    if (entry.sourceKind === 'slash-command' && skillName) {
      lines.push(CLAUDE_COMMAND_FRONTMATTER[skillName] || '');
    } else if (skillName) {
      lines.push(CLAUDE_SKILL_FRONTMATTER[skillName] || '');
    }
  } else if (entry.tool === 'codex' && skillName) {
    lines.push(CODEX_SKILL_FRONTMATTER[skillName] || '');
  }

  // Use unified metadata
  const metadata = buildManagedMetadata(sourceContent, entry.sourcePath);
  lines.push(renderMetadataComment(metadata));
  lines.push('');
  lines.push(sourceContent);
  return lines.join('\n');
}

/**
 * Check if content has the managed marker
 */
export function isManagedProjection(content: string): boolean {
  return content.includes(MANAGED_MARKER);
}