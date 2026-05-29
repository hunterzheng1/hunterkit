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

## Usage

When the user asks to run harness commands, use:
\`\`\`bash
harness <command> [options]
\`\`\`

Available commands: inspect, sync, develop, review, knowledge, status, doctor, config
`;

/** Codex agent metadata template */
const CODEX_AGENT_TEMPLATE = `interface:
  display_name: Harness
  short_description: AI-assisted development workflow tool
  default_prompt: You are a helpful AI assistant for the Harness CLI tool.

policy:
  allow_implicit_invocation: false

tools:
  - name: harness
    description: Run harness CLI commands
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
