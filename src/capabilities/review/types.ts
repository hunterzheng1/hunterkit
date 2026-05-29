/**
 * Review capability types
 * @module capabilities/review/types
 */

export type ReviewScope = 'staged' | 'range' | 'file' | 'all';

export interface ReviewOptions {
  scope: ReviewScope;
  range: string | null;
  file: string | null;
  strict: boolean;
  dryRun: boolean;
  json: boolean;
}

export interface ReviewFinding {
  file: string;
  line: number;
  severity: 'P0' | 'P1' | 'P2';
  category: string;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  scope: ReviewScope;
  findings: ReviewFinding[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
  reportPath: string;
}
