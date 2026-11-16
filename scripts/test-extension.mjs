import { existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = resolve(scriptDirectory, '..');
const extensionTestsPath = resolve(extensionDevelopmentPath, 'out/test/extension/index.js');
const requestedVersion = process.env.VSCODE_VERSION ?? 'stable';

await build({
  entryPoints: [resolve(extensionDevelopmentPath, 'test/extension/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: extensionTestsPath,
  external: ['vscode'],
});

let vscodeExecutablePath;
if (process.env.VSCODE_EXECUTABLE_PATH) {
  vscodeExecutablePath = resolve(process.env.VSCODE_EXECUTABLE_PATH);
  if (!existsSync(vscodeExecutablePath)) {
    throw new Error(`VSCODE_EXECUTABLE_PATH does not exist: ${vscodeExecutablePath}`);
  }
} else {
  const downloadedExecutable = await downloadAndUnzipVSCode(requestedVersion);
  vscodeExecutablePath = downloadedExecutable;

  // Recent macOS archives expose `Code`; older @vscode/test-electron paths end in
  // `Electron`. Use the sibling only when the downloaded default is absent.
  if (!existsSync(downloadedExecutable) && basename(downloadedExecutable) === 'Electron') {
    const currentBinary = join(dirname(downloadedExecutable), 'Code');
    if (existsSync(currentBinary)) vscodeExecutablePath = currentBinary;
  }
  if (!existsSync(vscodeExecutablePath)) {
    throw new Error(`Downloaded VS Code executable does not exist: ${downloadedExecutable}`);
  }
}

console.log(
  `Running extension host tests with VS Code ${requestedVersion}: ${vscodeExecutablePath}`,
);
await runTests({
  vscodeExecutablePath,
  extensionDevelopmentPath,
  extensionTestsPath,
});
