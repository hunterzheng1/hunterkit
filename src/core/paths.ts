/**
 * Path resolution utilities for workspace-config
 * @module core/paths
 */

import { existsSync, statSync } from 'node:fs';
import { resolve, normalize, relative, isAbsolute } from 'node:path';
import type { WorkspacePaths } from './types.js';

/**
 * Resolve project root from optional cwd parameter
 */
export function resolveProjectRoot(cwd?: string): string {
  const root = cwd ? resolve(cwd) : process.cwd();
  const normalized = normalize(root);

  if (!existsSync(normalized)) {
    throw new Error(`Path does not exist: ${normalized}`);
  }

  if (!statSync(normalized).isDirectory()) {
    throw new Error(`Path is not a directory: ${normalized}`);
  }

  return normalized;
}

/**
 * Resolve all workspace paths from project root
 */
export function resolveWorkspacePaths(root: string): WorkspacePaths {
  const harness = resolve(root, '.harness');
  return {
    root,
    harness,
    config: resolve(harness, 'config'),
    state: resolve(harness, 'state'),
    facts: resolve(harness, 'facts'),
    generated: resolve(harness, 'generated'),
    adapters: resolve(harness, 'adapters'),
    reports: resolve(harness, 'reports'),
    cache: resolve(harness, 'cache'),
    develop: resolve(harness, 'develop'),
    docs: resolve(harness, 'docs'),
    rules: resolve(harness, 'rules'),
    events: resolve(harness, 'events'),
  };
}

/**
 * Check if a target path is within the root directory (prevent path traversal)
 */
export function isPathWithinRoot(target: string, root: string): boolean {
  const normalizedTarget = normalize(resolve(target));
  const normalizedRoot = normalize(resolve(root));
  const rel = relative(normalizedRoot, normalizedTarget);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Check if a target path is writable (within .harness/ or allowed projection paths)
 */
export function isWritablePath(target: string, paths: WorkspacePaths): boolean {
  return isPathWithinRoot(target, paths.harness);
}
