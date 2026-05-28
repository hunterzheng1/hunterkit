/**
 * Knowledge capability types
 * @module capabilities/knowledge/types
 */

export interface KnowledgeIndex {
  schemaVersion: number;
  generatedAt: string;
  entries: KnowledgeEntry[];
}

export interface KnowledgeEntry {
  id: string;
  path: string;
  type: 'document' | 'code' | 'config' | 'fact';
  title: string;
  tags: string[];
  contentHash: string;
  lastModified: string;
}

export interface KnowledgeSearchResult {
  query: string;
  matches: Array<{
    entry: KnowledgeEntry;
    score: number;
    snippet: string;
  }>;
}
