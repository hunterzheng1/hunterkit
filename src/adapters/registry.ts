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
const CODEX_AGENT_TEMPLATE = `name: harness
description: Harness CLI adapter for Codex
tools:
  - name: harness
    description: Run harness CLI commands
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
      projectionPath: '.github/copilot/skills/harness/SKILL.md',
      templateContent: SHARED_SKILL_TEMPLATE,
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
