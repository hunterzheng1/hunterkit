/**
 * Global CLI options parser
 * @module cli/global-options
 */

import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ParsedCommand, GlobalOptions } from './types.js';
import { HarnessCliError } from './errors.js';

/**
 * Parse global options and command from argv
 */
export function parseGlobalOptions(argv: string[]): {
  parsedCommand: ParsedCommand;
  globalOptions: GlobalOptions;
} {
  const program = new Command();

  program
    .name('harness')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option('--cwd <path>', 'Project root directory')
    .option('--dry-run', 'Preview mode - no actual file writes', false)
    .option('--json', 'Output as pure JSON', false)
    .option('--no-color', 'Disable ANSI color codes');

  // Suppress commander's default output
  program.configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });

  program.exitOverride(() => {});

  try {
    program.parse(argv, { from: 'user' });
  } catch {
    // Ignore commander exit overrides
  }

  const opts = program.opts<{
    cwd?: string;
    dryRun: boolean;
    json: boolean;
    color: boolean;
  }>();

  // Resolve cwd
  let cwd: string;
  if (opts.cwd) {
    cwd = resolve(opts.cwd);
    if (!existsSync(cwd)) {
      throw new HarnessCliError(1002, `Path does not exist: ${cwd}`);
    }
  } else {
    cwd = process.cwd();
  }

  // Extract command (first non-option argument)
  const programArgs = program.args;
  const command = programArgs.length > 0 ? programArgs[0] : null;
  const args = programArgs.length > 1 ? programArgs.slice(1) : [];

  return {
    parsedCommand: { command, args },
    globalOptions: {
      cwd,
      dryRun: opts.dryRun ?? false,
      json: opts.json ?? false,
      noColor: opts.color === false ? true : false,
    },
  };
}
