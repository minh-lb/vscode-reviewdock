import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';

await build({
  entryPoints: ['test/extension/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: 'out/test/extension/index.js',
  external: ['vscode'],
});
await runTests({
  extensionDevelopmentPath: new URL('..', import.meta.url).pathname,
  extensionTestsPath: new URL('../out/test/extension/index.js', import.meta.url).pathname,
});
