/* Local-only mock VS Code host for manual browser inspection. Uses synthetic data and no network. */
(() => {
  const contextId = 'preview-context';
  window.reviewDockContextId = contextId;
  const output = () => document.getElementById('outgoing');
  window.acquireVsCodeApi = () => ({
    postMessage(message) {
      const line = document.createElement('div');
      line.textContent = JSON.stringify(message);
      output().prepend(line);
      if (message.type === 'loadMarkdownContent' && fullContent[message.path])
        queueMicrotask(() =>
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'markdownContent', path: message.path, ...fullContent[message.path] },
            }),
          ),
        );
    },
    getState: () => undefined,
    setState: () => undefined,
  });

  const capabilities = {
    generalComments: { support: 'supported' },
    inlineComments: { support: 'supported' },
    replyByResource: {
      'github-review-comment': { support: 'supported' },
      'gitlab-discussion': { support: 'supported' },
    },
    resolveThreads: {
      support: 'unsupported',
      reason: 'Thread resolution is unavailable in this preview.',
    },
    checks: { support: 'unknown' },
    approvals: { support: 'unknown' },
    reviewDecisions: { support: 'unsupported' },
    merge: { support: 'supported' },
  };
  const initialize = {
    type: 'initialize',
    contextId,
    context: { repositoryId: 'sample-repo', reviewRequestId: 'sample-pr', headSha: 'sample-head' },
    detail: {
      id: 'sample-pr',
      number: '42',
      repositoryId: 'sample-repo',
      title: 'Sample review: improve diff rendering',
      state: 'open',
      author: { id: 'author', login: 'sample-author', name: 'Sample Author' },
      sourceBranch: 'feature/review-preview',
      targetBranch: 'main',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-02T10:00:00Z',
      webUrl: 'https://example.invalid/pull/42',
      description:
        'Synthetic preview data.\n\nNo provider credentials or network requests are used.',
      headSha: 'sample-head',
      mergeable: true,
      assignees: [],
      reviewers: [],
      labels: ['preview'],
    },
    providerName: 'GitHub',
    connectionName: 'Preview connection',
    accountLogin: 'preview-user',
    serverHost: 'github.com',
    repositoryName: 'sample/reviewdock',
    capabilities,
  };
  const files = {
    type: 'files',
    requestId: 1,
    result: {
      items: [
        {
          path: 'src/added.ts',
          change: 'added',
          additions: 3,
          deletions: 0,
          patch: '@@ -0,0 +1,3 @@\n+export function added() {\n+  return "new";\n+}\n',
        },
        {
          path: 'src/removed.ts',
          change: 'removed',
          additions: 0,
          deletions: 2,
          patch: '@@ -1,2 +0,0 @@\n-export function removed() {\n-  return "old";\n',
        },
        {
          path: 'src/context.ts',
          change: 'modified',
          additions: 1,
          deletions: 1,
          patch:
            '@@ -1,2 +1,2 @@\n export const ready = true;\n-export const mode = "old";\n+export const mode = "review";\n',
        },
      ],
      page: { page: 1, perPage: 50, hasNextPage: false },
    },
  };
  const documentPrefix = '# Review guide\n\n';
  const documentTail =
    '\n\n' +
    [
      '## Review checklist',
      'A readable document should flow naturally across source lines.\nThis sentence continues the same paragraph, with **important details** and `inline code`.',
      '> Check both the behavior and the edge cases before approving.',
      '### Validation steps',
      '1. Open the latest version.\n2. Compare the highlighted changes.\n3. Leave a comment on the relevant source line.',
      '- [x] Build passes\n- [ ] Review completed',
      '| Feature | Status |\n| --- | --- |\n| Markdown tables | **Ready** |\n| Inline comments | Available |',
      '```ts\nconst review = { status: "ready" };\nconsole.log(review.status);\n```',
      ...Array.from({ length: 70 }, (_, index) => `Unchanged paragraph ${index + 1}.`),
    ].join('\n\n');
  files.result.items.unshift({
    path: 'docs/guide.md',
    change: 'modified',
    additions: 1,
    deletions: 1,
    patch: '@@ -1,3 +1,3 @@\n # Review guide\n \n-Previous introduction.\n+Updated introduction.',
  });
  const fullContent = {
    'docs/guide.md': {
      oldContent: documentPrefix + 'Previous introduction.' + documentTail,
      newContent: documentPrefix + 'Updated introduction.' + documentTail,
    },
    'src/added.ts': { newContent: 'export function added() {\n  return "new";\n}\n' },
    'src/removed.ts': { oldContent: 'export function removed() {\n  return "old";\n' },
    'src/context.ts': {
      oldContent:
        'export const ready = true;\nexport const mode = "old";\n' +
        Array.from({ length: 60 }, (_, i) => `// unchanged context ${i + 1}`).join('\n'),
      newContent:
        'export const ready = true;\nexport const mode = "review";\n' +
        Array.from({ length: 60 }, (_, i) => `// unchanged context ${i + 1}`).join('\n'),
    },
  };
  const conversations = {
    type: 'conversations',
    requestId: 1,
    result: {
      items: [
        {
          id: 'sample-discussion',
          provider: 'github',
          resourceType: 'github-review-comment',
          author: { id: 'reviewer', login: 'sample-reviewer' },
          body: 'Could we keep this example concise?',
          createdAt: '2026-11-02T10:15:00Z',
          position: { path: 'src/context.ts', side: 'new', line: 2, newLine: 2 },
          replies: [
            {
              id: 'sample-reply',
              provider: 'github',
              resourceType: 'github-review-comment',
              author: { id: 'author', login: 'sample-author' },
              body: 'Yes, this is only preview data.',
              createdAt: '2026-11-02T10:20:00Z',
            },
          ],
        },
      ],
      page: { page: 1, perPage: 50, hasNextPage: false },
    },
  };

  const fixtures = { initialize, files, conversations };
  document.addEventListener('click', (event) => {
    const name = event.target.closest('[data-fixture]')?.dataset.fixture;
    if (name && fixtures[name])
      window.dispatchEvent(new MessageEvent('message', { data: fixtures[name] }));
  });
})();
