/**
 * Drift detector - compare source and projection to detect drift
 * @module adapters/drift-detector
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdapterRegistryEntry, AdapterProjectionStatus } from './types.js';
import { isManagedProjection } from './projection-renderer.js';
import { computeSourceHash } from './metadata.js';

/**
 * Check adapter drift status
 */
export function checkAdapterDrift(cwd: string, entry: AdapterRegistryEntry): AdapterProjectionStatus {
  const sourcePath = resolve(cwd, entry.sourcePath);
  const projectionPath = resolve(cwd, entry.projectionPath);

  // Check source exists
  if (!existsSync(sourcePath)) {
    return {
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'missing',
      message: 'Source template not found',
    };
  }

  // Check projection exists
  if (!existsSync(projectionPath)) {
    return {
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'missing',
      message: 'Projection not found',
    };
  }

  const sourceContent = readFileSync(sourcePath, 'utf-8');
  const projectionContent = readFileSync(projectionPath, 'utf-8');

  // Check if projection is managed
  if (!isManagedProjection(projectionContent)) {
    return {
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'conflict',
      message: 'Projection exists but is not managed by harness',
    };
  }

  // Check if source hash in projection matches current source
  const sourceHash = computeSourceHash(sourceContent);
  if (projectionContent.includes(`source-hash: ${sourceHash}`)) {
    return {
      tool: entry.tool,
      sourcePath: entry.sourcePath,
      projectionPath: entry.projectionPath,
      status: 'synced',
    };
  }

  return {
    tool: entry.tool,
    sourcePath: entry.sourcePath,
    projectionPath: entry.projectionPath,
    status: 'drifted',
    message: 'Source has changed since last projection',
  };
}
