/**
 * CLI shared types for @hunterzheng/harness
 * @module cli/types
 */

import type { Writable, Readable } from 'node:stream';

/** Parsed command from argv */
export interface ParsedCommand {
  /** Top-level command name, null if no command provided */
  command: string | null;
  /** Remaining positional arguments after command */
  args: string[];
  /** 命令级参数透传（命令名之后的所有参数） */
  commandArgs?: string[];
}

/** Global CLI options shared across all commands */
export interface GlobalOptions {
  /** Project root directory (absolute path) */
  cwd: string;
  /** Preview mode - no actual file writes */
  dryRun: boolean;
  /** Output as pure JSON to stdout */
  json: boolean;
  /** Disable ANSI color codes */
  noColor: boolean;
}

/** AI 工具标识符 */
export type AiToolId = 'claude' | 'codex' | 'copilot' | 'cursor';

/** Artifact 分类类型 */
export type ArtifactKind = 'workspace' | 'config' | 'source' | 'runtime' | 'report' | 'skipped';

/** AI CLI 上下文信息 */
export interface AiCliContext {
  tool: 'Claude Code' | 'Codex' | 'Unknown';
  source: 'env' | 'unknown';
  sessionId?: string;
}

/** Artifact produced by a command */
export interface CliArtifact {
  /** Artifact type (e.g., 'file', 'directory', 'report') */
  type: string;
  /** Absolute path to the artifact */
  path: string;
  /** Human-readable description */
  description?: string;
  /** 分类标签（source/runtime/workspace/config/report/skipped） */
  kind?: ArtifactKind;
  /** 关联的 AI 工具 */
  tool?: AiToolId;
  /** 跳过原因（仅当 kind=skipped） */
  reason?: 'tool not selected' | 'dry-run' | 'not applicable';
}

/** 安装摘要 */
export interface InstallSummary {
  selectedAiTools: string[];
  selectedCapabilities: string[];
  hookStrength: string;
  writeStrategy: string;
  runtimeProjectionsWritten: CliArtifact[];
  runtimeProjectionsSkipped: CliArtifact[];
}

/** Unified CLI response body */
export interface CliResponse {
  /** Response code: 0 = success, non-zero = error */
  code: number;
  /** Response message */
  msg: string;
  /** Command-specific business data */
  data: Record<string, unknown> | null;
  /** Non-blocking warnings */
  warnings: string[];
  /** Produced artifacts */
  artifacts?: CliArtifact[];
}

/** I/O abstraction for CLI output */
export interface CliIo {
  /** Standard output stream */
  stdout: Writable;
  /** Standard error stream */
  stderr: Writable;
  /** Standard input stream */
  stdin: Readable;
}

/** Command handler interface - each capability implements this */
export interface CommandHandler {
  /** Command name (e.g., 'inspect', 'sync') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this command requires an initialized workspace */
  requiresInitializedWorkspace: boolean;
  /** Execute the command */
  run(context: CommandContext): Promise<CliResponse>;
}

/** Command registry interface */
export interface CommandRegistry {
  /** Resolve a command by name, returns null if not found */
  resolve(command: string): CommandHandler | null;
  /** List all registered commands */
  list(): CommandHandler[];
  /** Register or replace a command handler */
  registerHandler(handler: CommandHandler): void;
}

/** Context passed to every command handler */
export interface CommandContext {
  /** Parsed global options */
  globalOptions: GlobalOptions;
  /** Current command name */
  command: string;
  /** I/O abstraction */
  io: CliIo;
  /** Command registry reference */
  registry: CommandRegistry;
  /** Command-level arguments passed through from CLI */
  args: string[];
}
