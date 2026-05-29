/**
 * CLI error system - unified error codes and response conversion
 * @module cli/errors
 */

import type { CliResponse } from './types.js';

/** Error code definitions */
export const ERROR_CODES = {
  1001: { msg: 'Invalid command', suggestion: 'Run "harness" without arguments to see available commands' },
  1002: { msg: 'Invalid path', suggestion: 'Check the --cwd path exists and is a directory' },
  1003: { msg: 'Wizard interrupted', suggestion: 'Run "harness" again to restart the wizard' },
  1004: { msg: 'Invalid wizard input', suggestion: 'Please select a valid option from the list' },
  2001: { msg: 'Workspace not initialized', suggestion: 'Run "harness" without arguments to initialize' },
  2002: { msg: 'Invalid menu selection', suggestion: 'Please select a registered command from the menu' },
  4001: { msg: 'External dependency unavailable', suggestion: 'Run "harness doctor" to check dependencies' },
  5001: { msg: 'Unknown error', suggestion: 'Report this issue with the error details' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Unified CLI error class with error code
 */
export class HarnessCliError extends Error {
  public readonly code: ErrorCode;
  public readonly msg: string;
  public readonly suggestion: string;

  constructor(code: ErrorCode, msg?: string, suggestion?: string) {
    const info = ERROR_CODES[code];
    const finalMsg = msg ?? info.msg;
    super(finalMsg);
    this.name = 'HarnessCliError';
    this.code = code;
    this.msg = finalMsg;
    this.suggestion = suggestion ?? info.suggestion;
  }
}

/**
 * Convert any error to a CliResponse
 */
export function toCliResponse(error: unknown): CliResponse {
  if (error instanceof HarnessCliError) {
    return {
      code: error.code,
      msg: error.msg,
      data: null,
      warnings: [],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: 5001,
    msg: message,
    data: null,
    warnings: [],
  };
}
