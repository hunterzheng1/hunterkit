/**
 * Adapter artifact compliance regression tests
 * 覆盖 Claude/Codex 安装产物合规 + unselected tool + drift/repair
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAdapterRegistry, filterByTool } from '../../src/adapters/registry.js';
import { ensureAdapterSources } from '../../src/adapters/source-manager.js';
import { renderProjection, MANAGED_MARKER } from '../../src/adapters/projection-renderer.js';
import { checkAdapterDrift } from '../../src/adapters/drift-detector.js';
import { buildArtifactPlan } from '../../src/adapters/artifact-plan.js';
import { computeSourceHash, buildManagedMetadata } from '../../src/adapters/metadata.js';
import {
  renderClaudeFindingValidatorAgent,
  renderCodexFindingValidatorToml,
} from '../../src/adapters/agent-templates.js';
import type { AdapterTool } from '../../src/adapters/types.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'harness-compliance-'));
}
function cleanupTempProject(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ============================================================
// 安装产物合规 - Claude 全装
// ============================================================
describe('Install artifact compliance - Claude full', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('generates complete source tree for Claude', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);

    const claudeEntries = filterByTool(entries, ['claude']);
    expect(claudeEntries.length).toBeGreaterThan(0);

    for (const entry of claudeEntries) {
      expect(existsSync(join(tempDir, entry.sourcePath))).toBe(true);
    }
  });

  it('shared skill source has references/scripts/assets', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);

    const base = join(tempDir, '.harness/adapters/shared/skills/harness');
    expect(existsSync(join(base, 'references'))).toBe(true);
    expect(existsSync(join(base, 'scripts'))).toBe(true);
    expect(existsSync(join(base, 'assets'))).toBe(true);
  });

  it('Claude runtime SKILL.md has managed marker and repair command', () => {
    const entries = createAdapterRegistry();
    const claudeEntry = entries.find(
      e => e.tool === 'claude' && e.sourcePath.includes('SKILL.md'),
    );
    expect(claudeEntry).toBeDefined();
    const rendered = renderProjection(claudeEntry!, 'test content');
    expect(rendered).toContain(MANAGED_MARKER);
    expect(rendered).toContain('harness config --repair-adapters');
    expect(rendered).toContain(claudeEntry!.sourcePath);
  });

  it('Claude agent definition has all required sections', () => {
    const agent = renderClaudeFindingValidatorAgent();
    expect(agent).toContain('---');
    expect(agent).toContain('name: harness-finding-validator');
    expect(agent).toContain('## 职责边界');
    expect(agent).toContain('## 禁止事项');
    expect(agent).toContain('## 触发场景');
  });
});

// ============================================================
// 安装产物合规 - Codex 全装
// ============================================================
describe('Install artifact compliance - Codex full', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('generates complete source tree for Codex', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);

    const codexEntries = filterByTool(entries, ['codex']);
    expect(codexEntries.length).toBeGreaterThan(0);

    for (const entry of codexEntries) {
      expect(existsSync(join(tempDir, entry.sourcePath))).toBe(true);
    }
  });

  it('Codex openai.yaml is generated', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);

    const yamlPath = join(tempDir, '.harness/adapters/codex/skills/harness/agents/openai.yaml');
    expect(existsSync(yamlPath)).toBe(true);

    const content = readFileSync(yamlPath, 'utf-8');
    expect(content).toContain('interface:');
    expect(content).toContain('display_name:');
  });

  it('Codex agent TOML has all required sections', () => {
    const toml = renderCodexFindingValidatorToml();
    expect(toml).toContain('[agent]');
    expect(toml).toContain('[agent.constraints]');
    expect(toml).toContain('[agent.prompt]');
    expect(toml).toContain('[agent.body]');
    expect(toml).toContain('name = "harness-finding-validator"');
  });
});

// ============================================================
// Unselected tool 不写 runtime
// ============================================================
describe('Unselected tool - no runtime projection', () => {
  it('Codex runtime entries are skipped when only Claude selected', () => {
    const entries = createAdapterRegistry();
    const plan = buildArtifactPlan(['claude'], entries);

    const codexSkipped = plan.filter(p => p.tool === 'codex' && p.kind === 'skipped');
    expect(codexSkipped.length).toBeGreaterThan(0);
    for (const s of codexSkipped) {
      expect(s.reason).toBe('tool not selected');
    }
  });

  it('Claude runtime entries are skipped when only Codex selected', () => {
    const entries = createAdapterRegistry();
    const plan = buildArtifactPlan(['codex'], entries);

    const claudeSkipped = plan.filter(p => p.tool === 'claude' && p.kind === 'skipped');
    expect(claudeSkipped.length).toBeGreaterThan(0);
  });

  it('only selected tool has runtime entries in plan', () => {
    const entries = createAdapterRegistry();
    const selected: AdapterTool[] = ['claude'];
    const plan = buildArtifactPlan(selected, entries);

    const claudeRuntime = plan.filter(p => p.tool === 'claude' && p.kind === 'runtime');
    expect(claudeRuntime.length).toBeGreaterThan(0);

    // 未选择的工具不应有 runtime 条目
    const unselected = entries
      .map(e => e.tool)
      .filter(t => !selected.includes(t));
    for (const tool of unselected) {
      const runtimeForTool = plan.filter(p => p.tool === tool && p.kind === 'runtime');
      expect(runtimeForTool.length).toBe(0);
    }
  });
});

// ============================================================
// Drift 检测与修复
// ============================================================
describe('Drift detection and repair', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('hash consistency between metadata and drift detector', () => {
    const content = 'test source template content';
    const meta = buildManagedMetadata(content, 'test/SKILL.md');
    const hashFromMetadata = meta.sourceHash;
    const hashFromComputeSourceHash = computeSourceHash(content);

    expect(hashFromMetadata).toBe(hashFromComputeSourceHash);
    expect(hashFromMetadata.length).toBe(16);
  });

  it('drift detector reports missing when source absent', () => {
    const entries = createAdapterRegistry();
    const first = entries[0];
    const status = checkAdapterDrift(tempDir, first);
    expect(status.status).toBe('missing');
  });

  it('drift detector reports conflict for unmanaged projections', () => {
    const entry = createAdapterRegistry()[0];
    mkdirSync(join(tempDir, '.harness/adapters/claude/skills/harness'), { recursive: true });
    writeFileSync(join(tempDir, entry.sourcePath), 'source content');
    mkdirSync(join(tempDir, '.claude/skills/harness'), { recursive: true });
    writeFileSync(join(tempDir, entry.projectionPath), 'user custom unmanaged content');
    const status = checkAdapterDrift(tempDir, entry);
    expect(status.status).toBe('conflict');
  });
});