/**
 * Doctor command handler - diagnose environment and dependencies
 * @module commands/doctor
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandContext, CliResponse } from '../cli/types.js';
import { resolveWorkspacePaths } from '../core/paths.js';
import { readWorkspaceStatus } from '../core/workspace.js';
import { validateHarnessConfig } from '../core/config-schema.js';
import { loadHarnessConfig } from '../core/config.js';
import { detectLegacySources } from '../core/legacy-sources.js';

/**
 * Run the doctor command
 */
export async function runDoctorCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const status = readWorkspaceStatus(paths);
  const warnings: string[] = [];
  const checks: Record<string, string> = {};

  // Check 1: workspace initialized
  if (!status.initialized) {
    checks.workspace = 'NOT_INITIALIZED';
    warnings.push('Workspace not initialized. Run "harness" without arguments to initialize.');
  } else {
    checks.workspace = 'OK';
  }

  // Check 2: directory integrity
  const requiredDirs = [paths.config, paths.state, paths.facts, paths.generated, paths.reports];
  const missingDirs = requiredDirs.filter(d => !existsSync(d));
  if (missingDirs.length > 0) {
    checks.directoryIntegrity = `MISSING: ${missingDirs.length} directories`;
    warnings.push(`Missing directories: ${missingDirs.map(d => d.replace(cwd + '/', '')).join(', ')}`);
  } else {
    checks.directoryIntegrity = 'OK';
  }

  // Check 3: config validity
  if (status.initialized) {
    try {
      const config = loadHarnessConfig(paths.config);
      checks.configValidity = 'OK';
    } catch (e) {
      checks.configValidity = `INVALID: ${e instanceof Error ? e.message : String(e)}`;
      warnings.push('Config file is invalid. Run "harness doctor" for details.');
    }
  } else {
    checks.configValidity = 'N/A';
  }

  // Check 4: legacy sources
  const legacySources = detectLegacySources(cwd);
  if (legacySources.length > 0) {
    checks.legacySources = `FOUND: ${legacySources.map(s => s.name).join(', ')}`;
    warnings.push(`Legacy sources detected: ${legacySources.map(s => s.name).join(', ')}. Use "harness config --migrate-*" to migrate.`);
  } else {
    checks.legacySources = 'NONE';
  }

  // Check 5: Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major < 20) {
    checks.nodeVersion = `UNSUPPORTED: ${nodeVersion}`;
    warnings.push(`Node.js ${nodeVersion} is below minimum required version 20.0.0`);
  } else {
    checks.nodeVersion = `OK: ${nodeVersion}`;
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'doctor',
      checks,
      legacySources: legacySources.map(s => ({ name: s.name, path: s.path, fileCount: s.fileCount })),
    },
    warnings,
  };
}
