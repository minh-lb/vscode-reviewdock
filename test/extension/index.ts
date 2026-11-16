import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

/** Entry consumed by @vscode/test-electron inside the Extension Development Host. */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('reviewdock.reviewdock');
  assert.ok(extension, 'ReviewDock extension should be discoverable by publisher and package name');
  await extension.activate();
  assert.equal(extension.isActive, true);
}
