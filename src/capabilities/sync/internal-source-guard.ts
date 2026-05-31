/**
 * Internal source name guard - detect legacy source names in user-visible docs
 * @module capabilities/sync/internal-source-guard
 *
 * Scans user-facing documents for legacy internal source command names
 * (DocSync, GSD, kld-sdd, kld-review) that should not appear in daily UX.
 */

/** Internal source names that should not appear in daily UX */
export const INTERNAL_SOURCE_NAMES = [
  { name: 'docsync', context: 'only in internal/migration explanation' },
  { name: '/docsync:init', context: 'only in internal/migration explanation' },
  { name: '/docsync:sync', context: 'only in internal/migration explanation' },
  { name: 'gsd', context: 'only in internal/migration explanation' },
  { name: 'kld-sdd', context: 'only in internal/migration explanation' },
  { name: 'kld-review', context: 'only in internal/migration explanation' },
];

/** Exposure finding */
export interface NameExposure {
  /** The internal name found */
  name: string;
  /** File where it was found */
  file: string;
  /** Line content (trimmed) */
  line: string;
  /** Whether this is in a migration/explanation context (allowed) */
  inAllowedContext: boolean;
}

/** Scan result */
export interface ScanResult {
  /** All exposures found */
  exposures: NameExposure[];
  /** Exposures in disallowed contexts */
  disallowedExposures: NameExposure[];
  /** Whether any disallowed exposures exist */
  hasDisallowed: boolean;
}

/** Sections where internal names are allowed */
const ALLOWED_SECTIONS = [
  '内部来源',
  'migration',
  '迁移说明',
  '开发者说明',
  'internal source',
];

/**
 * Scan a document for internal source name exposures
 * @param content - document content
 * @param fileName - file name for reporting
 * @returns scan result
 */
export function scanForInternalNames(content: string, fileName: string): ScanResult {
  const exposures: NameExposure[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip code blocks
    if (trimmed.startsWith('```')) continue;
    // Skip YAML frontmatter
    if (trimmed === '---') continue;

    for (const internal of INTERNAL_SOURCE_NAMES) {
      if (trimmed.toLowerCase().includes(internal.name.toLowerCase())) {
        const inAllowedContext = ALLOWED_SECTIONS.some(section =>
          trimmed.toLowerCase().includes(section.toLowerCase()) ||
          content.slice(0, content.indexOf(line)).toLowerCase().includes(section.toLowerCase()),
        );

        exposures.push({
          name: internal.name,
          file: fileName,
          line: trimmed,
          inAllowedContext,
        });
      }
    }
  }

  const disallowedExposures = exposures.filter(e => !e.inAllowedContext);

  return {
    exposures,
    disallowedExposures,
    hasDisallowed: disallowedExposures.length > 0,
  };
}