import { build, context } from 'esbuild';

const options = {
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
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
