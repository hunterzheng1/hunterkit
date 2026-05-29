/**
 * Config command handler - manage configuration and migration
 * @module commands/config
 */

import type { CommandContext, CliResponse } from '../cli/types.js';
import { resolveWorkspacePaths } from '../core/paths.js';
import { detectLegacySources, buildMigrationPlan, applyMigrationPlan } from '../core/legacy-sources.js';
import { beginTransaction, commitTransaction } from '../core/transaction.js';
import { createAdapterRegistry, filterByTool } from '../adapters/registry.js';
import { ensureAdapterSources } from '../adapters/source-manager.js';
import { applyProjectionWrites } from '../adapters/projection-writer.js';
import type { MigrationOptions } from '../core/types.js';
import type { AdapterTool } from '../adapters/types.js';

/**
 * Parse migration and repair flags from command args
 */
function parseConfigArgs(args: string[]): {
  migrateDocsync: boolean;
  migrateSdd: boolean;
  migrateReview: boolean;
  migrateDocs: boolean;
  repairAdapters: boolean;
  aiTools: AdapterTool[];
} {
  return {
    migrateDocsync: args.includes('--migrate-docsync'),
    migrateSdd: args.includes('--migrate-sdd'),
    migrateReview: args.includes('--migrate-review'),
    migrateDocs: args.includes('--migrate-docs'),
    repairAdapters: args.includes('--repair-adapters'),
    aiTools: parseAiTools(args),
  };
}

/**
 * Parse --ai-tools flag (comma-separated list)
 */
function parseAiTools(args: string[]): AdapterTool[] {
  const idx = args.indexOf('--ai-tools');
  if (idx === -1 || idx + 1 >= args.length) {
    return [];
  }
  
  const toolsStr = args[idx + 1];
  const tools = toolsStr.split(',').map(t => t.trim()) as AdapterTool[];
  const validTools: AdapterTool[] = ['claude', 'codex', 'copilot', 'cursor'];
  
  return tools.filter(t => validTools.includes(t));
}

/**
 * Run the config command
 */
export async function runConfigCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  
  // Parse command args
  const args = (context as any).args || [];
  const configArgs = parseConfigArgs(args);

  // Handle --repair-adapters
  if (configArgs.repairAdapters) {
    return handleRepairAdapters(cwd, dryRun, configArgs.aiTools);
  }

  // Parse migration flags
  const options: MigrationOptions = {
    migrateDocsync: configArgs.migrateDocsync,
    migrateSdd: configArgs.migrateSdd,
    migrateReview: configArgs.migrateReview,
    migrateDocs: configArgs.migrateDocs,
  };

  // Check if any migration flag is set
  const hasMigrationFlag = options.migrateDocsync || options.migrateSdd || 
                          options.migrateReview || options.migrateDocs;

  // Detect legacy sources
  const legacySources = detectLegacySources(cwd);

  if (legacySources.length === 0 && !hasMigrationFlag) {
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

/**
 * Handle --repair-adapters flag
 */
async function handleRepairAdapters(
  cwd: string,
  dryRun: boolean,
  aiTools: AdapterTool[],
): Promise<CliResponse> {
  // Get adapter registry
  let entries = createAdapterRegistry();
  
  // Filter by specified tools if provided
  if (aiTools.length > 0) {
    entries = filterByTool(entries, aiTools);
  }

  // Ensure source templates exist
  ensureAdapterSources(cwd, entries);

  // Apply projection writes
  const tx = beginTransaction(cwd, dryRun);
  const statuses = applyProjectionWrites(cwd, entries, tx);
  const record = commitTransaction(tx);

  const repaired = statuses
    .filter(s => s.status === 'synced')
    .map(s => s.projectionPath);

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'config',
      dryRun,
      repaired,
      transactionId: record.id,
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
