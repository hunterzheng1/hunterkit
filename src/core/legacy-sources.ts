/**
 * Legacy source detection and migration
 * @module core/legacy-sources
 */

import { existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type {
  LegacySource,
  MigrationOptions,
  MigrationPlan,
  MigrationOperation,
  MigrationConflict,
  WorkspacePaths,
} from './types.js';
import type { Transaction } from './transaction.js';
import { stageWrite } from './transaction.js';
import { readFileSync } from 'node:fs';

/** Legacy source definitions */
const LEGACY_SOURCE_MAP: Array<{
  name: string;
  path: string;
  type: string;
  targetSubdir: string;
}> = [
  { name: 'docsync', path: '.docsync', type: 'rules', targetSubdir: 'rules/imported/docsync' },
  { name: 'sdd', path: 'openspec/changes', type: 'sdd', targetSubdir: 'develop/changes' },
  { name: 'review', path: '.kld-review', type: 'review', targetSubdir: 'reports/imported/kld-review' },
  { name: 'docs', path: 'docs', type: 'docs', targetSubdir: 'docs/imported' },
];

/**
 * Count files in a directory recursively
 */
function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isFile()) count++;
      else if (entry.isDirectory()) count += countFiles(join(dir, entry.name));
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Detect legacy sources in the project
 */
export function detectLegacySources(cwd: string): LegacySource[] {
  const found: LegacySource[] = [];

  for (const def of LEGACY_SOURCE_MAP) {
    const fullPath = resolve(cwd, def.path);
    if (existsSync(fullPath)) {
      found.push({
        name: def.name,
        path: def.path,
        type: def.type,
        fileCount: countFiles(fullPath),
      });
    }
  }

  return found;
}

/**
 * Build a migration plan based on options
 */
export function buildMigrationPlan(
  cwd: string,
  options: MigrationOptions,
  paths: WorkspacePaths,
): MigrationPlan {
  const sources = detectLegacySources(cwd);
  const operations: MigrationOperation[] = [];
  const conflicts: MigrationConflict[] = [];

  const flagMap: Record<string, boolean> = {
    docsync: options.migrateDocsync,
    sdd: options.migrateSdd,
    review: options.migrateReview,
    docs: options.migrateDocs,
  };

  for (const source of sources) {
    if (!flagMap[source.name]) continue;

    const def = LEGACY_SOURCE_MAP.find(d => d.name === source.name);
    if (!def) continue;

    const from = resolve(cwd, def.path);
    const to = resolve(paths.harness, def.targetSubdir);

    // Check for conflicts
    if (existsSync(to)) {
      const existingFiles = countFiles(to);
      if (existingFiles > 0) {
        conflicts.push({
          source: from,
          target: to,
          reason: `Target directory already contains ${existingFiles} file(s)`,
        });
        continue;
      }
    }

    operations.push({ type: 'copy', from, to });
  }

  return { sources, operations, conflicts, dryRun: false };
}

/**
 * Apply a migration plan via transaction
 */
export function applyMigrationPlan(plan: MigrationPlan, paths: WorkspacePaths, tx: Transaction): void {
  for (const op of plan.operations) {
    // Read source files and stage writes
    if (existsSync(op.from)) {
      stageCopyDir(op.from, op.to, tx);
    }
  }
}

/**
 * Stage a directory copy operation via transaction
 */
function stageCopyDir(from: string, to: string, tx: Transaction): void {
  if (!existsSync(from)) return;

  const entries = readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(from, entry.name);
    const destPath = join(to, entry.name);

    if (entry.isFile()) {
      const content = readFileSync(srcPath);
      stageWrite(tx, destPath, content);
    } else if (entry.isDirectory()) {
      stageCopyDir(srcPath, destPath, tx);
    }
  }
}
