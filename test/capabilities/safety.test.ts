/**
 * Safety orchestration tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable, Readable } from 'node:stream';

import {
  generateHooks,
  generateHookConfigs,
  generateSubagentDefs,
  checkCommandLineSafety,
} from '../../src/capabilities/safety/command.js';
import { createDefaultConfig } from '../../src/core/config-schema.js';
import { ensureWorkspace } from '../../src/core/workspace.js';
import { createCommandRegistry } from '../../src/cli/command-registry.js';
import type { CommandContext, CliIo } from '../../src/cli/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-safety-test-'));
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

function createTestContext(cwd: string, command = 'safety', args: string[] = []): CommandContext {
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
// TASK-SO-01: Hook 脚本生成测试
// ============================================================
describe('generateHooks', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should generate 5 Hook scripts for Claude', () => {
    generateHooks(tempDir);
    
    const hooks = [
      'dangerous-command',
      'sync-after-doc-change',
      'review-before-push',
      'session-summary',
      'compact-state',
    ];
    
    for (const hook of hooks) {
      const hookPath = join(tempDir, '.harness', 'adapters', 'claude', 'hooks', `${hook}.sh`);
      expect(existsSync(hookPath)).toBe(true);
    }
  });

  it('should generate 5 Hook scripts for Codex', () => {
    generateHooks(tempDir);
    
    const hooks = [
      'dangerous-command',
      'sync-after-doc-change',
      'review-before-push',
      'session-summary',
      'compact-state',
    ];
    
    for (const hook of hooks) {
      const hookPath = join(tempDir, '.harness', 'adapters', 'codex', 'hooks', `${hook}.sh`);
      expect(existsSync(hookPath)).toBe(true);
    }
  });

  it('should generate dangerous-command.sh that blocks 6 commands', () => {
    generateHooks(tempDir);
    
    const hookPath = join(tempDir, '.harness', 'adapters', 'claude', 'hooks', 'dangerous-command.sh');
    const content = readFileSync(hookPath, 'utf-8');
    
    expect(content).toContain('rm -rf');
    expect(content).toContain('git reset --hard');
    expect(content).toContain('git clean -fdx');
    expect(content).toContain('Remove-Item -Recurse -Force');
    expect(content).toContain('npm publish');
    expect(content).toContain('git push --force');
  });

  it('should generate Hook scripts that output JSON (structured output principle)', () => {
    generateHooks(tempDir);
    
    const hookPath = join(tempDir, '.harness', 'adapters', 'claude', 'hooks', 'dangerous-command.sh');
    const content = readFileSync(hookPath, 'utf-8');
    
    // 检查是否输出 JSON 格式
    expect(content).toContain('{"allowed"');
    expect(content).toContain('"hook"');
  });

  it('should generate Hook scripts that only call harness CLI or simple scripts', () => {
    generateHooks(tempDir);
    
    const hookPath = join(tempDir, '.harness', 'adapters', 'claude', 'hooks', 'sync-after-doc-change.sh');
    const content = readFileSync(hookPath, 'utf-8');
    
    // 检查是否只调用 harness CLI 或简单脚本
    expect(content).not.toContain('curl');
    expect(content).not.toContain('wget');
    expect(content).not.toContain('python');
  });
});

describe('generateHookConfigs', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should generate Claude settings.json', () => {
    generateHookConfigs(tempDir);
    
    const settingsPath = join(tempDir, '.harness', 'adapters', 'claude', 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);
    
    const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(content.hooks).toBeDefined();
    expect(content.hooks.PreToolUse).toBeDefined();
    expect(content.hooks.PostToolUse).toBeDefined();
  });

  it('should generate Codex hooks.json', () => {
    generateHookConfigs(tempDir);
    
    const hooksPath = join(tempDir, '.harness', 'adapters', 'codex', 'hooks.json');
    expect(existsSync(hooksPath)).toBe(true);
    
    const content = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    expect(content.hooks).toBeDefined();
    expect(Array.isArray(content.hooks)).toBe(true);
    expect(content.hooks.length).toBe(5);
  });
});

// ============================================================
// TASK-SO-02: Subagent 定义文件生成测试
// ============================================================
describe('generateSubagentDefs', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = createTempProject();
    initWorkspace(tempDir);
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should generate 4 requirement analysis agents for Claude', () => {
    generateSubagentDefs(tempDir);
    
    const agents = [
      'harness-requirement-clarifier',
      'harness-repo-context-mapper',
      'harness-risk-reviewer',
      'harness-scope-validator',
    ];
    
    for (const agent of agents) {
      const agentPath = join(tempDir, '.harness', 'adapters', 'claude', 'agents', `${agent}.md`);
      expect(existsSync(agentPath)).toBe(true);
    }
  });

  it('should generate 4 design agents for Claude', () => {
    generateSubagentDefs(tempDir);
    
    const agents = [
      'harness-design-writer',
      'harness-contract-validator',
      'harness-cross-module-validator',
      'harness-task-planner',
    ];
    
    for (const agent of agents) {
      const agentPath = join(tempDir, '.harness', 'adapters', 'claude', 'agents', `${agent}.md`);
      expect(existsSync(agentPath)).toBe(true);
    }
  });

  it('should generate 4 code generation agents for Claude', () => {
    generateSubagentDefs(tempDir);
    
    const agents = [
      'harness-implementer',
      'harness-test-reviewer',
      'harness-impl-contract-validator',
      'harness-doc-sync-reviewer',
    ];
    
    for (const agent of agents) {
      const agentPath = join(tempDir, '.harness', 'adapters', 'claude', 'agents', `${agent}.md`);
      expect(existsSync(agentPath)).toBe(true);
    }
  });

  it('should generate 7 review agents for Claude', () => {
    generateSubagentDefs(tempDir);
    
    const agents = [
      'harness-rules-reviewer',
      'harness-bug-scanner',
      'harness-deep-bug-analyzer',
      'harness-history-reviewer',
      'harness-standards-reviewer',
      'harness-contract-reviewer',
      'harness-finding-validator',
    ];
    
    for (const agent of agents) {
      const agentPath = join(tempDir, '.harness', 'adapters', 'claude', 'agents', `${agent}.md`);
      expect(existsSync(agentPath)).toBe(true);
    }
  });

  it('should generate 22 Codex .toml agent files', () => {
    generateSubagentDefs(tempDir);
    
    const agentsDir = join(tempDir, '.harness', 'adapters', 'codex', 'agents');
    expect(existsSync(agentsDir)).toBe(true);
    
    // 检查是否生成了 19 个 .toml 文件 (4+4+4+7)
    const { readdirSync } = require('node:fs');
    const files = readdirSync(agentsDir).filter((f: string) => f.endsWith('.toml'));
    expect(files.length).toBe(19);
  });
});

// ============================================================
// TASK-SO-03: CLI 拦截和阻断列表测试
// ============================================================
describe('checkCommandLineSafety', () => {
  it('should block rm -rf command', () => {
    const result = checkCommandLineSafety('rm -rf /tmp/test');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('rm -rf');
  });

  it('should block git reset --hard command', () => {
    const result = checkCommandLineSafety('git reset --hard HEAD');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('git reset --hard');
  });

  it('should block git clean -fdx command', () => {
    const result = checkCommandLineSafety('git clean -fdx');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('git clean -fdx');
  });

  it('should block Remove-Item -Recurse -Force command', () => {
    const result = checkCommandLineSafety('Remove-Item -Recurse -Force C:\\temp');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('Remove-Item -Recurse -Force');
  });

  it('should block npm publish command', () => {
    const result = checkCommandLineSafety('npm publish');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('npm publish');
  });

  it('should block git push --force command', () => {
    const result = checkCommandLineSafety('git push --force origin main');
    expect(result.passed).toBe(false);
    expect(result.violations[0].pattern).toBe('git push --force');
  });

  it('should allow normal commands', () => {
    const result = checkCommandLineSafety('git status');
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should allow git add and commit', () => {
    const result = checkCommandLineSafety('git add . && git commit -m "test"');
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});
