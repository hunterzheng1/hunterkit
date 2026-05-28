/**
 * Sync command handler
 * @module capabilities/sync/command
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import type { SyncDocumentResult, DocumentKind } from './types.js';

const DOCUMENT_TARGETS: Record<DocumentKind, { path: string; label: string }> = {
  readme: { path: 'README.md', label: 'README' },
  agents: { path: 'AGENTS.md', label: 'AGENTS' },
  claude: { path: 'CLAUDE.md', label: 'CLAUDE' },
  copilot: { path: '.github/copilot-instructions.md', label: 'Copilot Instructions' },
};

const MANAGED_BLOCK_START = '<!-- harness-managed:start -->';
const MANAGED_BLOCK_END = '<!-- harness-managed:end -->';

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
 * Run the sync command
 */
export async function runSyncCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const factsPath = resolve(paths.facts, 'repo-map.json');

  if (!existsSync(factsPath)) {
    return {
      code: 2404,
      msg: 'Repo facts not found. Run "harness inspect" first.',
      data: { command: 'sync' },
      warnings: [],
    };
  }

  const kinds: DocumentKind[] = ['readme', 'agents', 'claude', 'copilot'];
  const documents: SyncDocumentResult[] = [];
  const mode = dryRun ? 'dry-run' : 'sync';

  const tx = beginTransaction(cwd, dryRun);

  for (const kind of kinds) {
    const target = DOCUMENT_TARGETS[kind];
    const docPath = resolve(cwd, target.path);
    const block = generateManagedBlock(kind, factsPath.replace(cwd + '/', ''));

    if (existsSync(docPath)) {
      const existing = readFileSync(docPath, 'utf-8');
      if (existing.includes(MANAGED_BLOCK_START)) {
        // Update existing managed block
        const updated = existing.replace(
          new RegExp(`${MANAGED_BLOCK_START}[\\s\\S]*?${MANAGED_BLOCK_END}`),
          block,
        );
        if (updated !== existing) {
          stageWrite(tx, docPath, updated);
          documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
        } else {
          documents.push({ path: target.path, kind, status: 'up-to-date' });
        }
      } else {
        // Append managed block
        stageWrite(tx, docPath, existing + '\n\n' + block + '\n');
        documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
      }
    } else {
      // Create new document
      stageWrite(tx, docPath, `# ${target.label}\n\n${block}\n`);
      documents.push({ path: target.path, kind, status: dryRun ? 'planned' : 'written' });
    }
  }

  const record = commitTransaction(tx);

  // Write sync report
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const reportPath = resolve(paths.reports, `sync/${timestamp}-sync.md`);
  if (!dryRun) {
    const reportTx = beginTransaction(cwd);
    const reportContent = `# Sync Report\n\nGenerated: ${new Date().toISOString()}\n\n${documents.map(d => `- ${d.path}: ${d.status}`).join('\n')}\n`;
    stageWrite(reportTx, reportPath, reportContent);
    commitTransaction(reportTx);
  }

  const drift = documents.some(d => d.status === 'drifted');

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'sync',
      mode,
      drift,
      documents,
      reportPath: reportPath.replace(cwd + '/', ''),
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
