/**
 * State file management for .harness/state/*.json
 * @module core/state
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WorkspacePaths } from './types.js';
import type { Transaction } from './transaction.js';
import { stageWrite } from './transaction.js';

/** Predefined state file names */
export const INSTALL_STATE = 'install';
export const FACTS_STATE = 'facts';
export const ACTIVE_CHANGE_STATE = 'active-change';
export const CAPABILITIES_STATE = 'capabilities';

/**
 * Read a state file from .harness/state/
 */
export function readStateFile(paths: WorkspacePaths, name: string): Record<string, unknown> | null {
  const filePath = resolve(paths.state, `${name}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (data.schemaVersion === undefined) {
      throw new Error(`State file missing schemaVersion: ${filePath}`);
    }

    return data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`State file is not valid JSON: ${filePath}`);
    }
    throw e;
  }
}

/**
 * Write a state file via transaction, auto-injecting schemaVersion
 */
export function writeStateFile(
  paths: WorkspacePaths,
  name: string,
  data: Record<string, unknown>,
  tx: Transaction,
): void {
  const filePath = resolve(paths.state, `${name}.json`);
  const withSchema = { schemaVersion: 1, ...data };
  stageWrite(tx, filePath, JSON.stringify(withSchema, null, 2));
}
