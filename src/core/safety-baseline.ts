/**
 * Safety baseline - defines minimum secret patterns and dangerous command policies
 * @module core/safety-baseline
 *
 * Used by config-schema validation and doctor checks to ensure
 * safety configuration meets the baseline requirements.
 */

/** Baseline secret patterns that MUST be covered */
export const BASELINE_SECRET_PATTERNS = [
  '.env',
  '.env.*',
  '.env*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.jks',
  '*token*',
  '*secret*',
];

/** Dangerous commands that should be detected */
export const BASELINE_DANGEROUS_COMMANDS = [
  { pattern: 'rm -rf', description: '递归删除' },
  { pattern: 'git reset --hard', description: '强制 reset' },
  { pattern: 'git clean -fdx', description: '强制清理未跟踪文件' },
  { pattern: 'echo $', description: '凭据输出' },
  { pattern: 'cat ~/.ssh', description: '密钥文件读取' },
  { pattern: 'npm publish', description: '未确认发布' },
  { pattern: 'git push --force', description: '强制推送' },
  { pattern: 'git push --force-with-lease', description: '租约强制推送' },
  { pattern: 'Remove-Item -Recurse -Force', description: 'PowerShell 递归删除' },
];

/**
 * Validate that secretPatterns cover the baseline
 * @param patterns - configured secret patterns
 * @returns list of missing baseline patterns
 */
export function validateSecretPatternBaseline(patterns: string[]): string[] {
  const missing: string[] = [];

  for (const baseline of BASELINE_SECRET_PATTERNS) {
    if (!patterns.some(p => p.toLowerCase() === baseline.toLowerCase())) {
      missing.push(baseline);
    }
  }

  return missing;
}

/**
 * Get baseline secret patterns as a config-compatible array
 */
export function getBaselineSecretPatterns(): string[] {
  return [...BASELINE_SECRET_PATTERNS];
}

/**
 * Get baseline dangerous command policies
 */
export function getBaselineDangerousCommands(): Array<{ pattern: string; description: string }> {
  return [...BASELINE_DANGEROUS_COMMANDS];
}