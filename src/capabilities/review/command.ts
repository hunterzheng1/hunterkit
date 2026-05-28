/**
 * Review command handler
 * @module capabilities/review/command
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import type { ReviewFinding, ReviewResult } from './types.js';

const REVIEWABLE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];

function scanFilesForReview(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && REVIEWABLE_EXTS.includes(extname(entry.name))) {
        results.push(fullPath);
      } else if (entry.isDirectory()) {
        results.push(...scanFilesForReview(fullPath));
      }
    }
  } catch {}
  return results;
}

function reviewFile(filePath: string, root: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const rel = relative(root, filePath);
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for TODO/FIXME
      if (/TODO|FIXME|HACK|XXX/.test(line)) {
        findings.push({
          file: rel, line: i + 1, severity: 'info', category: 'todo',
          message: `Found TODO/FIXME comment`, suggestion: 'Resolve or track this item',
        });
      }
      // Check for console.log in production code
      if (/console\.(log|debug|info)\(/.test(line) && !rel.includes('test')) {
        findings.push({
          file: rel, line: i + 1, severity: 'warning', category: 'logging',
          message: 'Console output in non-test code', suggestion: 'Use a proper logger',
        });
      }
      // Check for hardcoded secrets patterns
      if (/(password|secret|token|api_key)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
        findings.push({
          file: rel, line: i + 1, severity: 'error', category: 'security',
          message: 'Possible hardcoded secret', suggestion: 'Use environment variables',
        });
      }
    }
  } catch {}
  return findings;
}

/**
 * Run the review command
 */
export async function runReviewCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  const files = scanFilesForReview(cwd);
  const allFindings: ReviewFinding[] = [];

  for (const file of files) {
    allFindings.push(...reviewFile(file, cwd));
  }

  const summary = {
    total: allFindings.length,
    errors: allFindings.filter(f => f.severity === 'error').length,
    warnings: allFindings.filter(f => f.severity === 'warning').length,
    info: allFindings.filter(f => f.severity === 'info').length,
  };

  // Write report
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const reportPath = resolve(paths.reports, `review/${timestamp}-review.md`);

  if (!dryRun) {
    const tx = beginTransaction(cwd);
    const reportContent = `# Review Report\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n- Total: ${summary.total}\n- Errors: ${summary.errors}\n- Warnings: ${summary.warnings}\n- Info: ${summary.info}\n\n## Findings\n\n${allFindings.map(f => `### ${f.severity.toUpperCase()} - ${f.file}:${f.line}\n**[${f.category}]** ${f.message}\n${f.suggestion ? `> Suggestion: ${f.suggestion}` : ''}\n`).join('\n')}`;
    stageWrite(tx, reportPath, reportContent);
    commitTransaction(tx);
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'review',
      scope: 'all',
      findings: allFindings,
      summary,
      reportPath: reportPath.replace(cwd + '/', ''),
    },
    warnings: dryRun ? ['Dry-run mode: no report was written'] : [],
  };
}
