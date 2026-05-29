/**
 * Knowledge command handler
 * @module capabilities/knowledge/command
 */

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, extname, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { CommandContext, CliResponse } from '../../cli/types.js';
import { resolveWorkspacePaths } from '../../core/paths.js';
import type { WorkspacePaths } from '../../core/types.js';

const INDEXABLE_EXTS = ['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.py', '.java', '.go'];

// 知识库来源配置
const KNOWLEDGE_SOURCES = [
  { dir: '.harness/develop', kind: 'spec' },
  { dir: '.harness/docs', kind: 'rule' },
  { dir: '.harness/rules', kind: 'rule' },
  { dir: '.harness/reports', kind: 'report' },
  { dir: 'openspec/changes', kind: 'spec' },
];

const LEGACY_KNOWLEDGE_SOURCES = [
  { dir: '.kld-review', kind: 'report' },
  { dir: '.docsync', kind: 'rule' },
];

interface FileInfo {
  sourcePath: string;
  title: string;
  kind: string;
  content: string;
  contentHash: string;
}

interface SearchResult {
  sourcePath: string;
  title: string;
  kind: string;
  snippet: string;
  score: number;
}

/**
 * 解析 knowledge 命令参数
 */
export function parseKnowledgeArgs(args: string[]): {
  index: boolean;
  search: string | null;
  limit: number;
} {
  const index = args.includes('--index');
  let search: string | null = null;
  let limit = 20;

  // 解析 --search
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1 && searchIdx + 1 < args.length) {
    search = args[searchIdx + 1];
    if (search.length === 0 || search.length > 200) {
      throw Object.assign(new Error('Search query must be 1-200 characters'), { code: 2701 });
    }
  }

  // 解析 --limit
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && limitIdx + 1 < args.length) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (limit < 1 || limit > 50) {
      throw Object.assign(new Error('Limit must be 1-50'), { code: 2701 });
    }
  }

  // 校验：--index 和 --search 至少传一个
  if (!index && !search) {
    throw Object.assign(new Error('At least one of --index or --search is required'), { code: 2701 });
  }

  return { index, search, limit };
}

/**
 * 递归扫描目录中的可索引文件
 */
function walkDir(dir: string, callback: (filePath: string) => void): void {
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist') continue;
      const fullPath = join(dir, item.name);
      if (item.isFile()) {
        callback(fullPath);
      } else if (item.isDirectory()) {
        walkDir(fullPath, callback);
      }
    }
  } catch {}
}

/**
 * 扫描知识库来源
 */
export function scanKnowledgeSources(cwd: string): FileInfo[] {
  const files: FileInfo[] = [];
  const allSources = [...KNOWLEDGE_SOURCES, ...LEGACY_KNOWLEDGE_SOURCES];

  for (const source of allSources) {
    const fullDir = resolve(cwd, source.dir);
    if (!existsSync(fullDir)) continue;

    walkDir(fullDir, (filePath) => {
      if (INDEXABLE_EXTS.includes(extname(filePath))) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const rel = relative(cwd, filePath);
          const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
          files.push({
            sourcePath: rel,
            title: basename(filePath),
            kind: source.kind,
            content,
            contentHash: hash,
          });
        } catch {}
      }
    });
  }

  return files;
}

/**
 * JSON 后备存储（当 SQLite 不可用时使用）
 */
interface JsonDocument {
  source_path: string;
  title: string;
  kind: string;
  content: string;
  content_hash: string;
  indexed_at: string;
}

class JsonFallbackDatabase {
  private documents: JsonDocument[] = [];
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (existsSync(dbPath)) {
      try {
        const data = JSON.parse(readFileSync(dbPath, 'utf-8'));
        this.documents = data.documents || [];
      } catch {
        this.documents = [];
      }
    }
  }

  insert(doc: JsonDocument): void {
    this.documents.push(doc);
  }

  update(sourcePath: string, doc: Partial<JsonDocument>): void {
    const idx = this.documents.findIndex(d => d.source_path === sourcePath);
    if (idx !== -1) {
      this.documents[idx] = { ...this.documents[idx], ...doc };
    }
  }

  delete(sourcePath: string): void {
    this.documents = this.documents.filter(d => d.source_path !== sourcePath);
  }

  get(sourcePath: string): JsonDocument | undefined {
    return this.documents.find(d => d.source_path === sourcePath);
  }

  getAll(): JsonDocument[] {
    return this.documents;
  }

  search(query: string, limit: number): SearchResult[] {
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const doc of this.documents) {
      const contentLower = doc.content.toLowerCase();
      const titleLower = doc.title.toLowerCase();

      if (contentLower.includes(queryLower) || titleLower.includes(queryLower)) {
        // 简单的评分算法：基于匹配次数
        const contentMatches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
        const titleMatches = (titleLower.match(new RegExp(queryLower, 'g')) || []).length;
        const score = contentMatches + titleMatches * 2;

        // 生成摘要
        const snippetStart = Math.max(0, contentLower.indexOf(queryLower) - 32);
        const snippetEnd = Math.min(doc.content.length, snippetStart + 64);
        const snippet = '...' + doc.content.slice(snippetStart, snippetEnd) + '...';

        results.push({
          sourcePath: doc.source_path,
          title: doc.title,
          kind: doc.kind,
          snippet,
          score,
        });
      }
    }

    // 按分数降序排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  save(): void {
    const dir = resolve(this.dbPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = { documents: this.documents };
    // 保存到 .sqlite 路径（内容为 JSON 格式），确保 existsSync 检查一致
    const { writeFileSync: wfs } = require('node:fs');
    wfs(this.dbPath, JSON.stringify(data, null, 2));
  }

  close(): void {
    this.save();
  }
}

/**
 * 打开或创建 SQLite 数据库（带 JSON 后备）
 */
function openOrCreateDatabase(dbPath: string): any {
  let Database;
  try {
    Database = require('better-sqlite3');
    const db = new Database(dbPath);

    // 创建 FTS5 虚拟表
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_documents USING fts5(
        source_path UNINDEXED,
        title,
        kind UNINDEXED,
        content,
        content_hash UNINDEXED,
        indexed_at UNINDEXED
      );
    `);

    return db;
  } catch (e: any) {
    // SQLite 不可用，使用 JSON 后备
    console.warn('SQLite FTS5 不可用，使用 JSON 后备存储');
    return new JsonFallbackDatabase(dbPath);
  }
}

/**
 * 执行索引操作（支持 SQLite 和 JSON 后备）
 */
function performIndex(db: any, files: FileInfo[]): number {
  let indexedCount = 0;
  const currentPaths = new Set(files.map(f => f.sourcePath));
  const now = new Date().toISOString();

  // 检查是否是 JSON 后备数据库
  if (db instanceof JsonFallbackDatabase) {
    for (const file of files) {
      const existing = db.get(file.sourcePath);

      if (!existing) {
        // 新文件，插入
        db.insert({
          source_path: file.sourcePath,
          title: file.title,
          kind: file.kind,
          content: file.content,
          content_hash: file.contentHash,
          indexed_at: now,
        });
        indexedCount++;
      } else if (existing.content_hash !== file.contentHash) {
        // 文件已变化，更新
        db.update(file.sourcePath, {
          title: file.title,
          kind: file.kind,
          content: file.content,
          content_hash: file.contentHash,
          indexed_at: now,
        });
        indexedCount++;
      }
    }

    // 删除已移除的文件
    const allDocs = db.getAll();
    for (const doc of allDocs) {
      if (!currentPaths.has(doc.source_path)) {
        db.delete(doc.source_path);
      }
    }
  } else {
    // SQLite 模式
    const insertStmt = db.prepare(`
      INSERT INTO knowledge_documents (source_path, title, kind, content, content_hash, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE knowledge_documents
      SET title = ?, kind = ?, content = ?, content_hash = ?, indexed_at = ?
      WHERE source_path = ?
    `);

    const selectStmt = db.prepare(`
      SELECT content_hash FROM knowledge_documents WHERE source_path = ?
    `);

    const deleteStmt = db.prepare(`
      DELETE FROM knowledge_documents WHERE source_path = ?
    `);

    for (const file of files) {
      const existing = selectStmt.get(file.sourcePath) as any;

      if (!existing) {
        // 新文件，插入
        insertStmt.run(file.sourcePath, file.title, file.kind, file.content, file.contentHash, now);
        indexedCount++;
      } else if (existing.content_hash !== file.contentHash) {
        // 文件已变化，更新
        updateStmt.run(file.title, file.kind, file.content, file.contentHash, now, file.sourcePath);
        indexedCount++;
      }
    }

    // 删除已移除的文件
    const allPathsStmt = db.prepare('SELECT source_path FROM knowledge_documents');
    const allPaths = allPathsStmt.all() as any[];
    for (const row of allPaths) {
      if (!currentPaths.has(row.source_path)) {
        deleteStmt.run(row.source_path);
      }
    }
  }

  return indexedCount;
}

/**
 * 执行搜索操作（支持 SQLite 和 JSON 后备）
 */
function performSearch(db: any, query: string, limit: number): SearchResult[] {
  // 检查是否是 JSON 后备数据库
  if (db instanceof JsonFallbackDatabase) {
    return db.search(query, limit);
  }

  // SQLite 模式
  const stmt = db.prepare(`
    SELECT source_path, title, kind,
           snippet(knowledge_documents, 3, '<b>', '</b>', '...', 64) as snippet,
           rank as score
    FROM knowledge_documents
    WHERE knowledge_documents MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  const results = stmt.all(query, limit) as any[];
  return results.map(row => ({
    sourcePath: row.source_path,
    title: row.title,
    kind: row.kind,
    snippet: row.snippet,
    score: Math.abs(row.score),
  }));
}

/**
 * Run the knowledge command
 */
export async function runKnowledgeCommand(context: CommandContext): Promise<CliResponse> {
  const { cwd, dryRun } = context.globalOptions;
  const paths = resolveWorkspacePaths(cwd);

  // 解析参数
  let options;
  try {
    options = parseKnowledgeArgs((context as any).args || []);
  } catch (err: any) {
    return {
      code: err.code || 2701,
      msg: err.message,
      data: { command: 'knowledge' },
      warnings: [],
    };
  }

  const dbPath = resolve(paths.cache, 'knowledge.sqlite');
  let indexedFiles = 0;
  let results: SearchResult[] = [];

  // 执行索引
  if (options.index) {
    const files = scanKnowledgeSources(cwd);

    if (!dryRun) {
      try {
        // 确保 cache 目录存在
        mkdirSync(paths.cache, { recursive: true });

        const db = openOrCreateDatabase(dbPath);
        indexedFiles = performIndex(db, files);
        db.close();
      } catch (err: any) {
        return {
          code: err.code || 5701,
          msg: err.message,
          data: { command: 'knowledge' },
          warnings: [],
        };
      }
    }
  }

  // 执行搜索
  if (options.search) {
    if (!existsSync(dbPath)) {
      return {
        code: 2702,
        msg: '索引不存在，请先运行 harness knowledge --index',
        data: { command: 'knowledge' },
        warnings: [],
      };
    }

    try {
      const db = openOrCreateDatabase(dbPath);
      results = performSearch(db, options.search, options.limit);
      db.close();
    } catch (err: any) {
      return {
        code: err.code || 5701,
        msg: err.message,
        data: { command: 'knowledge' },
        warnings: [],
      };
    }
  }

  return {
    code: 0,
    msg: 'success',
    data: {
      command: 'knowledge',
      indexPath: relative(cwd, dbPath),
      indexedFiles,
      results,
    },
    warnings: dryRun ? ['Dry-run mode: no index was written'] : [],
  };
}
