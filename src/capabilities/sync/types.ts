/**
 * Sync capability types
 * @module capabilities/sync/types
 */

export type DocumentKind = 'readme' | 'agents' | 'claude' | 'copilot';

export interface SyncOptions {
  check: boolean;
  fast: boolean;
  docs: DocumentKind[];
  dryRun: boolean;
  json: boolean;
}

export type SyncDocumentStatus = 'up-to-date' | 'planned' | 'written' | 'drifted' | 'blocked';

export interface SyncDocumentResult {
  path: string;
  kind: DocumentKind;
  status: SyncDocumentStatus;
  message?: string;
}

export interface SyncResult {
  mode: 'sync' | 'check' | 'dry-run';
  drift: boolean;
  documents: SyncDocumentResult[];
  reportPath: string;
}
