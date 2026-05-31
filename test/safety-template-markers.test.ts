/**
 * Safety 模板标注测试 — 验证 Hook/agent 生成逻辑存在 + managed markers
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateHooks,
  generateSubagentDefs,
  generateHookConfigs,
  projectRuntimeHooks,
  checkHookConsistency,
  buildHookActivationGuidance,
} from '../src/capabilities/safety/command.js';
import { sanitizeInternalNames, INTERNAL_NAME_MAP } from '../src/adapters/projection-renderer.js';
import { getBaselineSecretPatterns, getBaselineDangerousCommands } from '../src/core/safety-baseline.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-safety-marker-'));
}
function cleanupTempProject(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ============================================================
// TASK-SAF-01: Hook 运行时投影测试
// ============================================================
describe('TASK-SAF-01: Hook 运行时投影', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('projectRuntimeHooks generates Claude runtime files', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    const artifacts = projectRuntimeHooks(tempDir, ['claude']);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some(a => a.includes('.claude/hooks/'))).toBe(true);
    expect(artifacts.some(a => a === '.claude/settings.json')).toBe(true);
  });

  it('projectRuntimeHooks generates Codex runtime files', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    const artifacts = projectRuntimeHooks(tempDir, ['codex']);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some(a => a.includes('.codex/hooks/'))).toBe(true);
    expect(artifacts.some(a => a === '.codex/hooks.json')).toBe(true);
  });

  it('unselected tool hooks not written to runtime', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    // Only Claude selected, Codex runtime should not exist
    projectRuntimeHooks(tempDir, ['claude']);
    expect(existsSync(join(tempDir, '.codex/hooks.json'))).toBe(false);
    expect(existsSync(join(tempDir, '.codex/hooks'))).toBe(false);
  });
});

// ============================================================
// TASK-SAF-02: Safety 默认规则测试
// ============================================================
describe('TASK-SAF-02: Safety 默认规则', () => {
  it('baseline secret patterns cover required entries', () => {
    const patterns = getBaselineSecretPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(9);
    expect(patterns).toContain('.env');
    expect(patterns).toContain('.env.*');
    expect(patterns).toContain('*.pem');
    expect(patterns).toContain('*.key');
    expect(patterns.some(p => p.includes('token'))).toBe(true);
    expect(patterns.some(p => p.includes('secret'))).toBe(true);
  });

  it('baseline dangerous commands cover required rules', () => {
    const commands = getBaselineDangerousCommands();
    expect(commands.length).toBeGreaterThanOrEqual(9);
    const cmdStrings = commands.map(c => c.pattern);
    expect(cmdStrings.some(c => c.includes('rm -rf'))).toBe(true);
    expect(cmdStrings.some(c => c.includes('git reset --hard'))).toBe(true);
    expect(cmdStrings.some(c => c.includes('git push --force'))).toBe(true);
    expect(cmdStrings.some(c => c.includes('Remove-Item'))).toBe(true);
  });
});

// ============================================================
// TASK-SAF-03: Hook 脚本合规测试
// ============================================================
describe('TASK-SAF-03: Hook 脚本合规', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('hook script has shebang and managed marker', () => {
    generateHooks(tempDir);
    const hookFile = join(tempDir, '.harness/adapters/claude/hooks/dangerous-command.sh');
    expect(existsSync(hookFile)).toBe(true);
    const content = readFileSync(hookFile, 'utf-8');
    expect(content).toContain('#!/usr/bin/env bash');
    expect(content).toContain('@managed-by: harness install');
    expect(content).toContain('resolve_project_root');
  });

  it('hook scripts match source and runtime via copy', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    projectRuntimeHooks(tempDir, ['claude']);
    const srcContent = readFileSync(
      join(tempDir, '.harness/adapters/claude/hooks/dangerous-command.sh'),
      'utf-8',
    );
    const rtContent = readFileSync(
      join(tempDir, '.claude/hooks/dangerous-command.sh'),
      'utf-8',
    );
    expect(rtContent).toBe(srcContent);
  });

  it('hook activation guidance includes trust reminders', () => {
    const guidance = buildHookActivationGuidance(['claude', 'codex'], 'full');
    expect(guidance.claude.length).toBeGreaterThan(0);
    expect(guidance.claude.some(g => g.includes('settings.json'))).toBe(true);
    expect(guidance.codex.length).toBeGreaterThan(0);
    expect(guidance.codex.some(g => g.includes('信任') || g.includes('trust'))).toBe(true);
  });
});

// ============================================================
// TASK-SAF-07: Hook 一致性校验
// ============================================================
describe('TASK-SAF-07: Hook 一致性校验', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('reports consistent when both source and runtime exist', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    projectRuntimeHooks(tempDir, ['claude']);
    const result = checkHookConsistency(tempDir, ['claude']);
    expect(result.consistent).toBe(true);
    expect(result.mismatched.length).toBe(0);
    expect(result.errorCode).toBeNull();
  });

  it('reports inconsistency when source exists but runtime missing', () => {
    generateHooks(tempDir);
    generateHookConfigs(tempDir);
    // 不调用 projectRuntimeHooks，runtime 缺失
    const result = checkHookConsistency(tempDir, ['claude']);
    expect(result.consistent).toBe(false);
    expect(result.mismatched.length).toBeGreaterThan(0);
    expect(result.errorCode).toBe(2703);
  });

  it('returns null errorCode when no tools selected', () => {
    const result = checkHookConsistency(tempDir, []);
    expect(result.consistent).toBe(true);
    expect(result.errorCode).toBeNull();
  });
});

// ============================================================
// 原有测试
// ============================================================
describe('Safety 模板标注（原有）', () => {
  it('generateHooks 函数存在', () => {
    expect(typeof generateHooks).toBe('function');
  });

  it('generateSubagentDefs 函数存在', () => {
    expect(typeof generateSubagentDefs).toBe('function');
  });

  it('INTERNAL_NAME_MAP 已导出', () => {
    expect(INTERNAL_NAME_MAP).toBeDefined();
    expect(INTERNAL_NAME_MAP['docsync']).toBe('sync');
  });

  it('sanitizeInternalNames 过滤 docsync', () => {
    const result = sanitizeInternalNames('use docsync tool');
    expect(result).not.toContain('docsync');
    expect(result).toContain('sync');
  });

  it('buildHookActivationGuidance 函数存在', () => {
    expect(typeof buildHookActivationGuidance).toBe('function');
    const g = buildHookActivationGuidance(['claude'], 'basic');
    expect(g.claude).toEqual([]);
  });

  it('checkHookConsistency 函数存在', () => {
    expect(typeof checkHookConsistency).toBe('function');
  });
});