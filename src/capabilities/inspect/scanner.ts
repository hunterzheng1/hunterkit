/**
 * Project scanner - scans project structure and generates facts
 * @module capabilities/inspect/scanner
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import type { RepoMap, BuildFileFact, DocumentFact, AgentFileFact, CiFact, ModuleFact, InspectScope } from './types.js';

const BUILD_FILES = ['package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Cargo.toml', 'go.mod', 'Makefile'];
const DOC_PATTERNS = ['README', 'AGENTS', 'CLAUDE', 'CODEX', 'CONTRIBUTING', 'CHANGELOG'];
const AGENT_DIRS = ['.claude', '.agents', '.codex', '.cursor', '.github/copilot'];
const CI_PATTERNS = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci'];

function scanDir(dir: string, depth = 0, maxDepth = 3): string[] {
  if (depth > maxDepth || !existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.harness') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isFile()) results.push(fullPath);
      else if (entry.isDirectory()) results.push(...scanDir(fullPath, depth + 1, maxDepth));
    }
  } catch {}
  return results;
}

/**
 * Scan project and generate repo map
 */
export function scanProject(root: string, scope: InspectScope): RepoMap {
  const scanRoot = scope.path ? resolve(root, scope.path) : root;

  // 路径校验：不存在 → 2301
  if (scope.path && !existsSync(scanRoot)) {
    throw Object.assign(new Error(`Path does not exist: ${scope.path}`), { code: 2301 });
  }

  // 路径校验：越界 → 2302
  if (scope.path) {
    const rel = relative(root, scanRoot);
    if (rel.startsWith('..') || resolve(scanRoot) === resolve(root)) {
      // 允许 scanRoot === root（--path .）
      if (rel.startsWith('..')) {
        throw Object.assign(new Error(`Path is outside project root: ${scope.path}`), { code: 2302 });
      }
    }
  }

  const files = scanDir(scanRoot);
  const languages = new Set<string>();
  const packageManagers: string[] = [];
  const buildFiles: BuildFileFact[] = [];
  const docs: DocumentFact[] = [];
  const agentFiles: AgentFileFact[] = [];
  const ci: CiFact[] = [];
  const modules: ModuleFact[] = [];

  const extToLang: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.java': 'Java', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby',
    '.cs': 'C#', '.cpp': 'C++', '.c': 'C', '.md': 'Markdown', '.yaml': 'YAML', '.yml': 'YAML',
    '.json': 'JSON', '.html': 'HTML', '.css': 'CSS',
  };

  for (const file of files) {
    const rel = relative(root, file);
    const ext = extname(file);
    const basename = rel.split('/').pop() || '';

    // Language detection
    if (extToLang[ext]) languages.add(extToLang[ext]);

    // Build files
    if (BUILD_FILES.includes(basename)) {
      buildFiles.push({ path: rel, type: basename });
      if (basename === 'package.json') packageManagers.push('npm');
    }

    // Documents
    if (DOC_PATTERNS.some(p => basename.toUpperCase().startsWith(p)) && ext === '.md') {
      try {
        const stat = statSync(file);
        docs.push({ path: rel, kind: basename.replace('.md', '').toLowerCase(), size: stat.size });
      } catch {}
    }

    // Agent files
    for (const agentDir of AGENT_DIRS) {
      if (rel.startsWith(agentDir + '/') || rel.startsWith(agentDir.replace('.', '') + '/')) {
        agentFiles.push({ path: rel, tool: agentDir.replace('.', ''), type: ext || 'file' });
      }
    }

    // CI files
    for (const ciPattern of CI_PATTERNS) {
      if (rel.startsWith(ciPattern)) {
        ci.push({ path: rel, provider: ciPattern.split('/')[0].replace('.', '') });
      }
    }
  }

  return {
    schemaVersion: 1,
    root,
    generatedAt: new Date().toISOString(),
    languages: Array.from(languages).sort(),
    packageManagers: [...new Set(packageManagers)],
    buildFiles,
    docs,
    agentFiles,
    ci,
    modules,
  };
}

/**
 * Generate module map markdown from repo map
 */
export function generateModuleMap(repoMap: RepoMap): string {
  const lines = ['# Module Map', '', `Generated: ${repoMap.generatedAt}`, ''];
  lines.push(`## Languages: ${repoMap.languages.join(', ') || 'none detected'}`);
  lines.push('');
  if (repoMap.buildFiles.length > 0) {
    lines.push('## Build Files');
    for (const bf of repoMap.buildFiles) lines.push(`- ${bf.path} (${bf.type})`);
    lines.push('');
  }
  if (repoMap.docs.length > 0) {
    lines.push('## Documents');
    for (const doc of repoMap.docs) lines.push(`- ${doc.path} (${doc.kind}, ${doc.size} bytes)`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Generate rules markdown from repo map
 */
export function generateRules(repoMap: RepoMap): string {
  const lines = ['# Generated Rules', '', `Generated: ${repoMap.generatedAt}`, ''];
  if (repoMap.languages.includes('TypeScript')) {
    lines.push('## TypeScript Rules');
    lines.push('- Use ESM imports/exports');
    lines.push('- Strict mode enabled');
    lines.push('');
  }
  if (repoMap.packageManagers.includes('npm')) {
    lines.push('## Package Management');
    lines.push('- Use npm as package manager');
    lines.push('');
  }
  return lines.join('\n');
}
