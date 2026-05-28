/**
 * Develop command handler
 * @module capabilities/develop/command
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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

function resolveStorage(cwd: string, change: string): StorageLocation {
  const canonicalRoot = resolve(cwd, '.harness', 'develop', 'changes', change);
  const legacyRoot = resolve(cwd, 'openspec', 'changes', change);
  const canonicalExists = existsSync(canonicalRoot);
  const legacyExists = existsSync(legacyRoot);

  if (canonicalExists && legacyExists) return { canonicalRoot, legacyRoot, status: 'mixed' };
  if (canonicalExists) return { canonicalRoot, legacyRoot, status: 'canonical' };
  if (legacyExists) return { canonicalRoot, legacyRoot, status: 'legacy' };
  return { canonicalRoot, legacyRoot, status: 'missing' };
}

function detectStage(storage: StorageLocation): DevelopStage {
  const root = storage.status === 'legacy' ? storage.legacyRoot : storage.canonicalRoot;
  const specsDir = join(root, 'specs');

  if (!existsSync(join(root, 'proposal.md'))) return 'propose';
  if (!existsSync(specsDir)) return 'spec';

  // Check if specs have design.md
  if (existsSync(specsDir)) {
    const { readdirSync } = require('node:fs');
    try {
      const specs = readdirSync(specsDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());
      const hasDesign = specs.some((s: any) => existsSync(join(specsDir, s.name, 'design.md')));
      const hasTasks = specs.some((s: any) => existsSync(join(specsDir, s.name, 'tasks.md')));
      if (!hasDesign) return 'design';
      if (!hasTasks) return 'tasks';
    } catch {}
  }

  return 'check';
}

/**
 * Run the develop command
 */
export async function runDevelopCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const change = context.command.split(' ').slice(1).join(' ') || '';

  if (!change) {
    return {
      code: 2501,
      msg: 'Change name is required. Usage: harness develop <change-name>',
      data: { command: 'develop' },
      warnings: [],
    };
  }

  const validationError = validateChangeName(change);
  if (validationError) {
    return {
      code: 2501,
      msg: validationError,
      data: { command: 'develop', change },
      warnings: [],
    };
  }

  const storage = resolveStorage(cwd, change);
  const stage = detectStage(storage);
  const artifacts: string[] = [];

  if (stage === 'propose' && storage.status === 'missing') {
    // Create proposal
    const proposalDir = storage.canonicalRoot;
    if (!dryRun) {
      mkdirSync(proposalDir, { recursive: true });
      const proposalContent = `---\nmode: full\ntest-strategy: tdd\n---\n\n# ${change}\n\n## Background\n\nTODO: Describe the business intent.\n\n## Capabilities\n\nTODO: List capabilities.\n`;
      writeFileSync(join(proposalDir, 'proposal.md'), proposalContent);
    }
    artifacts.push(`${storage.canonicalRoot.replace(cwd + '/', '')}/proposal.md`);
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'develop',
      change,
      stage,
      mode: 'full',
      testStrategy: 'tdd',
      artifacts,
      storageStatus: storage.status,
    },
    warnings: dryRun ? ['Dry-run mode: no files were written'] : [],
  };
}
