/**
 * CLI main entrypoint - orchestrates the entire CLI flow
 * @module cli/main
 */

import type { CliIo, CliResponse, CommandContext, CommandHandler, CommandRegistry } from './types.js';
import { parseGlobalOptions } from './global-options.js';
import { createCommandRegistry } from './command-registry.js';
import { HarnessCliError, toCliResponse } from './errors.js';
import { writeCliResponse } from './output.js';
import { runInteractiveEntrypoint } from './interactive.js';
import type { WizardAnswers } from './interactive.js';
import { runStatusCommand } from '../commands/status.js';
import { runDoctorCommand } from '../commands/doctor.js';
import { runConfigCommand } from '../commands/config.js';
import { runInspectCommand } from '../capabilities/inspect/command.js';
import { runSyncCommand } from '../capabilities/sync/command.js';
import { runDevelopCommand } from '../capabilities/develop/command.js';
import { runReviewCommand } from '../capabilities/review/command.js';
import { runKnowledgeCommand } from '../capabilities/knowledge/command.js';
import { ensureWorkspace } from '../core/workspace.js';
import type { HarnessConfig } from '../core/types.js';
import { createAdapterRegistry, filterByTool } from '../adapters/registry.js';
import type { AdapterTool } from '../adapters/types.js';
import { ensureAdapterSources } from '../adapters/source-manager.js';
import { applyProjectionWrites } from '../adapters/projection-writer.js';
import { beginTransaction, commitTransaction } from '../core/transaction.js';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Register all real command handlers, replacing stubs
 */
function registerAllHandlers(registry: CommandRegistry): void {
  const handlers: CommandHandler[] = [
    { name: 'inspect', description: 'Scan project structure and generate facts', requiresInitializedWorkspace: true, run: runInspectCommand },
    { name: 'sync', description: 'Sync documents with knowledge base', requiresInitializedWorkspace: true, run: runSyncCommand },
    { name: 'develop', description: 'Run development workflow', requiresInitializedWorkspace: true, run: runDevelopCommand },
    { name: 'review', description: 'Run code review', requiresInitializedWorkspace: true, run: runReviewCommand },
    { name: 'knowledge', description: 'Manage knowledge index', requiresInitializedWorkspace: true, run: runKnowledgeCommand },
    { name: 'status', description: 'Show workspace and project status', requiresInitializedWorkspace: false, run: runStatusCommand },
    { name: 'doctor', description: 'Diagnose environment and dependencies', requiresInitializedWorkspace: false, run: runDoctorCommand },
    { name: 'config', description: 'Manage harness configuration', requiresInitializedWorkspace: false, run: runConfigCommand },
  ];
  for (const handler of handlers) {
    registry.registerHandler(handler);
  }
}

/**
 * 从向导答案构建 HarnessConfig
 */
function buildConfigFromAnswers(answers: WizardAnswers): HarnessConfig {
  return {
    schemaVersion: 1,
    project: {
      name: answers.projectPath.split('/').pop() || 'project',
      type: answers.projectType,
    },
    aiTools: {
      claude: answers.aiTools.includes('claude'),
      codex: answers.aiTools.includes('codex'),
      copilot: false,
      cursor: false,
    },
    capabilities: {
      inspect: answers.capabilities.includes('inspect'),
      sync: answers.capabilities.includes('sync'),
      develop: answers.capabilities.includes('develop'),
      review: answers.capabilities.includes('review'),
      knowledge: answers.capabilities.includes('knowledge'),
    },
    documents: {
      managed: ['AGENTS.md', 'CLAUDE.md'],
      generatedBlockPrefix: '<!-- harness-generated -->',
    },
    orchestration: {
      subagents: 'auto',
      maxParallelAgents: 4,
      validatorRequired: true,
    },
    safety: {
      dangerousCommandsBlocked: answers.hookStrength !== 'none',
      secretPatterns: ['.env*', '*.pem', '*.key'],
    },
  };
}

/**
 * 向导完成后执行工作区创建和产物生成
 */
function executePostWizardIntegration(
  cwd: string,
  answers: WizardAnswers,
  isDryRun: boolean,
): { artifacts: string[]; warnings: string[] } {
  const artifacts: string[] = [];
  const warnings: string[] = [];

  if (isDryRun) {
    warnings.push('Dry-run mode: no files were written');
    return { artifacts, warnings };
  }

  try {
    // 1. 创建工作区目录结构
    const config = buildConfigFromAnswers(answers);
    const workspaceResult = ensureWorkspace(
      { cwd, dryRun: isDryRun, json: false },
      config,
    );
    artifacts.push(...workspaceResult.created);

    // 2. 生成 AGENTS.md 和 CLAUDE.md
    const agentsPath = join(cwd, 'AGENTS.md');
    if (!existsSync(agentsPath)) {
      const agentsContent = `# AGENTS.md\n\nProject: ${config.project.name}\nType: ${config.project.type}\n`;
      writeFileSync(agentsPath, agentsContent, 'utf-8');
      artifacts.push('AGENTS.md');
    }

    if (config.aiTools.claude) {
      const claudePath = join(cwd, 'CLAUDE.md');
      if (!existsSync(claudePath)) {
        const claudeContent = `# CLAUDE.md\n\nProject: ${config.project.name}\n`;
        writeFileSync(claudePath, claudeContent, 'utf-8');
        artifacts.push('CLAUDE.md');
      }
    }

    // 3. 生成 Skill 投影
    const adapterEntries = createAdapterRegistry();
    const selectedTools = answers.aiTools as AdapterTool[];
    const filteredEntries = filterByTool(adapterEntries, selectedTools);

    ensureAdapterSources(cwd, filteredEntries);

    const tx = beginTransaction(cwd, isDryRun);
    const projectionStatuses = applyProjectionWrites(cwd, filteredEntries, tx);
    commitTransaction(tx);

    for (const status of projectionStatuses) {
      if (status.status === 'synced') {
        artifacts.push(status.projectionPath);
      }
    }
  } catch (error) {
    warnings.push(`Post-wizard integration failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { artifacts, warnings };
}

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
    // 0. Help detection — check original argv before commander consumes the flags
    const isHelp = argv.includes('--help') || argv.includes('-h');
    const wantsJson = argv.includes('--json');

    // Help mode: handle before parseGlobalOptions to avoid commander exitOverride
    if (isHelp) {
      const registry = createCommandRegistry();
      registerAllHandlers(registry);
      if (wantsJson) {
        const commands = registry.list().map(h => ({
          name: h.name,
          description: h.description,
          requiresInitializedWorkspace: h.requiresInitializedWorkspace,
        }));
        writeCliResponse({ code: 0, msg: 'success', data: { commands }, warnings: [] },
          { json: true, noColor: false, io });
        return 0;
      }
      const cmds = registry.list();
      const lines: string[] = [];
      lines.push('Usage: harness <command> [options]');
      lines.push('');
      lines.push('Commands:');
      for (const c of cmds) {
        const initNote = c.requiresInitializedWorkspace ? ' (requires init)' : '';
        lines.push(`  ${c.name.padEnd(15)} ${c.description}${initNote}`);
      }
      lines.push('');
      lines.push('Global Options:');
      lines.push('  --cwd <path>     Project root directory');
      lines.push('  --dry-run        Preview mode - no actual file writes');
      lines.push('  --json           Output as pure JSON');
      lines.push('  --no-color       Disable ANSI color codes');
      lines.push('  --help, -h       Show this help message');
      io.stdout.write(lines.join('\n') + '\n');
      return 0;
    }

    // 1. Parse global options and command
    const { parsedCommand, globalOptions } = parseGlobalOptions(argv);

    // 2. Create command registry and register real handlers
    const registry = createCommandRegistry();
    registerAllHandlers(registry);

    // 3. Route: interactive or command
    let response: CliResponse;

    const commandArgs = parsedCommand.commandArgs ?? [];

    if (!parsedCommand.command) {
      // No command - enter interactive mode
      const context: CommandContext = {
        globalOptions,
        command: '',
        io,
        registry,
        args: commandArgs,
      };
      response = await runInteractiveEntrypoint(context);

      // 向导完成后执行集成逻辑
      if (response.code === 0 && response.data?.mode === 'wizard' && response.data?.wizardAnswers) {
        const answers = response.data.wizardAnswers as WizardAnswers;
        const isDryRun = response.data.dryRun === true;
        const { artifacts, warnings } = executePostWizardIntegration(
          globalOptions.cwd,
          answers,
          isDryRun,
        );
        response.artifacts = artifacts.map(path => ({
          type: 'file',
          path,
          description: 'Generated by init wizard',
        }));
        response.warnings.push(...warnings);
      }
    } else {
      // Command provided - resolve and execute
      const handler = registry.resolve(parsedCommand.command);

      if (!handler) {
        throw new HarnessCliError(1001, `Unknown command: ${parsedCommand.command}. Run harness --help for available commands.`);
      }

      // Check workspace initialization if required
      if (handler.requiresInitializedWorkspace) {
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
        args: commandArgs,
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
