/**
 * 名称屏蔽测试 — 验证 sanitizeInternalNames 过滤函数
 */
import { describe, it, expect } from 'vitest';
import { sanitizeInternalNames } from '../src/adapters/projection-renderer.js';

describe('sanitizeInternalNames', () => {
  it('docsync → sync', () => {
    expect(sanitizeInternalNames('use docsync for docs')).toContain('sync');
    expect(sanitizeInternalNames('use docsync for docs')).not.toContain('docsync');
  });

  it('gsd 完全删除', () => {
    const result = sanitizeInternalNames('use gsd tool');
    expect(result).not.toContain('gsd');
  });

  it('kld-sdd → develop', () => {
    expect(sanitizeInternalNames('run kld-sdd')).toContain('develop');
    expect(sanitizeInternalNames('run kld-sdd')).not.toContain('kld-sdd');
  });

  it('kld-review → review', () => {
    expect(sanitizeInternalNames('run kld-review')).toContain('review');
    expect(sanitizeInternalNames('run kld-review')).not.toContain('kld-review');
  });

  it('不误伤正常单词（词边界）', () => {
    const text = 'Synchronize documents in sync mode';
    const result = sanitizeInternalNames(text);
    // "Sync" in "Synchronize" should not be touched
    expect(result).toContain('sync');
  });
});