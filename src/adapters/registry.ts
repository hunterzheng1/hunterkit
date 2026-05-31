/**
 * Adapter registry - registers all AI tool adapter definitions
 * @module adapters/registry
 */

import type { AdapterRegistryEntry, AdapterTool } from './types.js';

/** Shared harness skill template */
const SHARED_SKILL_TEMPLATE = `# Harness Skill

> This skill routes commands to the \`harness\` CLI.
> Source of truth: \`.harness/adapters/\`
> Repair: \`harness config --repair-adapters\`

## Command Mapping

Map user intent to CLI commands, execute, and display a brief result summary.

| 用户意图 / 自然语言 | CLI 命令 | 操作 |
|-------------------|---------|------|
| 扫描项目结构 / 了解项目 / inspect | \`harness inspect\` | Read-only scan, show facts summary |
| 同步文档 / 更新 AGENTS / sync | \`harness sync\` | Sync docs, show drift report |
| 功能开发 / 规格驱动流程 | \`harness develop <change>\` | Run dev workflow stage |
| 代码审查 / review / 检查代码 | \`harness review --local\` | Run review, show findings summary |
| 搜索知识库 / 查找历史设计 | \`harness knowledge --search "query"\` | Search project knowledge |
| 查看项目状态 | \`harness status\` | Show workspace + capabilities |
| 诊断环境 | \`harness doctor\` | Check deps + config + hooks |
| 管理配置 | \`harness config\` | View/edit harness config |

## Output

- For human-readable output, display the CLI result summary.
- For JSON output, add \`--json\` flag.
- For preview without file writes, add \`--dry-run\` flag.
- Always report the exit code (0 = success, non-zero = issue found).
`;

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

## Project Overview

Harness is a CLI tool that provides:
- Project structure inspection and fact generation
- Document synchronization with knowledge base
- Development workflow automation
- Code review with AI assistance
- Knowledge management and search

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
- \`.harness/docs/\` - Generated documentation
- \`.harness/adapters/\` - AI tool adapters

## Guidelines

1. Always check \`harness status\` before making changes
2. Use \`harness review\` before committing code
3. Respect managed document boundaries (look for \`<!-- harness-managed -->\` markers)
4. Use \`harness knowledge --search\` to find project-specific patterns

## Configuration

See \`.harness/config/harness.config.json\` for project configuration.
`;

/**
 * Create the adapter registry with all platform definitions
 */
export function createAdapterRegistry(): AdapterRegistryEntry[] {
  return [
    {
      tool: 'claude',
      sourcePath: '.harness/adapters/claude/skills/harness/SKILL.md',
      projectionPath: '.claude/skills/harness/SKILL.md',
      templateContent: SHARED_SKILL_TEMPLATE,
    },
    {
      tool: 'codex',
      sourcePath: '.harness/adapters/codex/skills/harness/SKILL.md',
      projectionPath: '.agents/skills/harness/SKILL.md',
      templateContent: SHARED_SKILL_TEMPLATE,
    },
    {
      tool: 'codex',
      sourcePath: '.harness/adapters/codex/skills/harness/agents/openai.yaml',
      projectionPath: '.agents/skills/harness/agents/openai.yaml',
      templateContent: CODEX_AGENT_TEMPLATE,
    },
    {
      tool: 'copilot',
      sourcePath: '.harness/adapters/copilot/skills/harness/SKILL.md',
      projectionPath: '.github/copilot-instructions.md',
      templateContent: COPILOT_INSTRUCTIONS_TEMPLATE,
    },
    {
      tool: 'cursor',
      sourcePath: '.harness/adapters/cursor/skills/harness/SKILL.md',
      projectionPath: '.cursor/skills/harness/SKILL.md',
      templateContent: SHARED_SKILL_TEMPLATE,
    },
  ];
}

/**
 * Filter registry entries by tool
 */
export function filterByTool(entries: AdapterRegistryEntry[], tools: AdapterTool[]): AdapterRegistryEntry[] {
  if (tools.length === 0) return entries;
  return entries.filter(e => tools.includes(e.tool));
}
