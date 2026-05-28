import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/harness': 'src/bin/harness.ts',
    'cli/main': 'src/cli/main.ts',
    'cli/types': 'src/cli/types.ts',
    'cli/errors': 'src/cli/errors.ts',
    'cli/global-options': 'src/cli/global-options.ts',
    'cli/command-registry': 'src/cli/command-registry.ts',
    'cli/output': 'src/cli/output.ts',
    'cli/interactive': 'src/cli/interactive.ts',
  },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: true,
  banner: {
    js: '',
  },
});
