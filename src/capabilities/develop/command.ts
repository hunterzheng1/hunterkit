/**
 * Develop command handler
 * @module capabilities/develop/command
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import type { DevelopStage, StorageLocation, ProposalMeta } from './types.js';

const VALID_CHANGE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateChangeName(name: string): string | null {
  if (!name || name.length < 3 || name.length > 80) return 'Change name must be 3-80 characters';
  if (!VALID_CHANGE_NAME.test(name)) return 'Change name must be kebab-case (lowercase alphanumeric with hyphens)';
  return null;
}

/**
 * 解析 develop 命令参数
 */
export function parseDevelopArgs(args: string[]): { change: string; options: any } {
  if (!args || args.length === 0) {
    throw new Error('Change name is required');
  }

  const change = args[0];
  const validationError = validateChangeName(change);
  if (validationError) {
    throw new Error(validationError);
  }

  const options: any = {
    stage: null,
    from: null,
    capability: null,
    parallel: true,
  };

  // 解析阶段参数（互斥）
  const stageFlags = ['--propose', '--spec', '--design', '--tasks', '--check', '--apply', '--archive'];
  const activeStages = stageFlags.filter(flag => args.includes(flag));

  if (activeStages.length > 1) {
    throw new Error('Stage flags are mutually exclusive');
  }

  if (activeStages.length === 1) {
    options.stage = activeStages[0].replace('--', '') as DevelopStage;
  }

  // 解析 --from
  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && fromIdx + 1 < args.length) {
    options.from = args[fromIdx + 1];
  }

  // 解析 --capability
  const capIdx = args.indexOf('--capability');
  if (capIdx !== -1 && capIdx + 1 < args.length) {
    options.capability = args[capIdx + 1];
  }

  // 解析 --parallel / --no-parallel（互斥）
  const hasParallel = args.includes('--parallel');
  const hasNoParallel = args.includes('--no-parallel');

  if (hasParallel && hasNoParallel) {
    throw new Error('--parallel and --no-parallel are mutually exclusive');
  }

  if (hasNoParallel) {
    options.parallel = false;
  }

  return { change, options };
}

/**
 * 解析存储位置（canonical 或 legacy）
 */
export function resolveStorage(cwd: string, change: string): StorageLocation {
  const canonicalRoot = resolve(cwd, '.harness', 'develop', 'changes', change);
  const legacyRoot = resolve(cwd, 'openspec', 'changes', change);
  const canonicalExists = existsSync(canonicalRoot);
  const legacyExists = existsSync(legacyRoot);

  if (canonicalExists && legacyExists) return { canonicalRoot, legacyRoot, status: 'mixed' };
  if (canonicalExists) return { canonicalRoot, legacyRoot, status: 'canonical' };
  if (legacyExists) return { canonicalRoot, legacyRoot, status: 'legacy' };
  return { canonicalRoot, legacyRoot, status: 'missing' };
}

/**
 * 检测当前阶段
 */
export function detectStage(storage: StorageLocation): DevelopStage {
  const root = storage.status === 'legacy' ? storage.legacyRoot : storage.canonicalRoot;
  const specsDir = join(root, 'specs');

  if (!existsSync(join(root, 'proposal.md'))) return 'propose';
  if (!existsSync(specsDir)) return 'spec';

  // 检查 specs 目录下的 capability 子目录
  try {
    const specs = readdirSync(specsDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());

    if (specs.length === 0) return 'spec';

    // 检查是否所有 capability 都有 design.md
    const allHaveDesign = specs.every((s: any) => existsSync(join(specsDir, s.name, 'design.md')));
    if (!allHaveDesign) return 'design';

    // 检查是否所有 capability 都有 tasks.md
    const allHaveTasks = specs.every((s: any) => existsSync(join(specsDir, s.name, 'tasks.md')));
    if (!allHaveTasks) return 'tasks';
  } catch {}

  return 'check';
}

/**
 * Run the develop command
 */
export async function runDevelopCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const args = context.args || [];

  // 解析参数
  let parsed: { change: string; options: any };
  try {
    parsed = parseDevelopArgs(args);
  } catch (err: any) {
    return {
      code: 2501,
      msg: err.message,
      data: { command: 'develop' },
      warnings: [],
    };
  }

  const { change, options } = parsed;
  const storage = resolveStorage(cwd, change);

  // 自动检测阶段或使用指定阶段
  const stage = options.stage || detectStage(storage);
  const artifacts: string[] = [];
  const warnings: string[] = [];

  // 执行对应阶段
  switch (stage) {
    case 'propose':
      if (storage.status === 'missing') {
        const proposalDir = storage.canonicalRoot;
        if (!dryRun) {
          mkdirSync(proposalDir, { recursive: true });
          const proposalContent = `---\nmode: full\ntest-strategy: tdd\n---\n\n# ${change}\n\n## Background\n\nTODO: Describe the business intent.\n\n## Capabilities\n\nTODO: List capabilities.\n`;
          writeFileSync(join(proposalDir, 'proposal.md'), proposalContent);
        }
        artifacts.push(`${storage.canonicalRoot.replace(cwd + '/', '')}/proposal.md`);
      }
      break;

    case 'spec':
      if (!existsSync(join(storage.canonicalRoot, 'proposal.md')) &&
          !existsSync(join(storage.legacyRoot, 'proposal.md'))) {
        return {
          code: 2502,
          msg: 'Proposal not found. Run --propose first.',
          data: { command: 'develop', change, stage, status: 'not_implemented' },
          warnings: ['Spec stage not yet implemented. 后续版本支持'],
        };
      }
      warnings.push('Spec stage not yet implemented. 后续版本支持');
      break;

    case 'design':
      if (!existsSync(join(storage.canonicalRoot, 'proposal.md')) &&
          !existsSync(join(storage.legacyRoot, 'proposal.md'))) {
        return {
          code: 2502,
          msg: 'Proposal not found. Run --propose first.',
          data: { command: 'develop', change, stage, status: 'not_implemented' },
          warnings: ['Design stage not yet implemented. 后续版本支持'],
        };
      }
      warnings.push('Design stage not yet implemented. 后续版本支持');
      break;

    case 'tasks':
      if (!existsSync(join(storage.canonicalRoot, 'proposal.md')) &&
          !existsSync(join(storage.legacyRoot, 'proposal.md'))) {
        return {
          code: 2504,
          msg: 'Upstream documents missing. Run previous stages first.',
          data: { command: 'develop', change, stage, status: 'not_implemented' },
          warnings: ['Tasks stage not yet implemented. 后续版本支持'],
        };
      }
      warnings.push('Tasks stage not yet implemented. 后续版本支持');
      break;

    case 'check':
      warnings.push('Check stage not yet implemented. 后续版本支持');
      break;

    case 'apply':
      return {
        code: 2505,
        msg: 'apply 阶段必须先通过 check — check 尚未实现，apply 不可用',
        data: { command: 'develop', change, stage, status: 'not_implemented' },
        warnings: [],
      };

    case 'archive':
      warnings.push('Archive stage not yet implemented. 后续版本支持');
      break;
  }

  if (dryRun) {
    warnings.push('Dry-run mode: no files were written');
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'develop',
      change,
      stage,
      status: stage === 'propose' ? 'completed' : 'not_implemented',
      mode: 'full',
      testStrategy: 'tdd',
      artifacts,
      storageStatus: storage.status,
    },
    warnings,
  };
}