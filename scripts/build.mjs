import { build as esbuild, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const sharedOptions = {
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
};
const extensionOptions = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/extension.js',
  external: ['vscode'],
};
const webviewOptions = {
  ...sharedOptions,
  entryPoints: ['webview-ui/src/main.tsx'],
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  outfile: 'webview-ui/dist/index.js',
  loader: { '.tsx': 'tsx', '.css': 'css' },
  assetNames: 'assets/[name]-[hash]',
};

if (watch) {
  const contexts = await Promise.all([context(extensionOptions), context(webviewOptions)]);
  await Promise.all(contexts.map((item) => item.watch()));
} else {
  await Promise.all([esbuild(extensionOptions), esbuild(webviewOptions)]);
}
