import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readReadme(): string {
  return readFileSync(resolve('README.md'), 'utf-8');
}

function firstNLines(text: string, n: number): string {
  return text.split('\n').slice(0, n).join('\n');
}

const INTERNAL_NAMES = ['docsync', 'gsd', 'kld-sdd', 'kld-review'];

describe('README 内容验证', () => {
  describe('R01: 首 50 行不含 npm install（用户安装步骤）', () => {
    it('首 50 行不得出现 npm install', () => {
      const head = firstNLines(readReadme(), 50);
      expect(head).not.toMatch(/npm install/);
    });
  });

  describe('R02: 不含内部来源项目名', () => {
    for (const name of INTERNAL_NAMES) {
      it(`不得出现内部来源名: ${name}`, () => {
        const content = readReadme();
        // 使用 \b 词边界，不误伤正常单词
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        expect(content).not.toMatch(regex);
      });
    }
  });

  describe('R03: 章节顺序正确', () => {
    it('"使用方式（目标项目用户）" 在第一', () => {
      const content = readReadme();
      const userGuideIndex = content.indexOf('使用方式（目标项目用户）');
      const devGuideIndex = content.indexOf('开发（本仓库贡献者）');
      expect(userGuideIndex).toBeGreaterThan(-1);
      expect(devGuideIndex).toBeGreaterThan(-1);
      expect(userGuideIndex).toBeLessThan(devGuideIndex);
    });

    it('"开发（本仓库贡献者）" 章节独立', () => {
      const content = readReadme();
      expect(content).toContain('开发（本仓库贡献者）');
    });
  });

  describe('R04: 命令表格含状态列', () => {
    it('命令表格包含"状态"列头', () => {
      const content = readReadme();

      // 找到命令表格并验证"状态"列
      // 表格格式: | 命令 | 描述 | 需要工作空间初始化 | 状态 |
      const hasStatusColumn = content.includes('| 状态 |') || content.includes('|状态|');
      expect(hasStatusColumn).toBe(true);
    });

    it('能力状态有标注（✅/🔶/⏳）', () => {
      const content = readReadme();
      // 至少包含一种状态标记
      const hasStatusMarkers = ['✅', '🔶', '⏳'].some(marker => content.includes(marker));
      expect(hasStatusMarkers).toBe(true);
    });
  });
});