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
import { buildArtifactPlan } from '../adapters/artifact-plan.js';
import type { MigrationOptions } from '../core/types.js';
import type { AdapterTool, ArtifactPlanEntry } from '../adapters/types.js';
import { loadHarnessConfig } from '../core/config.js';
import { resolve } from 'node:path';

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
  const args = context.args || [];
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

  // Determine selected tools: args override, else read from config
  let selectedTools = aiTools;
  if (selectedTools.length === 0) {
    try {
      const configPath = resolve(cwd, '.harness', 'config');
      const config = loadHarnessConfig(configPath);
      selectedTools = Object.entries(config.aiTools ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k as AdapterTool);
    } catch {
      // Config not available, repair all registry entries
      selectedTools = [...new Set(entries.map(e => e.tool))];
    }
  }

  // Filter entries by selected tools
  entries = filterByTool(entries, selectedTools);

  // Build artifact plan for classified reporting
  const plan = buildArtifactPlan(selectedTools, entries);

  // Ensure source templates exist
  ensureAdapterSources(cwd, entries);

  // Apply projection writes
  const tx = beginTransaction(cwd, dryRun);
  const statuses = applyProjectionWrites(cwd, entries, tx);
  const record = commitTransaction(tx);

  const repaired = statuses
    .filter(s => s.status === 'synced')
    .map(s => s.projectionPath);
  const skipped = plan
    .filter(p => p.kind === 'skipped')
    .map(p => ({ path: p.projectionPath, reason: p.reason }));
  const conflicts = statuses
    .filter(s => s.status === 'conflict')
    .map(s => ({ path: s.projectionPath, message: s.message }));

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'config',
      dryRun,
      repaired,
      skipped,
      conflicts,
      transactionId: record.id,
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
