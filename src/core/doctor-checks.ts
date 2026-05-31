/**
 * Doctor checks aggregator - all diagnostic checks for harness doctor
 * @module core/doctor-checks
 *
 * Aggregates base checks (Node.js version, harness dir, config),
 * artifact health checks, skill source, managed docs, safety baseline,
 * and local config privacy checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ArtifactHealthCheck } from './artifact-health.js';
import {
  diagnoseRuntimeProjectionConsistency,
  diagnoseRuntimeHooks,
  diagnoseSkillSource,
} from './artifact-health.js';
import { getExpectedRuntimePaths } from '../adapters/artifact-plan.js';
import type { AdapterRegistryEntry, AdapterTool } from '../adapters/types.js';
import { validateSecretPatternBaseline, BASELINE_SECRET_PATTERNS } from './safety-baseline.js';

/** Doctor check ID constants */
export const CHECK_IDS = {
  nodeVersion: 'base.nodeVersion',
  harnessDir: 'base.harnessDir',
  configExists: 'base.config',
  runtimeSkills: 'projection.runtimeSkills',
  runtimeHooks: 'projection.runtimeHooks',
  skillSource: 'skillSource',
  managedDocs: 'managedDocs',
  safetyBaseline: 'safetyBaseline',
  localConfigPrivacy: 'localConfigPrivacy',
} as const;

/**
 * Aggregate all doctor checks
 */
export function aggregateDoctorChecks(
  cwd: string,
  selectedTools: string[],
  hookStrength: string,
  entries: AdapterRegistryEntry[],
  configSecretPatterns: string[],
): ArtifactHealthCheck[] {
  const checks: ArtifactHealthCheck[] = [];

  // Base checks
  checks.push(...runBaseChecks(cwd));

  // Runtime projection checks
  const runtimePaths = getExpectedRuntimePaths(
    selectedTools as AdapterTool[],
    entries,
  );
  checks.push(...diagnoseRuntimeProjectionConsistency(
    cwd, selectedTools, entries, runtimePaths,
  ));

  // Hook checks
  checks.push(...diagnoseRuntimeHooks(cwd, selectedTools, hookStrength));

  // Skill source check
  checks.push(...diagnoseSkillSource(cwd));

  // Managed docs check
  checks.push(...diagnoseManagedDocs(cwd));

  // Safety baseline check
  checks.push(...diagnoseSafetyBaseline(configSecretPatterns));

  // Local config privacy
  checks.push(...diagnoseLocalConfigPrivacy(cwd));

  return checks;
}

/** Base system checks */
function runBaseChecks(cwd: string): ArtifactHealthCheck[] {
  const checks: ArtifactHealthCheck[] = [];

  // Node.js version
  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  checks.push({
    id: CHECK_IDS.nodeVersion,
    status: nodeMajor >= 20 ? 'OK' : 'ERROR',
    severity: nodeMajor >= 20 ? 'info' : 'error',
    message: nodeMajor >= 20
      ? `Node.js ${process.version} (>=20)`
      : `Node.js ${process.version} (<20 required)`,
    paths: [],
    repairCommand: 'nvm use 20 || nvm install 20',
  });

  // .harness directory
  const harnessDir = resolve(cwd, '.harness');
  checks.push({
    id: CHECK_IDS.harnessDir,
    status: existsSync(harnessDir) ? 'OK' : 'ERROR',
    severity: existsSync(harnessDir) ? 'info' : 'error',
    message: existsSync(harnessDir)
      ? '.harness directory exists'
      : '.harness directory not found',
    paths: ['.harness'],
    repairCommand: 'npx @hunterzheng/harness',
  });

  return checks;
}

/** Managed docs check */
function diagnoseManagedDocs(cwd: string): ArtifactHealthCheck[] {
  const checks: ArtifactHealthCheck[] = [];
  const agentsMd = resolve(cwd, 'AGENTS.md');

  if (existsSync(agentsMd)) {
    const { readFileSync } = require('node:fs');
    const content = readFileSync(agentsMd, 'utf-8');

    const hasHarnessBlock = content.includes('<!-- harness:start -->');
    const hasLegacyDocsyncBlock = content.includes('<!-- docsync:start -->');
    const exposesLegacyCommands = /\/docsync:(init|sync)/.test(content);

    if (exposesLegacyCommands || hasLegacyDocsyncBlock) {
      checks.push({
        id: CHECK_IDS.managedDocs,
        status: 'ERROR',
        severity: 'error',
        message: 'AGENTS.md contains legacy DocSync content or commands',
        paths: ['AGENTS.md'],
        repairCommand: 'harness sync --repair',
      });
    } else if (!hasHarnessBlock) {
      checks.push({
        id: CHECK_IDS.managedDocs,
        status: 'WARN',
        severity: 'warn',
        message: 'AGENTS.md missing Harness managed block',
        paths: ['AGENTS.md'],
        repairCommand: 'harness sync --repair',
      });
    }
  }

  return checks;
}

/** Safety baseline check */
function diagnoseSafetyBaseline(patterns: string[]): ArtifactHealthCheck[] {
  if (!patterns || patterns.length === 0) {
    return [{
      id: CHECK_IDS.safetyBaseline,
      status: 'ERROR',
      severity: 'error',
      message: 'Safety secretPatterns is empty',
      paths: ['.harness/config/harness.config.json'],
      repairCommand: 'harness config --repair',
    }];
  }

  const missing = validateSecretPatternBaseline(patterns);

  if (missing.length > 0) {
    return [{
      id: CHECK_IDS.safetyBaseline,
      status: 'ERROR',
      severity: 'error',
      message: `Safety baseline incomplete, missing: ${missing.join(', ')}`,
      paths: ['.harness/config/harness.config.json'],
      repairCommand: 'harness config --repair',
    }];
  }

  return [{
    id: CHECK_IDS.safetyBaseline,
    status: 'OK',
    severity: 'info',
    message: `Safety baseline covers all ${BASELINE_SECRET_PATTERNS.length} required patterns`,
    paths: [],
    repairCommand: 'harness config --repair',
  }];
}

/** Local config privacy check */
function diagnoseLocalConfigPrivacy(cwd: string): ArtifactHealthCheck[] {
  const localConfigPath = resolve(cwd, '.harness', 'config', 'harness.local.json');

  if (!existsSync(localConfigPath)) {
    return [];
  }

  return [{
    id: CHECK_IDS.localConfigPrivacy,
    status: 'OK',
    severity: 'info',
    message: 'Local config exists and is excluded from reportable artifacts',
    paths: ['.harness/config/harness.local.json'],
    repairCommand: '',
  }];
}