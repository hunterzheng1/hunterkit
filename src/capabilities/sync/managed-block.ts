/**
 * Managed block service - upsert, migration, and conflict detection
 * @module capabilities/sync/managed-block
 *
 * Replaces direct string operations in sync command with structured
 * block management that preserves user content and tracks migrations.
 */

/** Canonical Harness managed block markers */
export const MANAGED_BLOCK_START = '<!-- harness:start -->';
export const MANAGED_BLOCK_END = '<!-- harness:end -->';

/** Legacy block marker to detect and migrate */
export const LEGACY_DOCSYNC_START = '<!-- docsync:start -->';
export const LEGACY_DOCSYNC_END = '<!-- docsync:end -->';

/** Legacy harness marker (pre-standardization) */
export const LEGACY_HARNESS_START = '<!-- harness-managed:start -->';
export const LEGACY_HARNESS_END = '<!-- harness-managed:end -->';

/** Migration record */
export interface BlockMigration {
  /** Original block marker */
  fromMarker: string;
  /** Target block marker */
  toMarker: string;
  /** File that was migrated */
  file: string;
  /** Whether user content was preserved */
  preservedUserContent: boolean;
}

/** Block upsert result */
export interface BlockUpsertResult {
  /** Updated file content */
  content: string;
  /** Whether a new block was inserted */
  inserted: boolean;
  /** Whether a legacy block was migrated */
  migrated: boolean;
  /** Migration records */
  migrations: BlockMigration[];
  /** Whether existing user content was preserved outside the block */
  preservedUserContent: boolean;
}

/**
 * Detect if content contains a legacy managed block
 */
export function hasLegacyBlock(content: string): boolean {
  return content.includes(LEGACY_DOCSYNC_START) ||
    content.includes(LEGACY_HARNESS_START);
}

/**
 * Detect if content already has a canonical Harness managed block
 */
export function hasCanonicalBlock(content: string): boolean {
  return content.includes(MANAGED_BLOCK_START);
}

/**
 * Upsert a managed block into existing content
 * Only replaces content between managed markers, preserves everything else
 */
export function upsertManagedBlock(
  existingContent: string,
  newBlockContent: string,
  fileName: string,
): BlockUpsertResult {
  const migrations: BlockMigration[] = [];
  let migrated = false;

  // Check for legacy blocks
  if (hasLegacyBlock(existingContent)) {
    const migration = migrateLegacyBlock(existingContent, fileName);
    existingContent = migration.content;
    migrations.push(...migration.migrations);
    migrated = true;
  }

  let result = '';

  if (hasCanonicalBlock(existingContent)) {
    // Replace existing block
    const startIndex = existingContent.indexOf(MANAGED_BLOCK_START);
    const endIndex = existingContent.indexOf(MANAGED_BLOCK_END);

    if (endIndex > startIndex) {
      const before = existingContent.slice(0, startIndex);
      const after = existingContent.slice(endIndex + MANAGED_BLOCK_END.length);
      result = `${before}${MANAGED_BLOCK_START}\n\n${newBlockContent}\n\n${MANAGED_BLOCK_END}${after}`;

      return {
        content: result,
        inserted: false,
        migrated,
        migrations,
        preservedUserContent: before.trim().length > 0 || after.trim().length > 0,
      };
    }
  }

  // No block found, append at end
  if (existingContent.trim().length > 0) {
    result = `${existingContent}\n\n${MANAGED_BLOCK_START}\n\n${newBlockContent}\n\n${MANAGED_BLOCK_END}\n`;
  } else {
    result = `${MANAGED_BLOCK_START}\n\n${newBlockContent}\n\n${MANAGED_BLOCK_END}\n`;
  }

  return {
    content: result,
    inserted: true,
    migrated,
    migrations,
    preservedUserContent: true,
  };
}

/**
 * Migrate legacy managed blocks to canonical format
 */
export function migrateLegacyBlock(
  content: string,
  fileName: string,
): { content: string; migrations: BlockMigration[] } {
  const migrations: BlockMigration[] = [];

  // Migrate docsync block
  if (content.includes(LEGACY_DOCSYNC_START)) {
    const startIndex = content.indexOf(LEGACY_DOCSYNC_START);
    const endIdx = content.indexOf(LEGACY_DOCSYNC_END);

    if (endIdx > startIndex) {
      // Replace markers but keep content
      const before = content.slice(0, startIndex);
      const blockContent = content.slice(
        startIndex + LEGACY_DOCSYNC_START.length,
        endIdx,
      );
      const after = content.slice(endIdx + LEGACY_DOCSYNC_END.length);

      content = `${before}${MANAGED_BLOCK_START}${blockContent}${MANAGED_BLOCK_END}${after}`;

      migrations.push({
        fromMarker: 'docsync:start',
        toMarker: 'harness:start',
        file: fileName,
        preservedUserContent: true,
      });
    }
  }

  // Migrate legacy harness-managed block
  if (content.includes(LEGACY_HARNESS_START)) {
    content = content.replace(
      new RegExp(LEGACY_HARNESS_START.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
      MANAGED_BLOCK_START,
    );
    content = content.replace(
      new RegExp(LEGACY_HARNESS_END.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
      MANAGED_BLOCK_END,
    );

    migrations.push({
      fromMarker: 'harness-managed:start',
      toMarker: 'harness:start',
      file: fileName,
      preservedUserContent: true,
    });
  }

  return { content, migrations };
}