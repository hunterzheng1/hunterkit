/**
 * Knowledge command handler
 * @module capabilities/knowledge/command
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import type { KnowledgeIndex, KnowledgeEntry } from './types.js';

const INDEXABLE_EXTS = ['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.py', '.java', '.go'];

function scanIndexableFiles(dir: string, root: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist') continue;
      const fullPath = join(dir, item.name);
      if (item.isFile() && INDEXABLE_EXTS.includes(extname(item.name))) {
        const rel = relative(root, fullPath);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const stat = statSync(fullPath);
          const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
          const type = extname(item.name) === '.md' ? 'document' : extname(item.name) === '.json' ? 'config' : 'code';
          entries.push({
            id: hash,
            path: rel,
            type: type as any,
            title: item.name,
            tags: [extname(item.name).slice(1)],
            contentHash: hash,
            lastModified: stat.mtime.toISOString(),
          });
        } catch {}
      } else if (item.isDirectory()) {
        entries.push(...scanIndexableFiles(fullPath, root));
      }
    }
  } catch {}
  return entries;
}

/**
 * Run the knowledge command
 */
export async function runKnowledgeCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  const entries = scanIndexableFiles(cwd, cwd);
  const index: KnowledgeIndex = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  const indexPath = resolve(paths.facts, 'knowledge-index.json');

  if (!dryRun) {
    const tx = beginTransaction(cwd);
    stageWrite(tx, indexPath, JSON.stringify(index, null, 2));
    commitTransaction(tx);
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'knowledge',
      entryCount: entries.length,
      indexPath: indexPath.replace(cwd + '/', ''),
      types: {
        document: entries.filter(e => e.type === 'document').length,
        code: entries.filter(e => e.type === 'code').length,
        config: entries.filter(e => e.type === 'config').length,
      },
    },
    warnings: dryRun ? ['Dry-run mode: no index was written'] : [],
  };
}
