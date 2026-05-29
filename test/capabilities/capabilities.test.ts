/**
 * Tests for all capability commands
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import { runInspectCommand } from '../../src/capabilities/inspect/command.js';
import { runSyncCommand } from '../../src/capabilities/sync/command.js';
import { runDevelopCommand } from '../../src/capabilities/develop/command.js';
import { runReviewCommand } from '../../src/capabilities/review/command.js';
import { runKnowledgeCommand } from '../../src/capabilities/knowledge/command.js';
import { createSafetyPolicy, checkCommandSafety, checkFileSafety } from '../../src/capabilities/safety/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-cap-test-'));
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

function createTestContext(cwd: string, dryRun = false): CommandContext {
  return {
    globalOptions: { cwd, dryRun, json: true, noColor: true },
    command: 'test',
    io: createMockIo(),
    registry: createCommandRegistry(),
  };
}

function initWorkspace(cwd: string): void {
  const config = createDefaultConfig('test-project');
  ensureWorkspace({ cwd, dryRun: false, json: false }, config);
}

// ============================================================
// Inspect command tests
// ============================================================
describe('runInspectCommand', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    // Create some project files
    writeFileSync(join(tempDir, 'package.json'), '{"name":"test"}');
    writeFileSync(join(tempDir, 'README.md'), '# Test');
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should scan project and generate facts', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runInspectCommand(ctx);
    expect(result.code).toBe(0);
    expect(result.data).toBeTruthy();
    expect((result.data as any).command).toBe('inspect');
  });

  it('should write facts file', async () => {
    const ctx = createTestContext(tempDir);
    await runInspectCommand(ctx);
    expect(existsSync(join(tempDir, '.harness', 'facts', 'repo-map.json'))).toBe(true);
  });

  it('should respect dry-run', async () => {
    const ctx = createTestContext(tempDir, true);
    await runInspectCommand(ctx);
    expect(existsSync(join(tempDir, '.harness', 'facts', 'repo-map.json'))).toBe(false);
  });

  it('should detect languages', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runInspectCommand(ctx);
    expect((result.data as any).languages).toContain('TypeScript');
  });
});

// ============================================================
// Sync command tests
// ============================================================
describe('runSyncCommand', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    // Create facts first
    mkdirSync(join(tempDir, '.harness', 'facts'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'facts', 'repo-map.json'), '{"schemaVersion":1}');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should sync documents', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).command).toBe('sync');
  });

  it('should return error when facts not found', async () => {
    rmSync(join(tempDir, '.harness', 'facts', 'repo-map.json'));
    const ctx = createTestContext(tempDir);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(2404);
  });

  it('should respect dry-run', async () => {
    const ctx = createTestContext(tempDir, true);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).mode).toBe('dry-run');
  });
});

// ============================================================
// Develop command tests
// ============================================================
describe('runDevelopCommand', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create proposal for new change', async () => {
    const ctx = createTestContext(tempDir);
    (ctx as any).args = ['my-new-feature'];
    const result = await runDevelopCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).change).toBe('my-new-feature');
  });

  it('should reject invalid change name', async () => {
    const ctx = createTestContext(tempDir);
    ctx.command = 'develop INVALID_NAME';
    const result = await runDevelopCommand(ctx);
    expect(result.code).toBe(2501);
  });

  it('should reject empty change name', async () => {
    const ctx = createTestContext(tempDir);
    ctx.command = 'develop';
    const result = await runDevelopCommand(ctx);
    expect(result.code).toBe(2501);
  });

  it('should respect dry-run', async () => {
    const ctx = createTestContext(tempDir, true);
    (ctx as any).args = ['my-feature'];
    const result = await runDevelopCommand(ctx);
    expect(result.code).toBe(0);
    expect(existsSync(join(tempDir, '.harness', 'develop', 'changes', 'my-feature', 'proposal.md'))).toBe(false);
  });
});

// ============================================================
// Review command tests
// ============================================================
describe('runReviewCommand', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'app.ts'), 'const x = 1;\n// TODO: fix this\nconsole.log("debug");\n');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should scan files and produce findings', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runReviewCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).command).toBe('review');
    expect((result.data as any).findings.length).toBeGreaterThan(0);
  });

  it('should detect TODO comments', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runReviewCommand(ctx);
    const findings = (result.data as any).findings;
    expect(findings.some((f: any) => f.category === 'todo')).toBe(true);
  });

  it('should detect console.log in non-test code', async () => {
    const ctx = createTestContext(tempDir);
    const result = await runReviewCommand(ctx);
    const findings = (result.data as any).findings;
    expect(findings.some((f: any) => f.category === 'logging')).toBe(true);
  });

  it('should respect dry-run', async () => {
    const ctx = createTestContext(tempDir, true);
    const result = await runReviewCommand(ctx);
    expect(result.code).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Knowledge command tests
// ============================================================
describe('runKnowledgeCommand', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    writeFileSync(join(tempDir, 'README.md'), '# Test');
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should generate knowledge index', async () => {
    const ctx = createTestContext(tempDir);
    (ctx as any).args = ['--index'];
    const result = await runKnowledgeCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).indexedFiles).toBeGreaterThan(0);
  });

  it('should write index file', async () => {
    const ctx = createTestContext(tempDir);
    (ctx as any).args = ['--index'];
    await runKnowledgeCommand(ctx);
    expect(existsSync(join(tempDir, '.harness', 'cache', 'knowledge.sqlite'))).toBe(true);
  });

  it('should respect dry-run', async () => {
    const ctx = createTestContext(tempDir, true);
    (ctx as any).args = ['--index'];
    await runKnowledgeCommand(ctx);
    expect(existsSync(join(tempDir, '.harness', 'cache', 'knowledge.sqlite'))).toBe(false);
  });
});

// ============================================================
// Safety orchestration tests
// ============================================================
describe('Safety orchestration', () => {
  it('should create safety policy from config', () => {
    const config = createDefaultConfig('test');
    const policy = createSafetyPolicy(config);
    expect(policy.dangerousCommandsBlocked).toBe(true);
    expect(policy.secretPatterns.length).toBeGreaterThan(0);
  });

  it('should block dangerous commands', () => {
    const config = createDefaultConfig('test');
    const policy = createSafetyPolicy(config);
    const result = checkCommandSafety('rm -rf /', policy);
    expect(result.passed).toBe(false);
    expect(result.violations[0].type).toBe('dangerous_command');
  });

  it('should allow safe commands', () => {
    const config = createDefaultConfig('test');
    const policy = createSafetyPolicy(config);
    const result = checkCommandSafety('ls -la', policy);
    expect(result.passed).toBe(true);
  });

  it('should detect secrets in file content', () => {
    const config = createDefaultConfig('test');
    const policy = createSafetyPolicy(config);
    const result = checkFileSafety('config.ts', 'const password = "supersecret123456"', policy);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'secret_leak')).toBe(true);
  });

  it('should pass clean file content', () => {
    const config = createDefaultConfig('test');
    const policy = createSafetyPolicy(config);
    const result = checkFileSafety('app.ts', 'const x = 1;', policy);
    expect(result.passed).toBe(true);
  });
});
