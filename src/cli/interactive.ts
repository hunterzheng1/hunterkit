/**
 * Interactive entrypoint - init wizard and operation menu
 * @module cli/interactive
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandContext, CliResponse } from './types.js';

/**
 * Run the interactive entrypoint - routes to init wizard or operation menu
 */
export async function runInteractiveEntrypoint(context: CommandContext): Promise<CliResponse> {
  const configPath = join(context.globalOptions.cwd, '.harness', 'config', 'harness.config.json');
  const isInitialized = existsSync(configPath);

  if (isInitialized) {
    return runOperationMenu(context);
  } else {
    return runInitWizard(context);
  }
}

/**
 * Run the initialization wizard (stub - to be implemented by harness-workspace-config)
 */
export async function runInitWizard(context: CommandContext): Promise<CliResponse> {
  if (context.globalOptions.dryRun) {
    return {
      code: 0,
      msg: 'success',
      data: { command: 'init', mode: 'wizard', dryRun: true },
      warnings: ['Dry-run mode: no files were written'],
    };
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'init',
      mode: 'wizard',
      message: 'Initialization wizard - to be implemented by harness-workspace-config',
    },
    warnings: ['Init wizard is a stub, will be implemented by harness-workspace-config capability'],
  };
}

/**
 * Run the operation menu (stub - shows available commands)
 */
export async function runOperationMenu(context: CommandContext): Promise<CliResponse> {
  const commands = context.registry.list();

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'menu',
      availableCommands: commands.map(c => ({
        name: c.name,
        description: c.description,
      })),
    },
    warnings: [],
  };
}
