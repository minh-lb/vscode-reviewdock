import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

/** Entry consumed by @vscode/test-electron inside the Extension Development Host. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('minhluu.reviewdock');
  assert.ok(extension, 'ReviewDock extension should be discoverable by publisher and package name');
  await extension.activate();
  assert.equal(extension.isActive, true);

  const manifest = extension.packageJSON as {
    contributes?: {
      commands?: Array<{ command?: string }>;
      viewsContainers?: { activitybar?: Array<{ id?: string }> };
      views?: Record<string, Array<{ id?: string }>>;
    };
  };
  const commands = new Set(manifest.contributes?.commands?.map(({ command }) => command));
  for (const command of [
    'reviewdock.addConnection',
    'reviewdock.refresh',
    'reviewdock.openReviewRequest',
  ]) {
    assert.ok(commands.has(command), `Extension manifest should contribute ${command}`);
  }
  assert.ok(
    manifest.contributes?.viewsContainers?.activitybar?.some(({ id }) => id === 'reviewdock'),
  );
  const views = manifest.contributes?.views?.reviewdock?.map(({ id }) => id) ?? [];
  assert.ok(views.includes('reviewdock.connections'));
  assert.ok(views.includes('reviewdock.requests'));
}
