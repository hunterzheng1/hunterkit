/**
 * Unit tests for interactive entrypoint - init wizard and operation menu
 * TDD: test skeleton first (red state), then implementation makes them green
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Writable, Readable } from 'node:stream';
import type { CliIo, CommandContext, CommandRegistry, GlobalOptions } from '../../src/cli/types.js';

// Mock @inquirer/prompts
const mockSelect = vi.fn();
const mockCheckbox = vi.fn();

vi.mock('@inquirer/prompts', () => ({
  select: mockSelect,
  checkbox: mockCheckbox,
}));

/** Create a mock CliIo */
function createMockIo(): CliIo & { getStdout(): string; getStderr(): string } {
  let stdoutBuf = '';
  let stderrBuf = '';
  const stdout = new Writable({
    write(chunk, _encoding, callback) { stdoutBuf += chunk.toString(); callback(); },
  });
  const stderr = new Writable({
    write(chunk, _encoding, callback) { stderrBuf += chunk.toString(); callback(); },
  });
  const stdin = new Readable({ read() { this.push(null); } });
  return { stdout, stderr, stdin, getStdout: () => stdoutBuf, getStderr: () => stderrBuf };
}

/** Default wizard answers for 6 steps */
const DEFAULT_WIZARD_ANSWERS = {
  projectPath: process.cwd(),
  aiTools: ['claude', 'codex'],
  capabilities: ['inspect', 'sync', 'develop', 'review', 'knowledge'],
  projectType: 'node',
  writeStrategy: 'write',
  hookStrength: 'full',
};

// ============================================================
// runInitWizard tests (TASK-CE-01)
// ============================================================
describe('runInitWizard', () => {
  let runInitWizard: (context: CommandContext) => Promise<any>;
  let createMockContext: (overrides?: Partial<GlobalOptions>) => CommandContext;

  beforeEach(async () => {
    vi.resetModules();
    mockSelect.mockReset();
    mockCheckbox.mockReset();

    const interactiveMod = await import('../../src/cli/interactive.js');
    runInitWizard = interactiveMod.runInitWizard;

    const registryMod = await import('../../src/cli/command-registry.js');
    const createRegistry = registryMod.createCommandRegistry;

    createMockContext = (overrides?: Partial<GlobalOptions>): CommandContext => {
      const registry: CommandRegistry = createRegistry();
      return {
        globalOptions: {
          cwd: process.cwd(),
          dryRun: false,
          json: false,
          noColor: false,
          ...overrides,
        },
        command: '',
        io: createMockIo(),
        registry,
      };
    };
  });

  it('should complete 6-step wizard and return wizardAnswers', async () => {
    // Step 1: project path (select)
    mockSelect.mockResolvedValueOnce(process.cwd());
    // Step 2: AI tools (checkbox)
    mockCheckbox.mockResolvedValueOnce(['claude', 'codex']);
    // Step 3: capabilities (checkbox)
    mockCheckbox.mockResolvedValueOnce(['inspect', 'sync', 'develop', 'review', 'knowledge']);
    // Step 4: project type (select)
    mockSelect.mockResolvedValueOnce('node');
    // Step 5: write strategy (select)
    mockSelect.mockResolvedValueOnce('write');
    // Step 6: hook strength (select)
    mockSelect.mockResolvedValueOnce('full');

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.code).toBe(0);
    expect(response.data).toBeDefined();
    expect(response.data.wizardAnswers).toBeDefined();
    expect(response.data.wizardAnswers.projectPath).toBe(process.cwd());
    expect(response.data.wizardAnswers.aiTools).toEqual(['claude', 'codex']);
    expect(response.data.wizardAnswers.capabilities).toEqual(['inspect', 'sync', 'develop', 'review', 'knowledge']);
    expect(response.data.wizardAnswers.projectType).toBe('node');
    expect(response.data.wizardAnswers.writeStrategy).toBe('write');
    expect(response.data.wizardAnswers.hookStrength).toBe('full');
  });

  it('should handle step 2 with only Claude selected', async () => {
    mockSelect.mockResolvedValueOnce(process.cwd());
    mockCheckbox.mockResolvedValueOnce(['claude']);
    mockCheckbox.mockResolvedValueOnce(['inspect']);
    mockSelect.mockResolvedValueOnce('node');
    mockSelect.mockResolvedValueOnce('write');
    mockSelect.mockResolvedValueOnce('full');

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.data.wizardAnswers.aiTools).toEqual(['claude']);
  });

  it('should handle step 2 with "skip" (no AI tools)', async () => {
    mockSelect.mockResolvedValueOnce(process.cwd());
    mockCheckbox.mockResolvedValueOnce([]);
    mockCheckbox.mockResolvedValueOnce(['inspect']);
    mockSelect.mockResolvedValueOnce('node');
    mockSelect.mockResolvedValueOnce('write');
    mockSelect.mockResolvedValueOnce('none');

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.data.wizardAnswers.aiTools).toEqual([]);
  });

  it('should handle step 3 with "all" capabilities', async () => {
    mockSelect.mockResolvedValueOnce(process.cwd());
    mockCheckbox.mockResolvedValueOnce(['claude']);
    mockCheckbox.mockResolvedValueOnce(['inspect', 'sync', 'develop', 'review', 'knowledge']);
    mockSelect.mockResolvedValueOnce('node');
    mockSelect.mockResolvedValueOnce('write');
    mockSelect.mockResolvedValueOnce('full');

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.data.wizardAnswers.capabilities).toContain('inspect');
    expect(response.data.wizardAnswers.capabilities).toContain('knowledge');
  });

  it('should handle step 5 "preview" as dry-run', async () => {
    mockSelect.mockResolvedValueOnce(process.cwd());
    mockCheckbox.mockResolvedValueOnce(['claude']);
    mockCheckbox.mockResolvedValueOnce(['inspect']);
    mockSelect.mockResolvedValueOnce('node');
    mockSelect.mockResolvedValueOnce('preview');
    mockSelect.mockResolvedValueOnce('none');

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.data.wizardAnswers.writeStrategy).toBe('preview');
    expect(response.data.dryRun).toBe(true);
  });

  it('should return error code 1003 on Ctrl+C interruption', async () => {
    const interruptError = new Error('User cancelled');
    (interruptError as any).name = 'ExitPromptError';
    mockSelect.mockRejectedValueOnce(interruptError);

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.code).toBe(1003);
  });

  it('should return error code 1003 on generic cancellation', async () => {
    mockSelect.mockRejectedValueOnce(new Error('User cancelled'));

    const context = createMockContext();
    const response = await runInitWizard(context);

    expect(response.code).toBe(1003);
  });

  it('should call select 4 times and checkbox 2 times', async () => {
    mockSelect.mockResolvedValueOnce(process.cwd());
    mockCheckbox.mockResolvedValueOnce(['claude']);
    mockCheckbox.mockResolvedValueOnce(['inspect']);
    mockSelect.mockResolvedValueOnce('node');
    mockSelect.mockResolvedValueOnce('write');
    mockSelect.mockResolvedValueOnce('full');

    const context = createMockContext();
    await runInitWizard(context);

    expect(mockSelect).toHaveBeenCalledTimes(4);
    expect(mockCheckbox).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// runOperationMenu tests (TASK-CE-02)
// ============================================================
describe('runOperationMenu', () => {
  let runOperationMenu: (context: CommandContext) => Promise<any>;

  beforeEach(async () => {
    vi.resetModules();
    mockSelect.mockReset();
    mockCheckbox.mockReset();

    const interactiveMod = await import('../../src/cli/interactive.js');
    runOperationMenu = interactiveMod.runOperationMenu;
  });

  it('should display menu with all registered commands', async () => {
    const registryMod = await import('../../src/cli/command-registry.js');
    const registry = registryMod.createCommandRegistry();
    const context: CommandContext = {
      globalOptions: { cwd: process.cwd(), dryRun: false, json: false, noColor: false },
      command: '',
      io: createMockIo(),
      registry,
    };

    mockSelect.mockResolvedValueOnce('status');
    await runOperationMenu(context);

    expect(mockSelect).toHaveBeenCalledTimes(1);
    const callArgs = mockSelect.mock.calls[0][0];
    expect(callArgs.choices.length).toBe(8);
  });

  it('should route to selected command handler', async () => {
    const registryMod = await import('../../src/cli/command-registry.js');
    const registry = registryMod.createCommandRegistry();
    const context: CommandContext = {
      globalOptions: { cwd: process.cwd(), dryRun: false, json: false, noColor: false },
      command: '',
      io: createMockIo(),
      registry,
    };

    mockSelect.mockResolvedValueOnce('status');
    const response = await runOperationMenu(context);

    expect(response.code).toBe(0);
    expect(response.data.selectedCommand).toBe('status');
  });

  it('should return code 0 with cancel message when user cancels', async () => {
    const registryMod = await import('../../src/cli/command-registry.js');
    const registry = registryMod.createCommandRegistry();
    const context: CommandContext = {
      globalOptions: { cwd: process.cwd(), dryRun: false, json: false, noColor: false },
      command: '',
      io: createMockIo(),
      registry,
    };

    const cancelError = new Error('User cancelled');
    (cancelError as any).name = 'ExitPromptError';
    mockSelect.mockRejectedValueOnce(cancelError);

    const response = await runOperationMenu(context);
    expect(response.code).toBe(0);
    expect(response.data.selectedCommand).toBeNull();
  });

  it('should return error code 2002 for unknown command selection', async () => {
    const registryMod = await import('../../src/cli/command-registry.js');
    const registry = registryMod.createCommandRegistry();
    const context: CommandContext = {
      globalOptions: { cwd: process.cwd(), dryRun: false, json: false, noColor: false },
      command: '',
      io: createMockIo(),
      registry,
    };

    mockSelect.mockResolvedValueOnce('nonexistent-command');
    const response = await runOperationMenu(context);

    expect(response.code).toBe(2002);
  });
});

// ============================================================
// Command-level argument pass-through tests (TASK-CE-03)
// ============================================================
describe('命令级参数透传', () => {
  let parseGlobalOptions: (argv: string[]) => {
    parsedCommand: { command: string | null; args: string[]; commandArgs: string[] };
    globalOptions: GlobalOptions;
  };

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/cli/global-options.js');
    parseGlobalOptions = mod.parseGlobalOptions;
  });

  it('should pass remaining args as commandArgs after global options', () => {
    const result = parseGlobalOptions(['inspect', '--path', './src', '--full']);
    expect(result.parsedCommand.command).toBe('inspect');
    expect(result.parsedCommand.commandArgs).toContain('--path');
    expect(result.parsedCommand.commandArgs).toContain('./src');
    expect(result.parsedCommand.commandArgs).toContain('--full');
  });

  it('should handle --json at command level (e.g., inspect --json)', () => {
    const result = parseGlobalOptions(['inspect', '--json']);
    expect(result.parsedCommand.command).toBe('inspect');
    expect(result.globalOptions.json).toBe(true);
  });

  it('should handle --json at global level (e.g., --json inspect)', () => {
    const result = parseGlobalOptions(['--json', 'inspect']);
    expect(result.parsedCommand.command).toBe('inspect');
    expect(result.globalOptions.json).toBe(true);
  });

  it('should separate global --cwd from command args', () => {
    const result = parseGlobalOptions(['--cwd', process.cwd(), 'sync', '--check']);
    expect(result.globalOptions.cwd).toBe(process.cwd());
    expect(result.parsedCommand.command).toBe('sync');
    expect(result.parsedCommand.commandArgs).toContain('--check');
    expect(result.parsedCommand.commandArgs).not.toContain('--cwd');
  });
});
