/**
 * Command registry - registers 8 top-level commands and provides routing
 * @module cli/command-registry
 */

import type { CommandHandler, CommandRegistry, CommandContext, CliResponse } from './types.js';

/** Command metadata definitions */
const COMMAND_DEFINITIONS: Array<{
  name: string;
  description: string;
  requiresInitializedWorkspace: boolean;
}> = [
  { name: 'inspect', description: 'Scan project structure and generate facts', requiresInitializedWorkspace: true },
  { name: 'sync', description: 'Sync documents with knowledge base', requiresInitializedWorkspace: true },
  { name: 'develop', description: 'Run development workflow', requiresInitializedWorkspace: true },
  { name: 'review', description: 'Run code review', requiresInitializedWorkspace: true },
  { name: 'knowledge', description: 'Manage knowledge index', requiresInitializedWorkspace: true },
  { name: 'status', description: 'Show workspace and project status', requiresInitializedWorkspace: false },
  { name: 'doctor', description: 'Diagnose environment and dependencies', requiresInitializedWorkspace: false },
  { name: 'config', description: 'Manage harness configuration', requiresInitializedWorkspace: false },
];

/**
 * Create a stub handler for unimplemented commands
 */
function createStubHandler(name: string, description: string, requiresInit: boolean): CommandHandler {
  return {
    name,
    description,
    requiresInitializedWorkspace: requiresInit,
    async run(_context: CommandContext): Promise<CliResponse> {
      return {
        code: 0,
        msg: 'success',
        data: { command: name, status: 'stub', message: `${name} command - not yet implemented` },
        warnings: [`${name} command is a stub, will be implemented by the corresponding capability`],
      };
    },
  };
}

/**
 * Create a new command registry with all 8 top-level commands
 */
export function createCommandRegistry(): CommandRegistry {
  const handlers = new Map<string, CommandHandler>();

  // Register all commands with stub handlers
  for (const def of COMMAND_DEFINITIONS) {
    handlers.set(def.name, createStubHandler(def.name, def.description, def.requiresInitializedWorkspace));
  }

  return {
    resolve(command: string): CommandHandler | null {
      return handlers.get(command) ?? null;
    },

    list(): CommandHandler[] {
      return Array.from(handlers.values());
    },

    registerHandler(handler: CommandHandler): void {
      handlers.set(handler.name, handler);
    },
  };
}
