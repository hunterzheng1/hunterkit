/**
 * Adapter source manager - ensures source-of-truth templates exist
 * @module adapters/source-manager
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { AdapterRegistryEntry } from './types.js';

/**
 * Ensure adapter source templates exist in .harness/adapters/
 */
export function ensureAdapterSources(cwd: string, entries: AdapterRegistryEntry[]): void {
  for (const entry of entries) {
    const fullPath = resolve(cwd, entry.sourcePath);
    if (!existsSync(fullPath)) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, entry.templateContent, 'utf-8');
    }
  }
  
  // Generate shared/skills/harness/ directory structure
  ensureSharedSkillSources(cwd);
}

/**
 * Ensure shared skill source files exist (references/scripts/assets)
 */
function ensureSharedSkillSources(cwd: string): void {
  const sharedBase = resolve(cwd, '.harness/adapters/shared/skills/harness');
  
  // references/
  const references = [
    { name: 'command-contract.md', content: generateReferenceContent('command-contract') },
    { name: 'document-contract.md', content: generateReferenceContent('document-contract') },
    { name: 'agent-orchestration.md', content: generateReferenceContent('agent-orchestration') },
    { name: 'safety.md', content: generateReferenceContent('safety') },
  ];
  
  for (const ref of references) {
    const refPath = resolve(sharedBase, 'references', ref.name);
    if (!existsSync(refPath)) {
      mkdirSync(dirname(refPath), { recursive: true });
      writeFileSync(refPath, ref.content, 'utf-8');
    }
  }
  
  // scripts/
  const scripts = [
    { name: 'validate-workspace.mjs', content: generateScriptContent('validate-workspace') },
    { name: 'run-harness.mjs', content: generateScriptContent('run-harness') },
    { name: 'parse-result.mjs', content: generateScriptContent('parse-result') },
  ];
  
  for (const script of scripts) {
    const scriptPath = resolve(sharedBase, 'scripts', script.name);
    if (!existsSync(scriptPath)) {
      mkdirSync(dirname(scriptPath), { recursive: true });
      writeFileSync(scriptPath, script.content, 'utf-8');
    }
  }
  
  // assets/
  const assets = [
    { name: 'AGENTS.block.md', content: generateAssetContent('AGENTS.block') },
    { name: 'CLAUDE.template.md', content: generateAssetContent('CLAUDE.template') },
    { name: 'review-report.template.md', content: generateAssetContent('review-report.template') },
  ];
  
  for (const asset of assets) {
    const assetPath = resolve(sharedBase, 'assets', asset.name);
    if (!existsSync(assetPath)) {
      mkdirSync(dirname(assetPath), { recursive: true });
      writeFileSync(assetPath, asset.content, 'utf-8');
    }
  }
}

/**
 * Generate reference document content
 */
function generateReferenceContent(type: string): string {
  const templates: Record<string, string> = {
    'command-contract': `# Command Contract

This document defines the contract for Harness CLI commands.

## Command Structure

All Harness commands follow this structure:

\`\`\`bash
harness <command> [options] [arguments]
\`\`\`

## Available Commands

- \`inspect\` - Scan project structure and generate facts
- \`sync\` - Sync documents with knowledge base
- \`develop\` - Run development workflow
- \`review\` - Run code review
- \`knowledge\` - Manage knowledge index
- \`status\` - Show workspace and project status
- \`doctor\` - Diagnose environment and dependencies
- \`config\` - Manage harness configuration

## Global Options

- \`--cwd <path>\` - Project root directory
- \`--dry-run\` - Preview mode - no actual file writes
- \`--json\` - Output as pure JSON
- \`--no-color\` - Disable ANSI color codes

## Response Format

All commands return a standardized response:

\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": { ... },
  "warnings": []
}
\`\`\`
`,
    'document-contract': `# Document Contract

This document defines the contract for Harness-managed documents.

## Managed Documents

Harness manages the following documents:

- \`AGENTS.md\` - Project-level agent instructions
- \`CLAUDE.md\` - Claude-specific instructions
- \`.claude/skills/harness/SKILL.md\` - Claude skill definition
- \`.agents/skills/harness/SKILL.md\` - Codex skill definition

## Document Structure

All managed documents include:

1. **Frontmatter** (YAML) - Metadata for AI tools
2. **Managed Marker** - \`<!-- harness-managed: do not edit manually -->\`
3. **Source Reference** - Link to source template
4. **Repair Command** - How to regenerate

## Editing Guidelines

- Do not edit managed sections directly
- Use \`harness config --repair-adapters\` to regenerate
- Custom content should be placed outside managed blocks
`,
    'agent-orchestration': `# Agent Orchestration

This document describes how Harness orchestrates AI agents.

## Orchestration Model

Harness uses a multi-agent orchestration model:

1. **Coordinator Agent** - Routes tasks to specialized agents
2. **Specialized Agents** - Handle specific capabilities
3. **Validator Agents** - Verify outputs before committing

## Agent Communication

Agents communicate through:

- Shared workspace (\`.harness/\`)
- State files (\`.harness/state/\`)
- Facts database (\`.harness/facts/\`)

## Parallel Execution

Harness supports parallel agent execution:

- \`maxParallelAgents\` - Maximum concurrent agents (default: 6)
- \`validatorRequired\` - Require validation before commit (default: true)

## Safety Controls

- Dangerous command blocking
- Secret pattern detection
- Transaction-based writes with rollback
`,
    'safety': `# Safety

This document describes Harness safety controls.

## Dangerous Command Blocking

Harness blocks dangerous commands by default:

- \`rm -rf /\`
- \`git reset --hard\`
- \`git clean -fdx\`
- \`Remove-Item -Recurse -Force\` (PowerShell)
- \`npm publish\`
- \`git push --force\`

## Secret Detection

Harness detects and prevents committing secrets:

- \`.env\` files
- \`*.key\` files
- \`*.secret\` files
- \`*.token\` files

## Transaction Safety

All file writes use transactions:

1. **Stage** - Plan operations
2. **Backup** - Backup existing files
3. **Write** - Execute operations
4. **Commit** - Finalize or rollback

## Dry-Run Mode

Use \`--dry-run\` to preview changes without writing:

\`\`\`bash
harness <command> --dry-run
\`\`\`
`,
  };
  
  return templates[type] || `# ${type}\n\nReference document for ${type}.\n`;
}

/**
 * Generate script content
 */
function generateScriptContent(type: string): string {
  const templates: Record<string, string> = {
    'validate-workspace': `#!/usr/bin/env node

/**
 * Validate workspace integrity
 * @module scripts/validate-workspace
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED_DIRS = [
  '.harness/config',
  '.harness/state',
  '.harness/facts',
  '.harness/generated',
  '.harness/adapters',
  '.harness/reports',
  '.harness/cache',
  '.harness/develop',
];

export function validateWorkspace(cwd) {
  const missing = [];
  
  for (const dir of REQUIRED_DIRS) {
    const fullPath = resolve(cwd, dir);
    if (!existsSync(fullPath)) {
      missing.push(dir);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

// CLI entrypoint
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const cwd = process.argv[2] || process.cwd();
  const result = validateWorkspace(cwd);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}
`,
    'run-harness': `#!/usr/bin/env node

/**
 * Run harness CLI command
 * @module scripts/run-harness
 */

import { spawn } from 'node:child_process';

export function runHarness(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['@hunterzheng/harness', ...args], {
      stdio: 'pipe',
      ...options,
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// CLI entrypoint
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const args = process.argv.slice(2);
  runHarness(args).then((result) => {
    console.log(result.stdout);
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(result.code);
  }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
`,
    'parse-result': `#!/usr/bin/env node

/**
 * Parse harness CLI result
 * @module scripts/parse-result
 */

export function parseResult(output) {
  try {
    const result = JSON.parse(output);
    return {
      success: result.code === 0,
      code: result.code,
      message: result.msg,
      data: result.data,
      warnings: result.warnings || [],
    };
  } catch (err) {
    return {
      success: false,
      code: -1,
      message: 'Failed to parse output',
      error: err.message,
      raw: output,
    };
  }
}

// CLI entrypoint
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  let input = '';
  process.stdin.on('data', (chunk) => {
    input += chunk.toString();
  });
  process.stdin.on('end', () => {
    const result = parseResult(input);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
`,
  };
  
  return templates[type] || `#!/usr/bin/env node\n\n// ${type} script\n`;
}

/**
 * Generate asset content
 */
function generateAssetContent(type: string): string {
  const templates: Record<string, string> = {
    'AGENTS.block': `<!-- harness-generated: AGENTS.md block -->

## Harness Integration

This project uses Harness for AI-assisted development.

### Available Commands

- \`harness inspect\` - Scan project structure
- \`harness sync\` - Sync documents
- \`harness develop\` - Run development workflow
- \`harness review\` - Run code review
- \`harness knowledge\` - Manage knowledge

### Getting Started

1. Initialize workspace: \`harness\` (no arguments)
2. Check status: \`harness status\`
3. Run diagnostics: \`harness doctor\`

For more information, see \`.harness/docs/\` or run \`harness --help\`.
`,
    'CLAUDE.template': `<!-- harness-generated: CLAUDE.md template -->

# Claude Instructions

You are working on a project that uses Harness for AI-assisted development.

## Project Context

- **Project Type**: {{project.type}}
- **Capabilities**: {{capabilities.list}}

## Harness Commands

When the user asks to run Harness commands, use:

\`\`\`bash
harness <command> [options]
\`\`\`

## Important Files

- \`AGENTS.md\` - Project-level instructions
- \`.harness/config/harness.config.json\` - Configuration
- \`.harness/facts/\` - Project facts database

## Guidelines

1. Always check \`harness status\` before making changes
2. Use \`harness review\` before committing
3. Respect managed document boundaries
`,
    'review-report.template': `<!-- harness-generated: review report template -->

# Code Review Report

**Project**: {{project.name}}
**Date**: {{review.date}}
**Reviewer**: {{review.agent}}

## Summary

- **Files Reviewed**: {{review.fileCount}}
- **Issues Found**: {{review.issueCount}}
- **Severity**: {{review.severity}}

## Findings

{{#each findings}}
### {{this.file}}

- **Line**: {{this.line}}
- **Severity**: {{this.severity}}
- **Message**: {{this.message}}
- **Suggestion**: {{this.suggestion}}

{{/each}}

## Recommendations

{{recommendations}}

---

*Generated by Harness Review*
`,
  };
  
  return templates[type] || `<!-- harness-generated: ${type} -->\n\nAsset template for ${type}.\n`;
}

/**
 * Read an adapter source file
 */
export function readAdapterSource(cwd: string, sourcePath: string): string {
  const fullPath = resolve(cwd, sourcePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Adapter source not found: ${sourcePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}
