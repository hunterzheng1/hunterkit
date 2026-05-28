/**
 * Tests for commands module (status, doctor, config)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import { runStatusCommand } from '../../src/commands/status.js';
import { runDoctorCommand } from '../../src/commands/doctor.js';
import { runConfigCommand } from '../../src/commands/config.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-cmd-test-'));
}
function cleanupTempProject(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

function createMockIo(): CliIo {
  const stdout = new Writable({ write(_c, _e, cb) { cb(); } });
  const stderr = new Writable({ write(_c, _e, cb) { cb(); } });
  const stdin = new Readable({ read() { this.push(null); } });
  return { stdout, stderr, stdin };
}

function createTestContext(cwd: string, command = 'status'): CommandContext {
  return {
    globalOptions: { cwd, dryRun: false, json: true, noColor: true },
    command,
    io: createMockIo(),
    registry: createCommandRegistry(),
  };
}

function initWorkspace(cwd: string): void {
  const config = createDefaultConfig('test-project');
  ensureWorkspace({ cwd, dryRun: false, json: false }, config);
}

// ============================================================
// Status command tests
// ============================================================
describe('runStatusCommand', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return uninitialized status for empty project', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runStatusCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).initialized).toBe(false);
    expect((result.data as any).command).toBe('status');
  });

  it('should return initialized status after workspace creation', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir);
    const result = await runStatusCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).initialized).toBe(true);
    expect((result.data as any).schemaVersion).toBe(1);
  });

  it('should include capabilities in status', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir);
    const result = await runStatusCommand(ctx);
    expect((result.data as any).capabilities).toBeTruthy();
    expect(typeof (result.data as any).capabilities).toBe('object');
  });
});

// ============================================================
// Doctor command tests
// ============================================================
describe('runDoctorCommand', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should report NOT_INITIALIZED for empty project', async () => {
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).checks.workspace).toBe('NOT_INITIALIZED');
  });

  it('should report OK workspace after initialization', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).checks.workspace).toBe('OK');
  });

  it('should check Node.js version', async () => {
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    expect((result.data as any).checks.nodeVersion).toBeTruthy();
    expect((result.data as any).checks.nodeVersion).toContain('OK');
  });

  it('should detect legacy sources', async () => {
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    expect((result.data as any).checks.legacySources).toContain('FOUND');
    expect((result.data as any).legacySources.length).toBeGreaterThan(0);
  });

  it('should check directory integrity', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    expect((result.data as any).checks.directoryIntegrity).toBe('OK');
  });
});

// ============================================================
// Config command tests
// ============================================================
describe('runConfigCommand', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should report no legacy sources for empty project', async () => {
    const ctx = createTestContext(tempDir, 'config');
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).message).toBe('No legacy sources detected');
  });

  it('should build migration plan in dry-run when legacy sources exist', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).dryRun).toBe(true);
    expect((result.data as any).sources.length).toBeGreaterThan(0);
  });

  it('should execute migration when not dry-run', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = false;
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).transactionId).toBeTruthy();
  });
});
