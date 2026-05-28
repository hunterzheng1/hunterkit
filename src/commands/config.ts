/**
 * Config command handler - manage configuration and migration
 * @module commands/config
 */

import type { CommandContext, CliResponse } from '../cli/types.js';
import { resolveWorkspacePaths } from '../core/paths.js';
import { detectLegacySources, buildMigrationPlan, applyMigrationPlan } from '../core/legacy-sources.js';
import { beginTransaction, commitTransaction } from '../core/transaction.js';
import type { MigrationOptions } from '../core/types.js';

/**
 * Run the config command
 */
export async function runConfigCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  // Parse migration flags from command args (simplified - in real impl would use commander)
  const options: MigrationOptions = {
    migrateDocsync: true, // Default for now - would be parsed from args
    migrateSdd: false,
    migrateReview: false,
  };

  // Detect legacy sources
  const legacySources = detectLegacySources(cwd);

  if (legacySources.length === 0) {
    return {
      code: 0,
      msg: 'success',
      data: {
        command: 'config',
        message: 'No legacy sources detected',
        sources: [],
        operations: [],
        conflicts: [],
      },
      warnings: [],
    };
  }

  // Build migration plan
  const plan = buildMigrationPlan(cwd, options, paths);
  plan.dryRun = dryRun;

  if (plan.conflicts.length > 0) {
    return {
      code: 2104,
      msg: 'Migration conflicts detected',
      data: {
        command: 'config',
        conflicts: plan.conflicts,
      },
      warnings: plan.conflicts.map(c => c.reason),
    };
  }

  if (dryRun) {
    return {
      code: 0,
      msg: 'success',
      data: {
        command: 'config',
        dryRun: true,
        sources: plan.sources.map(s => s.name),
        operations: plan.operations,
        conflicts: [],
      },
      warnings: ['Dry-run mode: no files were written'],
    };
  }

  // Execute migration
  const tx = beginTransaction(cwd, false);
  applyMigrationPlan(plan, paths, tx);
  const record = commitTransaction(tx);

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'config',
      dryRun: false,
      sources: plan.sources.map(s => s.name),
      operations: plan.operations,
      transactionId: record.id,
    },
    warnings: [],
  };
}
