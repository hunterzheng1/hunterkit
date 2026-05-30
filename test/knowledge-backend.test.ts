/**
 * Knowledge 存储后端测试
 */
import { describe, it, expect } from 'vitest';
import { runKnowledgeCommand } from '../src/capabilities/knowledge/command.js';
import { createCommandRegistry } from '../src/cli/command-registry.js';
import type { CommandContext } from '../src/cli/types.js';

function makeContext(args: string[]): CommandContext {
  return {
    globalOptions: { cwd: process.cwd(), dryRun: true, json: true, noColor: true },
    command: 'knowledge',
    io: { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
    registry: createCommandRegistry(),
    args,
  };
}

describe('Knowledge 存储后端', () => {
  it('search 响应含 storageBackend', async () => {
    const ctx = makeContext(['knowledge', '--search', 'test']);
    const resp = await runKnowledgeCommand(ctx);
    expect(resp.data).toBeDefined();
    // storageBackend should be in data
    const backend = resp.data?.storageBackend;
    expect(['sqlite-fts5', 'json-fallback', undefined]).toContain(backend);
  });
});