import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const requireVsce = createRequire(import.meta.resolve('@vscode/vsce'));
const yauzl = requireVsce('yauzl');

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const archivePath = process.argv[2] ?? `${manifest.name}-${manifest.version}.vsix`;

function readArchive(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, archive) => {
      if (error) return reject(error);

      const files = [];
      let packedManifest;
      archive.on('error', reject);
      archive.on('entry', (entry) => {
        files.push(entry.fileName);
        if (entry.fileName !== 'extension/package.json') {
          archive.readEntry();
          return;
        }

        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => {
            try {
              packedManifest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              archive.readEntry();
            } catch (parseError) {
              reject(parseError);
            }
          });
        });
      });
      archive.on('end', () => resolve({ files, packedManifest }));
      archive.readEntry();
    });
  });
}

try {
  const { files, packedManifest } = await readArchive(archivePath);
  const fileSet = new Set(files);
  const requiredFiles = [
    'extension/package.json',
    'extension/readme.md',
    'extension/LICENSE.txt',
    'extension/changelog.md',
    'extension/PRIVACY.md',
    'extension/THIRD-PARTY-NOTICES.txt',
    'extension/resources/icon.png',
    'extension/dist/extension.js',
    'extension/webview-ui/dist/index.js',
    'extension/webview-ui/dist/index.css',
    'extension/resources/reviewdock.svg',
  ];
  const missingFiles = requiredFiles.filter((file) => !fileSet.has(file));
  if (missingFiles.length > 0) {
    throw new Error(`Package is missing required files: ${missingFiles.join(', ')}`);
  }

  const unexpectedFiles = files.filter((file) =>
    /(^|\/)(?:\.env(?:\..*)?|node_modules|test|tests|src|\.git)(?:\/|$)|\.(?:map|ts|tsx|pem|key)$|(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(
      file,
    ),
  );
  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Package contains development or sensitive files: ${unexpectedFiles.join(', ')}`,
    );
  }

  if (!packedManifest) throw new Error('Package does not contain extension/package.json');
  for (const key of [
    'name',
    'displayName',
    'version',
    'publisher',
    'license',
    'icon',
    'preview',
    'keywords',
    'categories',
    'engines',
    'extensionKind',
    'capabilities',
  ]) {
    if (JSON.stringify(packedManifest[key]) !== JSON.stringify(manifest[key])) {
      throw new Error(`Packaged ${key} does not match package.json`);
    }
  }

  console.log(`Validated ${archivePath}: metadata and ${files.length} packaged files`);
} catch (error) {
  console.error(`Package validation failed: ${error.message}`);
  process.exitCode = 1;
}
