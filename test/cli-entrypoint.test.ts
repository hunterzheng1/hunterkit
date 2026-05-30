/**
 * CLI 入口集成测试
 */
import { describe, it, expect } from 'vitest';
import { createCommandRegistry } from '../src/cli/command-registry.js';
import { parseGlobalOptions } from '../src/cli/global-options.js';
import type { CommandContext } from '../src/cli/types.js';

describe('CLI 入口', () => {
  describe('命令注册', () => {
    it('8 命令已注册', () => {
      const registry = createCommandRegistry();
      const cmds = registry.list();
      expect(cmds.length).toBe(8);
      const names = cmds.map(c => c.name);
      expect(names).toContain('inspect');
      expect(names).toContain('sync');
      expect(names).toContain('develop');
      expect(names).toContain('review');
      expect(names).toContain('knowledge');
      expect(names).toContain('status');
      expect(names).toContain('doctor');
      expect(names).toContain('config');
    });
  });

  describe('参数解析', () => {
    it('命令 + 参数正确分离', () => {
      const { parsedCommand, globalOptions } = parseGlobalOptions(['develop', 'demo-change', '--propose']);
      expect(parsedCommand.command).toBe('develop');
      expect(parsedCommand.commandArgs).toBeDefined();
      expect(parsedCommand.commandArgs!.length).toBeGreaterThanOrEqual(1);
    });

    it('--dry-run --json 全局选项正确识别', () => {
      const { globalOptions } = parseGlobalOptions(['--dry-run', '--json', 'review']);
      expect(globalOptions.dryRun).toBe(true);
      expect(globalOptions.json).toBe(true);
    });

    it('未知命令 parse 返回 null command', () => {
      const { parsedCommand } = parseGlobalOptions([]);
      expect(parsedCommand.command).toBeNull();
    });
  });

  describe('CommandContext', () => {
    it('args 字段存在', () => {
      // Type-level check: CommandContext has args
      const ctx: CommandContext = {
        globalOptions: { cwd: '/test', dryRun: false, json: false, noColor: false },
        command: 'test',
        io: { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
        registry: createCommandRegistry(),
        args: ['arg1', 'arg2'],
      };
      expect(ctx.args.length).toBe(2);
    });
  });

  describe('命令路由', () => {
    it('resolve 返回 handler 或 null', () => {
      const registry = createCommandRegistry();
      expect(registry.resolve('inspect')).not.toBeNull();
      expect(registry.resolve('nonexistent')).toBeNull();
    });
  });
});