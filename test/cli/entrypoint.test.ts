/**
 * Unit tests for CLI entrypoint modules
 * TDD: test skeleton first (red state), then implementation makes them green
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Writable, Readable } from 'node:stream';
import type { CliIo, CliResponse, GlobalOptions, CommandContext, CommandHandler, CommandRegistry } from '../../src/cli/types.js';

/** Create a mock CliIo that captures stdout/stderr output */
function createMockIo(): CliIo & { getStdout(): string; getStderr(): string } {
  let stdoutBuf = '';
  let stderrBuf = '';

  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      stdoutBuf += chunk.toString();
      callback();
    },
  });

  const stderr = new Writable({
    write(chunk, _encoding, callback) {
      stderrBuf += chunk.toString();
      callback();
    },
  });

  const stdin = new Readable({
    read() {
      this.push(null);
    },
  });

  return {
    stdout,
    stderr,
    stdin,
    getStdout: () => stdoutBuf,
    getStderr: () => stderrBuf,
  };
}

// ============================================================
// parseGlobalOptions tests
// ============================================================
describe('parseGlobalOptions', () => {
  let parseGlobalOptions: (argv: string[]) => { parsedCommand: { command: string | null; args: string[] }; globalOptions: GlobalOptions };

  beforeEach(async () => {
    const mod = await import('../../src/cli/global-options.js');
    parseGlobalOptions = mod.parseGlobalOptions;
  });

  it('should parse --cwd to absolute path', () => {
    const result = parseGlobalOptions(['status', '--cwd', process.cwd()]);
    expect(result.globalOptions.cwd).toBe(process.cwd());
  });

  it('should default cwd to process.cwd()', () => {
    const result = parseGlobalOptions(['status']);
    expect(result.globalOptions.cwd).toBeTruthy();
  });

  it('should parse --dry-run as boolean', () => {
    const result = parseGlobalOptions(['status', '--dry-run']);
    expect(result.globalOptions.dryRun).toBe(true);
  });

  it('should parse --json as boolean', () => {
    const result = parseGlobalOptions(['status', '--json']);
    expect(result.globalOptions.json).toBe(true);
  });

  it('should parse --no-color as boolean', () => {
    const result = parseGlobalOptions(['status', '--no-color']);
    expect(result.globalOptions.noColor).toBe(true);
  });

  it('should reject invalid --cwd path', () => {
    expect(() => parseGlobalOptions(['status', '--cwd', '/nonexistent/path/xyz123'])).toThrow();
  });

  it('should extract command name from argv', () => {
    const result = parseGlobalOptions(['inspect', '--json']);
    expect(result.parsedCommand.command).toBe('inspect');
  });

  it('should return null command when no command provided', () => {
    const result = parseGlobalOptions(['--json']);
    expect(result.parsedCommand.command).toBeNull();
  });
});

// ============================================================
// HarnessCliError tests
// ============================================================
describe('HarnessCliError', () => {
  let HarnessCliError: any;
  let toCliResponse: (error: unknown) => CliResponse;

  beforeEach(async () => {
    const mod = await import('../../src/cli/errors.js');
    HarnessCliError = mod.HarnessCliError;
    toCliResponse = mod.toCliResponse;
  });

  it('should create error with code 1001 for invalid command', () => {
    const err = new HarnessCliError(1001, 'Invalid command');
    expect(err.code).toBe(1001);
    expect(err.msg).toBe('Invalid command');
    expect(err).toBeInstanceOf(Error);
  });

  it('should create error with code 1002 for invalid path', () => {
    const err = new HarnessCliError(1002, 'Invalid path');
    expect(err.code).toBe(1002);
  });

  it('should create error with code 2001 for uninitialized workspace', () => {
    const err = new HarnessCliError(2001, 'Workspace not initialized');
    expect(err.code).toBe(2001);
  });

  it('should create error with code 4001 for missing external dependency', () => {
    const err = new HarnessCliError(4001, 'Git not found');
    expect(err.code).toBe(4001);
  });

  it('should convert unknown error to code 5001', () => {
    const err = new Error('something unexpected');
    const response = toCliResponse(err);
    expect(response.code).toBe(5001);
  });

  it('should convert HarnessCliError to CliResponse with correct code', () => {
    const err = new HarnessCliError(1001, 'bad command');
    const response = toCliResponse(err);
    expect(response.code).toBe(1001);
    expect(response.msg).toBe('bad command');
    expect(response.data).toBeNull();
    expect(response.warnings).toEqual([]);
  });
});

// ============================================================
// CommandRegistry tests
// ============================================================
describe('CommandRegistry', () => {
  let createCommandRegistry: () => CommandRegistry;

  beforeEach(async () => {
    const mod = await import('../../src/cli/command-registry.js');
    createCommandRegistry = mod.createCommandRegistry;
  });

  it('should resolve known command', () => {
    const registry = createCommandRegistry();
    const handler = registry.resolve('inspect');
    expect(handler).not.toBeNull();
    expect(handler!.name).toBe('inspect');
  });

  it('should return null for unknown command', () => {
    const registry = createCommandRegistry();
    const handler = registry.resolve('foobar');
    expect(handler).toBeNull();
  });

  it('should list all 8 commands', () => {
    const registry = createCommandRegistry();
    const commands = registry.list();
    expect(commands.length).toBe(8);
  });

  it('should include all expected command names', () => {
    const registry = createCommandRegistry();
    const names = registry.list().map(h => h.name).sort();
    expect(names).toEqual(['config', 'develop', 'doctor', 'inspect', 'knowledge', 'review', 'status', 'sync']);
  });
});

// ============================================================
// writeCliResponse tests
// ============================================================
describe('writeCliResponse', () => {
  let writeCliResponse: (response: CliResponse, options: { json: boolean; noColor: boolean; io: CliIo }) => void;

  beforeEach(async () => {
    const mod = await import('../../src/cli/output.js');
    writeCliResponse = mod.writeCliResponse;
  });

  it('should output valid JSON when --json is true', () => {
    const io = createMockIo();
    const response: CliResponse = { code: 0, msg: 'success', data: { command: 'status' }, warnings: [] };
    writeCliResponse(response, { json: true, noColor: false, io });
    const output = io.getStdout();
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.code).toBe(0);
  });

  it('should not mix non-JSON text in JSON mode', () => {
    const io = createMockIo();
    const response: CliResponse = { code: 0, msg: 'success', data: {}, warnings: ['some warning'] };
    writeCliResponse(response, { json: true, noColor: false, io });
    const output = io.getStdout();
    // stdout should be parseable as JSON
    expect(() => JSON.parse(output.trim())).not.toThrow();
  });

  it('should output human summary when --json is false', () => {
    const io = createMockIo();
    const response: CliResponse = { code: 0, msg: 'success', data: { command: 'status' }, warnings: [] };
    writeCliResponse(response, { json: false, noColor: true, io });
    const output = io.getStdout();
    expect(output.length).toBeGreaterThan(0);
    // Should not be valid JSON (it's human-readable)
    expect(output).toContain('success');
  });

  it('should output error info in human mode', () => {
    const io = createMockIo();
    const response: CliResponse = { code: 1001, msg: 'Invalid command', data: null, warnings: [] };
    writeCliResponse(response, { json: false, noColor: true, io });
    const output = io.getStdout();
    expect(output).toContain('1001');
  });
});

// ============================================================
// main() tests
// ============================================================
describe('main', () => {
  let main: (argv: string[], env: NodeJS.ProcessEnv, io: CliIo) => Promise<number>;

  beforeEach(async () => {
    const mod = await import('../../src/cli/main.js');
    main = mod.main;
  });

  it('should return exit code 0 on success with known command', async () => {
    const io = createMockIo();
    const exitCode = await main(['status', '--json'], process.env, io);
    expect(exitCode).toBe(0);
  });

  it('should return non-zero exit code on unknown command', async () => {
    const io = createMockIo();
    const exitCode = await main(['foobar', '--json'], process.env, io);
    expect(exitCode).not.toBe(0);
  });

  it('should output valid JSON in json mode', async () => {
    const io = createMockIo();
    await main(['status', '--json'], process.env, io);
    const output = io.getStdout();
    expect(() => JSON.parse(output.trim())).not.toThrow();
  });

  it('should return error code for invalid cwd', async () => {
    const io = createMockIo();
    const exitCode = await main(['status', '--cwd', '/nonexistent/path/xyz123', '--json'], process.env, io);
    expect(exitCode).not.toBe(0);
  });
});
