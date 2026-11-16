import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['webview-ui/src/main.tsx'],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  outfile: 'webview-ui/dist/index.js',
  loader: { '.tsx': 'tsx', '.css': 'css' },
  assetNames: 'assets/[name]-[hash]',
};
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
