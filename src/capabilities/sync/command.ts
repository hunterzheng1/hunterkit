/**
 * Sync command handler
 * @module capabilities/sync/command
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import type { SyncDocumentResult, DocumentKind } from './types.js';
import { MANAGED_BLOCK_START, MANAGED_BLOCK_END, upsertManagedBlock } from './managed-block.js';
import { renderAgentsManagedBlock, renderClaudeShortEntry, renderReadmeUsageBlock } from './document-templates.js';
import { scanForInternalNames } from './internal-source-guard.js';

const DOCUMENT_TARGETS: Record<DocumentKind, { path: string; label: string }> = {
  readme: { path: 'README.md', label: 'README' },
  agents: { path: 'AGENTS.md', label: 'AGENTS' },
  claude: { path: 'CLAUDE.md', label: 'CLAUDE' },
  copilot: { path: '.github/copilot-instructions.md', label: 'Copilot Instructions' },
};

const VALID_DOC_KINDS: string[] = ['readme', 'agents', 'claude', 'copilot'];

// MANAGED_BLOCK_START/END now imported from ./managed-block.js (canonical: <!-- harness:start -->)

/** 高风险变更模式 */
const HIGH_RISK_PATTERNS = [
  'package.json', 'package-lock.json',
  'tsconfig.json', 'pom.xml', 'build.gradle',
  '.github/workflows/', '.gitlab-ci.yml',
  'AGENTS.md', 'CLAUDE.md', '.claude/',
  'openspec/', '.harness/develop/',
];

/** 解析后的同步参数 */
export interface ParsedSyncArgs {
  check: boolean;
  fast: boolean;
  docs: DocumentKind[] | null;
}

/**
 * 解析 sync 命令参数
 */
export function parseSyncArgs(args: string[]): ParsedSyncArgs {
  const check = args.includes('--check');
  const fast = args.includes('--fast');
  let docs: DocumentKind[] | null = null;

  const docsIdx = args.indexOf('--docs');
  if (docsIdx !== -1 && docsIdx + 1 < args.length) {
    const raw = args[docsIdx + 1].split(',').map(s => s.trim());
    for (const d of raw) {
      if (!VALID_DOC_KINDS.includes(d)) {
        throw Object.assign(
          new Error(`Unknown document type: ${d}. Valid types: ${VALID_DOC_KINDS.join(', ')}`),
          { code: 2402 },
        );
      }
    }
    docs = raw as DocumentKind[];
  }

  return { check, fast, docs };
}

/**
 * 检测变更文件是否包含高风险模式
 */
export function isHighRiskChange(changedFiles: string[]): boolean {
  return changedFiles.some(f => HIGH_RISK_PATTERNS.some(p => f.includes(p)));
}

function generateManagedBlock(kind: DocumentKind, factsPath: string): string {
  return [
    MANAGED_BLOCK_START,
    `> This section is managed by harness. Run \`harness sync\` to update.`,
    `> Source: ${factsPath}`,
    '',
    `## Project Overview (managed by harness)`,
    '',
    `This project uses harness for development workflow management.`,
    '',
    MANAGED_BLOCK_END,
  ].join('\n');
}

/**
 * 生成同步报告 Markdown
 */
function generateReportContent(
  documents: SyncDocumentResult[],
  drift: boolean,
  reviewRequired: string[],
): string {
  const lines = [
    '# Sync Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `## Drift Status: ${drift ? 'DRIFTED' : 'UP-TO-DATE'}`,
    '',
    '## Documents',
    '',
  ];

  for (const doc of documents) {
    lines.push(`- **${doc.path}** (${doc.kind}): ${doc.status}${doc.message ? ` - ${doc.message}` : ''}`);
  }

  if (reviewRequired.length > 0) {
    lines.push('');
    lines.push('## REVIEW_REQUIRED');
    lines.push('');
    for (const item of reviewRequired) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Run the sync command
 */
export async function runSyncCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const factsPath = resolve(paths.facts, 'repo-map.json');

  // 解析命令参数
  const args = context.args || [];
  let parsed: ParsedSyncArgs;
  try {
    parsed = parseSyncArgs(args);
  } catch (err: any) {
    if (err.code === 2402) {
      return { code: 2402, msg: err.message, data: { command: 'sync' }, warnings: [] };
    }
    throw err;
  }

  // 检查 facts 是否存在
  if (!existsSync(factsPath)) {
    return {
      code: 2404,
      msg: 'Repo facts not found. Run "harness inspect" first.',
      data: { command: 'sync' },
      warnings: [],
    };
  }

  // 读取 facts
  let facts: any;
  try {
    facts = JSON.parse(readFileSync(factsPath, 'utf-8'));
  } catch {
    return {
      code: 2404,
      msg: 'Repo facts not found or invalid. Run "harness inspect" first.',
      data: { command: 'sync' },
      warnings: [],
    };
  }

  // 确定目标文档列表
  const kinds: DocumentKind[] = parsed.docs ?? ['readme', 'agents', 'claude', 'copilot'];
  const documents: SyncDocumentResult[] = [];
  const warnings: string[] = [];
  const reviewRequired: string[] = facts.reviewRequired || [];

  // --fast 模式：尝试使用 git diff 判断变更范围
  let upgradedFromFast = false;
  if (parsed.fast) {
    try {
      const { execSync } = await import('node:child_process');
      const diffOutput = execSync('git diff --name-only HEAD', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const changedFiles = diffOutput.split('\n').filter(Boolean);

      if (isHighRiskChange(changedFiles)) {
        upgradedFromFast = true;
        warnings.push('Upgraded to full check due to high-risk changes');
      }
    } catch {
      // Git 不可用时降级为完整检查
      warnings.push('Git unavailable, falling back to full check');
    }
  }

  // 确定模式
  const mode = parsed.check ? 'check' : dryRun ? 'dry-run' : 'sync';

  // 对每个目标文档计算期望内容并比较
  const tx = beginTransaction(cwd, dryRun || parsed.check);

  for (const kind of kinds) {
    const target = DOCUMENT_TARGETS[kind];
    const docPath = resolve(cwd, target.path);
    const block = generateManagedBlock(kind, factsPath.replace(cwd + '/', ''));

    if (existsSync(docPath)) {
      const existing = readFileSync(docPath, 'utf-8');

      if (existing.includes(MANAGED_BLOCK_START)) {
        // 更新已有 managed block
        const updated = existing.replace(
          new RegExp(`${MANAGED_BLOCK_START}[\\s\\S]*?${MANAGED_BLOCK_END}`),
          block,
        );

        if (updated !== existing) {
          if (parsed.check) {
            documents.push({ path: target.path, kind, status: 'drifted', message: 'Managed block has changed' });
          } else {
            stageWrite(tx, docPath, updated);
            documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
          }
        } else {
          documents.push({ path: target.path, kind, status: 'up-to-date' });
        }
      } else {
        // 文档存在但没有 managed block → 追加
        if (parsed.check) {
          documents.push({ path: target.path, kind, status: 'drifted', message: 'No managed block found' });
        } else {
          stageWrite(tx, docPath, existing + '\n\n' + block + '\n');
          documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
        }
      }
    } else {
      // 文档不存在
      if (parsed.check) {
        documents.push({ path: target.path, kind, status: 'drifted', message: 'Document does not exist' });
      } else {
        stageWrite(tx, docPath, `# ${target.label}\n\n${block}\n`);
        documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
      }
    }
  }

  // 提交事务（check 模式下不写入）
  const record = commitTransaction(tx);

  // 检测漂移
  const drift = documents.some(d => d.status === 'drifted');

  // 写入同步报告
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const reportRelPath = `.harness/reports/sync/${timestamp}-sync.md`;
  const reportAbsPath = resolve(cwd, reportRelPath);

  if (!dryRun) {
    try {
      const reportContent = generateReportContent(documents, drift, reviewRequired);
      const reportTx = beginTransaction(cwd);
      stageWrite(reportTx, reportAbsPath, reportContent);
      commitTransaction(reportTx);
    } catch {
      return {
        code: 5401,
        msg: 'Failed to write sync report',
        data: { command: 'sync' },
        warnings: [],
      };
    }
  }

  // 漂移时返回 2401
  if (parsed.check && drift) {
    return {
      code: 2401,
      msg: 'Document drift detected',
      data: {
        command: 'sync',
        mode,
        drift: true,
        documents,
        reportPath: reportRelPath,
        reviewRequired,
      },
      warnings,
    };
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'sync',
      mode,
      drift,
      documents,
      reportPath: reportRelPath,
      reviewRequired,
    },
    warnings: dryRun ? ['Dry-run mode: no files were written', ...warnings] : warnings,
  };
}
