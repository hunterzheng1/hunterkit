/**
 * Status command handler
 * @module commands/status
 */

import type { CommandContext, CliResponse } from '../cli/types.js';
import { resolveWorkspacePaths } from '../core/paths.js';
import { readWorkspaceStatus } from '../core/workspace.js';

/**
 * Run the status command
 */
export async function runStatusCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);
  const status = readWorkspaceStatus(paths);

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'status',
      workspace: status.workspace,
      schemaVersion: status.schemaVersion,
      initialized: status.initialized,
      capabilities: status.capabilities,
    },
    warnings: [],
  };
}
