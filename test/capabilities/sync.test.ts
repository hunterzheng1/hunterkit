/**
 * Sync capability tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import { runSyncCommand, parseSyncArgs, isHighRiskChange } from '../../src/capabilities/sync/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-sync-test-'));
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

function createTestContext(cwd: string, command = 'sync', args: string[] = []): CommandContext {
  return {
    globalOptions: { cwd, dryRun: false, json: true, noColor: true },
    command,
    io: createMockIo(),
    registry: createCommandRegistry(),
    args,
  } as any;
}

function initWorkspace(cwd: string): void {
  const config = createDefaultConfig('test-project');
  ensureWorkspace({ cwd, dryRun: false, json: false }, config);
}

function initFacts(cwd: string): void {
  mkdirSync(join(cwd, '.harness', 'facts'), { recursive: true });
  writeFileSync(join(cwd, '.harness', 'facts', 'repo-map.json'), JSON.stringify({
    schemaVersion: 1,
    root: cwd,
    generatedAt: new Date().toISOString(),
    languages: ['TypeScript'],
    packageManagers: ['npm'],
    buildFiles: [],
    docs: [],
    agentFiles: [],
    ci: [],
    modules: [],
    reviewRequired: ['project.description'],
  }));
}

// ============================================================
// TASK-SY-01: parseSyncArgs 参数解析测试
// ============================================================
describe('parseSyncArgs', () => {
  it('should parse default options when no args provided', () => {
    const options = parseSyncArgs([]);
    expect(options.check).toBe(false);
    expect(options.fast).toBe(false);
    expect(options.docs).toBeNull();
  });

  it('should parse --check flag', () => {
    const options = parseSyncArgs(['--check']);
    expect(options.check).toBe(true);
  });

  it('should parse --fast flag', () => {
    const options = parseSyncArgs(['--fast']);
    expect(options.fast).toBe(true);
  });

  it('should parse --docs with comma-separated values', () => {
    const options = parseSyncArgs(['--docs', 'readme,agents']);
    expect(options.docs).toEqual(['readme', 'agents']);
  });

  it('should throw error 2402 for unknown document type', () => {
    expect(() => parseSyncArgs(['--docs', 'unknown'])).toThrow();
  });
});

// ============================================================
// TASK-SY-02: 漂移检测和 REVIEW_REQUIRED 测试
// ============================================================
describe('runSyncCommand drift detection', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    initFacts(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should detect drift with --check and return code 2401', async () => {
    // 先同步一次创建文档
    const ctx1 = createTestContext(tempDir, 'sync', []);
    await runSyncCommand(ctx1);

    // 修改文档使其漂移
    const agentsPath = join(tempDir, 'AGENTS.md');
    if (existsSync(agentsPath)) {
      writeFileSync(agentsPath, '# Modified by user\n\nSome user content that differs');
    }

    const ctx = createTestContext(tempDir, 'sync', ['--check']);
    const result = await runSyncCommand(ctx);
    // 漂移时返回 2401
    expect(result.code).toBe(2401);
    expect((result.data as any).drift).toBe(true);
  });

  it('should not write files in --check mode', async () => {
    const ctx = createTestContext(tempDir, 'sync', ['--check']);
    await runSyncCommand(ctx);

    // --check 模式不应创建新文档
    expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(false);
  });

  it('should return 2404 when facts are missing', async () => {
    rmSync(join(tempDir, '.harness', 'facts', 'repo-map.json'));
    const ctx = createTestContext(tempDir, 'sync', []);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(2404);
  });

  it('should include REVIEW_REQUIRED in output', async () => {
    const ctx = createTestContext(tempDir, 'sync', []);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).reviewRequired).toBeDefined();
    expect((result.data as any).reviewRequired.length).toBeGreaterThan(0);
  });

  it('should return 2402 for invalid --docs type', async () => {
    const ctx = createTestContext(tempDir, 'sync', ['--docs', 'invalid']);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(2402);
  });
});

// ============================================================
// TASK-SY-03: --fast 模式和高风险升级测试
// ============================================================
describe('isHighRiskChange', () => {
  it('should detect package.json as high risk', () => {
    expect(isHighRiskChange(['package.json'])).toBe(true);
  });

  it('should detect CI workflow changes as high risk', () => {
    expect(isHighRiskChange(['.github/workflows/ci.yml'])).toBe(true);
  });

  it('should detect AGENTS.md changes as high risk', () => {
    expect(isHighRiskChange(['AGENTS.md'])).toBe(true);
  });

  it('should not flag regular source files as high risk', () => {
    expect(isHighRiskChange(['src/index.ts', 'src/utils.ts'])).toBe(false);
  });

  it('should detect openspec/ changes as high risk', () => {
    expect(isHighRiskChange(['openspec/changes/test.md'])).toBe(true);
  });
});

describe('runSyncCommand --fast mode', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    initFacts(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should perform sync with --fast flag', async () => {
    const ctx = createTestContext(tempDir, 'sync', ['--fast']);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
  });

  it('should include mode in response', async () => {
    const ctx = createTestContext(tempDir, 'sync', ['--fast']);
    const result = await runSyncCommand(ctx);
    expect((result.data as any).mode).toBeDefined();
  });
});

// ============================================================
// TASK-SY-07: 报告写入测试
// ============================================================
describe('runSyncCommand report', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    initFacts(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should write sync report to .harness/reports/sync/', async () => {
    const ctx = createTestContext(tempDir, 'sync', []);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
    expect((result.data as any).reportPath).toContain('.harness/reports/sync/');
    expect(existsSync(join(tempDir, (result.data as any).reportPath))).toBe(true);
  });

  it('should include drift status in report', async () => {
    const ctx = createTestContext(tempDir, 'sync', []);
    const result = await runSyncCommand(ctx);
    const reportPath = join(tempDir, (result.data as any).reportPath);
    const content = readFileSync(reportPath, 'utf-8');
    expect(content).toContain('Sync Report');
  });

  it('should respect --docs filter', async () => {
    const ctx = createTestContext(tempDir, 'sync', ['--docs', 'readme']);
    const result = await runSyncCommand(ctx);
    expect(result.code).toBe(0);
    const docs = (result.data as any).documents;
    expect(docs.every((d: any) => d.kind === 'readme')).toBe(true);
  });
});
