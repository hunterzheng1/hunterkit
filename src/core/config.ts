/**
 * Configuration load, write, and merge
 * @module core/config
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { HarnessConfig, ConfigValidationResult } from './types.js';
import type { Transaction } from './transaction.js';
import { validateHarnessConfig } from './config-schema.js';
import { stageWrite } from './transaction.js';

/**
 * Load and validate harness config from .harness/config/harness.config.json
 */
export function loadHarnessConfig(configDir: string): HarnessConfig {
  const configPath = resolve(configDir, 'harness.config.json');

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Config file is not valid JSON: ${configPath}`);
  }

  const validation = validateHarnessConfig(parsed);
  if (!validation.valid) {
    const details = [...validation.errors, ...validation.missing.map(m => `missing: ${m}`)].join(', ');
    throw new Error(`Config validation failed (${configPath}): ${details}`);
  }

  return parsed as HarnessConfig;
}

/**
 * Write harness config via transaction
 */
export function writeHarnessConfig(configDir: string, config: HarnessConfig, tx: Transaction): void {
  const configPath = resolve(configDir, 'harness.config.json');
  stageWrite(tx, configPath, JSON.stringify(config, null, 2));
}

/**
 * Merge local config overrides (*.local.json)
 * Returns effectiveConfig (for runtime) and reportableConfig (for reports, without local values)
 */
export function mergeLocalConfig(
  configDir: string,
  config: HarnessConfig,
): { effectiveConfig: HarnessConfig; reportableConfig: HarnessConfig; localOverrides: string[] } {
  const effectiveConfig = JSON.parse(JSON.stringify(config)) as HarnessConfig;
  const reportableConfig = JSON.parse(JSON.stringify(config)) as HarnessConfig;
  const localOverrides: string[] = [];

  if (!existsSync(configDir)) {
    return { effectiveConfig, reportableConfig, localOverrides };
  }

  const files = readdirSync(configDir).filter(f => f.endsWith('.local.json'));

  for (const file of files) {
    const filePath = resolve(configDir, file);
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const localConfig = JSON.parse(raw) as Record<string, unknown>;

      // Only allow overriding safe runtime fields (not schemaVersion or safety)
      for (const key of Object.keys(localConfig)) {
        if (key === 'schemaVersion' || key === 'safety') continue;
        if (key in effectiveConfig) {
          (effectiveConfig as Record<string, unknown>)[key] = localConfig[key];
          localOverrides.push(key);
        }
      }
    } catch {
      // Skip invalid local config files
    }
  }

  return { effectiveConfig, reportableConfig, localOverrides };
}
