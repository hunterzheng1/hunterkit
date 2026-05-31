/**
 * Artifact health model - computes expected vs actual artifact status
 * @module core/artifact-health
 *
 * Used by doctor and status commands to determine whether
 * runtime projections match the selected tool configuration.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdapterRegistryEntry } from '../adapters/types.js';
import { getExpectedRuntimePaths } from '../adapters/artifact-plan.js';

/** Health check result */
export interface ArtifactHealthCheck {
  id: string;
  status: 'OK' | 'WARN' | 'ERROR';
  severity: 'info' | 'warn' | 'error';
  message: string;
  paths: string[];
  repairCommand: string;
}

/** Artifact health result */
export interface ArtifactHealthResult {
  checks: ArtifactHealthCheck[];
  overallStatus: 'OK' | 'WARN' | 'ERROR';
}

/**
 * Diagnose runtime projection consistency
 * Checks if selected tools have their expected runtime projections present
 */
export function diagnoseRuntimeProjectionConsistency(
  cwd: string,
  selectedTools: string[],
  entries: AdapterRegistryEntry[],
  expectedRuntimePaths: string[],
): ArtifactHealthCheck[] {
  const checks: ArtifactHealthCheck[] = [];

  for (const tool of selectedTools) {
    const toolEntries = entries.filter(e => e.tool === tool);

    for (const entry of toolEntries) {
      const runtimePath = resolve(cwd, entry.projectionPath);
      const exists = existsSync(runtimePath);

      if (!exists) {
        checks.push({
          id: `projection.${entry.sourceKind ?? 'skill'}.${entry.tool}`,
          status: 'ERROR',
          severity: 'error',
          message: `${tool} runtime projection missing: ${entry.projectionPath}`,
          paths: [entry.projectionPath],
          repairCommand: `harness config --repair-adapters --ai-tools=${tool}`,
        });
      }
    }
  }

  return checks;
}

/**
 * Diagnose hook runtime projection gap
 */
export function diagnoseRuntimeHooks(
  cwd: string,
  selectedTools: string[],
  hookStrength: string,
): ArtifactHealthCheck[] {
  if (hookStrength === 'none') return [];
  const checks: ArtifactHealthCheck[] = [];

  for (const tool of selectedTools) {
    if (tool === 'claude') {
      const hooksDir = resolve(cwd, '.claude/hooks');
      const settingsPath = resolve(cwd, '.claude/settings.json');

      if (!existsSync(settingsPath) || !existsSync(hooksDir)) {
        checks.push({
          id: 'projection.runtimeHooks',
          status: 'ERROR',
          severity: 'error',
          message: `Claude Code runtime hooks missing: .claude/hooks/ or .claude/settings.json not found`,
          paths: ['.claude/hooks/', '.claude/settings.json'],
          repairCommand: 'harness config --repair-adapters',
        });
      }
    }

    if (tool === 'codex') {
      const hooksDir = resolve(cwd, '.codex/hooks');
      const hooksJson = resolve(cwd, '.codex/hooks.json');

      if (!existsSync(hooksJson) || !existsSync(hooksDir)) {
        checks.push({
          id: 'projection.runtimeHooks',
          status: 'WARN',
          severity: 'warn',
          message: `Codex runtime hooks missing: .codex/hooks/ or .codex/hooks.json not found`,
          paths: ['.codex/hooks/', '.codex/hooks.json'],
          repairCommand: 'harness config --repair-adapters',
        });
      }
    }
  }

  return checks;
}

/**
 * Diagnose Skill source structure
 */
export function diagnoseSkillSource(cwd: string): ArtifactHealthCheck[] {
  const sharedSkillPath = resolve(cwd, '.harness/adapters/shared/skills/harness/SKILL.md');
  const referencesDir = resolve(cwd, '.harness/adapters/shared/skills/harness/references');
  const scriptsDir = resolve(cwd, '.harness/adapters/shared/skills/harness/scripts');
  const assetsDir = resolve(cwd, '.harness/adapters/shared/skills/harness/assets');

  const missing: string[] = [];
  if (!existsSync(sharedSkillPath)) missing.push('.harness/adapters/shared/skills/harness/SKILL.md');
  if (!existsSync(referencesDir)) missing.push('.harness/adapters/shared/skills/harness/references/');
  if (!existsSync(scriptsDir)) missing.push('.harness/adapters/shared/skills/harness/scripts/');
  if (!existsSync(assetsDir)) missing.push('.harness/adapters/shared/skills/harness/assets/');

  if (missing.length > 0) {
    return [{
      id: 'skillSource',
      status: 'ERROR',
      severity: 'error',
      message: `Shared Skill source structure incomplete: ${missing.join(', ')}`,
      paths: missing,
      repairCommand: 'harness config --repair-adapters',
    }];
  }

  return [{
    id: 'skillSource',
    status: 'OK',
    severity: 'info',
    message: 'Shared Skill source structure complete',
    paths: [],
    repairCommand: 'harness config --repair-adapters',
  }];
}