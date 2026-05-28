/**
 * Develop capability types
 * @module capabilities/develop/types
 */

export type DevelopStage = 'propose' | 'spec' | 'design' | 'tasks' | 'check' | 'apply' | 'archive';

export interface DevelopOptions {
  change: string;
  propose: boolean;
  spec: boolean;
  design: boolean;
  tasks: boolean;
  check: boolean;
  apply: boolean;
  archive: boolean;
  from: string | null;
  capability: string | null;
  parallel: boolean;
  dryRun: boolean;
  json: boolean;
}

export interface ProposalMeta {
  mode: 'full' | 'simple';
  testStrategy: 'tdd' | 'impl-first' | 'none';
}

export interface DevelopResult {
  change: string;
  stage: DevelopStage;
  mode: 'full' | 'simple';
  testStrategy: 'tdd' | 'impl-first' | 'none';
  artifacts: string[];
}

export interface StorageLocation {
  canonicalRoot: string;
  legacyRoot: string;
  status: 'canonical' | 'legacy' | 'mixed' | 'missing';
}
