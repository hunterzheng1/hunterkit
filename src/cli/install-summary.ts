/**
 * 安装摘要与 Artifact 分类模块
 * @module cli/install-summary
 *
 * 负责将安装产物分类为 source/runtime/workspace/config/report/skipped，
 * 并构建结构化安装摘要供 human 和 JSON 输出使用。
 */

import type { CliArtifact, ArtifactKind, AiToolId, InstallSummary } from './types.js';

/** 分类规则：路径前缀 → ArtifactKind */
const CLASSIFICATION_RULES: Array<{ prefix: string; kind: ArtifactKind }> = [
  { prefix: '.harness/reports/', kind: 'report' },
  { prefix: '.harness/config/', kind: 'config' },
  { prefix: '.harness/adapters/', kind: 'source' },
  { prefix: '.claude/', kind: 'runtime' },
  { prefix: '.agents/', kind: 'runtime' },
  { prefix: '.codex/', kind: 'runtime' },
  { prefix: '.harness', kind: 'workspace' },
];

/**
 * 根据路径分类 artifact
 * @param artifact - 待分类的 artifact
 * @returns 带有 kind 字段的 artifact 副本
 */
export function classifyArtifact(artifact: CliArtifact): CliArtifact {
  const normalizedPath = artifact.path.replace(/\\/g, '/');

  for (const rule of CLASSIFICATION_RULES) {
    if (normalizedPath.startsWith(rule.prefix)) {
      return { ...artifact, kind: rule.kind };
    }
  }

  return { ...artifact, kind: 'runtime' };
}

/**
 * 批量分类 artifact 列表
 * @param artifacts - 待分类的 artifact 列表
 * @returns 带有 kind 字段的 artifact 列表
 */
export function classifyArtifacts(artifacts: CliArtifact[]): CliArtifact[] {
  return artifacts.map(classifyArtifact);
}

/**
 * 构建安装摘要
 * @param selectedAiTools - 用户选择的 AI 工具名称列表
 * @param selectedCapabilities - 用户选择的能力列表
 * @param hookStrength - Hook 强度
 * @param writeStrategy - 写入策略
 * @param allArtifacts - 全部分类后的 artifact 列表
 * @returns 结构化安装摘要
 */
export function buildInstallSummary(
  selectedAiTools: string[],
  selectedCapabilities: string[],
  hookStrength: string,
  writeStrategy: string,
  allArtifacts: CliArtifact[],
): InstallSummary {
  // 已写入的运行时投影
  const runtimeProjectionsWritten = allArtifacts.filter(
    a => a.kind === 'runtime' && a.reason !== 'tool not selected',
  );

  // 跳过的运行时投影
  const runtimeProjectionsSkipped = allArtifacts.filter(
    a => a.kind === 'skipped' || (a.kind === 'runtime' && a.reason === 'tool not selected'),
  );

  return {
    selectedAiTools,
    selectedCapabilities,
    hookStrength,
    writeStrategy,
    runtimeProjectionsWritten,
    runtimeProjectionsSkipped,
  };
}

/**
 * 为未选择的工具生成 skipped artifact 记录
 * @param toolId - 工具 ID
 * @param toolName - 工具显示名称
 * @param runtimePaths - 该工具通常会生成的运行时路径列表
 * @returns skipped artifact 列表
 */
export function buildSkippedToolArtifacts(
  toolId: AiToolId,
  toolName: string,
  runtimePaths: string[],
): CliArtifact[] {
  return runtimePaths.map(path => ({
    type: 'runtime',
    path,
    description: `${toolName} runtime projection (skipped)`,
    kind: 'skipped' as ArtifactKind,
    tool: toolId,
    reason: 'tool not selected',
  }));
}

/** 默认的 Claude 运行时投影路径 */
export const CLAUDE_RUNTIME_PATHS = [
  '.claude/skills/harness/SKILL.md',
  '.claude/settings.json',
  '.claude/hooks/',
  '.claude/agents/',
];

/** 默认的 Codex 运行时投影路径 */
export const CODEX_RUNTIME_PATHS = [
  '.agents/skills/harness/SKILL.md',
  '.agents/skills/harness/agents/openai.yaml',
  '.codex/hooks.json',
  '.codex/hooks/',
  '.codex/agents/',
];