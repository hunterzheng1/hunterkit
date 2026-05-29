/**
 * Knowledge capability tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import {
  runKnowledgeCommand,
  parseKnowledgeArgs,
  scanKnowledgeSources,
} from '../../src/capabilities/knowledge/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-knowledge-test-'));
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

function createTestContext(cwd: string, command = 'knowledge', args: string[] = []): CommandContext {
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
// TASK-KN-01: parseKnowledgeArgs 参数解析测试
// ============================================================
describe('parseKnowledgeArgs', () => {
  it('should parse --index flag', () => {
    const options = parseKnowledgeArgs(['--index']);
    expect(options.index).toBe(true);
    expect(options.search).toBeNull();
  });

  it('should parse --search with query', () => {
    const options = parseKnowledgeArgs(['--search', '文档防腐']);
    expect(options.search).toBe('文档防腐');
    expect(options.index).toBe(false);
  });

  it('should throw error 2701 for empty search query', () => {
    expect(() => parseKnowledgeArgs(['--search', ''])).toThrow();
  });

  it('should throw error 2701 for search query > 200 chars', () => {
    const longQuery = 'a'.repeat(201);
    expect(() => parseKnowledgeArgs(['--search', longQuery])).toThrow();
  });

  it('should parse --limit with valid range', () => {
    const options = parseKnowledgeArgs(['--index', '--limit', '10']);
    expect(options.limit).toBe(10);
  });

  it('should throw error 2701 for --limit out of range', () => {
    expect(() => parseKnowledgeArgs(['--index', '--limit', '0'])).toThrow();
    expect(() => parseKnowledgeArgs(['--index', '--limit', '51'])).toThrow();
  });

  it('should throw error 2701 when neither --index nor --search provided', () => {
    expect(() => parseKnowledgeArgs([])).toThrow();
  });

  it('should allow both --index and --search', () => {
    const options = parseKnowledgeArgs(['--index', '--search', 'test']);
    expect(options.index).toBe(true);
    expect(options.search).toBe('test');
  });
});

// ============================================================
// TASK-KN-02: 索引构建测试
// ============================================================
describe('scanKnowledgeSources', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should scan .harness/develop directory', () => {
    mkdirSync(join(tempDir, '.harness', 'develop', 'changes', 'test-change'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'develop', 'changes', 'test-change', 'proposal.md'), '# Test');

    const files = scanKnowledgeSources(tempDir);
    expect(files.some(f => f.sourcePath.includes('develop'))).toBe(true);
  });

  it('should scan .harness/docs directory', () => {
    mkdirSync(join(tempDir, '.harness', 'docs'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'docs', 'adr.md'), '# ADR');

    const files = scanKnowledgeSources(tempDir);
    expect(files.some(f => f.sourcePath.includes('docs'))).toBe(true);
  });

  it('should scan .harness/rules directory', () => {
    mkdirSync(join(tempDir, '.harness', 'rules'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'rules', 'default.md'), '# Rules');

    const files = scanKnowledgeSources(tempDir);
    expect(files.some(f => f.sourcePath.includes('rules'))).toBe(true);
  });

  it('should scan .harness/reports directory', () => {
    mkdirSync(join(tempDir, '.harness', 'reports', 'review'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'reports', 'review', 'report.md'), '# Report');

    const files = scanKnowledgeSources(tempDir);
    expect(files.some(f => f.sourcePath.includes('reports'))).toBe(true);
  });

  it('should scan legacy openspec/changes directory', () => {
    mkdirSync(join(tempDir, 'openspec', 'changes', 'old-change'), { recursive: true });
    writeFileSync(join(tempDir, 'openspec', 'changes', 'old-change', 'spec.md'), '# Spec');

    const files = scanKnowledgeSources(tempDir);
    expect(files.some(f => f.sourcePath.includes('openspec'))).toBe(true);
  });
});

describe('runKnowledgeCommand --index', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.harness', 'develop', 'changes', 'test'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'develop', 'changes', 'test', 'proposal.md'), '# Test Proposal');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create knowledge.sqlite on first index', async () => {
    const ctx = createTestContext(tempDir, 'knowledge', ['--index']);
    const result = await runKnowledgeCommand(ctx);

    expect(result.code).toBe(0);
    expect(existsSync(join(tempDir, '.harness', 'cache', 'knowledge.sqlite'))).toBe(true);
    expect((result.data as any).indexedFiles).toBeGreaterThan(0);
  });

  it('should perform incremental index on second run', async () => {
    const ctx1 = createTestContext(tempDir, 'knowledge', ['--index']);
    await runKnowledgeCommand(ctx1);

    const ctx2 = createTestContext(tempDir, 'knowledge', ['--index']);
    const result = await runKnowledgeCommand(ctx2);

    expect(result.code).toBe(0);
    // 增量索引应该返回 0（没有变化）
    expect((result.data as any).indexedFiles).toBe(0);
  });

  it('should respect --dry-run and not write knowledge.sqlite', async () => {
    const ctx = createTestContext(tempDir, 'knowledge', ['--index']);
    ctx.globalOptions.dryRun = true;
    const result = await runKnowledgeCommand(ctx);

    expect(result.code).toBe(0);
    expect(existsSync(join(tempDir, '.harness', 'cache', 'knowledge.sqlite'))).toBe(false);
  });
});

// ============================================================
// TASK-KN-03: 搜索功能测试
// ============================================================
describe('runKnowledgeCommand --search', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, '.harness', 'develop', 'changes', 'test'), { recursive: true });
    writeFileSync(join(tempDir, '.harness', 'develop', 'changes', 'test', 'proposal.md'), '# 文档防腐策略\n\n本文档描述文档防腐的实现方案。');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return error 2702 when index does not exist', async () => {
    const ctx = createTestContext(tempDir, 'knowledge', ['--search', 'test']);
    const result = await runKnowledgeCommand(ctx);

    expect(result.code).toBe(2702);
  });

  it('should search and return results with correct structure', async () => {
    // 先建立索引
    const ctx1 = createTestContext(tempDir, 'knowledge', ['--index']);
    await runKnowledgeCommand(ctx1);

    // 然后搜索
    const ctx2 = createTestContext(tempDir, 'knowledge', ['--search', '文档防腐']);
    const result = await runKnowledgeCommand(ctx2);

    expect(result.code).toBe(0);
    const results = (result.data as any).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('sourcePath');
    expect(results[0]).toHaveProperty('title');
    expect(results[0]).toHaveProperty('kind');
    expect(results[0]).toHaveProperty('snippet');
    expect(results[0]).toHaveProperty('score');
  });

  it('should respect --limit parameter', async () => {
    // 创建多个文件
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(tempDir, '.harness', 'develop', 'changes', 'test', `doc${i}.md`), `# 文档 ${i}\n\n测试内容`);
    }

    const ctx1 = createTestContext(tempDir, 'knowledge', ['--index']);
    await runKnowledgeCommand(ctx1);

    const ctx2 = createTestContext(tempDir, 'knowledge', ['--search', '文档', '--limit', '2']);
    const result = await runKnowledgeCommand(ctx2);

    expect(result.code).toBe(0);
    const results = (result.data as any).results;
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should return results sorted by score descending', async () => {
    const ctx1 = createTestContext(tempDir, 'knowledge', ['--index']);
    await runKnowledgeCommand(ctx1);

    const ctx2 = createTestContext(tempDir, 'knowledge', ['--search', '文档']);
    const result = await runKnowledgeCommand(ctx2);

    expect(result.code).toBe(0);
    const results = (result.data as any).results;
    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    }
  });
});
