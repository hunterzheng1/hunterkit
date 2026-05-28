/**
 * Inspect command handler
 * @module capabilities/inspect/command
 */

import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import { beginTransaction, stageWrite, commitTransaction } from '../../core/transaction.js';
import { scanProject, generateModuleMap, generateRules } from './scanner.js';
import type { InspectOptions, InspectScope } from './types.js';

/**
 * Run the inspect command
 */
export async function runInspectCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun, json } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  const scope: InspectScope = { full: true, path: null };
  const repoMap = scanProject(cwd, scope);

  const factsPath = resolve(paths.facts, 'repo-map.json');
  const moduleMapPath = resolve(paths.generated, 'module-map.md');
  const rulesPath = resolve(paths.generated, 'rules.generated.md');

  if (!dryRun) {
    const tx = beginTransaction(cwd);
    stageWrite(tx, factsPath, JSON.stringify(repoMap, null, 2));
    stageWrite(tx, moduleMapPath, generateModuleMap(repoMap));
    stageWrite(tx, rulesPath, generateRules(repoMap));
    commitTransaction(tx);
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'inspect',
      factsPath: dryRun ? factsPath.replace(cwd + '/', '') : factsPath.replace(cwd + '/', ''),
      moduleMapPath: moduleMapPath.replace(cwd + '/', ''),
      rulesPath: rulesPath.replace(cwd + '/', ''),
      scope,
      languages: repoMap.languages,
      fileCount: repoMap.buildFiles.length + repoMap.docs.length + repoMap.agentFiles.length,
      reviewRequired: [],
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
