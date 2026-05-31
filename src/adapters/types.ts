/**
 * Adapter skill runtime types
 * @module adapters/types
 */

/** Supported AI tool platforms */
export type AdapterTool = 'claude' | 'codex' | 'copilot' | 'cursor';

/** Adapter source descriptor */
export interface AdapterSource {
  /** Platform name */
  tool: AdapterTool;
  /** Source-of-truth path under .harness/adapters/ */
  path: string;
  /** Template content */
  content: string;
}

/** Projection target descriptor */
export interface ProjectionTarget {
  /** Platform name */
  tool: AdapterTool;
  /** Runtime projection path */
  path: string;
  /** Source path reference */
  sourcePath: string;
}

/** Adapter projection status */
export interface AdapterProjectionStatus {
  tool: AdapterTool;
  sourcePath: string;
  projectionPath: string;
  status: 'synced' | 'missing' | 'drifted' | 'conflict' | 'planned';
  message?: string;
}

/** Adapter repair options */
export interface AdapterRepairOptions {
  repairAdapters: boolean;
  aiTools: AdapterTool[];
  dryRun: boolean;
  json: boolean;
}

/** Adapter repair result */
export interface AdapterRepairResult {
  adapters: AdapterProjectionStatus[];
}

/** Adapter error data */
export interface AdapterErrorData {
  tool: AdapterTool;
  sourcePath: string;
}

/** Adapter registry entry */
export interface AdapterRegistryEntry {
  tool: AdapterTool;
  sourcePath: string;
  projectionPath: string;
  templateContent: string;
  /** artifact kind: source/runtime/config/report */
  kind?: 'source' | 'runtime' | 'config' | 'report';
  /** source tree type: skill/metadata/agent */
  sourceKind?: 'skill' | 'metadata' | 'agent';
  /** required companion files for source tree */
  requiredFiles?: string[];
  /** managed metadata */
  metadata?: ProjectionMetadata;
  /** repair command hint */
  repairCommand?: string;
  /** skip reason (when unselected) */
  skipReason?: 'tool not selected' | 'dry-run' | 'not applicable';
}

/** Projection managed metadata */
export interface ProjectionMetadata {
  sourceHash: string;
  sourcePath: string;
  managedMarker: string;
  repairCommand: string;
  generatedAt: string;
}

/** Artifact plan entry */
export interface ArtifactPlanEntry {
  tool: AdapterTool;
  sourcePath: string;
  projectionPath: string;
  kind: 'source' | 'runtime' | 'skipped';
  status: 'planned' | 'generated' | 'skipped' | 'conflict';
  reason?: string;
}
