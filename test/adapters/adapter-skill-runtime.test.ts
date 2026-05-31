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
import { buildArtifactPlan, getExpectedRuntimePaths } from '../../src/adapters/artifact-plan.js';
import { computeSourceHash, buildManagedMetadata, renderMetadataComment } from '../../src/adapters/metadata.js';
import { renderClaudeFindingValidatorAgent, renderCodexFindingValidatorToml } from '../../src/adapters/agent-templates.js';
import type { AdapterRegistryEntry, AdapterTool } from '../../src/adapters/types.js';

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

  // TASK-AR-02: shared 目录生成测试
  it('should create shared/skills/harness/ directory structure', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    
    // 验证 shared 目录存在
    const sharedBase = join(tempDir, '.harness/adapters/shared/skills/harness');
    expect(existsSync(sharedBase)).toBe(true);
    
    // 验证 references 子目录
    expect(existsSync(join(sharedBase, 'references'))).toBe(true);
    expect(existsSync(join(sharedBase, 'references/command-contract.md'))).toBe(true);
    expect(existsSync(join(sharedBase, 'references/document-contract.md'))).toBe(true);
    expect(existsSync(join(sharedBase, 'references/agent-orchestration.md'))).toBe(true);
    expect(existsSync(join(sharedBase, 'references/safety.md'))).toBe(true);
    
    // 验证 scripts 子目录
    expect(existsSync(join(sharedBase, 'scripts'))).toBe(true);
    expect(existsSync(join(sharedBase, 'scripts/validate-workspace.mjs'))).toBe(true);
    expect(existsSync(join(sharedBase, 'scripts/run-harness.mjs'))).toBe(true);
    expect(existsSync(join(sharedBase, 'scripts/parse-result.mjs'))).toBe(true);
    
    // 验证 assets 子目录
    expect(existsSync(join(sharedBase, 'assets'))).toBe(true);
    expect(existsSync(join(sharedBase, 'assets/AGENTS.block.md'))).toBe(true);
    expect(existsSync(join(sharedBase, 'assets/CLAUDE.template.md'))).toBe(true);
    expect(existsSync(join(sharedBase, 'assets/review-report.template.md'))).toBe(true);
  });

  it('should include Copilot adapter in registry', () => {
    const entries = createAdapterRegistry();
    const copilotEntries = entries.filter(e => e.tool === 'copilot');
    expect(copilotEntries.length).toBeGreaterThan(0);
    
    // 验证 copilot projectionPath 正确
    const copilotSkill = copilotEntries.find(e => e.sourcePath.includes('SKILL.md'));
    expect(copilotSkill).toBeDefined();
    expect(copilotSkill!.projectionPath).toBe('.github/copilot-instructions.md');
  });

  it('should include Cursor adapter in registry', () => {
    const entries = createAdapterRegistry();
    const cursorEntries = entries.filter(e => e.tool === 'cursor');
    expect(cursorEntries.length).toBeGreaterThan(0);
  });

  it('should generate openai.yaml for Codex', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    
    const openaiYamlPath = join(tempDir, '.harness/adapters/codex/skills/harness/agents/openai.yaml');
    expect(existsSync(openaiYamlPath)).toBe(true);
    
    const content = readFileSync(openaiYamlPath, 'utf-8');
    expect(content).toContain('interface:');
    expect(content).toContain('display_name:');
    expect(content).toContain('policy:');
  });

  it('should generate copilot-instructions.md', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    
    const copilotPath = join(tempDir, '.harness/adapters/copilot/skills/harness/SKILL.md');
    expect(existsSync(copilotPath)).toBe(true);
    
    const content = readFileSync(copilotPath, 'utf-8');
    expect(content).toContain('Harness');
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

  // TASK-AR-01: frontmatter 生成测试
  it('should include Claude frontmatter for claude tool', () => {
    const entries = createAdapterRegistry();
    const claudeEntry = entries.find(e => e.tool === 'claude' && e.sourcePath.includes('SKILL.md'));
    expect(claudeEntry).toBeDefined();
    const rendered = renderProjection(claudeEntry!, 'test content');
    expect(rendered).toContain('---');
    expect(rendered).toContain('name: harness');
    expect(rendered).toContain('description:');
    expect(rendered).toContain('when_to_use:');
    expect(rendered).toContain('allowed-tools:');
  });

  it('should include Codex frontmatter for codex tool', () => {
    const entries = createAdapterRegistry();
    const codexEntry = entries.find(e => e.tool === 'codex' && e.sourcePath.includes('SKILL.md'));
    expect(codexEntry).toBeDefined();
    const rendered = renderProjection(codexEntry!, 'test content');
    expect(rendered).toContain('---');
    expect(rendered).toContain('name: harness');
    expect(rendered).toContain('description:');
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

// ============================================================
// TASK-ADP-01: Skill 源结构合规测试
// ============================================================
describe('TASK-ADP-01: Shared skill source compliance', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('generates SKILL.md for each tool adapter', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    // 每个工具适配器都应生成 SKILL.md
    for (const entry of entries) {
      if (entry.sourcePath.includes('SKILL.md')) {
        const fullPath = join(tempDir, entry.sourcePath);
        expect(existsSync(fullPath)).toBe(true);
      }
    }
  });

  it('generates references/scripts/assets directories in shared tree', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    const base = join(tempDir, '.harness/adapters/shared/skills/harness');
    expect(existsSync(join(base, 'references'))).toBe(true);
    expect(existsSync(join(base, 'scripts'))).toBe(true);
    expect(existsSync(join(base, 'assets'))).toBe(true);
  });

  it('tool SKILL.md content describes harness capabilities', () => {
    const entries = createAdapterRegistry();
    ensureAdapterSources(tempDir, entries);
    // 使用 claude 工具的 SKILL.md 检查内容
    const claudeSkillEntry = entries.find(
      e => e.tool === 'claude' && e.sourcePath.includes('SKILL.md'),
    );
    expect(claudeSkillEntry).toBeDefined();
    const content = readFileSync(join(tempDir, claudeSkillEntry!.sourcePath), 'utf-8');
    // 应包含能力路由或统一入口描述
    expect(content).toMatch(/harness|inspect|sync|develop|review|knowledge/i);
  });
});

// ============================================================
// TASK-ADP-02: 运行时薄投影测试
// ============================================================
describe('TASK-ADP-02: Runtime thin projection', () => {
  let tempDir: string;
  beforeEach(() => { tempDir = createTempProject(); });
  afterEach(() => cleanupTempProject(tempDir));

  it('Claude runtime SKILL.md is thin projection', () => {
    const entries = createAdapterRegistry();
    const claudeEntry = entries.find(
      e => e.tool === 'claude' && e.sourcePath.includes('SKILL.md'),
    );
    expect(claudeEntry).toBeDefined();
    const rendered = renderProjection(claudeEntry!, 'route: harness inspect');
    // 薄投影：不应包含大量 references 内容
    expect(rendered.length).toBeLessThan(5000);
    // 必须包含 managed marker
    expect(rendered).toContain(MANAGED_MARKER);
    // 必须包含 repair 指针
    expect(rendered).toContain('harness config --repair-adapters');
  });

  it('Codex runtime SKILL.md is thin projection', () => {
    const entries = createAdapterRegistry();
    const codexEntry = entries.find(
      e => e.tool === 'codex' && e.sourcePath.includes('SKILL.md'),
    );
    expect(codexEntry).toBeDefined();
    const rendered = renderProjection(codexEntry!, 'route: harness inspect');
    expect(rendered.length).toBeLessThan(5000);
    expect(rendered).toContain(MANAGED_MARKER);
  });

  it('Codex runtime not written when codex is unselected', () => {
    const entries = createAdapterRegistry();
    const plan = buildArtifactPlan(['claude'], entries);
    const skipped = plan.filter(p => p.kind === 'skipped');
    const codexSkipped = skipped.filter(s => s.tool === 'codex');
    expect(codexSkipped.length).toBeGreaterThan(0);
    for (const s of codexSkipped) {
      expect(s.reason).toBe('tool not selected');
    }
  });

  it('Unselected tool artifact plan records skipped reason', () => {
    const entries = createAdapterRegistry();
    const selectedTools: AdapterTool[] = ['claude'];
    const plan = buildArtifactPlan(selectedTools, entries);
    const skippedItems = plan.filter(p => p.kind === 'skipped');
    expect(skippedItems.length).toBeGreaterThan(0);
    expect(skippedItems.every(s => s.reason === 'tool not selected')).toBe(true);
  });
});

// ============================================================
// TASK-ADP-03: Agent 定义质量测试
// ============================================================
describe('TASK-ADP-03: Agent definition quality', () => {
  it('Claude agent md has required frontmatter', () => {
    const agent = renderClaudeFindingValidatorAgent();
    expect(agent).toContain('---');
    expect(agent).toContain('name: harness-finding-validator');
    expect(agent).toContain('description:');
    expect(agent).toContain('tools:');
    // 职责边界
    expect(agent).toContain('## 职责边界');
    expect(agent).toContain('## 输入格式');
    expect(agent).toContain('## 输出格式');
    expect(agent).toContain('## 禁止事项');
    expect(agent).toContain('## 触发场景');
  });

  it('Codex agent TOML has required fields', () => {
    const toml = renderCodexFindingValidatorToml();
    expect(toml).toContain('[agent]');
    expect(toml).toContain('name = "harness-finding-validator"');
    expect(toml).toContain('model =');
    expect(toml).toContain('effort =');
    expect(toml).toContain('[agent.constraints]');
    expect(toml).toContain('[agent.prompt]');
    expect(toml).toContain('[agent.body]');
  });

  it('Finding validator agent is actionable', () => {
    const agent = renderClaudeFindingValidatorAgent();
    // 必须包含验证证据、文件行号、严重度、置信度
    expect(agent).toMatch(/evidence|证据/i);
    expect(agent).toMatch(/severity|严重度|P0|P1|P2/i);
    expect(agent).toMatch(/confidence|置信度|high|medium|low/i);
    expect(agent).toMatch(/false.?positive|误报/i);
    // 禁止模糊措辞
    expect(agent).toContain('不得跳过验证直接通过');
    expect(agent).toContain('不得在没有文件/行号证据的情况下确认');
  });

  it('Codex finding validator is actionable', () => {
    const toml = renderCodexFindingValidatorToml();
    expect(toml).toMatch(/evidence|证据/i);
    expect(toml).toMatch(/severity|严重度|P0|P1|P2/i);
    expect(toml).toMatch(/confidence|置信度|high|medium|low/i);
    expect(toml).toMatch(/false.?positive|误报/i);
  });

  it('Agent definitions match between Claude and Codex', () => {
    const claudeAgent = renderClaudeFindingValidatorAgent();
    const codexToml = renderCodexFindingValidatorToml();
    // 两者应包含相同的验证器名称
    expect(claudeAgent).toContain('harness-finding-validator');
    expect(codexToml).toContain('harness-finding-validator');
    // 两者都应包含验证职责
    expect(claudeAgent).toMatch(/验证|validate/i);
    expect(codexToml).toMatch(/验证|validate|validator/i);
  });
});

// ============================================================
// TASK-ADP-10: Artifact plan 补充测试
// ============================================================
describe('TASK-ADP-10: Artifact plan', () => {
  it('builds artifact plan with source/runtime/skipped classification', () => {
    const entries = createAdapterRegistry();
    const plan = buildArtifactPlan(['claude'], entries);
    expect(plan.length).toBeGreaterThan(0);
    const kinds = new Set(plan.map(p => p.kind));
    expect(kinds.has('source')).toBe(true);
    expect(kinds.has('runtime')).toBe(true);
    expect(kinds.has('skipped')).toBe(true);
  });

  it('getExpectedRuntimePaths returns correct paths for Claude', () => {
    const entries = createAdapterRegistry();
    const paths = getExpectedRuntimePaths('claude', entries);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some(p => p.includes('.claude'))).toBe(true);
  });

  it('getExpectedRuntimePaths returns correct paths for Codex', () => {
    const entries = createAdapterRegistry();
    const paths = getExpectedRuntimePaths('codex', entries);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some(p => p.includes('.codex') || p.includes('.agents'))).toBe(true);
  });
});

// ============================================================
// Metadata 模块测试
// ============================================================
describe('Metadata module', () => {
  it('computeSourceHash produces consistent output', () => {
    const hash1 = computeSourceHash('test content');
    const hash2 = computeSourceHash('test content');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it('computeSourceHash produces different output for different content', () => {
    const hash1 = computeSourceHash('content A');
    const hash2 = computeSourceHash('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('buildManagedMetadata includes all required fields', () => {
    const meta = buildManagedMetadata('test', 'src/test.md');
    expect(meta.sourceHash).toBeDefined();
    expect(meta.sourcePath).toBe('src/test.md');
    expect(meta.managedMarker).toBeDefined();
    expect(meta.repairCommand).toBeDefined();
    expect(meta.generatedAt).toBeDefined();
  });

  it('renderMetadataComment includes all fields', () => {
    const meta = buildManagedMetadata('test', 'src/test.md');
    const comment = renderMetadataComment(meta);
    expect(comment).toContain('harness-managed');
    expect(comment).toContain(meta.sourcePath);
    expect(comment).toContain(meta.sourceHash);
    expect(comment).toContain(meta.repairCommand);
  });
});
