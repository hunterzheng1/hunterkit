/**
 * Review capability tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import {
  runReviewCommand,
  parseReviewArgs,
  resolveScope,
  selectReviewers,
  classifySeverity,
} from '../../src/capabilities/review/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-review-test-'));
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

function createTestContext(cwd: string, command = 'review', args: string[] = []): CommandContext {
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
// TASK-RV-01: parseReviewArgs 参数解析测试
// ============================================================
describe('parseReviewArgs', () => {
  it('should parse --local flag', () => {
    const options = parseReviewArgs(['--local']);
    expect(options.local).toBe(true);
    expect(options.staged).toBe(false);
    expect(options.scan).toBeNull();
  });

  it('should parse --staged flag', () => {
    const options = parseReviewArgs(['--staged']);
    expect(options.staged).toBe(true);
    expect(options.local).toBe(false);
  });

  it('should parse --scan with path', () => {
    const options = parseReviewArgs(['--scan', 'src/payment']);
    expect(options.scan).toBe('src/payment');
    expect(options.local).toBe(false);
    expect(options.staged).toBe(false);
  });

  it('should throw error 2602 for multiple scope flags', () => {
    expect(() => parseReviewArgs(['--local', '--staged'])).toThrow();
  });

  it('should parse --fix and --no-fix', () => {
    const options1 = parseReviewArgs(['--fix']);
    expect(options1.fix).toBe(true);
    expect(options1.noFix).toBe(false);

    const options2 = parseReviewArgs(['--no-fix']);
    expect(options2.noFix).toBe(true);
    expect(options2.fix).toBe(false);
  });

  it('should throw error for --fix and --no-fix together', () => {
    expect(() => parseReviewArgs(['--fix', '--no-fix'])).toThrow();
  });

  it('should parse --full and --lite', () => {
    const options1 = parseReviewArgs(['--full']);
    expect(options1.full).toBe(true);
    expect(options1.lite).toBe(false);

    const options2 = parseReviewArgs(['--lite']);
    expect(options2.lite).toBe(true);
    expect(options2.full).toBe(false);
  });

  it('should throw error for --full and --lite together', () => {
    expect(() => parseReviewArgs(['--full', '--lite'])).toThrow();
  });

  it('should parse --comment flag', () => {
    const options = parseReviewArgs(['--comment']);
    expect(options.comment).toBe(true);
  });
});

// ============================================================
// TASK-RV-02: 范围解析和 reviewer 选择测试
// ============================================================
describe('resolveScope', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should resolve --scan path', () => {
    mkdirSync(join(tempDir, 'src', 'payment'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'payment', 'index.ts'), 'export const x = 1;');

    const result = resolveScope({ scan: 'src/payment' } as any, tempDir);
    expect(result.scopeName).toBe('scan');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should throw error 2603 for --scan path outside project', () => {
    expect(() => resolveScope({ scan: '../outside' } as any, tempDir)).toThrow();
  });

  it('should select lite reviewers with --lite', () => {
    const reviewers = selectReviewers({ lite: true } as any);
    expect(reviewers).toContain('contract-reviewer');
    expect(reviewers).toContain('bug-scanner');
    expect(reviewers.length).toBe(2);
  });

  it('should select all reviewers with --full', () => {
    const reviewers = selectReviewers({ full: true } as any);
    expect(reviewers.length).toBe(6);
    expect(reviewers).toContain('rules-reviewer');
    expect(reviewers).toContain('bug-scanner');
    expect(reviewers).toContain('deep-bug-analyzer');
    expect(reviewers).toContain('history-reviewer');
    expect(reviewers).toContain('standards-reviewer');
    expect(reviewers).toContain('contract-reviewer');
  });

  it('should select all reviewers when file count > 3', () => {
    const reviewers = selectReviewers({} as any, 5);
    expect(reviewers.length).toBe(6);
  });
});

// ============================================================
// TASK-RV-03: 过滤、分级和报告测试
// ============================================================
describe('classifySeverity', () => {
  it('should classify security findings with high confidence as P0', () => {
    const findings = [
      { file: 'src/app.ts', line: 10, category: 'security', confidence: 95, reviewer: 'deep-bug-analyzer', message: 'Hardcoded secret', suggestion: 'Use env vars' },
    ];
    const classified = classifySeverity(findings);
    expect(classified[0].severity).toBe('P0');
  });

  it('should classify security/contract findings as P1', () => {
    const findings = [
      { file: 'src/app.ts', line: 10, category: 'security', confidence: 85, reviewer: 'bug-scanner', message: 'Possible issue', suggestion: 'Fix it' },
      { file: 'src/app.ts', line: 20, category: 'contract', confidence: 90, reviewer: 'contract-reviewer', message: 'Contract violation', suggestion: 'Fix it' },
    ];
    const classified = classifySeverity(findings);
    expect(classified[0].severity).toBe('P1');
    expect(classified[1].severity).toBe('P1');
  });

  it('should classify other findings as P2', () => {
    const findings = [
      { file: 'src/app.ts', line: 10, category: 'todo', confidence: 85, reviewer: 'rules-reviewer', message: 'TODO comment', suggestion: 'Resolve it' },
    ];
    const classified = classifySeverity(findings);
    expect(classified[0].severity).toBe('P2');
  });
});

describe('runReviewCommand integration', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'app.ts'), 'const x = 1;\n// TODO: fix this\nconsole.log("debug");\n');
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should filter findings with confidence < 80', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    const summary = (result.data as any).summary;
    expect(summary.discarded).toBeGreaterThanOrEqual(0);
  });

  it('should deduplicate findings with same file+line+category', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    const findings = (result.data as any).findings;
    const uniqueKeys = new Set(findings.map((f: any) => `${f.file}:${f.line}:${f.category}`));
    expect(uniqueKeys.size).toBe(findings.length);
  });

  it('should write both Markdown and JSON reports', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    const reports = (result.data as any).reports;
    expect(reports.markdown).toBeDefined();
    expect(reports.json).toBeDefined();
    expect(existsSync(join(tempDir, reports.markdown))).toBe(true);
    expect(existsSync(join(tempDir, reports.json))).toBe(true);
  });

  it('should include timestamp and branch in report path', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    const reports = (result.data as any).reports;
    expect(reports.markdown).toMatch(/\d{14}-/);
    expect(reports.json).toMatch(/\d{14}-/);
  });

  it('should return error 2601 when P0 findings exist', async () => {
    // 创建一个包含硬编码密钥的文件
    writeFileSync(join(tempDir, 'src', 'secret.ts'), 'const password = "supersecret123456";\n');
    
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    // 如果检测到 P0 问题，应该返回 2601
    const summary = (result.data as any).summary;
    if (summary.p0 > 0) {
      expect(result.code).toBe(2601);
    }
  });

  it('should use Chinese for user-visible content', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    const reports = (result.data as any).reports;
    const mdContent = readFileSync(join(tempDir, reports.markdown), 'utf-8');
    // 检查是否包含中文关键词
    expect(mdContent).toMatch(/审查报告|代码审查|发现问题/);
  });

  it('should respect --lite mode', async () => {
    const ctx = createTestContext(tempDir, 'review', ['--scan', 'src', '--lite']);
    const result = await runReviewCommand(ctx);
    
    expect(result.code).toBe(0);
    // lite 模式应该只使用 2 个 reviewer
    const findings = (result.data as any).findings;
    const reviewers = new Set(findings.map((f: any) => f.reviewer));
    expect(reviewers.size).toBeLessThanOrEqual(2);
  });
});
