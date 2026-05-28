/**
 * Projection writer - plan and apply projection writes via transaction
 * @module adapters/projection-writer
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdapterRegistryEntry, AdapterProjectionStatus } from './types.js';
import type { Transaction } from '../core/transaction.js';
import { stageWrite } from '../core/transaction.js';
import { renderProjection, isManagedProjection } from './projection-renderer.js';

/**
 * Plan projection writes and return status list
 */
export function planProjectionWrites(
  cwd: string,
  entries: AdapterRegistryEntry[],
): AdapterProjectionStatus[] {
  const statuses: AdapterProjectionStatus[] = [];

  for (const entry of entries) {
    const projectionPath = resolve(cwd, entry.projectionPath);
    const sourcePath = resolve(cwd, entry.sourcePath);

    if (!existsSync(sourcePath)) {
      statuses.push({
        tool: entry.tool,
        sourcePath: entry.sourcePath,
        projectionPath: entry.projectionPath,
        status: 'missing',
        message: 'Source template not found',
      });
      continue;
    }

    // Check for conflicts
    if (existsSync(projectionPath)) {
      const existing = readFileSync(projectionPath, 'utf-8');
      if (!isManagedProjection(existing)) {
        statuses.push({
          tool: entry.tool,
          sourcePath: entry.sourcePath,
          projectionPath: entry.projectionPath,
          status: 'conflict',
          message: 'Existing file is not managed by harness',
        });
        continue;
      }
    }

    statuses.push({
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'planned',
    });
  }

  return statuses;
}

/**
 * Apply projection writes via transaction
 */
export function applyProjectionWrites(
  cwd: string,
  entries: AdapterRegistryEntry[],
  tx: Transaction,
): AdapterProjectionStatus[] {
  const statuses: AdapterProjectionStatus[] = [];

  for (const entry of entries) {
    const sourcePath = resolve(cwd, entry.sourcePath);
    const projectionPath = resolve(cwd, entry.projectionPath);

    if (!existsSync(sourcePath)) {
      statuses.push({
        tool: entry.tool,
        sourcePath: entry.sourcePath,
        projectionPath: entry.projectionPath,
        status: 'missing',
        message: 'Source template not found',
      });
      continue;
    }

    // Check for conflicts
    if (existsSync(projectionPath)) {
      const existing = readFileSync(projectionPath, 'utf-8');
      if (!isManagedProjection(existing)) {
        statuses.push({
          tool: entry.tool,
          sourcePath: entry.sourcePath,
          projectionPath: entry.projectionPath,
          status: 'conflict',
          message: 'Existing file is not managed by harness',
        });
        continue;
      }
    }

    const sourceContent = readFileSync(sourcePath, 'utf-8');
    const rendered = renderProjection(entry, sourceContent);
    stageWrite(tx, projectionPath, rendered);

    statuses.push({
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'synced',
    });
  }

  return statuses;
}
