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