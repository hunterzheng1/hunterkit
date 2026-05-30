/**
 * Develop 阶段状态测试
 */
import { describe, it, expect } from 'vitest';
import { runDevelopCommand } from '../src/capabilities/develop/command.js';
import { createCommandRegistry } from '../src/cli/command-registry.js';
import type { CommandContext } from '../src/cli/types.js';

function makeContext(args: string[]): CommandContext {
  return {
    globalOptions: { cwd: process.cwd(), dryRun: true, json: true, noColor: true },
    command: 'develop',
    io: { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
    registry: createCommandRegistry(),
    args,
  };
}

describe('Develop 阶段状态', () => {
  it('apply 返回 2505', async () => {
    const ctx = makeContext(['develop', 'test-change', '--apply']);
    const resp = await runDevelopCommand(ctx);
    expect(resp.code).toBe(2505);
    expect(resp.data?.status).toBe('not_implemented');
  });

  it('spec 返回 2502 (proposal 缺失)', async () => {
    const ctx = makeContext(['develop', 'test-change', '--spec']);
    const resp = await runDevelopCommand(ctx);
    expect(resp.code).toBe(2502);
  });
});