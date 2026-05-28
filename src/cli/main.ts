/**
 * CLI main entrypoint - orchestrates the entire CLI flow
 * @module cli/main
 */

import type { CliIo, CliResponse, CommandContext } from './types.js';
import { parseGlobalOptions } from './global-options.js';
import { createCommandRegistry } from './command-registry.js';
import { HarnessCliError, toCliResponse } from './errors.js';
import { writeCliResponse } from './output.js';
import { runInteractiveEntrypoint } from './interactive.js';

/**
 * Main CLI entrypoint function
 * @returns exit code (0 = success, non-zero = error)
 */
export async function main(
  argv: string[],
  _env: NodeJS.ProcessEnv,
  io: CliIo,
): Promise<number> {
  try {
    // 1. Parse global options and command
    const { parsedCommand, globalOptions } = parseGlobalOptions(argv);

    // 2. Create command registry
    const registry = createCommandRegistry();

    // 3. Route: interactive or command
    let response: CliResponse;

    if (!parsedCommand.command) {
      // No command - enter interactive mode
      const context: CommandContext = {
        globalOptions,
        command: '',
        io,
        registry,
      };
      response = await runInteractiveEntrypoint(context);
    } else {
      // Command provided - resolve and execute
      const handler = registry.resolve(parsedCommand.command);

      if (!handler) {
        throw new HarnessCliError(1001, `Unknown command: ${parsedCommand.command}`);
      }

      // Check workspace initialization if required
      if (handler.requiresInitializedWorkspace) {
        const { existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        const configPath = join(globalOptions.cwd, '.harness', 'config', 'harness.config.json');
        if (!existsSync(configPath)) {
          throw new HarnessCliError(2001, `Command "${parsedCommand.command}" requires an initialized workspace`);
        }
      }

      const context: CommandContext = {
        globalOptions,
        command: parsedCommand.command,
        io,
        registry,
      };

      response = await handler.run(context);
    }

    // 4. Output response
    writeCliResponse(response, {
      json: globalOptions.json,
      noColor: globalOptions.noColor,
      io,
    });

    // 5. Return exit code
    return response.code === 0 ? 0 : 1;
  } catch (error) {
    // Top-level error boundary
    const response = toCliResponse(error);

    writeCliResponse(response, {
      json: argv.includes('--json'),
      noColor: argv.includes('--no-color'),
      io,
    });

    return 1;
  }
}
