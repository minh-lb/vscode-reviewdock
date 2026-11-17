import { afterEach, describe, expect, it, vi } from 'vitest';

const ui = vi.hoisted(() => ({ picker: undefined as unknown }));
vi.mock('vscode', () => ({
  ThemeIcon: class {
    constructor(public id: string) {}
  },
  window: { createQuickPick: () => ui.picker },
}));
import { pickSidebarRepositories } from '../../src/presentation/tree/repositoryPicker';
import type { Connection, RepositoryRef } from '../../src/domain/models';
import type { ReviewProvider } from '../../src/application/ports';

const repo = (id: string): RepositoryRef => ({
  id,
  name: id,
  fullName: `team/${id}`,
  owner: 'team',
  webUrl: `https://github.com/team/${id}`,
});
const result = (items: RepositoryRef[], page = 1, hasNextPage = false) => ({
  items,
  page: { page, hasNextPage },
});
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function fixture(selected = [repo('a')]) {
  type Item = { repository: RepositoryRef };
  type Events = {
    ChangeSelection: (items: Item[]) => void;
    ChangeValue: () => void;
    TriggerButton: (button: unknown) => void;
    Accept: () => Promise<void>;
    Hide: () => void;
  };
  const events: Partial<Events> = {};
  const disposable = () => ({ dispose: vi.fn() });
  const picker = {
    items: [] as Item[],
    selectedItems: [] as Item[],
    value: '',
    buttons: [] as unknown[],
    enabled: true,
    show: vi.fn(),
    dispose: vi.fn(),
    hide: vi.fn(() => events.Hide!()),
    onDidChangeSelection: (callback: Events['ChangeSelection']) => {
      events.ChangeSelection = callback;
      return disposable();
    },
    onDidChangeValue: (callback: Events['ChangeValue']) => {
      events.ChangeValue = callback;
      return disposable();
    },
    onDidTriggerButton: (callback: Events['TriggerButton']) => {
      events.TriggerButton = callback;
      return disposable();
    },
    onDidAccept: (callback: Events['Accept']) => {
      events.Accept = callback;
      return disposable();
    },
    onDidHide: (callback: Events['Hide']) => {
      events.Hide = callback;
      return disposable();
    },
  };
  ui.picker = picker;
  const listRepositories = vi.fn().mockResolvedValue(result([repo('a'), repo('b')], 1, true));
  const save = vi.fn().mockResolvedValue(undefined);
  const reportError = vi.fn();
  const connection = {
    id: 'account',
    displayName: 'Work',
    selectedRepositories: selected,
  } as Connection;
  pickSidebarRepositories(
    connection,
    { listRepositories } as unknown as ReviewProvider,
    save,
    reportError,
  );
  return { picker, events, listRepositories, save, reportError };
}

afterEach(() => vi.useRealTimers());

describe('sidebar repository picker', () => {
  it('preselects saved repos and preserves checks while loading another page', async () => {
    const { picker, events, listRepositories, save } = fixture();
    await settle();
    expect(
      picker.selectedItems.map((item: { repository: RepositoryRef }) => item.repository.id),
    ).toEqual(['a']);
    events.ChangeSelection!(picker.items);
    listRepositories.mockResolvedValueOnce(result([repo('c')], 2));
    events.TriggerButton!(picker.buttons[0]);
    await settle();
    expect(listRepositories).toHaveBeenLastCalledWith({ page: 2, perPage: 100 });
    expect(picker.items.map((item: { repository: RepositoryRef }) => item.repository.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      picker.selectedItems.map((item: { repository: RepositoryRef }) => item.repository.id),
    ).toEqual(['a', 'b']);
    await events.Accept!();
    expect(save).toHaveBeenCalledWith([repo('a'), repo('b')]);
  });

  it('saves an empty selection instead of reverting to every repository', async () => {
    const { events, save } = fixture();
    await settle();
    events.ChangeSelection!([]);
    await events.Accept!();
    expect(save).toHaveBeenCalledWith([]);
  });

  it('cancels without saving and ignores a late page response', async () => {
    const { picker, events, save } = fixture();
    events.Hide!();
    await settle();
    expect(save).not.toHaveBeenCalled();
    expect(picker.items.map((item: { repository: RepositoryRef }) => item.repository.id)).toEqual([
      'a',
    ]);
    expect(picker.dispose).toHaveBeenCalledOnce();
  });

  it('retains selected repositories through a server search', async () => {
    vi.useFakeTimers();
    const { picker, events, listRepositories, save } = fixture();
    await settle();
    listRepositories.mockResolvedValueOnce(result([repo('z')]));
    picker.value = 'z';
    events.ChangeValue!();
    await vi.advanceTimersByTimeAsync(300);
    expect(listRepositories).toHaveBeenLastCalledWith({ page: 1, perPage: 100, search: 'z' });
    expect(
      picker.selectedItems.map((item: { repository: RepositoryRef }) => item.repository.id),
    ).toEqual(['a']);
    events.ChangeSelection!(picker.items);
    await events.Accept!();
    expect(save).toHaveBeenCalledWith([repo('a'), repo('z')]);
  });

  it('keeps the picker open if saving fails', async () => {
    const { picker, events, save, reportError } = fixture();
    await settle();
    save.mockRejectedValueOnce(new Error('storage failed'));
    await events.Accept!();
    expect(picker.hide).not.toHaveBeenCalled();
    expect(picker.enabled).toBe(true);
    expect(reportError).toHaveBeenCalledOnce();
  });
});
