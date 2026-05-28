/**
 * Configuration schema validator (minimal built-in, no external framework)
 * @module core/config-schema
 */

import type { ConfigValidationResult, HarnessConfig } from './types.js';

/**
 * Validate a HarnessConfig object
 */
export function validateHarnessConfig(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const missing: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'], missing: ['*'] };
  }

  const c = config as Record<string, unknown>;

  // schemaVersion
  if (c.schemaVersion === undefined) {
    missing.push('schemaVersion');
  } else if (typeof c.schemaVersion !== 'number' || c.schemaVersion !== 1) {
    errors.push('schemaVersion must be number 1');
  }

  // project
  if (!c.project || typeof c.project !== 'object') {
    missing.push('project');
  } else {
    const p = c.project as Record<string, unknown>;
    if (p.name === undefined) missing.push('project.name');
    if (p.type === undefined) missing.push('project.type');
  }

  // aiTools
  if (!c.aiTools || typeof c.aiTools !== 'object') {
    missing.push('aiTools');
  }

  // capabilities
  if (!c.capabilities || typeof c.capabilities !== 'object') {
    missing.push('capabilities');
  } else {
    const cap = c.capabilities as Record<string, unknown>;
    for (const key of ['inspect', 'sync', 'develop', 'review', 'knowledge']) {
      if (cap[key] === undefined) missing.push(`capabilities.${key}`);
    }
  }

  // documents
  if (!c.documents || typeof c.documents !== 'object') {
    missing.push('documents');
  }

  // orchestration
  if (!c.orchestration || typeof c.orchestration !== 'object') {
    missing.push('orchestration');
  }

  // safety
  if (!c.safety || typeof c.safety !== 'object') {
    missing.push('safety');
  }

  return {
    valid: errors.length === 0 && missing.length === 0,
    errors,
    missing,
  };
}

/**
 * Create a default HarnessConfig
 */
export function createDefaultConfig(projectName: string): HarnessConfig {
  return {
    schemaVersion: 1,
    project: { name: projectName, type: 'auto' },
    aiTools: { claude: false, codex: false, copilot: false, cursor: false },
    capabilities: { inspect: true, sync: true, develop: true, review: true, knowledge: false },
    documents: { managed: ['README.md', 'AGENTS.md', 'CLAUDE.md'], generatedBlockPrefix: 'harness' },
    orchestration: { subagents: 'auto', maxParallelAgents: 6, validatorRequired: true },
    safety: { dangerousCommandsBlocked: true, secretPatterns: ['.env', '*.key', '*.secret', '*.token'] },
  };
}
