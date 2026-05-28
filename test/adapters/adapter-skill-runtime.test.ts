/**
 * Unit tests for adapter-skill-runtime module
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAdapterRegistry, filterByTool } from '../../src/adapters/registry.js';
import { ensureAdapterSources, readAdapterSource } from '../../src/adapters/source-manager.js';
import { renderProjection, isManagedProjection, MANAGED_MARKER } from '../../src/adapters/projection-renderer.js';
import { checkAdapterDrift } from '../../src/adapters/drift-detector.js';
import { planProjectionWrites, applyProjectionWrites } from '../../src/adapters/projection-writer.js';
import { beginTransaction, commitTransaction } from '../../src/core/transaction.js';
import type { AdapterRegistryEntry } from '../../src/adapters/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-adapter-test-'));
}
function cleanupTempProject(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

describe('createAdapterRegistry', () => {
  it('should return entries for all platforms', () => {
    const entries = createAdapterRegistry();
    expect(entries.length).toBeGreaterThanOrEqual(4);
    const tools = new Set(entries.map(e => e.tool));
    expect(tools.has('claude')).toBe(true);
    expect(tools.has('codex')).toBe(true);
    expect(tools.has('copilot')).toBe(true);
    expect(tools.has('cursor')).toBe(true);
  });

  it('should filter by tool', () => {
    const entries = createAdapterRegistry();
    const claudeOnly = filterByTool(entries, ['claude']);
    expect(claudeOnly.every(e => e.tool === 'claude')).toBe(true);
  });
});

describe('ensureAdapterSources', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should create source templates in .harness/adapters/', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    for (const entry of entries) {
      expect(existsSync(join(tempDir, entry.sourcePath))).toBe(true);
    }
  });

  it('should not overwrite existing sources', () => {
    const entries = createAdapterRegistry();
    const first = entries[0];
    const fullPath = join(tempDir, first.sourcePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, 'custom content');
    ensureAdapterSources(tempDir, [first]);
    expect(readFileSync(fullPath, 'utf-8')).toBe('custom content');
  });
});

describe('renderProjection', () => {
  it('should include managed marker', () => {
    const entry = createAdapterRegistry()[0];
    const rendered = renderProjection(entry, 'test content');
    expect(rendered).toContain(MANAGED_MARKER);
  });

  it('should include source path reference', () => {
    const entry = createAdapterRegistry()[0];
    const rendered = renderProjection(entry, 'test content');
    expect(rendered).toContain(entry.sourcePath);
  });

  it('should include repair command', () => {
    const entry = createAdapterRegistry()[0];
    const rendered = renderProjection(entry, 'test content');
    expect(rendered).toContain('harness config --repair-adapters');
  });
});

describe('isManagedProjection', () => {
  it('should detect managed content', () => {
    expect(isManagedProjection(`${MANAGED_MARKER}\nsome content`)).toBe(true);
  });

  it('should reject unmanaged content', () => {
    expect(isManagedProjection('some random content')).toBe(false);
  });
});

describe('checkAdapterDrift', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should report missing when source not found', () => {
    const entry: AdapterRegistryEntry = {
      tool: 'claude',
      sourcePath: '.harness/adapters/claude/skills/harness/SKILL.md',
      projectionPath: '.claude/skills/harness/SKILL.md',
      templateContent: 'test',
    };
    const status = checkAdapterDrift(tempDir, entry);
    expect(status.status).toBe('missing');
  });

  it('should report missing when projection not found', () => {
    const entry: AdapterRegistryEntry = {
      tool: 'claude',
      sourcePath: '.harness/adapters/claude/skills/harness/SKILL.md',
      projectionPath: '.claude/skills/harness/SKILL.md',
      templateContent: 'test',
    };
    mkdirSync(join(tempDir, '.harness/adapters/claude/skills/harness'), { recursive: true });
    writeFileSync(join(tempDir, entry.sourcePath), 'source content');
    const status = checkAdapterDrift(tempDir, entry);
    expect(status.status).toBe('missing');
  });

  it('should report conflict when projection is not managed', () => {
    const entry: AdapterRegistryEntry = {
      tool: 'claude',
      sourcePath: '.harness/adapters/claude/skills/harness/SKILL.md',
      projectionPath: '.claude/skills/harness/SKILL.md',
      templateContent: 'test',
    };
    mkdirSync(join(tempDir, '.harness/adapters/claude/skills/harness'), { recursive: true });
    writeFileSync(join(tempDir, entry.sourcePath), 'source content');
    mkdirSync(join(tempDir, '.claude/skills/harness'), { recursive: true });
    writeFileSync(join(tempDir, entry.projectionPath), 'user custom content');
    const status = checkAdapterDrift(tempDir, entry);
    expect(status.status).toBe('conflict');
  });
});

describe('planProjectionWrites', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should plan writes for entries with sources', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    const statuses = planProjectionWrites(tempDir, entries);
    expect(statuses.some(s => s.status === 'planned')).toBe(true);
  });

  it('should detect conflicts for unmanaged projections', () => {
    const entries = [createAdapterRegistry()[0]];
    ensureAdapterSources(tempDir, entries);
    // Create unmanaged projection
    const projPath = join(tempDir, entries[0].projectionPath);
    mkdirSync(join(projPath, '..'), { recursive: true });
    writeFileSync(projPath, 'user content');
    const statuses = planProjectionWrites(tempDir, entries);
    expect(statuses[0].status).toBe('conflict');
  });
});

describe('applyProjectionWrites', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('should write projections via transaction', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    const tx = beginTransaction(tempDir);
    const statuses = applyProjectionWrites(tempDir, entries, tx);
    commitTransaction(tx);
    for (const entry of entries) {
      expect(existsSync(join(tempDir, entry.projectionPath))).toBe(true);
    }
    expect(statuses.every(s => s.status === 'synced')).toBe(true);
  });

  it('should respect dry-run (zero writes)', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    const tx = beginTransaction(tempDir, true);
    applyProjectionWrites(tempDir, entries, tx);
    commitTransaction(tx);
    for (const entry of entries) {
      expect(existsSync(join(tempDir, entry.projectionPath))).toBe(false);
    }
  });
});
