/**
 * Safety orchestration capability types
 * @module capabilities/safety/types
 */

export interface SafetyPolicy {
  dangerousCommandsBlocked: boolean;
  secretPatterns: string[];
  allowedWritePaths: string[];
  blockedFilePatterns: string[];
}

export interface SafetyCheckResult {
  passed: boolean;
  violations: SafetyViolation[];
}

export interface SafetyViolation {
  type: 'dangerous_command' | 'secret_leak' | 'path_violation' | 'blocked_file';
  path?: string;
  pattern?: string;
  message: string;
}

export interface DryRunPlan {
  operations: Array<{
    type: string;
    path: string;
    description: string;
  }>;
  blocked: SafetyViolation[];
}
