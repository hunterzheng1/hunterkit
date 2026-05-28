/**
 * Projection renderer - renders source templates into runtime projections
 * @module adapters/projection-renderer
 */

import type { AdapterRegistryEntry } from './types.js';

/** Managed marker injected into projections */
export const MANAGED_MARKER = '<!-- harness-managed: do not edit manually -->';

/**
 * Render a projection from a source template
 */
export function renderProjection(entry: AdapterRegistryEntry, sourceContent: string): string {
  const lines = [
    MANAGED_MARKER,
    `<!-- source: ${entry.sourcePath} -->`,
    `<!-- repair: harness config --repair-adapters -->`,
    '',
    sourceContent,
  ];
  return lines.join('\n');
}

/**
 * Check if content has the managed marker
 */
export function isManagedProjection(content: string): boolean {
  return content.includes(MANAGED_MARKER);
}
