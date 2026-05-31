/**
 * Unified output adapter - JSON and human-readable output
 * @module cli/output
 */

import type { CliResponse, CliIo, InstallSummary } from './types.js';

/**
 * Write a CliResponse to the appropriate output stream
 */
export function writeCliResponse(
  response: CliResponse,
  options: { json: boolean; noColor: boolean; io: CliIo },
): void {
  const { json, noColor, io } = options;

  if (json) {
    // Pure JSON output - no ANSI codes, no extra text
    io.stdout.write(JSON.stringify(response));
  } else {
    // Human-readable summary
    const summary = formatHumanSummary(response, noColor);
    io.stdout.write(summary);
  }
}

/**
 * Format a CliResponse as a human-readable summary string
 */
export function formatHumanSummary(response: CliResponse, noColor = false): string {
  const lines: string[] = [];

  if (response.code === 0) {
    // Success
    const statusIcon = noColor ? '[OK]' : '\x1b[32m[OK]\x1b[0m';
    lines.push(`${statusIcon} ${response.msg}`);

    if (response.data) {
      const data = response.data;

      // 安装摘要六类信息（优先展示）
      if (data.installSummary) {
        const summary = data.installSummary as InstallSummary;
        lines.push(`  Selected AI tools: ${summary.selectedAiTools.length > 0 ? summary.selectedAiTools.join(', ') : 'none'}`);
        lines.push(`  Selected capabilities: ${summary.selectedCapabilities.length > 0 ? summary.selectedCapabilities.join(', ') : 'none'}`);
        lines.push(`  Hook strength: ${summary.hookStrength}`);
        lines.push(`  Write strategy: ${summary.writeStrategy}`);

        // Runtime projections written
        lines.push('  Runtime projections written:');
        if (summary.runtimeProjectionsWritten.length > 0) {
          for (const artifact of summary.runtimeProjectionsWritten) {
            const kind = artifact.kind ?? 'runtime';
            lines.push(`    - [${kind}] ${artifact.path}`);
          }
        } else {
          lines.push('    none');
        }

        // Runtime projections skipped
        lines.push('  Runtime projections skipped:');
        if (summary.runtimeProjectionsSkipped.length > 0) {
          for (const artifact of summary.runtimeProjectionsSkipped) {
            const reason = artifact.reason ? ` (${artifact.reason})` : '';
            lines.push(`    - [${artifact.kind ?? 'skipped'}] ${artifact.path}${reason}`);
          }
        } else {
          lines.push('    none');
        }
      }

      // 常规字段
      if (data.command) {
        lines.push(`  Command: ${data.command}`);
      }
      if (data.status) {
        lines.push(`  Status: ${data.status}`);
      }
      if (data.message) {
        lines.push(`  ${data.message}`);
      }
    }

    // Artifacts
    if (response.artifacts && response.artifacts.length > 0) {
      lines.push('  Artifacts:');
      for (const artifact of response.artifacts) {
        const kind = artifact.kind ?? artifact.type;
        const toolInfo = artifact.tool ? ` (${artifact.tool})` : '';
        lines.push(`    - [${kind}] ${artifact.path}${artifact.description ? ` (${artifact.description})` : ''}${toolInfo}`);
      }
    }
  } else {
    // Error
    const errorIcon = noColor ? '[ERROR]' : '\x1b[31m[ERROR]\x1b[0m';
    lines.push(`${errorIcon} Code ${response.code}: ${response.msg}`);

    if (response.data?.suggestion) {
      lines.push(`  Suggestion: ${response.data.suggestion}`);
    }
  }

  // Warnings
  if (response.warnings.length > 0) {
    const warnPrefix = noColor ? '[WARN]' : '\x1b[33m[WARN]\x1b[0m';
    for (const warning of response.warnings) {
      lines.push(`${warnPrefix} ${warning}`);
    }
  }

  return lines.join('\n') + '\n';
}
