/**
 * 质量门禁测试 — 验证构建产物和代码结构
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe('工程门禁', () => {
  it('dist/bin/harness.js 存在', () => {
    expect(existsSync('dist/bin/harness.js')).toBe(true);
  });

  it('eslint.config.js 存在', () => {
    expect(existsSync('eslint.config.js')).toBe(true);
  });

  it('npm pack dry-run 含 dist', () => {
    const result = execSync('npm pack --dry-run 2>&1', { encoding: 'utf-8' });
    expect(result).toContain('dist/');
  });

  it('npm pack dry-run 含 README.md', () => {
    const result = execSync('npm pack --dry-run 2>&1', { encoding: 'utf-8' });
    expect(result).toContain('README.md');
  });
});