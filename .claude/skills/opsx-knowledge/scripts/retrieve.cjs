#!/usr/bin/env node
/**
 * RAGFlow 知识库检索 CLI（SDD opsx-knowledge 专用）
 *
 * 用法:
 *   node scripts/retrieve.cjs --question="什么是物料凭证" --module=mm
 *   node scripts/retrieve.cjs --question="成本中心是什么" --module=co
 *   node scripts/retrieve.cjs --question="..." --module=auto
 *
 * 失败时 exit 0 并返回 ok:false，不阻断 SDD 主流程。
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv.slice(2)) {
    if (!item.startsWith('--')) continue;
    const eq = item.indexOf('=');
    if (eq === -1) {
      args[item.slice(2)] = true;
    } else {
      args[item.slice(2, eq)] = item.slice(eq + 1);
    }
  }
  return args;
}

function scoreModule(question, moduleConfig) {
  const text = String(question || '').toLowerCase();
  let score = 0;
  for (const keyword of moduleConfig.keywords || []) {
    if (text.includes(String(keyword).toLowerCase())) {
      score += 1;
    }
  }
  return score;
}

function resolveModules(question, moduleArg, config) {
  const modules = config.modules || {};
  if (moduleArg && moduleArg !== 'auto' && modules[moduleArg]) {
    return [moduleArg];
  }

  const ranked = Object.entries(modules)
    .map(([key, value]) => ({ key, score: scoreModule(question, value) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return [];
  }

  const topScore = ranked[0].score;
  return ranked.filter(item => item.score === topScore).map(item => item.key);
}

function postRetrieval(config, question, datasetIds) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL('/api/v1/retrieval', config.baseUrl);
    const payload = JSON.stringify({
      question,
      dataset_ids: datasetIds
    });

    const req = http.request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port || 80,
        path: endpoint.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${config.apiKey}`
        },
        timeout: config.timeoutMs || 8000
      },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${config.timeoutMs || 8000}ms`));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function normalizeChunks(response) {
  const chunks = response?.data?.chunks || response?.chunks || [];
  return chunks.map((chunk, index) => ({
    index: index + 1,
    content: chunk.content || chunk.text || '',
    document_name: chunk.document_name || chunk.doc_name || chunk.document_id || '',
    similarity: chunk.similarity ?? chunk.score ?? null
  }));
}

function failOutput(error, extra = {}) {
  return {
    ok: false,
    advisory: true,
    error: String(error?.message || error),
    chunks: [],
    ...extra
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const question = String(args.question || '').trim();
  const moduleArg = String(args.module || 'auto').trim().toLowerCase();

  if (!question) {
    console.log(JSON.stringify(failOutput(new Error('Missing required --question=')), null, 2));
    process.exit(0);
    return;
  }

  let config;
  try {
    config = readConfig();
  } catch (error) {
    console.log(JSON.stringify(failOutput(error)), null, 2);
    process.exit(0);
    return;
  }

  const selectedModules = resolveModules(question, moduleArg, config);
  if (selectedModules.length === 0) {
    console.log(JSON.stringify({
      ok: false,
      advisory: true,
      skipped: true,
      reason: 'No matching module for question; specify --module=mm or --module=co',
      question,
      chunks: []
    }, null, 2));
    process.exit(0);
    return;
  }

  const datasetIds = selectedModules.map(key => config.modules[key].datasetId);
  const moduleLabels = selectedModules.map(key => config.modules[key].label);

  try {
    const response = await postRetrieval(config, question, datasetIds);
    const chunks = normalizeChunks(response);
    console.log(JSON.stringify({
      ok: true,
      advisory: true,
      question,
      modules: selectedModules,
      module_labels: moduleLabels,
      dataset_ids: datasetIds,
      chunk_count: chunks.length,
      chunks
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.log(JSON.stringify(failOutput(error, {
      question,
      modules: selectedModules,
      module_labels: moduleLabels,
      dataset_ids: datasetIds
    }), null, 2));
    process.exit(0);
  }
}

main();
