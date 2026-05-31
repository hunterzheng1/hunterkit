/**
 * Doctor command handler - diagnose environment and dependencies
 * @module commands/doctor
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandContext, CliResponse } from '../cli/types.js';
import { resolveWorkspacePaths } from '../core/paths.js';
import { readWorkspaceStatus } from '../core/workspace.js';
import { loadHarnessConfig } from '../core/config.js';
import { aggregateDoctorChecks } from '../core/doctor-checks.js';
import { createAdapterRegistry } from '../adapters/registry.js';
import type { ArtifactHealthCheck } from '../core/artifact-health.js';

/**
 * Run the doctor command
 */
export async function runDoctorCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const status = readWorkspaceStatus(paths);
  const warnings: string[] = [];

  let checks: ArtifactHealthCheck[] = [];

  // Load config to determine selected tools and safety patterns
  let selectedTools: string[] = [];
  let safetyPatterns: string[] = [];
  let hookStrength = 'none';

  if (status.initialized) {
    try {
      const config = loadHarnessConfig(paths.config);
      selectedTools = Object.entries(config.aiTools ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      safetyPatterns = config.safety?.secretPatterns ?? [];
      hookStrength = config.safety?.hookStrength ?? 'none';
    } catch {
      // Config load failure — will be reported by base checks
    }
  }

  // Use aggregated checks from doctor-checks module
  const registry = createAdapterRegistry();
  checks = aggregateDoctorChecks(cwd, selectedTools, hookStrength, registry, safetyPatterns);

  // Collect warnings from ERROR checks
  for (const check of checks) {
    if (check.status === 'ERROR') {
      warnings.push(`[${check.id}] ${check.message}`);
    }
  }

  // Determine exit code: non-zero if any ERROR check
  const hasErrors = checks.some(c => c.status === 'ERROR');
  const hasWarnings = checks.some(c => c.status === 'WARN');

  return {
    code: hasErrors ? 1 : 0,
    msg: hasErrors ? 'doctor found issues' : hasWarnings ? 'doctor found warnings' : 'all checks passed',
    data: {
      command: 'doctor',
      checks,
    },
    warnings,
  };
}