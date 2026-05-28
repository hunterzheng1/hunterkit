/**
 * Workspace-config module shared types
 * @module core/types
 */

/** Main harness configuration (harness.config.json) */
export interface HarnessConfig {
  schemaVersion: number;
  project: {
    name: string;
    type: string;
  };
  aiTools: {
    claude: boolean;
    codex: boolean;
    copilot: boolean;
    cursor: boolean;
  };
  capabilities: {
    inspect: boolean;
    sync: boolean;
    develop: boolean;
    review: boolean;
    knowledge: boolean;
  };
  documents: {
    managed: string[];
    generatedBlockPrefix: string;
  };
  orchestration: {
    subagents: string;
    maxParallelAgents: number;
    validatorRequired: boolean;
  };
  safety: {
    dangerousCommandsBlocked: boolean;
    secretPatterns: string[];
  };
}

/** Workspace request parameters */
export interface WorkspaceRequest {
  cwd: string;
  dryRun: boolean;
  json: boolean;
}

/** Migration options flags */
export interface MigrationOptions {
  migrateDocsync: boolean;
  migrateSdd: boolean;
  migrateReview: boolean;
}

/** Workspace status report */
export interface WorkspaceStatus {
  workspace: string;
  schemaVersion: number | null;
  initialized: boolean;
  capabilities: Record<string, boolean>;
}

/** Complete workspace paths tree */
export interface WorkspacePaths {
  root: string;
  harness: string;
  config: string;
  state: string;
  facts: string;
  generated: string;
  adapters: string;
  reports: string;
  cache: string;
  develop: string;
}

/** Transaction operation types */
export type TransactionOperationType = 'create_dir' | 'create_file' | 'write_file' | 'backup' | 'delete';

/** Single transaction operation */
export interface TransactionOperation {
  type: TransactionOperationType;
  path: string;
  content?: string | Buffer;
  backupPath?: string;
}

/** Transaction status */
export type TransactionStatus = 'pending' | 'committed' | 'rolled_back' | 'failed';

/** Transaction record (persisted after commit/rollback) */
export interface TransactionRecord {
  id: string;
  status: TransactionStatus;
  cwd: string;
  operations: TransactionOperation[];
  createdAt: string;
}

/** Transaction object (in-memory during lifecycle) */
export interface Transaction {
  id: string;
  status: TransactionStatus;
  cwd: string;
  dryRun: boolean;
  operations: TransactionOperation[];
}

/** Legacy source descriptor */
export interface LegacySource {
  name: string;
  path: string;
  type: string;
  fileCount: number;
}

/** Migration operation */
export interface MigrationOperation {
  type: 'copy';
  from: string;
  to: string;
}

/** Migration conflict */
export interface MigrationConflict {
  source: string;
  target: string;
  reason: string;
}

/** Migration plan */
export interface MigrationPlan {
  sources: LegacySource[];
  operations: MigrationOperation[];
  conflicts: MigrationConflict[];
  dryRun: boolean;
}

/** Config validation result */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  missing: string[];
}

/** Ensure workspace result */
export interface EnsureWorkspaceResult {
  workspace: string;
  created: string[];
  transactionId: string;
  dryRun: boolean;
}
