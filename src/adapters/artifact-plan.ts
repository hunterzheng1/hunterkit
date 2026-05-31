/**
 * Artifact plan builder - constructs source/runtime/skipped artifact plans
 * @module adapters/artifact-plan
 *
 * Used by init, repair, and doctor to build a consistent view of
 * expected vs actual artifacts across all AI tool adapters.
 */

import type { AdapterRegistryEntry, AdapterTool, ArtifactPlanEntry } from './types.js';

/** Tools that generate agent definitions (currently Claude and Codex) */
const AGENT_TOOLS: AdapterTool[] = ['claude', 'codex'];

/**
 * Build an artifact plan based on selected tools and registry entries
 * @param selectedTools - user-selected AI tools
 * @param entries - full adapter registry
 * @returns classified artifact plan
 */
export function buildArtifactPlan(
  selectedTools: AdapterTool[],
  entries: AdapterRegistryEntry[],
): ArtifactPlanEntry[] {
  const plan: ArtifactPlanEntry[] = [];

  for (const entry of entries) {
    const isSelected = selectedTools.includes(entry.tool);

    if (isSelected) {
      // Source entries
      plan.push({
        tool: entry.tool,
        sourcePath: entry.sourcePath,
        projectionPath: entry.projectionPath,
        kind: 'source',
        status: 'planned',
      });

      // Runtime projection
      plan.push({
        tool: entry.tool,
        sourcePath: entry.sourcePath,
        projectionPath: entry.projectionPath,
        kind: 'runtime',
        status: 'planned',
      });
    } else {
      // Skipped runtime
      plan.push({
        tool: entry.tool,
        sourcePath: entry.sourcePath,
        projectionPath: entry.projectionPath,
        kind: 'skipped',
        status: 'skipped',
        reason: 'tool not selected',
      });
    }
  }

  // Add agent projections for selected tools
  for (const tool of selectedTools) {
    if (AGENT_TOOLS.includes(tool)) {
      plan.push({
        tool,
        sourcePath: `.harness/adapters/${tool}/agents/harness-finding-validator.md`,
        projectionPath: tool === 'claude'
          ? '.claude/agents/harness-finding-validator.md'
          : `.codex/agents/harness-finding-validator.toml`,
        kind: 'runtime',
        status: 'planned',
      });
    }
  }

  return plan;
}

/**
 * Compute expected runtime projection paths for a given tool
 * @param tool - AI tool
 * @param entries - full adapter registry
 * @returns list of expected runtime paths
 */
export function getExpectedRuntimePaths(
  tool: AdapterTool,
  entries: AdapterRegistryEntry[],
): string[] {
  const paths: string[] = [];

  const toolEntries = entries.filter(e => e.tool === tool);
  for (const entry of toolEntries) {
    paths.push(entry.projectionPath);
  }

  if (AGENT_TOOLS.includes(tool)) {
    paths.push(
      tool === 'claude'
        ? '.claude/agents/harness-finding-validator.md'
        : `.codex/agents/harness-finding-validator.toml`,
    );
  }

  return paths;
}