/**
 * Review M1 边界测试
 */
import { describe, it, expect } from 'vitest';
import { runReviewCommand } from '../src/capabilities/review/command.js';
import { createCommandRegistry } from '../src/cli/command-registry.js';
import type { CommandContext } from '../src/cli/types.js';

function makeContext(args: string[]): CommandContext {
  return {
    globalOptions: { cwd: process.cwd(), dryRun: true, json: true, noColor: true },
    command: 'review',
    io: { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
    registry: createCommandRegistry(),
    args,
  };
}

describe('Review M1 边界', () => {
  it('--comment 返回 2606', async () => {
    const ctx = makeContext(['review', '--comment']);
    const resp = await runReviewCommand(ctx);
    expect(resp.code).toBe(2606);
    expect(resp.msg).toContain('后续版本');
  });
});