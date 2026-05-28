/**
 * Adapter source manager - ensures source-of-truth templates exist
 * @module adapters/source-manager
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { AdapterRegistryEntry } from './types.js';

/**
 * Ensure adapter source templates exist in .harness/adapters/
 */
export function ensureAdapterSources(cwd: string, entries: AdapterRegistryEntry[]): void {
  for (const entry of entries) {
    const fullPath = resolve(cwd, entry.sourcePath);
    if (!existsSync(fullPath)) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, entry.templateContent, 'utf-8');
    }
  }
}

/**
 * Read an adapter source file
 */
export function readAdapterSource(cwd: string, sourcePath: string): string {
  const fullPath = resolve(cwd, sourcePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Adapter source not found: ${sourcePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}
