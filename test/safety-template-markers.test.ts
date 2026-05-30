/**
 * Safety 模板标注测试 — 验证 Hook/agent 生成逻辑存在
 */
import { describe, it, expect } from 'vitest';
import { generateHooks, generateSubagentDefs } from '../src/capabilities/safety/command.js';
import { sanitizeInternalNames, INTERNAL_NAME_MAP } from '../src/adapters/projection-renderer.js';
import { detectAiTool } from '../src/cli/interactive.js';

describe('Safety 模板标注', () => {
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

  it('detectAiTool 函数存在', () => {
    expect(typeof detectAiTool).toBe('function');
  });

  it('sanitizeInternalNames 过滤 docsync', () => {
    const result = sanitizeInternalNames('use docsync tool');
    expect(result).not.toContain('docsync');
    expect(result).toContain('sync');
  });
});