/**
 * Inspect command handler
 * @module capabilities/inspect/command
 */

import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import { scanProject, generateModuleMap, generateRules } from './scanner.js';
import type { InspectOptions, InspectScope } from './types.js';

/** 解析后的 inspect 参数（含 scope 嵌套结构） */
export interface ParsedInspectArgs {
  scope: InspectScope;
  rules: boolean;
}

/**
 * Parse inspect command arguments
 */
export function parseInspectArgs(args: string[], cwd: string): ParsedInspectArgs {
  const full = args.includes('--full');
  const rules = args.includes('--rules');
  let path: string | null = null;
  
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && pathIdx + 1 < args.length) {
    path = args[pathIdx + 1];
  }
  
  // 首次无 facts 目录时自动等价 --full
  const factsDir = resolve(cwd, '.harness/facts');
  if (!full && !path && !existsSync(factsDir)) {
    return { scope: { full: true, path: null }, rules };
  }
  
  return { scope: { full, path }, rules };
}

/**
 * Run the inspect command
 */
export async function runInspectCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun, json } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  // 解析命令参数
  const args = (context as any).args || [];
  const parsed = parseInspectArgs(args, cwd);
  const scope: InspectScope = parsed.scope;
  const repoMap = scanProject(cwd, scope);

  const factsPath = resolve(paths.facts, 'repo-map.json');
  const moduleMapPath = resolve(paths.generated, 'module-map.md');
  const rulesPath = resolve(paths.generated, 'rules.generated.md');

  if (!dryRun) {
    const tx = beginTransaction(cwd);
    stageWrite(tx, factsPath, JSON.stringify(repoMap, null, 2));
    stageWrite(tx, moduleMapPath, generateModuleMap(repoMap));
    
    // 仅当 --rules 为 true 时写入 rules.generated.md
    if (parsed.rules) {
      stageWrite(tx, rulesPath, generateRules(repoMap));
    }
    
    commitTransaction(tx);
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'inspect',
      factsPath: dryRun ? factsPath.replace(cwd + '/', '') : factsPath.replace(cwd + '/', ''),
      moduleMapPath: moduleMapPath.replace(cwd + '/', ''),
      rulesPath: parsed.rules ? rulesPath.replace(cwd + '/', '') : null,
      scope,
      languages: repoMap.languages,
      fileCount: repoMap.buildFiles.length + repoMap.docs.length + repoMap.agentFiles.length,
      reviewRequired: [],
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
