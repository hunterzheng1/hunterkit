/**
 * Install state service - manages .harness/state/install.json
 * @module core/install-state
 *
 * Provides typed read/write access to installation state,
 * recording selected tools, capabilities, hook strength,
 * write policy, and artifact tracking.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/** Artifact record in install state */
export interface InstallArtifactRecord {
  path: string;
  type: 'skill' | 'hook' | 'config' | 'doc' | 'agent' | 'source';
  tool: 'claude' | 'codex' | 'copilot' | 'cursor' | 'shared';
  managed: boolean;
  generatedAt: string;
}

/** Skipped artifact record */
export interface SkippedArtifactRecord {
  path: string;
  tool: string;
  reason: 'tool not selected' | 'dry-run' | 'not applicable';
}

/** Installation state snapshot */
export interface InstallStateSnapshot {
  schemaVersion: number;
  installedAt: string;
  nodeVersion: string;
  selectedTools: string[];
  capabilities: string[];
  hookStrength: string;
  writePolicy: string;
  artifacts: InstallArtifactRecord[];
  skippedArtifacts: SkippedArtifactRecord[];
}

/** Default install state */
export function createDefaultInstallState(
  selectedTools: string[],
  capabilities: string[],
  hookStrength: string,
  writePolicy: string,
): InstallStateSnapshot {
  return {
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    nodeVersion: process.version,
    selectedTools,
    capabilities,
    hookStrength,
    writePolicy,
    artifacts: [],
    skippedArtifacts: [],
  };
}

/**
 * Read install state from disk
 */
export function readInstallState(cwd: string): InstallStateSnapshot | null {
  const statePath = resolve(cwd, '.harness', 'state', 'install.json');
  if (!existsSync(statePath)) return null;

  try {
    const raw = readFileSync(statePath, 'utf-8');
    return JSON.parse(raw) as InstallStateSnapshot;
  } catch {
    return null;
  }
}

/**
 * Write install state to disk
 */
export function writeInstallState(cwd: string, state: InstallStateSnapshot): void {
  const statePath = resolve(cwd, '.harness', 'state', 'install.json');
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Add an artifact record to the install state
 */
export function addArtifactToState(
  state: InstallStateSnapshot,
  record: InstallArtifactRecord,
): InstallStateSnapshot {
  return {
    ...state,
    artifacts: [...state.artifacts.filter(a => a.path !== record.path), record],
  };
}

/**
 * Add a skipped artifact record
 */
export function addSkippedArtifactToState(
  state: InstallStateSnapshot,
  record: SkippedArtifactRecord,
): InstallStateSnapshot {
  return {
    ...state,
    skippedArtifacts: [...state.skippedArtifacts.filter(a => a.path !== record.path), record],
  };
}