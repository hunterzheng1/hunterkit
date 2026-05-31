#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();

// Git facts
try {
  const status = execSync('git status --short', { cwd }).toString().trim();
  process.stdout.write(`## Git Status\n${status}\n\n`);
} catch {
  process.stdout.write('## Git Status\nNot a git repository\n\n');
}

try {
  const diff = execSync('git diff --stat', { cwd }).toString().trim();
  process.stdout.write(`## Git Diff Stat\n${diff}\n\n`);
} catch {
  process.stdout.write('## Git Diff Stat\nNo changes\n\n');
}

// Core docs
for (const file of ['README.md', 'AGENTS.md', 'CLAUDE.md']) {
  const path = join(cwd, file);
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n');
    process.stdout.write(`## ${file}\nLines: ${lines.length}\nSections: ${lines.filter(l => l.startsWith('#')).length}\n\n`);
  } else {
    process.stdout.write(`## ${file}\nDoes not exist\n\n`);
  }
}

// package.json
const pkgPath = join(cwd, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  process.stdout.write(`## package.json\nName: ${pkg.name || 'unknown'}\nVersion: ${pkg.version || 'unknown'}\nType: ${pkg.type || 'commonjs'}\n\n`);
}
