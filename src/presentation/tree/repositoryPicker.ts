import * as vscode from 'vscode';
import type { Connection, RepositoryRef } from '../../domain/models';
import type { ReviewProvider } from '../../application/ports';

interface RepositoryItem extends vscode.QuickPickItem {
  repository: RepositoryRef;
}

/** Keeps choices across searches/pages; only Done persists changes. */
export function pickSidebarRepositories(
  connection: Connection,
  provider: ReviewProvider,
  save: (repositories: RepositoryRef[]) => Promise<void>,
  reportError: (error: unknown) => void,
): void {
  const picker = vscode.window.createQuickPick<RepositoryItem>();
  picker.title = `Sidebar repositories · ${connection.displayName}`;
  picker.placeholder = 'Select repositories to show. Unchecked repositories stay hidden.';
  picker.canSelectMany = true;
  picker.ignoreFocusOut = true;
  picker.matchOnDescription = true;
  const more = { iconPath: new vscode.ThemeIcon('add'), tooltip: 'Load more repositories' };
  const selected = new Map((connection.selectedRepositories ?? []).map((repo) => [repo.id, repo]));
  let generation = 0;
  let page = 0;
  let hasMore = false;
  let hidden = false;
  let updating = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const subscriptions: vscode.Disposable[] = [];
  const render = (repositories: RepositoryRef[]) => {
    updating = true;
    const all = new Map([...selected, ...repositories.map((repo) => [repo.id, repo] as const)]);
    picker.items = [...all.values()].map((repository) => ({
      label: repository.fullName,
      description: repository.private ? 'Private' : 'Public',
      repository,
    }));
    picker.selectedItems = picker.items.filter((item) => selected.has(item.repository.id));
    updating = false;
  };
  const load = async (append = false) => {
    const current = ++generation;
    picker.busy = true;
    try {
      const query = picker.value.trim();
      const result = await provider.listRepositories({
        page: append ? page + 1 : 1,
        perPage: 100,
        ...(query ? { search: query } : {}),
      });
      if (hidden || current !== generation) return;
      page = result.page.page;
      hasMore = result.page.hasNextPage;
      render([...(append ? picker.items.map((item) => item.repository) : []), ...result.items]);
      picker.buttons = hasMore ? [more] : [];
    } catch (error) {
      if (!hidden && current === generation) reportError(error);
    } finally {
      if (!hidden && current === generation) picker.busy = false;
    }
  };
  subscriptions.push(
    picker.onDidChangeSelection((items) => {
      if (updating) return;
      const checked = new Set(items.map((item) => item.repository.id));
      for (const item of picker.items) {
        if (checked.has(item.repository.id)) selected.set(item.repository.id, item.repository);
        else selected.delete(item.repository.id);
      }
    }),
    picker.onDidChangeValue(() => {
      generation++;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 300);
    }),
    picker.onDidTriggerButton((button) => {
      if (button === more && hasMore && !picker.busy) void load(true);
    }),
    picker.onDidAccept(async () => {
      picker.enabled = false;
      try {
        await save([...selected.values()]);
        picker.hide();
      } catch (error) {
        if (!hidden) {
          picker.enabled = true;
          reportError(error);
        }
      }
    }),
    picker.onDidHide(() => {
      hidden = true;
      generation++;
      if (debounce) clearTimeout(debounce);
      subscriptions.forEach((subscription) => subscription.dispose());
      picker.dispose();
    }),
  );
  render([]);
  picker.show();
  void load();
}
