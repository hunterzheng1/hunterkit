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

  it('should report base.harnessDir error for empty project', async () => {
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    // 未初始化项目：harnessDir 检查应为 ERROR，code 非 0
    expect(result.code).toBe(1);
    const checks = (result.data as any).checks as Array<{ id: string; status: string }>;
    const harnessCheck = checks.find((c: any) => c.id === 'base.harnessDir');
    expect(harnessCheck).toBeTruthy();
    expect(harnessCheck!.status).toBe('ERROR');
  });

  it('should report OK base checks after initialization', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    const checks = (result.data as any).checks as Array<{ id: string; status: string }>;
    const harnessCheck = checks.find((c: any) => c.id === 'base.harnessDir');
    expect(harnessCheck).toBeTruthy();
    expect(harnessCheck!.status).toBe('OK');
  });

  it('should check Node.js version', async () => {
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    const checks = (result.data as any).checks as Array<{ id: string; status: string }>;
    const nodeCheck = checks.find((c: any) => c.id === 'base.nodeVersion');
    expect(nodeCheck).toBeTruthy();
    expect(nodeCheck!.status).toBe('OK');
  });

  it('should detect legacy DocSync content in AGENTS.md', async () => {
    initWorkspace(tempDir);
    // 写入包含旧 docsync 命令的 AGENTS.md
    writeFileSync(join(tempDir, 'AGENTS.md'), '<!-- docsync:start -->\nRun /docsync:sync\n<!-- docsync:end -->');
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    const checks = (result.data as any).checks as Array<{ id: string; status: string }>;
    const docCheck = checks.find((c: any) => c.id === 'managedDocs');
    expect(docCheck).toBeTruthy();
    expect(docCheck!.status).toBe('ERROR');
  });

  it('should check skill source structure', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'doctor');
    const result = await runDoctorCommand(ctx);
    const checks = (result.data as any).checks as Array<{ id: string; status: string }>;
    const skillCheck = checks.find((c: any) => c.id === 'skillSource');
    expect(skillCheck).toBeTruthy();
    // 未生成 shared skill source 时应为 ERROR
    expect(skillCheck!.status).toBe('ERROR');
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

  // TASK-AR-03: 迁移参数解析测试
  it('should parse --migrate-docsync flag', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    // 模拟命令行参数
    (ctx as any).args = ['--migrate-docsync'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).sources).toContain('docsync');
  });

  it('should parse --migrate-sdd flag', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, 'openspec/changes'), { recursive: true });
    writeFileSync(join(tempDir, 'openspec/changes/test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    (ctx as any).args = ['--migrate-sdd'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).sources).toContain('sdd');
  });

  it('should parse --migrate-review flag', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.kld-review'), { recursive: true });
    writeFileSync(join(tempDir, '.kld-review/test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    (ctx as any).args = ['--migrate-review'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).sources).toContain('review');
  });

  it('should parse --migrate-docs flag', async () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, 'docs/adr'), { recursive: true });
    writeFileSync(join(tempDir, 'docs/adr/test.md'), 'content');
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    (ctx as any).args = ['--migrate-docs'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).sources).toContain('docs');
  });

  it('should parse --repair-adapters flag', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'config');
    (ctx as any).args = ['--repair-adapters'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).repaired).toBeDefined();
  });

  it('should respect --dry-run with --repair-adapters', async () => {
    initWorkspace(tempDir);
    const ctx = createTestContext(tempDir, 'config');
    ctx.globalOptions.dryRun = true;
    (ctx as any).args = ['--repair-adapters'];
    const result = await runConfigCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).dryRun).toBe(true);
  });
});
