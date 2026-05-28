/**
 * Inspect capability types
 * @module capabilities/inspect/types
 */

export interface InspectOptions {
  full: boolean;
  path: string | null;
  rules: boolean;
  json: boolean;
  dryRun: boolean;
}

export interface InspectScope {
  full: boolean;
  path: string | null;
}

export interface BuildFileFact {
  path: string;
  type: string;
  name?: string;
  version?: string;
}

export interface DocumentFact {
  path: string;
  kind: string;
  size: number;
}

export interface AgentFileFact {
  path: string;
  tool: string;
  type: string;
}

export interface CiFact {
  path: string;
  provider: string;
}

export interface ModuleFact {
  path: string;
  name: string;
  languages: string[];
  fileCount: number;
}

export interface ReviewRequiredItem {
  path: string;
  reason: string;
}

export interface RepoMap {
  schemaVersion: number;
  root: string;
  generatedAt: string;
  languages: string[];
  packageManagers: string[];
  buildFiles: BuildFileFact[];
  docs: DocumentFact[];
  agentFiles: AgentFileFact[];
  ci: CiFact[];
  modules: ModuleFact[];
}

export interface InspectResult {
  factsPath: string;
  moduleMapPath: string;
  rulesPath: string | null;
  scope: InspectScope;
  reviewRequired: ReviewRequiredItem[];
}
