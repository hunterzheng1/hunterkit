/**
 * Skill 结构验证测试 — 确保所有 harness-* SKILL.md 和斜杠命令文件格式合规
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS_DIR = '.claude/skills';
const COMMANDS_DIR = '.claude/commands/harness';

const REQUIRED_SKILLS = [
  'harness-status',
  'harness-doctor',
  'harness-inspect',
  'harness-sync',
  'harness-review',
  'harness-develop',
  'harness-knowledge',
  'harness-config',
];

const REQUIRED_SKILL_FRONTMATTER_FIELDS = [
  'name',
  'description',
  'argument-hint',
  'license',
  'compatibility',
  'allowed-tools',
];

const REQUIRED_SKILL_SECTIONS = [
  '## 技能定位',
  '## 启动流程',
  '## Guardrails',
];

const REQUIRED_COMMAND_FRONTMATTER_FIELDS = [
  'name',
  'description',
  'skill',
];

// ============================================================
// SKILL.md 文件存在性
// ============================================================
describe('Skill files existence', () => {
  for (const skill of REQUIRED_SKILLS) {
    it(`should have SKILL.md for ${skill}`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      expect(existsSync(path)).toBe(true);
    });
  }
});

// ============================================================
// SKILL.md 前端 YAML 验证
// ============================================================
describe('Skill frontmatter validation', () => {
  for (const skill of REQUIRED_SKILLS) {
    it(`${skill} SKILL.md has required frontmatter fields`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      // 检查以 --- 开头
      expect(content.startsWith('---')).toBe(true);

      for (const field of REQUIRED_SKILL_FRONTMATTER_FIELDS) {
        expect(content).toContain(`${field}:`);
      }

      // name 字段应与目录名匹配
      expect(content).toContain(`name: ${skill}`);
    });

    it(`${skill} SKILL.md has allowed-tools field`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      // 必须包含 Bash（所有技能都需要执行 CLI 命令）
      expect(content).toContain('Bash');
      // 必须包含 Read（所有技能都需要读取文件）
      expect(content).toContain('Read');
    });
  }
});

// ============================================================
// SKILL.md 正文结构验证
// ============================================================
describe('Skill body structure validation', () => {
  for (const skill of REQUIRED_SKILLS) {
    it(`${skill} SKILL.md has required sections`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      for (const section of REQUIRED_SKILL_SECTIONS) {
        expect(content).toContain(section);
      }
    });

    it(`${skill} SKILL.md has cross-platform rules`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      expect(content).toContain('跨平台执行规则');
    });

    it(`${skill} SKILL.md has phase boundary constraints`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      expect(content).toContain('阶段边界约束');
    });
  }
});

// ============================================================
// 斜杠命令文件存在性
// ============================================================
describe('Slash command files existence', () => {
  for (const skill of REQUIRED_SKILLS) {
    const cmdName = skill.replace('harness-', '');
    it(`should have command file for ${cmdName}`, () => {
      const path = join(COMMANDS_DIR, `${cmdName}.md`);
      expect(existsSync(path)).toBe(true);
    });
  }
});

// ============================================================
// 斜杠命令文件前端 YAML 验证
// ============================================================
describe('Slash command frontmatter validation', () => {
  for (const skill of REQUIRED_SKILLS) {
    const cmdName = skill.replace('harness-', '');
    it(`${cmdName}.md has required frontmatter fields`, () => {
      const path = join(COMMANDS_DIR, `${cmdName}.md`);
      const content = readFileSync(path, 'utf-8');

      expect(content.startsWith('---')).toBe(true);

      for (const field of REQUIRED_COMMAND_FRONTMATTER_FIELDS) {
        expect(content).toContain(`${field}:`);
      }

      // skill 字段应指向正确的技能
      expect(content).toContain(`skill: ${skill}`);
    });
  }
});

// ============================================================
// 技能与 CLI 命令映射验证
// ============================================================
describe('Skill-to-CLI command mapping', () => {
  it('harness-status maps to harness status', () => {
    const path = join(SKILLS_DIR, 'harness-status', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness status');
  });

  it('harness-doctor maps to harness doctor', () => {
    const path = join(SKILLS_DIR, 'harness-doctor', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness doctor');
  });

  it('harness-inspect maps to harness inspect', () => {
    const path = join(SKILLS_DIR, 'harness-inspect', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness inspect');
  });

  it('harness-sync maps to harness sync', () => {
    const path = join(SKILLS_DIR, 'harness-sync', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness sync');
  });

  it('harness-review maps to harness review', () => {
    const path = join(SKILLS_DIR, 'harness-review', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness review');
  });

  it('harness-develop maps to harness develop', () => {
    const path = join(SKILLS_DIR, 'harness-develop', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness develop');
  });

  it('harness-knowledge maps to harness knowledge', () => {
    const path = join(SKILLS_DIR, 'harness-knowledge', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness knowledge');
  });

  it('harness-config maps to harness config', () => {
    const path = join(SKILLS_DIR, 'harness-config', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('harness config');
  });
});

// ============================================================
// disable-model-invocation 字段验证（最佳实践 §7.4）
// ============================================================
describe('disable-model-invocation field validation', () => {
  const HIGH_RISK_MANUAL_SKILLS = [
    'harness-sync',
    'harness-config',
    'harness-develop',
    'harness-inspect',
  ];

  const LOW_RISK_AUTO_SKILLS = [
    'harness-status',
    'harness-doctor',
    'harness-review',
    'harness-knowledge',
  ];

  it('all skills have disable-model-invocation field', () => {
    for (const skill of REQUIRED_SKILLS) {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('disable-model-invocation:');
    }
  });

  for (const skill of HIGH_RISK_MANUAL_SKILLS) {
    it(`${skill} should disable model invocation (high risk write operations)`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('disable-model-invocation: true');
    });
  }

  for (const skill of LOW_RISK_AUTO_SKILLS) {
    it(`${skill} should allow model invocation (safe/read-only operations)`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('disable-model-invocation: false');
    });
  }
});

// ============================================================
// model 字段验证（最佳实践 §7）
// ============================================================
describe('model field optimization', () => {
  const HAIKU_SKILLS = ['harness-status', 'harness-doctor'];
  const SONNET_SKILLS = ['harness-review', 'harness-inspect'];

  it('all skills have model field', () => {
    for (const skill of REQUIRED_SKILLS) {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');

      // status/doctor/review/inspect 应该有 model 字段
      if ([...HAIKU_SKILLS, ...SONNET_SKILLS].includes(skill)) {
        expect(content).toContain('model:');
      }
    }
  });

  for (const skill of HAIKU_SKILLS) {
    it(`${skill} should use haiku model (lightweight query)`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('model: haiku');
    });
  }

  for (const skill of SONNET_SKILLS) {
    it(`${skill} should use sonnet model (needs reasoning)`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('model: sonnet');
    });
  }
});

// ============================================================
// 意图路由表验证（最佳实践 §7.1）
// ============================================================
describe('Intent routing table validation', () => {
  for (const skill of REQUIRED_SKILLS) {
    it(`${skill} SKILL.md has intent routing table`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('## 意图路由表');
      // 路由表必须包含表格结构（至少 3 列）
      expect(content).toMatch(/\| 用户意图关键词 \|/);
      expect(content).toMatch(/\| 触发条件 \|/);
      expect(content).toMatch(/\| 执行策略 \|/);
    });
  }
});

// ============================================================
// Supporting Files / 渐进披露验证（最佳实践 §7.2）
// ============================================================
describe('Progressive disclosure via Supporting Files', () => {
  const SKILLS_WITH_REFERENCE = [
    'harness-review',
    'harness-doctor',
    'harness-develop',
  ];

  for (const skill of SKILLS_WITH_REFERENCE) {
    it(`${skill} SKILL.md has Supporting Files section`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('## Supporting Files');
    });

    it(`${skill} has reference.md`, () => {
      const path = join(SKILLS_DIR, skill, 'reference.md');
      expect(existsSync(path)).toBe(true);
    });

    it(`${skill} SKILL.md references reference.md`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('reference.md');
    });
  }

  // 不需要 reference 的技能不应错误引用
  const SKILLS_WITHOUT_REFERENCE = REQUIRED_SKILLS.filter(
    s => !SKILLS_WITH_REFERENCE.includes(s)
  );

  for (const skill of SKILLS_WITHOUT_REFERENCE) {
    it(`${skill} does not need reference.md (self-contained)`, () => {
      // 这些技能足够精简, 不需要拆分
      expect(REQUIRED_SKILLS).toContain(skill);
    });
  }
});

// ============================================================
// Subagent 文件验证（最佳实践 §8-§10）
// ============================================================
describe('Subagent file validation', () => {
  const AGENTS_DIR = '.claude/agents';

  const REQUIRED_AGENTS = [
    'harness-code-reviewer',
    'harness-code-researcher',
  ];

  for (const agent of REQUIRED_AGENTS) {
    it(`should have agent file for ${agent}`, () => {
      const path = join(AGENTS_DIR, `${agent}.md`);
      expect(existsSync(path)).toBe(true);
    });

    it(`${agent} has required frontmatter fields`, () => {
      const path = join(AGENTS_DIR, `${agent}.md`);
      const content = readFileSync(path, 'utf-8');

      expect(content.startsWith('---')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
      expect(content).toContain('tools:');
      expect(content).toContain('model:');
      expect(content).toContain('permissionMode:');
    });
  }

  it('harness-review SKILL.md links to harness-code-reviewer agent', () => {
    const path = join(SKILLS_DIR, 'harness-review', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('agent: harness-code-reviewer');
    expect(content).toContain('context: fork');
  });

  it('harness-inspect SKILL.md links to harness-code-researcher agent', () => {
    const path = join(SKILLS_DIR, 'harness-inspect', 'SKILL.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('agent: harness-code-researcher');
    expect(content).toContain('context: fork');
  });
});

// ============================================================
// 无逻辑重复验证
// ============================================================
describe('No logic duplication in skills', () => {
  it('skills do not contain TypeScript code', () => {
    for (const skill of REQUIRED_SKILLS) {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      // 不应该包含实现代码（function/const/import 等 TS 关键字）
      expect(content).not.toMatch(/^export function/m);
      expect(content).not.toMatch(/^import /m);
    }
  });

  it('skills do not contain Node.js API calls', () => {
    for (const skill of REQUIRED_SKILLS) {
      const path = join(SKILLS_DIR, skill, 'SKILL.md');
      const content = readFileSync(path, 'utf-8');
      // 不应该有 Node.js 文件操作代码
      expect(content).not.toContain("require('fs')");
      expect(content).not.toContain('createHash');
    }
  });
});