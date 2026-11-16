import { build as esbuild, context } from 'esbuild';

const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: true,
};
const webviewOptions = {
  entryPoints: ['webview-ui/src/main.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  outfile: 'webview-ui/dist/index.js',
  sourcemap: true,
  loader: { '.tsx': 'tsx', '.css': 'css' },
  assetNames: 'assets/[name]-[hash]',
};
if (process.argv.includes('--watch')) {
  const contexts = await Promise.all([context(extensionOptions), context(webviewOptions)]);
  await Promise.all(contexts.map((item) => item.watch()));
} else {
  await Promise.all([esbuild(extensionOptions), esbuild(webviewOptions)]);
}
