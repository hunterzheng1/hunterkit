/**
 * Agent definition templates - Claude .md and Codex .toml agent definitions
 * @module adapters/agent-templates
 *
 * Replaces placeholder strings in safety module with structured,
 * verifiable agent definitions that meet guide quality requirements.
 */

/** Claude agent definition frontmatter fields */
export interface ClaudeAgentDef {
  name: string;
  description: string;
  tools: string[];
  responsibilities: string[];
  inputFormat: string;
  outputFormat: string;
  forbidden: string[];
  triggers: string[];
}

/** Codex agent TOML fields */
export interface CodexAgentDef {
  name: string;
  model: string;
  effort: string;
  description: string;
  toolConstraints: string[];
  prompt: string;
  body: string;
}

/**
 * Generate harness-finding-validator agent definition (Claude)
 * Actionable validation agent with evidence, file, line, severity, confidence requirements
 */
export function renderClaudeFindingValidatorAgent(): string {
  const def: ClaudeAgentDef = {
    name: 'harness-finding-validator',
    description: 'Validates code review findings with evidence, severity, and confidence assessment',
    tools: ['Read', 'Grep', 'Glob', 'Bash(npm run test *)'],
    responsibilities: [
      '验证每个 finding 的证据（文件路径、行号、代码片段）',
      '评估严重度（P0 阻断 / P1 重要 / P2 建议）',
      '给出置信度（high/medium/low）和置信度理由',
      '标记误报（false positive）并提供误报原因',
    ],
    inputFormat: 'JSON 格式: { findings: [{ file, line, severity, category, message }] }',
    outputFormat: 'JSON 格式: { validated: [{ file, line, severity, confidence, isFalsePositive, evidence, notes }] }',
    forbidden: [
      '不得跳过验证直接通过',
      '不得在没有文件/行号证据的情况下确认 finding',
      '不得使用 "may"、"might"、"possibly" 等模糊措辞作为唯一判断依据',
    ],
    triggers: [
      '用户触发 review 后自动调用',
      'harness review --validate 显式调用',
    ],
  };

  return renderClaudeAgentMarkdown(def);
}

/**
 * Render Claude agent as Markdown
 */
function renderClaudeAgentMarkdown(def: ClaudeAgentDef): string {
  const lines: string[] = [
    '---',
    `name: ${def.name}`,
    `description: ${def.description}`,
    `tools: ${def.tools.join(', ')}`,
    '---',
    '',
    `# ${def.name}`,
    '',
    `> ${def.description}`,
    '',
    '## 职责边界',
    '',
    ...def.responsibilities.map(r => `- ${r}`),
    '',
    '## 输入格式',
    '',
    `\`\`\`json`,
    def.inputFormat,
    `\`\`\``,
    '',
    '## 输出格式',
    '',
    `\`\`\`json`,
    def.outputFormat,
    `\`\`\``,
    '',
    '## 禁止事项',
    '',
    ...def.forbidden.map(f => `- ❌ ${f}`),
    '',
    '## 触发场景',
    '',
    ...def.triggers.map(t => `- ${t}`),
  ];

  return lines.join('\n');
}

/**
 * Generate harness-finding-validator agent definition (Codex TOML)
 */
export function renderCodexFindingValidatorToml(): string {
  const def: CodexAgentDef = {
    name: 'harness-finding-validator',
    model: 'inherit',
    effort: 'medium',
    description: 'Validates code review findings with evidence, severity, and confidence assessment',
    toolConstraints: ['read', 'search', 'test'],
    prompt: 'You are a code review validator. For each finding, verify evidence (file, line), assess severity, provide confidence level, and mark false positives.',
    body: `## 职责
1. 验证每个 finding 的文件路径和行号
2. 评估严重度: P0(阻断) / P1(重要) / P2(建议)
3. 给出置信度: high / medium / low
4. 标记误报并提供原因

## 输出格式
\`\`\`json
{ "validated": [{ "file": "...", "line": 0, "severity": "P0", "confidence": "high", "isFalsePositive": false, "evidence": "...", "notes": "..." }] }
\`\`\`

## 禁止
- 跳过验证直接通过
- 无证据确认 finding
- 使用模糊措辞作为唯一判断依据`,
  };

  return renderCodexAgentToml(def);
}

/**
 * Render Codex agent as TOML
 */
function renderCodexAgentToml(def: CodexAgentDef): string {
  // Simple TOML format for Codex custom agents
  const lines: string[] = [
    `[agent]`,
    `name = "${def.name}"`,
    `model = "${def.model}"`,
    `effort = "${def.effort}"`,
    `description = "${def.description}"`,
    '',
    `[agent.constraints]`,
    `tools = [${def.toolConstraints.map(t => `"${t}"`).join(', ')}]`,
    '',
    `[agent.prompt]`,
    `text = """`,
    def.prompt,
    `"""`,
    '',
    `[agent.body]`,
    `text = """`,
    def.body,
    `"""`,
  ];

  return lines.join('\n');
}

/**
 * All agent definitions for the finder validator
 */
export const AGENT_DEFINITIONS = {
  findingValidator: {
    claude: renderClaudeFindingValidatorAgent,
    codex: renderCodexFindingValidatorToml,
  },
} as const;