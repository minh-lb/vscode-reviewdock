import { describe, expect, it } from 'vitest';
import {
  parseWebviewRequest,
  validateWebviewRequest,
} from '../../src/presentation/webview/messageProtocol';

describe('Webview message protocol', () => {
  it('requires the active panel context for every message', () => {
    expect(parseWebviewRequest({ type: 'merge', expectedHeadSha: 'abc' })).toBeUndefined();
    expect(
      parseWebviewRequest({ type: 'merge', contextId: 'panel-a', expectedHeadSha: 'abc' }),
    ).toEqual({ type: 'merge', contextId: 'panel-a', expectedHeadSha: 'abc' });
    expect(
      validateWebviewRequest(
        { type: 'merge', contextId: 'old-panel', expectedHeadSha: 'abc' },
        'current-panel',
      ),
    ).toBeUndefined();
    expect(
      validateWebviewRequest(
        { type: 'merge', contextId: 'current-panel', expectedHeadSha: 'abc' },
        'current-panel',
      ),
    ).toBeDefined();
  });

  it('rejects invalid inline positions and empty mutation bodies', () => {
    expect(
      parseWebviewRequest({
        type: 'addInlineComment',
        contextId: 'panel-a',
        body: 'comment',
        position: { path: 'src/a.ts', side: 'new', line: 0 },
      }),
    ).toBeUndefined();
    expect(
      parseWebviewRequest({ type: 'addGeneralComment', contextId: 'panel-a', body: '  ' }),
    ).toBeUndefined();
    expect(
      parseWebviewRequest({
        type: 'reply',
        contextId: 'panel-a',
        conversationId: '',
        body: 'reply',
      }),
    ).toBeUndefined();
  });

  it('rejects unknown message types and malformed tab values', () => {
    expect(parseWebviewRequest({ type: 'execute', contextId: 'panel-a' })).toBeUndefined();
    expect(
      parseWebviewRequest({ type: 'selectTab', contextId: 'panel-a', tab: 'secrets' }),
    ).toBeUndefined();
  });

  it('validates metadata edits, picker paging, comment deletion and full-content requests', () => {
    expect(
      parseWebviewRequest({
        type: 'editMetadata',
        contextId: 'p',
        title: 'Changed',
        labels: ['bug'],
      }),
    ).toEqual({ type: 'editMetadata', contextId: 'p', title: 'Changed', labels: ['bug'] });
    expect(parseWebviewRequest({ type: 'editMetadata', contextId: 'p' })).toBeUndefined();
    expect(
      parseWebviewRequest({
        type: 'listMetadataOptions',
        contextId: 'p',
        kind: 'reviewers',
        search: 'al',
        page: 2,
      }),
    ).toMatchObject({ type: 'listMetadataOptions', kind: 'reviewers', page: 2 });
    expect(
      parseWebviewRequest({
        type: 'deleteComment',
        contextId: 'p',
        conversationId: 'root',
        commentId: 'reply',
      }),
    ).toMatchObject({ type: 'deleteComment', conversationId: 'root', commentId: 'reply' });
    expect(
      parseWebviewRequest({ type: 'loadMarkdownContent', contextId: 'p', path: 'README.md' }),
    ).toMatchObject({ type: 'loadMarkdownContent', path: 'README.md' });
    expect(
      parseWebviewRequest({ type: 'loadMarkdownContent', contextId: 'p', path: '' }),
    ).toBeUndefined();
  });
});
