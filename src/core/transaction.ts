/**
 * Transaction write system - dry-run, backup, atomic write, rollback
 * @module core/transaction
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Transaction, TransactionRecord, TransactionOperation, TransactionStatus } from './types.js';
import { isPathWithinRoot } from './paths.js';

/**
 * Begin a new transaction
 */
export function beginTransaction(cwd: string, dryRun = false): Transaction {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return {
    id: `txn_${timestamp}_${random}`,
    status: 'pending',
    cwd,
    dryRun,
    operations: [],
  };
}

/**
 * Stage a write operation in the transaction
 */
export function stageWrite(tx: Transaction, path: string, content: string | Buffer): void {
  const normalizedPath = resolve(path);

  // Path boundary check
  if (!isPathWithinRoot(normalizedPath, tx.cwd)) {
    throw new Error(`Write path outside project root: ${normalizedPath}`);
  }

  const operation: TransactionOperation = {
    type: existsSync(normalizedPath) ? 'write_file' : 'create_file',
    path: normalizedPath,
    content,
  };

  // If file exists, record backup path
  if (existsSync(normalizedPath)) {
    operation.backupPath = `${normalizedPath}.bak_${tx.id}`;
  }

  tx.operations.push(operation);
}

/**
 * Stage a directory creation operation
 */
export function stageMkdir(tx: Transaction, path: string): void {
  const normalizedPath = resolve(path);
  if (!isPathWithinRoot(normalizedPath, tx.cwd)) {
    throw new Error(`Directory path outside project root: ${normalizedPath}`);
  }
  tx.operations.push({ type: 'create_dir', path: normalizedPath });
}

/**
 * Commit all staged operations
 */
export function commitTransaction(tx: Transaction): TransactionRecord {
  if (tx.status !== 'pending') {
    throw new Error(`Cannot commit transaction in status: ${tx.status}`);
  }

  // Dry-run: return planned operations without executing
  if (tx.dryRun) {
    tx.status = 'committed';
    return getTransactionRecord(tx);
  }

  const executed: TransactionOperation[] = [];

  try {
    for (const op of tx.operations) {
      switch (op.type) {
        case 'create_dir':
          if (!existsSync(op.path)) {
            mkdirSync(op.path, { recursive: true });
          }
          break;

        case 'create_file':
        case 'write_file':
          // Ensure parent directory exists
          mkdirSync(dirname(op.path), { recursive: true });

          // Backup existing file
          if (op.backupPath && existsSync(op.path)) {
            copyFileSync(op.path, op.backupPath);
          }

          // Write new content
          writeFileSync(op.path, op.content!);
          break;
      }
      executed.push(op);
    }

    tx.status = 'committed';
  } catch (error) {
    // Rollback on failure
    tx.status = 'failed';
    try {
      rollbackOperations(executed, tx.cwd);
    } catch {
      // Rollback failure - preserve backup paths for manual recovery
    }
    throw error;
  }

  return getTransactionRecord(tx);
}

/**
 * Rollback executed operations (reverse order)
 */
export function rollbackTransaction(tx: Transaction): TransactionRecord {
  if (tx.status === 'committed') {
    throw new Error('Cannot rollback a committed transaction');
  }

  try {
    rollbackOperations(tx.operations.filter(op => op.type !== 'create_dir'), tx.cwd);
    tx.status = 'rolled_back';
  } catch {
    tx.status = 'failed';
  }

  return getTransactionRecord(tx);
}

/**
 * Get transaction record
 */
export function getTransactionRecord(tx: Transaction): TransactionRecord {
  return {
    id: tx.id,
    status: tx.status,
    cwd: tx.cwd,
    operations: tx.operations,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Internal: rollback operations in reverse order
 */
function rollbackOperations(operations: TransactionOperation[], _cwd: string): void {
  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];

    if (op.type === 'create_file') {
      // Remove newly created file
      if (existsSync(op.path)) {
        unlinkSync(op.path);
      }
    } else if (op.type === 'write_file' && op.backupPath) {
      // Restore from backup
      if (existsSync(op.backupPath)) {
        copyFileSync(op.backupPath, op.path);
        unlinkSync(op.backupPath);
      }
    }
  }
}
