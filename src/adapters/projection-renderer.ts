/**
 * Projection renderer - renders source templates into runtime projections
 * @module adapters/projection-renderer
 */

import type { AdapterRegistryEntry } from './types.js';

/** Managed marker injected into projections */
export const MANAGED_MARKER = '<!-- harness-managed: do not edit manually -->';

/** 内部来源名称屏蔽映射 — sanitize Internal source names */
export const INTERNAL_NAME_MAP: Record<string, string> = {
  'docsync': 'sync',
  'gsd': '',
  'kld-sdd': 'develop',
  'kld-review': 'review',
};

/** 过滤内部来源名称 */
export function sanitizeInternalNames(text: string): string {
  let result = text;
  for (const [internal, external] of Object.entries(INTERNAL_NAME_MAP)) {
    if (external === '') {
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), '');
    } else {
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), external);
    }
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

/** Claude SKILL.md frontmatter */
const CLAUDE_FRONTMATTER = `---
name: harness
description: Use the local Harness CLI to inspect codebases, sync agent docs, drive feature development, review changes, and search project knowledge.
when_to_use: Use when the user asks to scan a project, update docs, create or continue a feature spec, check implementation against specs, review code, or search archived project knowledge.
argument-hint: "[inspect|sync|develop|review|knowledge] [args]"
user-invocable: true
disable-model-invocation: false
allowed-tools: Read Grep Glob Bash(harness *) Bash(npx @hunterzheng/harness *)
model: inherit
effort: medium
paths:
  - ".harness/**"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "README.md"
  - "openspec/**"
---`;

/** Codex SKILL.md frontmatter */
const CODEX_FRONTMATTER = `---
name: harness
description: Use the local Harness CLI for project inspection, document sync, feature development, code review, and knowledge search.
---`;

/**
 * Render a projection from a source template
 */
export function renderProjection(entry: AdapterRegistryEntry, sourceContent: string): string {
  const lines: string[] = [];
  
  // Add frontmatter based on tool type
  if (entry.tool === 'claude' && entry.sourcePath.includes('SKILL.md')) {
    lines.push(CLAUDE_FRONTMATTER);
  } else if (entry.tool === 'codex' && entry.sourcePath.includes('SKILL.md')) {
    lines.push(CODEX_FRONTMATTER);
  }
  
  lines.push(
    MANAGED_MARKER,
    `<!-- source: ${entry.sourcePath} -->`,
    `<!-- repair: harness config --repair-adapters -->`,
    '',
    sourceContent,
  );
  return lines.join('\n');
}

/**
 * Check if content has the managed marker
 */
export function isManagedProjection(content: string): boolean {
  return content.includes(MANAGED_MARKER);
}
