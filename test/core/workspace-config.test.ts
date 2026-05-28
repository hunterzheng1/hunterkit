/**
 * Unit tests for workspace-config module
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveProjectRoot, resolveWorkspacePaths, isPathWithinRoot, isWritablePath } from '../../src/core/paths.js';
import { validateHarnessConfig, createDefaultConfig } from '../../src/core/config-schema.js';
import { loadHarnessConfig, writeHarnessConfig, mergeLocalConfig } from '../../src/core/config.js';
import { readStateFile, writeStateFile } from '../../src/core/state.js';
import { beginTransaction, stageWrite, stageMkdir, commitTransaction, rollbackTransaction } from '../../src/core/transaction.js';
import { ensureWorkspace, readWorkspaceStatus } from '../../src/core/workspace.js';
import { detectLegacySources, buildMigrationPlan } from '../../src/core/legacy-sources.js';
import type { HarnessConfig, WorkspacePaths } from '../../src/core/types.js';

/** Create a temp project directory */
function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-test-'));
}

/** Clean up temp project */
function cleanupTempProject(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ============================================================
// Path resolution tests
// ============================================================
describe('resolveProjectRoot', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return normalized absolute path', () => {
    const result = resolveProjectRoot(tempDir);
    expect(result).toBe(tempDir);
  });

  it('should throw for nonexistent path', () => {
    expect(() => resolveProjectRoot('/nonexistent/path/xyz123')).toThrow();
  });

  it('should default to process.cwd()', () => {
    const result = resolveProjectRoot();
    expect(result).toBeTruthy();
  });
});

describe('resolveWorkspacePaths', () => {
  it('should return complete path tree', () => {
    const paths = resolveWorkspacePaths('/tmp/test');
    expect(paths.harness).toContain('.harness');
    expect(paths.config).toContain('config');
    expect(paths.state).toContain('state');
    expect(paths.facts).toContain('facts');
    expect(paths.generated).toContain('generated');
    expect(paths.adapters).toContain('adapters');
    expect(paths.reports).toContain('reports');
    expect(paths.cache).toContain('cache');
    expect(paths.develop).toContain('develop');
  });
});

describe('isPathWithinRoot', () => {
  it('should accept paths within root', () => {
    expect(isPathWithinRoot('/tmp/test/.harness/config', '/tmp/test')).toBe(true);
  });

  it('should reject path traversal', () => {
    expect(isPathWithinRoot('/tmp/test/../etc/passwd', '/tmp/test')).toBe(false);
  });
});

// ============================================================
// Config validation tests
// ============================================================
describe('validateHarnessConfig', () => {
  it('should accept valid config with all required fields', () => {
    const config = createDefaultConfig('test-project');
    const result = validateHarnessConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('should reject config missing schemaVersion', () => {
    const config = { ...createDefaultConfig('test') } as any;
    delete config.schemaVersion;
    const result = validateHarnessConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('schemaVersion');
  });

  it('should reject config missing project', () => {
    const config = { ...createDefaultConfig('test') } as any;
    delete config.project;
    const result = validateHarnessConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('project');
  });

  it('should reject config with wrong schemaVersion type', () => {
    const config = { ...createDefaultConfig('test'), schemaVersion: '1' } as any;
    const result = validateHarnessConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return missing field list in error', () => {
    const result = validateHarnessConfig({});
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Config load/write/merge tests
// ============================================================
describe('config load/write/merge', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempProject();
    mkdirSync(join(tempDir, '.harness', 'config'), { recursive: true });
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should load valid config from .harness/config/', () => {
    const config = createDefaultConfig('test-project');
    writeFileSync(join(tempDir, '.harness', 'config', 'harness.config.json'), JSON.stringify(config));
    const loaded = loadHarnessConfig(join(tempDir, '.harness', 'config'));
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.project.name).toBe('test-project');
  });

  it('should fail when config file missing', () => {
    expect(() => loadHarnessConfig(join(tempDir, '.harness', 'config'))).toThrow();
  });

  it('should merge local config overrides', () => {
    const config = createDefaultConfig('test-project');
    writeFileSync(join(tempDir, '.harness', 'config', 'harness.config.json'), JSON.stringify(config));
    writeFileSync(join(tempDir, '.harness', 'config', 'dev.local.json'), JSON.stringify({ project: { name: 'local-override', type: 'local' } }));

    const loaded = loadHarnessConfig(join(tempDir, '.harness', 'config'));
    const { effectiveConfig, reportableConfig, localOverrides } = mergeLocalConfig(join(tempDir, '.harness', 'config'), loaded);
    expect(effectiveConfig.project.name).toBe('local-override');
    expect(reportableConfig.project.name).toBe('test-project');
    expect(localOverrides).toContain('project');
  });
});

// ============================================================
// Transaction tests
// ============================================================
describe('Transaction', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create transaction with unique id', () => {
    const tx = beginTransaction(tempDir);
    expect(tx.id).toMatch(/^txn_/);
    expect(tx.status).toBe('pending');
  });

  it('should stage write operations', () => {
    const tx = beginTransaction(tempDir);
    stageWrite(tx, join(tempDir, '.harness', 'test.txt'), 'hello');
    expect(tx.operations.length).toBe(1);
  });

  it('should commit all staged writes', () => {
    const tx = beginTransaction(tempDir);
    const filePath = join(tempDir, '.harness', 'test.txt');
    stageWrite(tx, filePath, 'hello world');
    commitTransaction(tx);
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe('hello world');
  });

  it('should respect dry-run (zero writes)', () => {
    const tx = beginTransaction(tempDir, true);
    const filePath = join(tempDir, '.harness', 'test.txt');
    stageWrite(tx, filePath, 'hello');
    commitTransaction(tx);
    expect(existsSync(filePath)).toBe(false);
  });

  it('should reject writes outside project root', () => {
    const tx = beginTransaction(tempDir);
    expect(() => stageWrite(tx, '/etc/passwd', 'hack')).toThrow();
  });

  it('should stage mkdir operations', () => {
    const tx = beginTransaction(tempDir);
    stageMkdir(tx, join(tempDir, '.harness', 'subdir'));
    commitTransaction(tx);
    expect(existsSync(join(tempDir, '.harness', 'subdir'))).toBe(true);
  });
});

// ============================================================
// State file tests
// ============================================================
describe('state file management', () => {
  let tempDir: string;
  let paths: WorkspacePaths;

  beforeEach(() => {
    tempDir = createTempProject();
    paths = resolveWorkspacePaths(tempDir);
    mkdirSync(paths.state, { recursive: true });
  });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return null for nonexistent state file', () => {
    const result = readStateFile(paths, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should write and read state file with schemaVersion', () => {
    const tx = beginTransaction(tempDir);
    writeStateFile(paths, 'test-state', { foo: 'bar' }, tx);
    commitTransaction(tx);

    const result = readStateFile(paths, 'test-state');
    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(1);
    expect(result!.foo).toBe('bar');
  });
});

// ============================================================
// Workspace tests
// ============================================================
describe('ensureWorkspace', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create .harness/ directory structure', () => {
    const config = createDefaultConfig('test');
    const result = ensureWorkspace({ cwd: tempDir, dryRun: false, json: false }, config);
    expect(existsSync(join(tempDir, '.harness', 'config'))).toBe(true);
    expect(existsSync(join(tempDir, '.harness', 'state'))).toBe(true);
    expect(existsSync(join(tempDir, '.harness', 'facts'))).toBe(true);
    expect(result.transactionId).toMatch(/^txn_/);
  });

  it('should write harness.config.json and install.json', () => {
    const config = createDefaultConfig('test');
    ensureWorkspace({ cwd: tempDir, dryRun: false, json: false }, config);
    expect(existsSync(join(tempDir, '.harness', 'config', 'harness.config.json'))).toBe(true);
    expect(existsSync(join(tempDir, '.harness', 'state', 'install.json'))).toBe(true);
  });

  it('should return planned operations in dry-run', () => {
    const config = createDefaultConfig('test');
    const result = ensureWorkspace({ cwd: tempDir, dryRun: true, json: false }, config);
    expect(result.dryRun).toBe(true);
    expect(existsSync(join(tempDir, '.harness', 'config', 'harness.config.json'))).toBe(false);
  });
});

describe('readWorkspaceStatus', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return initialized=false when no config', () => {
    const paths = resolveWorkspacePaths(tempDir);
    const status = readWorkspaceStatus(paths);
    expect(status.initialized).toBe(false);
  });

  it('should return initialized=true after workspace creation', () => {
    const config = createDefaultConfig('test');
    ensureWorkspace({ cwd: tempDir, dryRun: false, json: false }, config);
    const paths = resolveWorkspacePaths(tempDir);
    const status = readWorkspaceStatus(paths);
    expect(status.initialized).toBe(true);
    expect(status.schemaVersion).toBe(1);
  });
});

// ============================================================
// Legacy sources tests
// ============================================================
describe('detectLegacySources', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return empty when no legacy sources', () => {
    const sources = detectLegacySources(tempDir);
    expect(sources).toEqual([]);
  });

  it('should detect .docsync/ when present', () => {
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const sources = detectLegacySources(tempDir);
    expect(sources.some(s => s.name === 'docsync')).toBe(true);
  });

  it('should detect skywalk-sdd/ when present', () => {
    mkdirSync(join(tempDir, 'skywalk-sdd'), { recursive: true });
    writeFileSync(join(tempDir, 'skywalk-sdd', 'log.cjs'), 'content');
    const sources = detectLegacySources(tempDir);
    expect(sources.some(s => s.name === 'skywalk-sdd')).toBe(true);
  });
});

describe('buildMigrationPlan', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should return empty plan when no legacy sources', () => {
    const paths = resolveWorkspacePaths(tempDir);
    const plan = buildMigrationPlan(tempDir, { migrateDocsync: true, migrateSdd: true, migrateReview: true }, paths);
    expect(plan.operations).toEqual([]);
  });

  it('should build migration plan with copy operations', () => {
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const paths = resolveWorkspacePaths(tempDir);
    const plan = buildMigrationPlan(tempDir, { migrateDocsync: true, migrateSdd: false, migrateReview: false }, paths);
    expect(plan.operations.length).toBeGreaterThan(0);
    expect(plan.operations[0].type).toBe('copy');
  });

  it('should detect conflicts when target exists', () => {
    mkdirSync(join(tempDir, '.docsync'), { recursive: true });
    writeFileSync(join(tempDir, '.docsync', 'test.md'), 'content');
    const paths = resolveWorkspacePaths(tempDir);
    mkdirSync(join(paths.harness, 'rules', 'imported', 'docsync'), { recursive: true });
    writeFileSync(join(paths.harness, 'rules', 'imported', 'docsync', 'existing.md'), 'existing');
    const plan = buildMigrationPlan(tempDir, { migrateDocsync: true, migrateSdd: false, migrateReview: false }, paths);
    expect(plan.conflicts.length).toBeGreaterThan(0);
  });
});
