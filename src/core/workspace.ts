/**
 * Workspace creation and status checking
 * @module core/workspace
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  WorkspaceRequest,
  HarnessConfig,
  WorkspaceStatus,
  WorkspacePaths,
  EnsureWorkspaceResult,
} from './types.js';
import { resolveWorkspacePaths } from './paths.js';
import { writeHarnessConfig, loadHarnessConfig } from './config.js';
import { writeStateFile } from './state.js';
import { beginTransaction, stageMkdir, commitTransaction } from './transaction.js';

/**
 * Ensure workspace exists with proper directory structure
 */
export function ensureWorkspace(
  request: WorkspaceRequest,
  initialConfig: HarnessConfig,
): EnsureWorkspaceResult {
  const paths = resolveWorkspacePaths(request.cwd);
  const tx = beginTransaction(request.cwd, request.dryRun);

  // Stage directory creation
  const dirs = [
    paths.harness,
    paths.config,
    paths.state,
    paths.facts,
    paths.generated,
    paths.adapters,
    paths.reports,
    paths.cache,
    paths.develop,
  ];

  for (const dir of dirs) {
    stageMkdir(tx, dir);
  }

  // Stage config file write
  writeHarnessConfig(paths.config, initialConfig, tx);

  // Stage install state
  writeStateFile(paths, 'install', {
    installedAt: new Date().toISOString(),
    nodeVersion: process.version,
  }, tx);

  // Commit (or dry-run)
  const record = commitTransaction(tx);

  return {
    workspace: '.harness',
    created: record.operations.map(op => op.path.replace(request.cwd + '/', '')),
    transactionId: record.id,
    dryRun: request.dryRun,
  };
}

/**
 * Read workspace status
 */
export function readWorkspaceStatus(paths: WorkspacePaths): WorkspaceStatus {
  const configPath = resolve(paths.config, 'harness.config.json');

  if (!existsSync(configPath)) {
    return {
      workspace: '.harness',
      schemaVersion: null,
      initialized: false,
      capabilities: {},
    };
  }

  try {
    const config = loadHarnessConfig(paths.config);
    return {
      workspace: '.harness',
      schemaVersion: config.schemaVersion,
      initialized: true,
      capabilities: { ...config.capabilities },
    };
  } catch {
    return {
      workspace: '.harness',
      schemaVersion: null,
      initialized: false,
      capabilities: {},
    };
  }
}
