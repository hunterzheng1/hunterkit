#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const docsyncDir = join(cwd, '.docsync');

const REQUIRED = [
  { path: 'state/install.json', error: 'ERR_NO_INSTALL: 未完成引导安装。请先运行 npx @hunterzheng/docsync 初始化。' },
  { path: 'config/', error: 'ERR_WORKSPACE_INCOMPLETE: 缺少 .docsync/config/' },
  { path: 'context/', error: 'ERR_WORKSPACE_INCOMPLETE: 缺少 .docsync/context/' },
  { path: 'rules/', error: 'ERR_WORKSPACE_INCOMPLETE: 缺少 .docsync/rules/' },
];

let ok = true;
for (const { path, error } of REQUIRED) {
  if (!existsSync(join(docsyncDir, path))) {
    process.stderr.write(`${error}\n`);
    ok = false;
  }
}

process.exitCode = ok ? 0 : 1;
