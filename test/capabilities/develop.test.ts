/**
 * Develop capability tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import { runDevelopCommand, parseDevelopArgs, detectStage, resolveStorage } from '../../src/capabilities/develop/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-develop-test-'));
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

function createTestContext(cwd: string, command = 'develop', args: string[] = []): CommandContext {
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
// TASK-DV-01: parseDevelopArgs 参数解析测试
// ============================================================
describe('parseDevelopArgs', () => {
  it('should extract change name from args[0]', () => {
    const result = parseDevelopArgs(['my-feature']);
    expect(result.change).toBe('my-feature');
  });

  it('should validate kebab-case change name', () => {
    expect(() => parseDevelopArgs(['INVALID_NAME'])).toThrow();
  });

  it('should reject empty change name', () => {
    expect(() => parseDevelopArgs([])).toThrow();
  });

  it('should parse --spec stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--spec']);
    expect(result.options.stage).toBe('spec');
  });

  it('should parse --design stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--design']);
    expect(result.options.stage).toBe('design');
  });

  it('should parse --tasks stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--tasks']);
    expect(result.options.stage).toBe('tasks');
  });

  it('should parse --check stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--check']);
    expect(result.options.stage).toBe('check');
  });

  it('should parse --apply stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--apply']);
    expect(result.options.stage).toBe('apply');
  });

  it('should parse --archive stage flag', () => {
    const result = parseDevelopArgs(['my-feature', '--archive']);
    expect(result.options.stage).toBe('archive');
  });

  it('should reject multiple stage flags', () => {
    expect(() => parseDevelopArgs(['my-feature', '--spec', '--design'])).toThrow();
  });

  it('should parse --from path', () => {
    const result = parseDevelopArgs(['my-feature', '--from', 'requirements/demo.md']);
    expect(result.options.from).toBe('requirements/demo.md');
  });

  it('should parse --capability name', () => {
    const result = parseDevelopArgs(['my-feature', '--capability', 'harness-review']);
    expect(result.options.capability).toBe('harness-review');
  });

  it('should parse --parallel flag', () => {
    const result = parseDevelopArgs(['my-feature', '--parallel']);
    expect(result.options.parallel).toBe(true);
  });

  it('should parse --no-parallel flag', () => {
    const result = parseDevelopArgs(['my-feature', '--no-parallel']);
    expect(result.options.parallel).toBe(false);
  });

  it('should reject --parallel and --no-parallel together', () => {
    expect(() => parseDevelopArgs(['my-feature', '--parallel', '--no-parallel'])).toThrow();
  });
});

// ============================================================
// TASK-DV-02: 阶段检测和存储解析测试
// ============================================================
describe('detectStage', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return propose when no proposal.md exists', () => {
    const storage = resolveStorage(tempDir, 'new-change');
    const stage = detectStage(storage);
    expect(stage).toBe('propose');
  });

  it('should return spec when proposal exists but no specs dir', () => {
    const changeDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');
    
    const storage = resolveStorage(tempDir, 'my-change');
    const stage = detectStage(storage);
    expect(stage).toBe('spec');
  });

  it('should return design when specs exist but no design.md', () => {
    const changeDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    const specsDir = join(changeDir, 'specs', 'harness-review');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');
    writeFileSync(join(specsDir, 'spec.md'), '# Spec');
    
    const storage = resolveStorage(tempDir, 'my-change');
    const stage = detectStage(storage);
    expect(stage).toBe('design');
  });

  it('should return tasks when design exists but no tasks.md', () => {
    const changeDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    const specsDir = join(changeDir, 'specs', 'harness-review');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');
    writeFileSync(join(specsDir, 'spec.md'), '# Spec');
    writeFileSync(join(specsDir, 'design.md'), '# Design');
    
    const storage = resolveStorage(tempDir, 'my-change');
    const stage = detectStage(storage);
    expect(stage).toBe('tasks');
  });

  it('should return check when all docs exist', () => {
    const changeDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    const specsDir = join(changeDir, 'specs', 'harness-review');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(changeDir, 'proposal.md'), '# Proposal');
    writeFileSync(join(specsDir, 'spec.md'), '# Spec');
    writeFileSync(join(specsDir, 'design.md'), '# Design');
    writeFileSync(join(specsDir, 'tasks.md'), '# Tasks');
    
    const storage = resolveStorage(tempDir, 'my-change');
    const stage = detectStage(storage);
    expect(stage).toBe('check');
  });
});

describe('resolveStorage', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return canonical storage when .harness/develop/changes exists', () => {
    const changeDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    mkdirSync(changeDir, { recursive: true });
    
    const storage = resolveStorage(tempDir, 'my-change');
    expect(storage.status).toBe('canonical');
  });

  it('should return legacy storage when openspec/changes exists', () => {
    const changeDir = join(tempDir, 'openspec', 'changes', 'my-change');
    mkdirSync(changeDir, { recursive: true });
    
    const storage = resolveStorage(tempDir, 'my-change');
    expect(storage.status).toBe('legacy');
  });

  it('should return missing when neither exists', () => {
    const storage = resolveStorage(tempDir, 'new-change');
    expect(storage.status).toBe('missing');
  });

  it('should return mixed when both exist', () => {
    const canonicalDir = join(tempDir, '.harness', 'develop', 'changes', 'my-change');
    const legacyDir = join(tempDir, 'openspec', 'changes', 'my-change');
    mkdirSync(canonicalDir, { recursive: true });
    mkdirSync(legacyDir, { recursive: true });
    
    const storage = resolveStorage(tempDir, 'my-change');
    expect(storage.status).toBe('mixed');
  });
});

// ============================================================
// TASK-DV-03: DAG 并行执行测试
// ============================================================
describe('runDevelopCommand DAG execution', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create proposal in propose stage', async () => {
    const ctx = createTestContext(tempDir, 'develop', ['my-feature', '--propose']);
    const result = await runDevelopCommand(ctx);
    
    expect(result.code).toBe(0);
    expect((result.data as any).stage).toBe('propose');
    expect(existsSync(join(tempDir, '.harness', 'develop', 'changes', 'my-feature', 'proposal.md'))).toBe(true);
  });

  it('should respect --dry-run in propose stage', async () => {
    const ctx = createTestContext(tempDir, 'develop', ['my-feature', '--propose']);
    ctx.globalOptions.dryRun = true;
    const result = await runDevelopCommand(ctx);
    
    expect(result.code).toBe(0);
    expect(existsSync(join(tempDir, '.harness', 'develop', 'changes', 'my-feature', 'proposal.md'))).toBe(false);
  });

  it('should auto-detect stage when no stage flag provided', async () => {
    const ctx = createTestContext(tempDir, 'develop', ['my-feature']);
    const result = await runDevelopCommand(ctx);
    
    expect(result.code).toBe(0);
    expect((result.data as any).stage).toBe('propose');
  });

  it('should return 2501 for invalid change name', async () => {
    const ctx = createTestContext(tempDir, 'develop', ['INVALID_NAME']);
    const result = await runDevelopCommand(ctx);
    
    expect(result.code).toBe(2501);
  });

  it('should return 2501 for empty change name', async () => {
    const ctx = createTestContext(tempDir, 'develop', []);
    const result = await runDevelopCommand(ctx);
    
    expect(result.code).toBe(2501);
  });
});
