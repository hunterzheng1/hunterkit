/**
 * Adapter metadata - source hash and managed projection metadata
 * @module adapters/metadata
 *
 * Provides unified hash computation and managed metadata construction
 * for use by projection-renderer and drift-detector.
 */

import { createHash } from 'node:crypto';
import type { ProjectionMetadata } from './types.js';

/** Managed marker for projections */
export const MANAGED_MARKER_V2 = '<!-- harness-managed: do not edit manually -->';

/** Default repair command */
export const DEFAULT_REPAIR_COMMAND = 'harness config --repair-adapters';

/**
 * Compute SHA-256 hash of content (short form, 16 hex chars)
 */
export function computeSourceHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Build managed metadata for a projection
 * @param sourceContent - source template content
 * @param sourcePath - relative source path
 * @returns Projection metadata object
 */
export function buildManagedMetadata(
  sourceContent: string,
  sourcePath: string,
): ProjectionMetadata {
  return {
    sourceHash: computeSourceHash(sourceContent),
    sourcePath,
    managedMarker: MANAGED_MARKER_V2,
    repairCommand: DEFAULT_REPAIR_COMMAND,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Render metadata as comment block
 */
export function renderMetadataComment(metadata: ProjectionMetadata): string {
  return [
    MANAGED_MARKER_V2,
    `<!-- source: ${metadata.sourcePath} -->`,
    `<!-- source-hash: ${metadata.sourceHash} -->`,
    `<!-- repair: ${metadata.repairCommand} -->`,
    `<!-- generated-at: ${metadata.generatedAt} -->`,
  ].join('\n');
}