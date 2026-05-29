/**
 * Review command handler
 * @module capabilities/review/command
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import type { ReviewFinding, ReviewResult } from './types.js';

const REVIEWABLE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];

const ALL_REVIEWERS = [
  'rules-reviewer',
  'bug-scanner',
  'deep-bug-analyzer',
  'history-reviewer',
  'standards-reviewer',
  'contract-reviewer',
];

const LITE_REVIEWERS = ['contract-reviewer', 'bug-scanner'];

/**
 * 解析 review 命令参数
 */
export function parseReviewArgs(args: string[]): {
  local: boolean;
  staged: boolean;
  scan: string | null;
  fix: boolean;
  noFix: boolean;
  full: boolean;
  lite: boolean;
  comment: boolean;
} {
  const local = args.includes('--local');
  const staged = args.includes('--staged');
  let scan: string | null = null;
  const scanIdx = args.indexOf('--scan');
  if (scanIdx !== -1 && scanIdx + 1 < args.length) {
    scan = args[scanIdx + 1];
  }

  // 互斥校验：scope flags
  const scopeFlags = [local, staged, scan !== null].filter(Boolean);
  if (scopeFlags.length > 1) {
    throw Object.assign(new Error('范围参数冲突：--local、--staged、--scan 不能同时使用'), { code: 2602 });
  }

  const fix = args.includes('--fix');
  const noFix = args.includes('--no-fix');
  if (fix && noFix) {
    throw Object.assign(new Error('--fix 和 --no-fix 互斥'), { code: 2602 });
  }

  const full = args.includes('--full');
  const lite = args.includes('--lite');
  if (full && lite) {
    throw Object.assign(new Error('--full 和 --lite 互斥'), { code: 2602 });
  }

  const comment = args.includes('--comment');

  return { local, staged, scan, fix, noFix, full, lite, comment };
}

/**
 * 解析审查范围
 */
export function resolveScope(
  options: { local?: boolean; staged?: boolean; scan?: string | null },
  cwd: string,
): { files: string[]; scopeName: string } {
  if (options.scan) {
    const scanPath = resolve(cwd, options.scan);
    if (!scanPath.startsWith(cwd)) {
      throw Object.assign(new Error(`审查路径越界：${options.scan} 不在项目根目录内`), { code: 2603 });
    }
    const files = scanFilesForReview(scanPath);
    return { files, scopeName: 'scan' };
  }

  if (options.staged) {
    try {
      const output = execSync('git diff --cached --name-only', { cwd, encoding: 'utf-8' });
      const files = output.split('\n').filter(f => f && REVIEWABLE_EXTS.includes(extname(f)));
      return { files: files.map(f => resolve(cwd, f)), scopeName: 'staged' };
    } catch {
      return { files: [], scopeName: 'staged' };
    }
  }

  if (options.local) {
    try {
      const output = execSync('git diff main...HEAD --name-only', { cwd, encoding: 'utf-8' });
      const files = output.split('\n').filter(f => f && REVIEWABLE_EXTS.includes(extname(f)));
      return { files: files.map(f => resolve(cwd, f)), scopeName: 'local' };
    } catch {
      return { files: [], scopeName: 'local' };
    }
  }

  // 默认：扫描全部
  const files = scanFilesForReview(cwd);
  return { files, scopeName: 'all' };
}

/**
 * 选择 reviewer
 */
export function selectReviewers(
  options: { lite?: boolean; full?: boolean },
  fileCount: number = 0,
): string[] {
  if (options.lite) {
    return LITE_REVIEWERS;
  }
  if (options.full || fileCount > 3) {
    return ALL_REVIEWERS;
  }
  return ALL_REVIEWERS;
}

/**
 * 分类严重度
 */
export function classifySeverity(
  findings: Array<{ file: string; line: number; category: string; confidence: number; reviewer: string; message: string; suggestion?: string }>,
): ReviewFinding[] {
  return findings.map(f => {
    let severity: 'P0' | 'P1' | 'P2';
    if (f.category === 'security' && f.confidence >= 90) {
      severity = 'P0';
    } else if (f.category === 'security' || f.category === 'contract') {
      severity = 'P1';
    } else {
      severity = 'P2';
    }
    return {
      file: f.file,
      line: f.line,
      severity,
      category: f.category,
      message: f.message,
      suggestion: f.suggestion,
    };
  });
}

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
 * 运行 reviewer（模拟实现）
 */
function runReviewers(
  reviewers: string[],
  files: string[],
  cwd: string,
): Array<{ file: string; line: number; category: string; confidence: number; reviewer: string; message: string; suggestion?: string }> {
  const candidateFindings: Array<{ file: string; line: number; category: string; confidence: number; reviewer: string; message: string; suggestion?: string }> = [];

  for (const file of files) {
    const rel = relative(cwd, file);
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 每个 reviewer 检查不同类型的问题
        if (reviewers.includes('rules-reviewer')) {
          if (/TODO|FIXME|HACK|XXX/.test(line)) {
            candidateFindings.push({
              file: rel,
              line: i + 1,
              category: 'todo',
              confidence: 85,
              reviewer: 'rules-reviewer',
              message: '发现 TODO/FIXME 注释',
              suggestion: '解决或跟踪此项目',
            });
          }
        }

        if (reviewers.includes('bug-scanner')) {
          if (/console\.(log|debug|info)\(/.test(line) && !rel.includes('test')) {
            candidateFindings.push({
              file: rel,
              line: i + 1,
              category: 'logging',
              confidence: 85,
              reviewer: 'bug-scanner',
              message: '非测试代码中的控制台输出',
              suggestion: '使用适当的日志记录器',
            });
          }
        }

        if (reviewers.includes('deep-bug-analyzer')) {
          if (/(password|secret|token|api_key)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
            candidateFindings.push({
              file: rel,
              line: i + 1,
              category: 'security',
              confidence: 95,
              reviewer: 'deep-bug-analyzer',
              message: '可能的硬编码密钥',
              suggestion: '使用环境变量',
            });
          }
        }

        if (reviewers.includes('contract-reviewer')) {
          // 模拟契约检查
          if (/export\s+default/.test(line) && !content.includes('@contract')) {
            candidateFindings.push({
              file: rel,
              line: i + 1,
              category: 'contract',
              confidence: 75,
              reviewer: 'contract-reviewer',
              message: '导出缺少契约注释',
              suggestion: '添加 @contract 注释',
            });
          }
        }
      }
    } catch {}
  }

  return candidateFindings;
}

/**
 * 去重 findings
 */
function deduplicateFindings<T extends { file: string; line: number; category: string }>(
  findings: T[],
): T[] {
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.file}:${f.line}:${f.category}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 获取当前分支名
 */
function getCurrentBranch(cwd: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Run the review command
 */
export async function runReviewCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const args = (context as any).args || [];

  // 解析参数
  let options;
  try {
    options = parseReviewArgs(args);
  } catch (err: any) {
    return {
      code: err.code || 2602,
      msg: err.message,
      data: { command: 'review' },
      warnings: [],
    };
  }

  // 解析范围
  let scopeResult;
  try {
    scopeResult = resolveScope(options, cwd);
  } catch (err: any) {
    return {
      code: err.code || 2603,
      msg: err.message,
      data: { command: 'review' },
      warnings: [],
    };
  }

  const { files, scopeName } = scopeResult;

  // 选择 reviewer
  const reviewers = selectReviewers(options, files.length);

  // 运行 reviewer
  const candidateFindings = runReviewers(reviewers, files, cwd);

  // 过滤 confidence < 80
  const filtered = candidateFindings.filter(f => f.confidence >= 80);
  const discarded = candidateFindings.length - filtered.length;

  // 去重
  const deduplicated = deduplicateFindings(filtered);

  // 分类严重度
  const classified = classifySeverity(deduplicated);

  // 统计
  const summary = {
    p0: classified.filter(f => f.severity === 'P0').length,
    p1: classified.filter(f => f.severity === 'P1').length,
    p2: classified.filter(f => f.severity === 'P2').length,
    discarded,
  };

  // 生成报告路径
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const branch = getCurrentBranch(cwd);
  const mdReportPath = `.harness/reports/review/${timestamp}-${branch}.md`;
  const jsonReportPath = `.harness/reports/review/${timestamp}-${branch}.json`;

  // 写入报告
  if (!dryRun) {
    const tx = beginTransaction(cwd);

    // Markdown 报告（中文）
    const mdContent = `# 代码审查报告

生成时间: ${new Date().toISOString()}

## 摘要
- P0 (阻断): ${summary.p0}
- P1 (重要): ${summary.p1}
- P2 (建议): ${summary.p2}
- 已丢弃: ${summary.discarded}

## 发现问题

${classified.map(f => `### ${f.severity} - ${f.file}:${f.line}
**[${f.category}]** ${f.message}
${f.suggestion ? `> 建议: ${f.suggestion}` : ''}
`).join('\n')}
`;

    // JSON 报告
    const jsonReport = {
      schemaVersion: 1,
      scope: scopeName,
      findings: classified,
      summary,
      reports: {
        markdown: mdReportPath,
        json: jsonReportPath,
      },
    };

    stageWrite(tx, resolve(cwd, mdReportPath), mdContent);
    stageWrite(tx, resolve(cwd, jsonReportPath), JSON.stringify(jsonReport, null, 2));
    commitTransaction(tx);
  }

  // 如果有 P0，返回错误
  if (summary.p0 > 0) {
    return {
      code: 2601,
      msg: `发现 ${summary.p0} 个 P0 阻断问题`,
      data: {
        command: 'review',
        scope: scopeName,
        findings: classified,
        summary,
        reports: {
          markdown: mdReportPath,
          json: jsonReportPath,
        },
      },
      warnings: dryRun ? ['Dry-run 模式：未写入报告'] : [],
    };
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'review',
      scope: scopeName,
      findings: classified,
      summary,
      reports: {
        markdown: mdReportPath,
        json: jsonReportPath,
      },
    },
    warnings: dryRun ? ['Dry-run 模式：未写入报告'] : [],
  };
}
