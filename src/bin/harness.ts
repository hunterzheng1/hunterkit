#!/usr/bin/env node

/**
 * Binary shim for @hunterzheng/harness CLI
 * Captures process arguments and delegates to main()
 */

import { main } from '../cli/main.js';

const io = {
  stdout: process.stdout,
  stderr: process.stderr,
  stdin: process.stdin,
};

main(process.argv.slice(2), process.env, io).then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
