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

/**
 * Parse inspect command arguments
 */
export function parseInspectArgs(args: string[], cwd: string): InspectOptions {
  const full = args.includes('--full');
  const rules = args.includes('--rules');
  let path: string | null = null;
  
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && pathIdx + 1 < args.length) {
    path = args[pathIdx + 1];
  }
  
  // 首次无 facts 时自动等价 --full
  const factsPath = resolve(cwd, '.harness/facts/repo-map.json');
  if (!full && !path && !existsSync(factsPath)) {
    return { 
      full: true, 
      path: null, 
      rules, 
      json: false, 
      dryRun: false 
    };
  }
  
  return { 
    full, 
    path, 
    rules, 
    json: false, 
    dryRun: false 
  };
}

/**
 * Run the inspect command
 */
export async function runInspectCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun, json } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  // 解析命令参数
  const args = (context as any).args || [];
  const options = parseInspectArgs(args, cwd);
  
  const scope: InspectScope = { full: options.full, path: options.path };
  const repoMap = scanProject(cwd, scope);

  const factsPath = resolve(paths.facts, 'repo-map.json');
  const moduleMapPath = resolve(paths.generated, 'module-map.md');
  const rulesPath = resolve(paths.generated, 'rules.generated.md');

  if (!dryRun) {
    const tx = beginTransaction(cwd);
    stageWrite(tx, factsPath, JSON.stringify(repoMap, null, 2));
    stageWrite(tx, moduleMapPath, generateModuleMap(repoMap));
    
    // 仅当 --rules 为 true 时写入 rules.generated.md
    if (options.rules) {
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
      rulesPath: options.rules ? rulesPath.replace(cwd + '/', '') : null,
      scope,
      languages: repoMap.languages,
      fileCount: repoMap.buildFiles.length + repoMap.docs.length + repoMap.agentFiles.length,
      reviewRequired: [],
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
