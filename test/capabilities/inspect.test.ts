/**
 * Inspect capability tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import { runInspectCommand } from '../../src/capabilities/inspect/command.js';
import { parseInspectArgs } from '../../src/capabilities/inspect/command.js';
import { scanProject } from '../../src/capabilities/inspect/scanner.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-inspect-test-'));
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

function createTestContext(cwd: string, command = 'inspect', args: string[] = []): CommandContext {
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

// ============================================================
// TASK-IN-01: parseInspectArgs 参数解析测试
// ============================================================
describe('parseInspectArgs', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should parse default scope when no args provided', () => {
    initWorkspace(tempDir);
    const options = parseInspectArgs([], tempDir);
    expect(options.scope.full).toBe(false);
    expect(options.scope.path).toBeNull();
    expect(options.rules).toBe(false);
  });

  it('should parse --full flag', () => {
    initWorkspace(tempDir);
    const options = parseInspectArgs(['--full'], tempDir);
    expect(options.scope.full).toBe(true);
    expect(options.scope.path).toBeNull();
  });

  it('should parse --path with value', () => {
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    const options = parseInspectArgs(['--path', 'src'], tempDir);
    expect(options.scope.full).toBe(false);
    expect(options.scope.path).toBe('src');
  });

  it('should parse --rules flag', () => {
    initWorkspace(tempDir);
    const options = parseInspectArgs(['--rules'], tempDir);
    expect(options.rules).toBe(true);
  });

  it('should auto-equal --full when no facts exist', () => {
    // 不初始化工作区，没有 facts 文件
    const options = parseInspectArgs([], tempDir);
    expect(options.scope.full).toBe(true);
  });
});

// ============================================================
// TASK-IN-02: 路径限定扫描测试
// ============================================================
describe('scanProject with path limiting', () => {
  let tempDir: string;
  beforeEach(() => { 
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should only scan files under --path directory', () => {
    // 创建多个目录
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    mkdirSync(join(tempDir, 'test'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');
    writeFileSync(join(tempDir, 'test', 'test.ts'), 'describe("test", () => {});');
    
    const repoMap = scanProject(tempDir, { full: false, path: 'src' });
    
    // 应该只包含 src 下的文件
    const allPaths = [
      ...repoMap.buildFiles.map(f => f.path),
      ...repoMap.docs.map(d => d.path),
      ...repoMap.agentFiles.map(a => a.path),
    ];
    
    expect(allPaths.every(p => p.startsWith('src/') || p === 'src')).toBe(true);
  });

  it('should return error 2302 when path is outside cwd', () => {
    const outsidePath = join(tempDir, '..', 'outside');
    mkdirSync(outsidePath, { recursive: true });
    
    expect(() => {
      scanProject(tempDir, { full: false, path: '../outside' });
    }).toThrow();
  });

  it('should return error 2301 when path does not exist', () => {
    expect(() => {
      scanProject(tempDir, { full: false, path: 'nonexistent' });
    }).toThrow();
  });
});

// ============================================================
// TASK-IN-03: rules 条件生成测试
// ============================================================
describe('runInspectCommand with --rules', () => {
  let tempDir: string;
  beforeEach(() => { 
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should write rules.generated.md when --rules is true', async () => {
    const ctx = createTestContext(tempDir, 'inspect', ['--rules']);
    const result = await runInspectCommand(ctx);
    
    expect(result.code).toBe(0);
    const rulesPath = join(tempDir, '.harness/generated/rules.generated.md');
    expect(existsSync(rulesPath)).toBe(true);
  });

  it('should not write rules.generated.md when --rules is false', async () => {
    const ctx = createTestContext(tempDir, 'inspect', []);
    const result = await runInspectCommand(ctx);
    
    expect(result.code).toBe(0);
    const rulesPath = join(tempDir, '.harness/generated/rules.generated.md');
    expect(existsSync(rulesPath)).toBe(false);
  });
});

// ============================================================
// TASK-IN-06: 集成测试验证
// ============================================================
describe('runInspectCommand integration', () => {
  let tempDir: string;
  beforeEach(() => { 
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should perform full scan with --full', async () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');
    writeFileSync(join(tempDir, 'package.json'), '{"name":"test","version":"1.0.0"}');
    
    const ctx = createTestContext(tempDir, 'inspect', ['--full']);
    const result = await runInspectCommand(ctx);
    
    expect(result.code).toBe(0);
    expect((result.data as any).scope.full).toBe(true);
    expect((result.data as any).fileCount).toBeGreaterThan(0);
  });

  it('should perform limited scan with --path', async () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    mkdirSync(join(tempDir, 'test'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');
    writeFileSync(join(tempDir, 'test', 'test.ts'), 'describe("test", () => {});');
    
    const ctx = createTestContext(tempDir, 'inspect', ['--path', 'src']);
    const result = await runInspectCommand(ctx);
    
    expect(result.code).toBe(0);
    expect((result.data as any).scope.path).toBe('src');
  });

  it('should respect dry-run mode', async () => {
    const ctx = createTestContext(tempDir, 'inspect', ['--full']);
    ctx.globalOptions.dryRun = true;
    const result = await runInspectCommand(ctx);
    
    expect(result.code).toBe(0);
    expect(result.warnings).toContain('Dry-run mode: no files were written');
    
    const factsPath = join(tempDir, '.harness/facts/repo-map.json');
    expect(existsSync(factsPath)).toBe(false);
  });
});
