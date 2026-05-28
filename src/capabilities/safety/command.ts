/**
 * Safety orchestration module
 * @module capabilities/safety
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { SafetyPolicy, SafetyCheckResult, SafetyViolation } from './types.js';
import type { HarnessConfig } from '../../core/types.js';

const DEFAULT_DANGEROUS_COMMANDS = ['rm -rf /', 'format', 'del /s', 'DROP TABLE', 'DROP DATABASE'];
const DEFAULT_SECRET_PATTERNS = ['.env', '*.key', '*.secret', '*.token', '*.pem', '*.p12'];

/**
 * Create safety policy from config
 */
export function createSafetyPolicy(config: HarnessConfig): SafetyPolicy {
  return {
    dangerousCommandsBlocked: config.safety.dangerousCommandsBlocked,
    secretPatterns: config.safety.secretPatterns,
    allowedWritePaths: ['.harness/'],
    blockedFilePatterns: config.safety.secretPatterns,
  };
}

/**
 * Check a command against safety policy
 */
export function checkCommandSafety(command: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];

  if (policy.dangerousCommandsBlocked) {
    for (const dangerous of DEFAULT_DANGEROUS_COMMANDS) {
      if (command.includes(dangerous)) {
        violations.push({
          type: 'dangerous_command',
          pattern: dangerous,
          message: `Blocked dangerous command pattern: ${dangerous}`,
        });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Check file content for secret patterns
 */
export function checkFileSafety(filePath: string, content: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];

  for (const pattern of policy.secretPatterns) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    if (regex.test(filePath)) {
      violations.push({
        type: 'blocked_file',
        path: filePath,
        pattern,
        message: `File matches blocked pattern: ${pattern}`,
      });
    }
  }

  // Check for common secret patterns in content
  const secretRegexes = [
    /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /(?:api_key|apikey|api-key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /(?:secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /-----BEGIN\s+(RSA|EC|DSA)\s+PRIVATE\s+KEY-----/g,
  ];

  for (const regex of secretRegexes) {
    if (regex.test(content)) {
      violations.push({
        type: 'secret_leak',
        path: filePath,
        message: `Possible secret detected: ${regex.source}`,
      });
    }
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Check if a write path is allowed
 */
export function checkPathSafety(targetPath: string, root: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];
  const rel = relative(root, targetPath);

  const isAllowed = policy.allowedWritePaths.some(allowed => rel.startsWith(allowed));
  if (!isAllowed && !rel.startsWith('.')) {
    violations.push({
      type: 'path_violation',
      path: targetPath,
      message: `Write path outside allowed boundaries: ${rel}`,
    });
  }

  return { passed: violations.length === 0, violations };
}
