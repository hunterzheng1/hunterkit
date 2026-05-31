/**
 * Skill source manifest - defines shared and tool-specific Skill source tree structure
 * @module adapters/skill-source-manifest
 *
 * Provides runtime validation of Skill source directory compliance.
 */

/** Required files in shared Skill source root */
export const SHARED_SKILL_REQUIRED_FILES = [
  'SKILL.md',
];

/** Required subdirectories in shared Skill source */
export const SHARED_SKILL_REQUIRED_DIRS = [
  'references',
  'scripts',
  'assets',
];

/** Required references in shared Skill */
export const SHARED_SKILL_REQUIRED_REFERENCES = [
  'references/command-contract.md',
  'references/document-contract.md',
  'references/agent-orchestration.md',
  'references/safety.md',
];

/** Required files for a tool adapter Skill source */
export const TOOL_SKILL_REQUIRED_FILES = [
  'SKILL.md',
];

/**
 * Skill source compliance check result
 */
export interface SkillSourceCheck {
  /** Skill source base path */
  basePath: string;
  /** Whether the source structure is compliant */
  compliant: boolean;
  /** Missing files */
  missingFiles: string[];
  /** Missing directories */
  missingDirs: string[];
  /** Error code (if non-compliant) */
  errorCode?: number;
}

/**
 * Validate shared Skill source compliance
 * @param cwd - project root
 * @returns compliance check result
 */
export function validateSharedSkillSource(cwd: string): SkillSourceCheck {
  const basePath = '.harness/adapters/shared/skills/harness';
  const missingFiles: string[] = [];
  const missingDirs: string[] = [];

  for (const file of SHARED_SKILL_REQUIRED_FILES) {
    missingFiles.push(`${basePath}/${file}`);
  }

  for (const dir of SHARED_SKILL_REQUIRED_DIRS) {
    missingDirs.push(`${basePath}/${dir}`);
  }

  const compliant = missingFiles.length === 0 && missingDirs.length === 0;

  return {
    basePath,
    compliant,
    missingFiles,
    missingDirs,
    errorCode: compliant ? undefined : 2601,
  };
}

/**
 * Validate tool adapter Skill source compliance
 * @param cwd - project root
 * @param tool - tool name (claude/codex)
 * @returns compliance check result
 */
export function validateToolSkillSource(cwd: string, tool: string): SkillSourceCheck {
  const basePath = `.harness/adapters/${tool}/skills/harness`;
  const missingFiles: string[] = [];
  const missingDirs: string[] = [];

  for (const file of TOOL_SKILL_REQUIRED_FILES) {
    missingFiles.push(`${basePath}/${file}`);
  }

  const compliant = missingFiles.length === 0;

  return {
    basePath,
    compliant,
    missingFiles,
    missingDirs,
    errorCode: compliant ? undefined : 2601,
  };
}