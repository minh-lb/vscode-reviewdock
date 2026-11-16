# ReviewDock — Multi-provider Test Plan

> **Document ID:** RVD-TEST-001  
> **Version:** 0.2.0  
> **Status:** Proposed  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md)

## 1. Purpose

This plan defines how ReviewDock will be verified against its requirements before MVP release. It covers unit, integration, extension-host, manual acceptance, compatibility, security and regression testing.

## 2. Test objectives

1. Verify that all P0 SRS requirements are implemented.
2. Verify GitHub and GitLab API requests, response mapping and connection isolation.
3. Verify comments and merge operations use current server state.
4. Verify no credential reaches Webview, logs or workspace files.
5. Verify the extension remains responsive under network errors and large responses.
6. Verify unsupported GitLab capabilities degrade without breaking core MR review.

## 3. Test scope

### In scope for MVP

- Multiple GitHub/GitLab connections and provider-specific PAT lifecycle.
- Git remote parsing and per-workspace repository binding.
- GitHub PR / GitLab MR list, filters, search, pagination and detail.
- Diff retrieval and rendering.
- Single-line inline comments.
- General comments and discussion replies.
- Immediate merge with SHA precondition and confirmation.
- Error handling, security and accessibility basics.

### P1 test scope

- Pipeline and job status.
- Approval state and edition/tier capability detection.
- Discussion resolve/reopen.
- Side-by-side diff if later approved.

### Out of scope

- GitLab issue management.
- Git operations such as commit/push/rebase.
- AI code review.
- Performance testing at GitLab-scale beyond practical test fixtures.
- Mutation tests against production projects.

## 4. Test strategy

| Test level | Purpose | Tooling proposal |
|---|---|---|
| Unit | Pure domain logic, parsers, mapping and validation | Vitest |
| API integration | HTTP contract, headers, pagination, error mapping | Vitest + mock HTTP server |
| Extension integration | Commands, providers, SecretStorage adapter and Webview bridge | @vscode/test-electron |
| Manual acceptance | Real GitLab workflows and UX | VS Code Stable + isolated GitLab test project |
| Compatibility | Oldest supported and current GitLab instances | Manual/CI matrix |
| Security | Secret handling, Webview CSP, untrusted input, host validation | Automated tests + inspection |
| Regression | Ensure fixes do not break prior flows | Automated test suite |

No test should require a real PAT in source code, fixtures, CI logs or repository secrets unless it is a protected, explicitly approved integration environment.

## 5. Test environments

### 5.1. Automated environment

- Node.js version compatible with the selected VS Code engine.
- TypeScript strict mode.
- Vitest for unit and API integration tests.
- @vscode/test-electron for extension-host tests.
- Mock GitLab responses stored as sanitized JSON fixtures.
- Fake SecretStorage adapter for unit tests; real VS Code SecretStorage for extension integration tests.

### 5.2. Provider integration environments

Use isolated non-production repositories/projects and dedicated test accounts:
- GitHub.com: one account with repository read access, one with review-comment write access and one with merge permission.
- GitHub Enterprise Server: test the latest and oldest still-supported feature release selected by the release compatibility matrix; verify API root and supported API version.
- GitLab.com: one account with project read access, one with discussion write access and one with merge permission.
- GitLab Self-Managed: test the oldest and newest vendor-maintained minor releases selected by the release compatibility matrix.

For each provider, prepare an open PR/MR with added, removed and modified lines, at least one review conversation, and a repository/project with merge restrictions for negative tests. Enable GitHub Checks/Actions or GitLab pipelines if P1 tests are enabled.

The exact minimum VS Code engine, GHES versions and GitLab Self-Managed maintenance window must be confirmed in PROVIDER-CAPABILITY-MATRIX.md before release. Do not use an unsupported GitLab release as the permanent technical floor.

### 5.3. Operating system matrix

| Platform | Minimum validation |
|---|---|
| Windows | Extension activation, SecretStorage, Webview, diff and comments |
| macOS | Extension activation, SecretStorage, Webview, diff and comments |
| Linux | Extension activation, SecretStorage, Webview, diff and comments |

Run at least one full end-to-end workflow on each platform before stable release.

## 6. Test data and fixtures

Required sanitized fixtures:
- GitHub authenticated user and GitLab current user.
- GitHub repository and GitLab project details.
- GitHub PR list pages 1 and 2; GitLab MR list pages 1 and 2.
- GitHub PR detail and GitLab MR detail with current head/diff refs.
- MR detail with missing/preparing diff_refs.
- Diff version list and a selected version.
- Diff files: added, modified, deleted, renamed, empty patch, binary, too large and collapsed.
- GitHub general issue comment with no reply relationship.
- GitHub inline review comment with one top-level reply and a reply-to-reply negative fixture.
- GitHub review submission distinct from comments.
- GitLab discussion with multiple reply notes.
- GitLab general discussion and inline discussion with old/new line positions.
- Approval response for Community Edition.
- Approval response for Premium/Ultimate.
- Pipeline and jobs in pending, running, success, failed, canceled and skipped states.
- Merge success and failure responses.

Fixtures must contain no real user secrets, private code or production project identifiers.

## 7. Unit test cases

### 7.1. Git remote and repository mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-PROJ-001 | Parse HTTPS GitLab remote ending in .git | Host and namespace path extracted |
| UNIT-PROJ-002 | Parse SCP-style SSH remote | Host and namespace path extracted |
| UNIT-PROJ-003 | Parse ssh:// remote | Host and namespace path extracted |
| UNIT-PROJ-004 | Remote host does not match configured instance | No automatic match |
| UNIT-PROJ-005 | Malformed or unsupported remote | Manual selection offered |
| UNIT-PROJ-006 | Path includes nested groups and URL characters | Correct path encoding |



### 7.2. Connection registry and isolation

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-CONN-001 | Create GitHub connection | Immutable ID and GitHub provider are stored |
| UNIT-CONN-002 | Create GitLab connection | Immutable ID and GitLab provider are stored |
| UNIT-CONN-003 | Create multiple connections for one provider | All records coexist independently |
| UNIT-CONN-004 | Create two accounts on the same host | Both connections remain selectable |
| UNIT-CONN-005 | Duplicate provider + host + account ID | Duplicate warning is shown; no silent merge |
| UNIT-CONN-006 | Duplicate display name | Allowed; UI identity remains unambiguous |
| UNIT-CONN-007 | Rename connection | Only displayName changes; secret key and bindings remain stable |
| UNIT-CONN-008 | Re-authenticate one connection | Only that connection's secret is replaced after successful validation |
| UNIT-CONN-009 | Authenticated-user validation fails | Credential is not saved |
| UNIT-CONN-010 | Disconnect one connection | Only its credential is deleted; record remains disconnected |
| UNIT-CONN-011 | Delete one connection | Only its record/secret is deleted; dependent bindings become unresolved |
| UNIT-CONN-012 | Set GitHub and GitLab defaults | One independent default per provider is maintained |
| UNIT-CONN-013 | Two workspace folders use different connections | Each folder resolves its own provider/account/repository |
| UNIT-CONN-014 | Multiple same-host connections can access remote | Explicit account picker is required |
| UNIT-CONN-015 | Provider or server URL is changed on existing connection | Mutation is rejected; user must create a new connection |
| UNIT-CONN-016 | Create a connection without specifying enabled | Connection is created with enabled=true |
| UNIT-CONN-017 | Disable one connection | Only its enabled flag changes; credential, status and other connections remain unchanged |
| UNIT-CONN-018 | Resolve a disabled connection by workspace binding/default/remote discovery | Resolution is blocked; no alternate account is silently selected |
| UNIT-CONN-019 | Disable the current provider default | Provider default is cleared; no other connection is auto-promoted |
| UNIT-CONN-020 | Attempt to set a disabled connection as default | Operation is rejected |
| UNIT-CONN-021 | Re-enable a connection whose last-known status is re-authentication-required | It remains unusable for provider operations until re-authenticated |
| UNIT-CONN-022 | Re-enable a previously connected connection | It becomes eligible without an automatic validation request |

### 7.3. Diff parsing and position mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-DIFF-001 | Parse a simple added line | Correct new line number |
| UNIT-DIFF-002 | Parse a removed line | Correct old line number |
| UNIT-DIFF-003 | Parse context line | Both old and new line numbers |
| UNIT-DIFF-004 | Parse multiple hunks | Line counters reset from each hunk header |
| UNIT-DIFF-005 | Parse file rename | Old and new paths preserved |
| UNIT-DIFF-006 | Hunk header selected | Row is not commentable |
| UNIT-DIFF-007 | Malformed patch | Safe parse error; no guessed line numbers |
| UNIT-DIFF-008 | Missing diff SHA | Inline comment disabled |
| UNIT-DIFF-009 | Diff version changes | Existing composer context becomes stale |

### 7.4. Conversation capability and normalization

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-CONV-001 | Map GitHub issue comment | Kind is github-issue-comment; reply is unsupported |
| UNIT-CONV-002 | Map GitHub inline review comment | Kind and provider comment ID are preserved; top-level reply capability is supported |
| UNIT-CONV-003 | Map GitHub reply comment | Parent comment ID is preserved; reply-to-reply capability is unsupported |
| UNIT-CONV-004 | Map GitLab discussion and notes | Discussion ID, note IDs, parent/thread grouping and resolution state are preserved |
| UNIT-CONV-005 | Provider omits resolution or reply metadata | State is unknown/not-applicable; never coerced to false or resolved |

### 7.5. Domain and error mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-ERR-001 | Map 401 response | AuthenticationError |
| UNIT-ERR-002 | Map 403 response | AuthorizationError |
| UNIT-ERR-003 | Map 404 response | NotFoundError |
| UNIT-ERR-004 | Map 400/422 response | ValidationError |
| UNIT-ERR-005 | Map 409 response | ConflictError |
| UNIT-ERR-006 | Map 429 with Retry-After | RateLimitError with retry metadata |
| UNIT-ERR-007 | Map 5xx response | GitLabServerError |
| UNIT-ERR-008 | Missing optional MR field | Domain mapper preserves unknown/absent state |

## 8. API integration test cases

| ID | Scenario | Expected result |
|---|---|---|
| API-AUTH-001 | Valid PAT calls GET /user | User identity returned |
| API-AUTH-002 | Invalid PAT returns 401 | Reconnect guidance; no secret in logs |
| API-AUTH-003 | PAT is sent to configured GitLab host | PRIVATE-TOKEN header present only for that host |
| API-AUTH-004 | Request target host differs from configured instance | Request blocked before token is attached |
| API-PROJ-001 | Resolve project by numeric ID | Project DTO normalized |
| API-PROJ-002 | Resolve encoded namespace path | Project path resolved correctly |
| API-MR-001 | List opened MRs | Correct query parameters |
| API-MR-002 | List assigned/review-requested MRs | Correct scope parameter |
| API-MR-003 | Search MRs | Search is debounced by caller and request is cancellable |
| API-MR-004 | Response contains next Link | Next page URL is followed |
| API-MR-005 | Next Link points to another host | Link rejected; token not forwarded |
| API-MR-006 | MR detail includes detailed_merge_status | Field mapped without deprecated merge_status |
| API-DIFF-001 | Retrieve diff versions | Base/start/head SHAs mapped correctly |
| API-DIFF-002 | Retrieve paginated diffs | All pages can be loaded |
| API-DIFF-003 | Diff returns too_large/collapsed | UI receives explicit unavailable state |
| API-DISC-001 | List discussions | Thread grouping and note metadata preserved |
| API-DISC-002 | Create general discussion | POST /discussions with body; 201 normalized |
| API-DISC-003 | Create added-line comment | Position includes new_line only |
| API-DISC-004 | Create removed-line comment | Position includes old_line only |
| API-DISC-005 | Create context-line comment | Position includes old_line and new_line |
| API-DISC-006 | Reply to discussion | Correct discussion ID endpoint used |
| API-MERGE-001 | Merge request | Current source SHA included |
| API-MERGE-002 | SHA mismatch | 409 mapped to conflict; no automatic retry |
| API-MERGE-003 | Merge rejected by policy | 405/422 mapped and surfaced |
| API-MERGE-004 | Merge request times out | State refresh required before another attempt |



### GitHub API tests

| ID | Scenario | Expected result |
|---|---|---|
| API-GH-AUTH-001 | Valid GitHub PAT calls GET /user | Stable account identity returned |
| API-GH-AUTH-002 | Invalid GitHub PAT | Authentication error; credential not persisted |
| API-GH-AUTH-003 | Fine-grained token lacks one repository permission | Connection stays valid; operation-level permission error shown |
| API-GH-REPO-001 | List accessible repositories | Results are scoped to selected connection |
| API-GH-PR-001 | List and retrieve PR | PR DTO normalized with repository ID and PR number |
| API-GH-PR-002 | Retrieve PR files with pagination | Pages loaded; missing patches represented explicitly; 3,000-file cap marked partial |
| API-GH-PR-003 | Search PR by title and number | Search query uses repository and is:pr qualifiers; full PR detail is fetched |
| API-GH-PR-004 | Filter created/assigned/direct review-requested PRs | author:@me, assignee:@me and user-review-requested:@me are used |
| API-GH-PR-005 | Search API reaches 1,000 results or rate limit | UI marks results limited; does not claim exhaustive results |
| API-GH-PR-006 | Closed PR list includes both closed and merged PRs | Merged filter uses merged/merged_at; Closed excludes merged PRs |
| API-GH-COM-001 | Create general PR comment | Issue comment endpoint is used |
| API-GH-COM-002 | Create inline comment on added line | Current head SHA, path, line and RIGHT side sent |
| API-GH-COM-003 | Create inline comment on removed line | Current head SHA, path, line and LEFT side sent |
| API-GH-COM-004 | Reply to review comment | Correct review-comment reply endpoint used |
| API-GH-COM-005 | Create general issue comment | Comment is shown as standalone; no Reply action is exposed |
| API-GH-COM-006 | Reply to top-level inline review comment | Reply is created and grouped under the top-level comment |
| API-GH-COM-007 | Attempt reply to an inline reply | UI does not expose the action; adapter rejects unsupported operation locally |
| API-GH-COM-008 | Create comment on a context line | New-side line and side=RIGHT are sent |
| API-GH-COM-009 | Resolve GitHub review thread | No resolve/reopen action is exposed by the selected REST adapter |
| API-GH-MERGE-001 | Merge PR | Current head SHA included |
| API-GH-MERGE-002 | Head SHA mismatch | 409/conflict shown; no automatic retry |
| API-GH-MERGE-003 | Merge rejected by rules/permission | Server rejection surfaced accurately |
| API-GH-MERGE-004 | PR requires a merge queue | Direct merge limitation is surfaced; no implicit queue/async merge is initiated |
| API-GH-CHECK-001 | Check run SHA differs from PR head | Check is not shown as current |
| API-GH-PAGE-001 | Pagination Link points to another origin | Link rejected before token is attached |

### P1 API tests

| ID | Scenario | Expected result |
|---|---|---|
| API-APR-001 | GitLab Community Edition /approvals response | Basic fields only are displayed; missing rule counts remain unavailable |
| API-APR-002 | GitLab Enterprise Edition /approvals response | Returned approval counts/rules are displayed without inferring missing fields |
| API-APR-003 | GitLab detailed approval-state endpoint unavailable/forbidden | Basic approval panel remains usable |
| API-APR-004 | CE approved=true with one approval and no rule fields | UI displays provider-reported approval state, not an inferred rule count |
| API-APR-005 | EE approval rules and approvals_left returned | Rule satisfaction is displayed only from returned provider fields |
| API-PIPE-001 | MR pipelines returned | Pipeline summary mapped |
| API-PIPE-002 | Pipeline SHA differs from MR head | Pipeline marked as not current |
| API-PIPE-003 | Jobs request returns paginated results | Job list loads pages |
| API-GH-REVIEW-001 | GitHub review state is retrieved | Review submissions are distinct from general/inline comments |
| API-GH-REVIEW-002 | GitHub review permission is missing | Operation-level permission error shown; connection remains valid |
| API-GH-REVIEW-003 | Review submission uses APPROVE or REQUEST_CHANGES | Review decision is distinct from general/inline comment creation |
| API-GH-CHECK-002 | Check Runs request lacks Checks:read | Checks panel shows permission state; PR detail remains usable |
| API-GH-CHECK-003 | Actions workflow request lacks Actions:read | Workflow panel shows permission state; no false failed state |

## 9. Extension and Webview tests

| ID | Scenario | Expected result |
|---|---|---|
| EXT-001 | Activate extension offline | Activation succeeds without waiting for network |
| EXT-002 | Open ReviewDock with no instance configured | Connect empty state shown |
| EXT-003 | Open ReviewDock with expired token | Authentication-required state shown |
| EXT-004 | Switch project while requests are pending | Old requests canceled or ignored |
| EXT-005 | Close MR Webview | List and extension remain stable |
| EXT-006 | Send unknown Webview message type | Message rejected |
| EXT-007 | Send malformed Webview payload | Payload validation rejects it |
| EXT-008 | Webview attempts to request arbitrary URL | Host does not expose unrestricted fetch |
| EXT-009 | Inspect Webview state/messages | No PAT or SecretStorage content present |
| EXT-010 | MR description contains HTML/script | Content rendered safely; script not executed |
| EXT-011 | External link uses unsafe scheme | Link blocked |
| EXT-012 | Submit comment twice quickly | Only one request is sent |
| EXT-013 | Request result becomes ambiguous after timeout | UI refreshes state before retry |
| EXT-014 | Theme changes | Webview updates to VS Code theme tokens |
| EXT-015 | Execute a provider command using a disabled connection | Local ConnectionDisabledError; no credential lookup or outbound HTTP request |
| EXT-016 | Disable a connection with pending reads | Pending reads are cancelled where possible; stale results are ignored |
| EXT-017 | Disable a connection after a mutation was submitted | UI does not claim rollback; outcome is reconciled after re-enabling |
| EXT-018 | Render a GitHub general issue comment | No Reply or Resolve action is shown |
| EXT-019 | Keyboard-only review workflow | Connection, PR/MR list, diff and comment controls are reachable and operable |
| EXT-020 | Accessibility and theme inspection | Status is not color-only; controls have accessible labels and follow VS Code theme tokens |

## 10. Manual end-to-end scenarios

### E2E-001 — Create and use multiple connections

1. Install extension in VS Code.
2. Add a GitHub connection with a display name and PAT; test and save it.
3. Add a GitLab connection with a different display name and PAT; test and save it.
4. Add a second account on one of the same provider hosts.
5. Bind two workspace folders to different connections and repositories.
6. Restart VS Code and reopen ReviewDock.
7. Disable one connection and verify it is excluded from selectors and API requests while its credential and workspace binding remain stored.
8. Re-enable it and verify it becomes eligible without automatic credential validation.
9. Disconnect one connection and verify the other remains usable.

Expected:
- All connection records and repository bindings remain available.
- Each token is retrieved from its own SecretStorage key.
- The account picker appears when more than one connection matches a remote.
- Disabling a connection does not delete its credential, alter its last-known status or silently reassign its workspace binding.
- A disabled connection cannot be selected or used for provider API requests.
- Re-enabling does not silently validate or switch accounts.
- Disconnecting one connection does not affect another.


### E2E-002A — Discover and open a GitHub PR

1. Bind a workspace folder to a GitHub connection and repository.
2. Load open PRs and paginate.
3. Search by title and PR number.
4. Exercise Created by me, Assigned to me and direct Review requested from me.
5. Open a PR and refresh its detail.

Expected:
- PR results are scoped to the selected connection/repository.
- Search uses GitHub Search API qualifiers; full PR detail is fetched before displaying full metadata.
- Search caps/rate limits are represented as limited results, not complete results.
- PR number is always scoped by repository and connection.

### E2E-002B — Discover and open a GitLab MR

1. Bind a workspace folder to a GitLab connection and project.
2. Load open MRs and paginate.
3. Exercise Created by me, Assigned to me and Review requested from me.
4. Search by title and IID.
5. Open an MR and refresh its detail.

Expected:
- MR list scopes and search parameters match GitLab API behavior.
- Pagination and MR IID are scoped by project and connection.
- Missing fields are displayed as unknown rather than false.

### E2E-003A — Review GitHub PR changes

1. Open a PR with added, modified, deleted and renamed files.
2. Navigate the changed-file list and inspect line numbers/hunks.
3. Open a binary or large patch.
4. Use a PR with more than 3,000 changed files if the test environment can safely provide one, or validate the documented API cap with a fixture.

Expected:
- File state and diff mapping are accurate.
- Missing patch text is explicitly unavailable.
- A result at the 3,000-file API cap is marked partial.
- Non-diff rows cannot receive comments.

### E2E-003B — Review GitLab MR changes

1. Open an MR with added, modified, deleted and renamed files.
2. Navigate the changed-file list and inspect line numbers/hunks.
3. Open a binary, collapsed or too-large diff.
4. Verify diff version metadata is associated with rendered rows.

Expected:
- File state and diff mapping are accurate.
- Collapsed/too-large or unsupported patches are explained.
- Inline commenting remains disabled when required SHAs or line positions are missing.

### E2E-004A — GitHub comments and review replies

1. Create a general PR timeline comment.
2. Verify that no Reply action is shown for the general issue comment.
3. Create an inline comment on an added line, a removed line and a context line.
4. Reply to a top-level inline review comment.
5. Verify that a reply-to-reply action is not exposed.
6. Refresh the PR in GitHub Web.

Expected:
- General comments use the Issues Comments API.
- Inline comments use the Pull Request Review Comments API and correct side/line/head SHA.
- Only a top-level inline review comment can receive a reply.
- No GitHub REST Resolve/Reopen action is shown.
- All comments appear on the correct resource and line.

### E2E-004B — GitLab discussions and replies

1. Create a general MR discussion.
2. Create inline discussions on added, removed and context lines.
3. Reply to a discussion.
4. Resolve/reopen a discussion if the account and project permit it.
5. Refresh the MR in GitLab Web.

Expected:
- Discussion grouping and note IDs are preserved.
- General and inline discussion replies use the correct discussion ID.
- Resolve/reopen appears only when the provider permits it.
- No duplicate notes are created.

### E2E-005A — GitHub stale diff protection

1. Open a PR diff and prepare an inline review comment.
2. Push a new commit to the PR head from another session.
3. Attempt to submit using the old head SHA and line context.

Expected:
- ReviewDock refreshes PR detail and compares current head SHA.
- Submission is blocked when the head SHA changed.
- Draft text is preserved; it is never posted as a general issue comment.

### E2E-005B — GitLab stale diff protection

1. Open an MR diff and prepare an inline discussion.
2. Push a new commit to the source branch from another session.
3. Attempt to submit using the old diff version.

Expected:
- ReviewDock detects the changed diff version or GitLab rejects the stale position.
- Draft text is preserved.
- No comment is silently posted as a general discussion.

### E2E-006A — GitHub PR merge success

1. Use a test PR that is mergeable for the current account and repository rules.
2. Click Merge and inspect provider, connection, repository, PR number and branches.
3. Confirm merge.
4. Refresh PR state.

Expected:
- Request includes the current PR head SHA.
- PR becomes merged only after GitHub confirms.
- No auto-merge, merge queue or source-branch deletion option is silently enabled.

### E2E-006B — GitLab MR merge success

1. Use a test MR that is mergeable for the current account and project rules.
2. Click Merge and inspect provider, connection, project, MR IID and branches.
3. Confirm merge.
4. Refresh MR state.

Expected:
- Request includes the current source HEAD SHA.
- MR becomes merged only after GitLab confirms.
- No auto-merge-when-pipeline-succeeds or source-branch deletion option is silently enabled.

### E2E-007A — GitHub merge rejection

Run separate tests for:
- Insufficient repository permission.
- Protected branch or repository rule rejection.
- Stale head SHA.
- Closed PR.
- Merge queue required.

Expected:
- GitHub rejection is displayed.
- No false success notification or implicit queue action occurs.
- PR state is refreshed.
- No automatic retry occurs.

### E2E-007B — GitLab merge rejection

Run separate tests for:
- Insufficient permission.
- Conflict.
- Missing approval.
- Failed pipeline.
- Stale source SHA.
- Closed MR.

Expected:
- GitLab rejection is displayed.
- No false success notification.
- MR state is refreshed.
- No automatic retry occurs.

### E2E-008 — Disable and re-enable a connection

1. Create and validate two connections for the same provider.
2. Bind a workspace repository to the first connection and set it as the provider default.
3. Disable the first connection.
4. Attempt repository discovery and an API-backed command through the existing workspace binding.
5. Inspect the provider default and connection registry.
6. Re-enable the first connection and inspect its status.
7. Explicitly test/re-authenticate only if its last-known status requires it.

Expected:
- The first connection is excluded from selection, discovery, default resolution and outbound requests while disabled.
- Its credential, configuration, last-known status and workspace binding remain stored.
- Disabling it clears the provider default and does not auto-promote the second connection.
- The existing workspace binding is blocked rather than silently reassigned.
- Re-enabling does not automatically validate the credential or switch accounts.

## 11. Security test cases

| ID | Threat / test | Expected result |
|---|---|---|
| SEC-TEST-001 | Search repository/settings/logs for GitHub and GitLab PAT fixtures | No PAT persisted outside SecretStorage |
| SEC-TEST-002 | Inspect Webview messages and state | No token exposed |
| SEC-TEST-003 | Malicious pagination Link to another origin | Rejected before authenticated request |
| SEC-TEST-004 | HTML/script in MR description or comment | Safely escaped/sanitized |
| SEC-TEST-005 | External link with javascript/data scheme | Blocked |
| SEC-TEST-006 | Log HTTP error containing sensitive header | Header redacted |
| SEC-TEST-007 | Disconnect one connection | Corresponding SecretStorage key removed |
| SEC-TEST-008 | User lacks merge permission | Merge is rejected by the provider; no bypass path exists |
| SEC-TEST-009 | GitHub general comment and inline review comment are normalized | Resource kind and reply capability are preserved; no synthetic general-comment thread |
| SEC-TEST-010 | Inspect VS Code logs, Webview messages and CI artifacts | No PAT, private diff body or comment content is exposed |

## 12. Performance and resilience checks

Initial targets (to be validated and adjusted after baseline measurement):

- Extension activation does not wait for GitHub or GitLab network.
- Show a loading state immediately when a network-backed view opens.
- With a normal network and a response under 1 MB, PR/MR list first page should render within 2 seconds after the response is received.
- Large diffs should be paginated/lazy-loaded and must not block extension host event processing.
- Changing MR/project cancels obsolete read requests.
- Rate-limit and transient server errors do not create request storms.
- No automatic retry of ambiguous mutations.

## 13. Release gates

MVP release is blocked until:
- All P0 common test cases pass, and every P0 provider-specific workflow passes against both GitHub and GitLab. A provider-specific unsupported capability must pass its negative test.
- All P0 SRS requirements map to at least one test or inspection.
- GitHub inline review comment mapping and GitLab diff position mapping are verified against real test environments.
- GitHub PR head SHA and GitLab MR source SHA preconditions are verified against real test environments.
- Secret handling and Webview security tests pass.
- No known critical/high severity security defect remains.
- Windows, macOS and Linux smoke tests pass.
- Compatibility floor and tested VS Code, GHES and GitLab versions are documented.
- Manual test results are recorded in the release checklist.


## 14. CI and release automation checks

| ID | Scenario | Expected result |
|---|---|---|
| CI-001 | Pull request CI runs lint and formatting checks | Both pass; failure blocks merge |
| CI-002 | Pull request CI runs TypeScript strict typecheck | No type errors |
| CI-003 | Pull request CI runs unit and mocked provider integration tests | All required tests pass without live credentials |
| CI-004 | Pull request CI builds extension and Webview bundles | Build succeeds reproducibly from lockfile |

## 15. Additional performance checks

| ID | Scenario | Expected result |
|---|---|---|
| PERF-001 | Extension activation with all providers unreachable | Activation completes without waiting for network |
| PERF-002 | Open a large PR/MR diff | Diff is paginated/lazy-loaded; extension host remains responsive |
| PERF-003 | Switch repository while multiple reads are pending | Obsolete requests are cancelled or ignored |
| PERF-004 | Repeated rate-limit/network failures | Bounded retries; no request storm |

## 16. Traceability

Maintain a test-to-requirement mapping as implementation progresses:

| Requirement group | Primary test groups |
|---|---|
| AUTH / CONN | API-AUTH, API-GH-AUTH, UNIT-CONN, E2E-001, SEC-TEST |
| PROJ | UNIT-PROJ, API-PROJ, API-GH-REPO, E2E-001 |
| PR / MR / DETAIL | API-MR, API-GH-PR, E2E-002A/B |
| DIFF | UNIT-DIFF, API-DIFF, API-GH-PR, E2E-003A/B, E2E-005A/B |
| DISC / REVIEW COMMENTS | UNIT-CONV, API-DISC, API-GH-COM, E2E-004A/B |
| MERGE | API-MERGE, API-GH-MERGE, E2E-006A/B, E2E-007A/B |
| APR / PIPE | API-APR, API-PIPE |
| UI / NFR | EXT, SEC-TEST, performance checks |

A test case is considered passed only when the observed result and evidence are recorded. A skipped test must include a reason and an approved deferral.
# ReviewDock — Multi-provider Test Plan

> **Document ID:** RVD-TEST-001  
> **Version:** 0.2.0  
> **Status:** Proposed  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md)

## 1. Purpose

This plan defines how ReviewDock will be verified against its requirements before MVP release. It covers unit, integration, extension-host, manual acceptance, compatibility, security and regression testing.

## 2. Test objectives

1. Verify that all P0 SRS requirements are implemented.
2. Verify GitHub and GitLab API requests, response mapping and connection isolation.
3. Verify comments and merge operations use current server state.
4. Verify no credential reaches Webview, logs or workspace files.
5. Verify the extension remains responsive under network errors and large responses.
6. Verify unsupported GitLab capabilities degrade without breaking core MR review.

## 3. Test scope

### In scope for MVP

- Multiple GitHub/GitLab connections and provider-specific PAT lifecycle.
- Git remote parsing and per-workspace repository binding.
- GitHub PR / GitLab MR list, filters, search, pagination and detail.
- Diff retrieval and rendering.
- Single-line inline comments.
- General comments and discussion replies.
- Immediate merge with SHA precondition and confirmation.
- Error handling, security and accessibility basics.

### P1 test scope

- Pipeline and job status.
- Approval state and edition/tier capability detection.
- Discussion resolve/reopen.
- Side-by-side diff if later approved.

### Out of scope

- GitLab issue management.
- Git operations such as commit/push/rebase.
- AI code review.
- Performance testing at GitLab-scale beyond practical test fixtures.
- Mutation tests against production projects.

## 4. Test strategy

| Test level | Purpose | Tooling proposal |
|---|---|---|
| Unit | Pure domain logic, parsers, mapping and validation | Vitest |
| API integration | HTTP contract, headers, pagination, error mapping | Vitest + mock HTTP server |
| Extension integration | Commands, providers, SecretStorage adapter and Webview bridge | @vscode/test-electron |
| Manual acceptance | Real GitLab workflows and UX | VS Code Stable + isolated GitLab test project |
| Compatibility | Oldest supported and current GitLab instances | Manual/CI matrix |
| Security | Secret handling, Webview CSP, untrusted input, host validation | Automated tests + inspection |
| Regression | Ensure fixes do not break prior flows | Automated test suite |

No test should require a real PAT in source code, fixtures, CI logs or repository secrets unless it is a protected, explicitly approved integration environment.

## 5. Test environments

### 5.1. Automated environment

- Node.js version compatible with the selected VS Code engine.
- TypeScript strict mode.
- Vitest for unit and API integration tests.
- @vscode/test-electron for extension-host tests.
- Mock GitLab responses stored as sanitized JSON fixtures.
- Fake SecretStorage adapter for unit tests; real VS Code SecretStorage for extension integration tests.

### 5.2. Provider integration environments

Use isolated non-production repositories/projects and dedicated test accounts:
- GitHub.com: one account with repository read access, one with review-comment write access and one with merge permission.
- GitHub Enterprise Server: test the latest and oldest still-supported feature release selected by the release compatibility matrix; verify API root and supported API version.
- GitLab.com: one account with project read access, one with discussion write access and one with merge permission.
- GitLab Self-Managed: test the oldest and newest vendor-maintained minor releases selected by the release compatibility matrix.

For each provider, prepare an open PR/MR with added, removed and modified lines, at least one review conversation, and a repository/project with merge restrictions for negative tests. Enable GitHub Checks/Actions or GitLab pipelines if P1 tests are enabled.

The exact minimum VS Code engine, GHES versions and GitLab Self-Managed maintenance window must be confirmed in PROVIDER-CAPABILITY-MATRIX.md before release. Do not use an unsupported GitLab release as the permanent technical floor.

### 5.3. Operating system matrix

| Platform | Minimum validation |
|---|---|
| Windows | Extension activation, SecretStorage, Webview, diff and comments |
| macOS | Extension activation, SecretStorage, Webview, diff and comments |
| Linux | Extension activation, SecretStorage, Webview, diff and comments |

Run at least one full end-to-end workflow on each platform before stable release.

## 6. Test data and fixtures

Required sanitized fixtures:
- GitHub authenticated user and GitLab current user.
- GitHub repository and GitLab project details.
- GitHub PR list pages 1 and 2; GitLab MR list pages 1 and 2.
- GitHub PR detail and GitLab MR detail with current head/diff refs.
- MR detail with missing/preparing diff_refs.
- Diff version list and a selected version.
- Diff files: added, modified, deleted, renamed, empty patch, binary, too large and collapsed.
- GitHub general issue comment with no reply relationship.
- GitHub inline review comment with one top-level reply and a reply-to-reply negative fixture.
- GitHub review submission distinct from comments.
- GitLab discussion with multiple reply notes.
- GitLab general discussion and inline discussion with old/new line positions.
- Approval response for Community Edition.
- Approval response for Premium/Ultimate.
- Pipeline and jobs in pending, running, success, failed, canceled and skipped states.
- Merge success and failure responses.

Fixtures must contain no real user secrets, private code or production project identifiers.

## 7. Unit test cases

### 7.1. Git remote and repository mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-PROJ-001 | Parse HTTPS GitLab remote ending in .git | Host and namespace path extracted |
| UNIT-PROJ-002 | Parse SCP-style SSH remote | Host and namespace path extracted |
| UNIT-PROJ-003 | Parse ssh:// remote | Host and namespace path extracted |
| UNIT-PROJ-004 | Remote host does not match configured instance | No automatic match |
| UNIT-PROJ-005 | Malformed or unsupported remote | Manual selection offered |
| UNIT-PROJ-006 | Path includes nested groups and URL characters | Correct path encoding |



### 7.2. Connection registry and isolation

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-CONN-001 | Create GitHub connection | Immutable ID and GitHub provider are stored |
| UNIT-CONN-002 | Create GitLab connection | Immutable ID and GitLab provider are stored |
| UNIT-CONN-003 | Create multiple connections for one provider | All records coexist independently |
| UNIT-CONN-004 | Create two accounts on the same host | Both connections remain selectable |
| UNIT-CONN-005 | Duplicate provider + host + account ID | Duplicate warning is shown; no silent merge |
| UNIT-CONN-006 | Duplicate display name | Allowed; UI identity remains unambiguous |
| UNIT-CONN-007 | Rename connection | Only displayName changes; secret key and bindings remain stable |
| UNIT-CONN-008 | Re-authenticate one connection | Only that connection's secret is replaced after successful validation |
| UNIT-CONN-009 | Authenticated-user validation fails | Credential is not saved |
| UNIT-CONN-010 | Disconnect one connection | Only its credential is deleted; record remains disconnected |
| UNIT-CONN-011 | Delete one connection | Only its record/secret is deleted; dependent bindings become unresolved |
| UNIT-CONN-012 | Set GitHub and GitLab defaults | One independent default per provider is maintained |
| UNIT-CONN-013 | Two workspace folders use different connections | Each folder resolves its own provider/account/repository |
| UNIT-CONN-014 | Multiple same-host connections can access remote | Explicit account picker is required |
| UNIT-CONN-015 | Provider or server URL is changed on existing connection | Mutation is rejected; user must create a new connection |
| UNIT-CONN-016 | Create a connection without specifying enabled | Connection is created with enabled=true |
| UNIT-CONN-017 | Disable one connection | Only its enabled flag changes; credential, status and other connections remain unchanged |
| UNIT-CONN-018 | Resolve a disabled connection by workspace binding/default/remote discovery | Resolution is blocked; no alternate account is silently selected |
| UNIT-CONN-019 | Disable the current provider default | Provider default is cleared; no other connection is auto-promoted |
| UNIT-CONN-020 | Attempt to set a disabled connection as default | Operation is rejected |
| UNIT-CONN-021 | Re-enable a connection whose last-known status is re-authentication-required | It remains unusable for provider operations until re-authenticated |
| UNIT-CONN-022 | Re-enable a previously connected connection | It becomes eligible without an automatic validation request |

### 7.3. Diff parsing and position mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-DIFF-001 | Parse a simple added line | Correct new line number |
| UNIT-DIFF-002 | Parse a removed line | Correct old line number |
| UNIT-DIFF-003 | Parse context line | Both old and new line numbers |
| UNIT-DIFF-004 | Parse multiple hunks | Line counters reset from each hunk header |
| UNIT-DIFF-005 | Parse file rename | Old and new paths preserved |
| UNIT-DIFF-006 | Hunk header selected | Row is not commentable |
| UNIT-DIFF-007 | Malformed patch | Safe parse error; no guessed line numbers |
| UNIT-DIFF-008 | Missing diff SHA | Inline comment disabled |
| UNIT-DIFF-009 | Diff version changes | Existing composer context becomes stale |

### 7.4. Conversation capability and normalization

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-CONV-001 | Map GitHub issue comment | Kind is github-issue-comment; reply is unsupported |
| UNIT-CONV-002 | Map GitHub inline review comment | Kind and provider comment ID are preserved; top-level reply capability is supported |
| UNIT-CONV-003 | Map GitHub reply comment | Parent comment ID is preserved; reply-to-reply capability is unsupported |
| UNIT-CONV-004 | Map GitLab discussion and notes | Discussion ID, note IDs, parent/thread grouping and resolution state are preserved |
| UNIT-CONV-005 | Provider omits resolution or reply metadata | State is unknown/not-applicable; never coerced to false or resolved |

### 7.5. Domain and error mapping

| ID | Scenario | Expected result |
|---|---|---|
| UNIT-ERR-001 | Map 401 response | AuthenticationError |
| UNIT-ERR-002 | Map 403 response | AuthorizationError |
| UNIT-ERR-003 | Map 404 response | NotFoundError |
| UNIT-ERR-004 | Map 400/422 response | ValidationError |
| UNIT-ERR-005 | Map 409 response | ConflictError |
| UNIT-ERR-006 | Map 429 with Retry-After | RateLimitError with retry metadata |
| UNIT-ERR-007 | Map 5xx response | GitLabServerError |
| UNIT-ERR-008 | Missing optional MR field | Domain mapper preserves unknown/absent state |

## 8. API integration test cases

| ID | Scenario | Expected result |
|---|---|---|
| API-AUTH-001 | Valid PAT calls GET /user | User identity returned |
| API-AUTH-002 | Invalid PAT returns 401 | Reconnect guidance; no secret in logs |
| API-AUTH-003 | PAT is sent to configured GitLab host | PRIVATE-TOKEN header present only for that host |
| API-AUTH-004 | Request target host differs from configured instance | Request blocked before token is attached |
| API-PROJ-001 | Resolve project by numeric ID | Project DTO normalized |
| API-PROJ-002 | Resolve encoded namespace path | Project path resolved correctly |
| API-MR-001 | List opened MRs | Correct query parameters |
| API-MR-002 | List assigned/review-requested MRs | Correct scope parameter |
| API-MR-003 | Search MRs | Search is debounced by caller and request is cancellable |
| API-MR-004 | Response contains next Link | Next page URL is followed |
| API-MR-005 | Next Link points to another host | Link rejected; token not forwarded |
| API-MR-006 | MR detail includes detailed_merge_status | Field mapped without deprecated merge_status |
| API-DIFF-001 | Retrieve diff versions | Base/start/head SHAs mapped correctly |
| API-DIFF-002 | Retrieve paginated diffs | All pages can be loaded |
| API-DIFF-003 | Diff returns too_large/collapsed | UI receives explicit unavailable state |
| API-DISC-001 | List discussions | Thread grouping and note metadata preserved |
| API-DISC-002 | Create general discussion | POST /discussions with body; 201 normalized |
| API-DISC-003 | Create added-line comment | Position includes new_line only |
| API-DISC-004 | Create removed-line comment | Position includes old_line only |
| API-DISC-005 | Create context-line comment | Position includes old_line and new_line |
| API-DISC-006 | Reply to discussion | Correct discussion ID endpoint used |
| API-MERGE-001 | Merge request | Current source SHA included |
| API-MERGE-002 | SHA mismatch | 409 mapped to conflict; no automatic retry |
| API-MERGE-003 | Merge rejected by policy | 405/422 mapped and surfaced |
| API-MERGE-004 | Merge request times out | State refresh required before another attempt |



### GitHub API tests

| ID | Scenario | Expected result |
|---|---|---|
| API-GH-AUTH-001 | Valid GitHub PAT calls GET /user | Stable account identity returned |
| API-GH-AUTH-002 | Invalid GitHub PAT | Authentication error; credential not persisted |
| API-GH-AUTH-003 | Fine-grained token lacks one repository permission | Connection stays valid; operation-level permission error shown |
| API-GH-REPO-001 | List accessible repositories | Results are scoped to selected connection |
| API-GH-PR-001 | List and retrieve PR | PR DTO normalized with repository ID and PR number |
| API-GH-PR-002 | Retrieve PR files with pagination | Pages loaded; missing patches represented explicitly; 3,000-file cap marked partial |
| API-GH-PR-003 | Search PR by title and number | Search query uses repository and is:pr qualifiers; full PR detail is fetched |
| API-GH-PR-004 | Filter created/assigned/direct review-requested PRs | author:@me, assignee:@me and user-review-requested:@me are used |
| API-GH-PR-005 | Search API reaches 1,000 results or rate limit | UI marks results limited; does not claim exhaustive results |
| API-GH-PR-006 | Closed PR list includes both closed and merged PRs | Merged filter uses merged/merged_at; Closed excludes merged PRs |
| API-GH-COM-001 | Create general PR comment | Issue comment endpoint is used |
| API-GH-COM-002 | Create inline comment on added line | Current head SHA, path, line and RIGHT side sent |
| API-GH-COM-003 | Create inline comment on removed line | Current head SHA, path, line and LEFT side sent |
| API-GH-COM-004 | Reply to review comment | Correct review-comment reply endpoint used |
| API-GH-COM-005 | Create general issue comment | Comment is shown as standalone; no Reply action is exposed |
| API-GH-COM-006 | Reply to top-level inline review comment | Reply is created and grouped under the top-level comment |
| API-GH-COM-007 | Attempt reply to an inline reply | UI does not expose the action; adapter rejects unsupported operation locally |
| API-GH-COM-008 | Create comment on a context line | New-side line and side=RIGHT are sent |
| API-GH-COM-009 | Resolve GitHub review thread | No resolve/reopen action is exposed by the selected REST adapter |
| API-GH-MERGE-001 | Merge PR | Current head SHA included |
| API-GH-MERGE-002 | Head SHA mismatch | 409/conflict shown; no automatic retry |
| API-GH-MERGE-003 | Merge rejected by rules/permission | Server rejection surfaced accurately |
| API-GH-MERGE-004 | PR requires a merge queue | Direct merge limitation is surfaced; no implicit queue/async merge is initiated |
| API-GH-CHECK-001 | Check run SHA differs from PR head | Check is not shown as current |
| API-GH-PAGE-001 | Pagination Link points to another origin | Link rejected before token is attached |

### P1 API tests

| ID | Scenario | Expected result |
|---|---|---|
| API-APR-001 | GitLab Community Edition /approvals response | Basic fields only are displayed; missing rule counts remain unavailable |
| API-APR-002 | GitLab Enterprise Edition /approvals response | Returned approval counts/rules are displayed without inferring missing fields |
| API-APR-003 | GitLab detailed approval-state endpoint unavailable/forbidden | Basic approval panel remains usable |
| API-APR-004 | CE approved=true with one approval and no rule fields | UI displays provider-reported approval state, not an inferred rule count |
| API-APR-005 | EE approval rules and approvals_left returned | Rule satisfaction is displayed only from returned provider fields |
| API-PIPE-001 | MR pipelines returned | Pipeline summary mapped |
| API-PIPE-002 | Pipeline SHA differs from MR head | Pipeline marked as not current |
| API-PIPE-003 | Jobs request returns paginated results | Job list loads pages |
| API-GH-REVIEW-001 | GitHub review state is retrieved | Review submissions are distinct from general/inline comments |
| API-GH-REVIEW-002 | GitHub review permission is missing | Operation-level permission error shown; connection remains valid |
| API-GH-REVIEW-003 | Review submission uses APPROVE or REQUEST_CHANGES | Review decision is distinct from general/inline comment creation |
| API-GH-CHECK-002 | Check Runs request lacks Checks:read | Checks panel shows permission state; PR detail remains usable |
| API-GH-CHECK-003 | Actions workflow request lacks Actions:read | Workflow panel shows permission state; no false failed state |

## 9. Extension and Webview tests

| ID | Scenario | Expected result |
|---|---|---|
| EXT-001 | Activate extension offline | Activation succeeds without waiting for network |
| EXT-002 | Open ReviewDock with no instance configured | Connect empty state shown |
| EXT-003 | Open ReviewDock with expired token | Authentication-required state shown |
| EXT-004 | Switch project while requests are pending | Old requests canceled or ignored |
| EXT-005 | Close MR Webview | List and extension remain stable |
| EXT-006 | Send unknown Webview message type | Message rejected |
| EXT-007 | Send malformed Webview payload | Payload validation rejects it |
| EXT-008 | Webview attempts to request arbitrary URL | Host does not expose unrestricted fetch |
| EXT-009 | Inspect Webview state/messages | No PAT or SecretStorage content present |
| EXT-010 | MR description contains HTML/script | Content rendered safely; script not executed |
| EXT-011 | External link uses unsafe scheme | Link blocked |
| EXT-012 | Submit comment twice quickly | Only one request is sent |
| EXT-013 | Request result becomes ambiguous after timeout | UI refreshes state before retry |
| EXT-014 | Theme changes | Webview updates to VS Code theme tokens |
| EXT-015 | Execute a provider command using a disabled connection | Local ConnectionDisabledError; no credential lookup or outbound HTTP request |
| EXT-016 | Disable a connection with pending reads | Pending reads are cancelled where possible; stale results are ignored |
| EXT-017 | Disable a connection after a mutation was submitted | UI does not claim rollback; outcome is reconciled after re-enabling |
| EXT-018 | Render a GitHub general issue comment | No Reply or Resolve action is shown |
| EXT-019 | Keyboard-only review workflow | Connection, PR/MR list, diff and comment controls are reachable and operable |
| EXT-020 | Accessibility and theme inspection | Status is not color-only; controls have accessible labels and follow VS Code theme tokens |

## 10. Manual end-to-end scenarios

### E2E-001 — Create and use multiple connections

1. Install extension in VS Code.
2. Add a GitHub connection with a display name and PAT; test and save it.
3. Add a GitLab connection with a different display name and PAT; test and save it.
4. Add a second account on one of the same provider hosts.
5. Bind two workspace folders to different connections and repositories.
6. Restart VS Code and reopen ReviewDock.
7. Disable one connection and verify it is excluded from selectors and API requests while its credential and workspace binding remain stored.
8. Re-enable it and verify it becomes eligible without automatic credential validation.
9. Disconnect one connection and verify the other remains usable.

Expected:
- All connection records and repository bindings remain available.
- Each token is retrieved from its own SecretStorage key.
- The account picker appears when more than one connection matches a remote.
- Disabling a connection does not delete its credential, alter its last-known status or silently reassign its workspace binding.
- A disabled connection cannot be selected or used for provider API requests.
- Re-enabling does not silently validate or switch accounts.
- Disconnecting one connection does not affect another.


### E2E-002A — Discover and open a GitHub PR

1. Bind a workspace folder to a GitHub connection and repository.
2. Load open PRs and paginate.
3. Search by title and PR number.
4. Exercise Created by me, Assigned to me and direct Review requested from me.
5. Open a PR and refresh its detail.

Expected:
- PR results are scoped to the selected connection/repository.
- Search uses GitHub Search API qualifiers; full PR detail is fetched before displaying full metadata.
- Search caps/rate limits are represented as limited results, not complete results.
- PR number is always scoped by repository and connection.

### E2E-002B — Discover and open a GitLab MR

1. Bind a workspace folder to a GitLab connection and project.
2. Load open MRs and paginate.
3. Exercise Created by me, Assigned to me and Review requested from me.
4. Search by title and IID.
5. Open an MR and refresh its detail.

Expected:
- MR list scopes and search parameters match GitLab API behavior.
- Pagination and MR IID are scoped by project and connection.
- Missing fields are displayed as unknown rather than false.

### E2E-003A — Review GitHub PR changes

1. Open a PR with added, modified, deleted and renamed files.
2. Navigate the changed-file list and inspect line numbers/hunks.
3. Open a binary or large patch.
4. Use a PR with more than 3,000 changed files if the test environment can safely provide one, or validate the documented API cap with a fixture.

Expected:
- File state and diff mapping are accurate.
- Missing patch text is explicitly unavailable.
- A result at the 3,000-file API cap is marked partial.
- Non-diff rows cannot receive comments.

### E2E-003B — Review GitLab MR changes

1. Open an MR with added, modified, deleted and renamed files.
2. Navigate the changed-file list and inspect line numbers/hunks.
3. Open a binary, collapsed or too-large diff.
4. Verify diff version metadata is associated with rendered rows.

Expected:
- File state and diff mapping are accurate.
- Collapsed/too-large or unsupported patches are explained.
- Inline commenting remains disabled when required SHAs or line positions are missing.

### E2E-004A — GitHub comments and review replies

1. Create a general PR timeline comment.
2. Verify that no Reply action is shown for the general issue comment.
3. Create an inline comment on an added line, a removed line and a context line.
4. Reply to a top-level inline review comment.
5. Verify that a reply-to-reply action is not exposed.
6. Refresh the PR in GitHub Web.

Expected:
- General comments use the Issues Comments API.
- Inline comments use the Pull Request Review Comments API and correct side/line/head SHA.
- Only a top-level inline review comment can receive a reply.
- No GitHub REST Resolve/Reopen action is shown.
- All comments appear on the correct resource and line.

### E2E-004B — GitLab discussions and replies

1. Create a general MR discussion.
2. Create inline discussions on added, removed and context lines.
3. Reply to a discussion.
4. Resolve/reopen a discussion if the account and project permit it.
5. Refresh the MR in GitLab Web.

Expected:
- Discussion grouping and note IDs are preserved.
- General and inline discussion replies use the correct discussion ID.
- Resolve/reopen appears only when the provider permits it.
- No duplicate notes are created.

### E2E-005A — GitHub stale diff protection

1. Open a PR diff and prepare an inline review comment.
2. Push a new commit to the PR head from another session.
3. Attempt to submit using the old head SHA and line context.

Expected:
- ReviewDock refreshes PR detail and compares current head SHA.
- Submission is blocked when the head SHA changed.
- Draft text is preserved; it is never posted as a general issue comment.

### E2E-005B — GitLab stale diff protection

1. Open an MR diff and prepare an inline discussion.
2. Push a new commit to the source branch from another session.
3. Attempt to submit using the old diff version.

Expected:
- ReviewDock detects the changed diff version or GitLab rejects the stale position.
- Draft text is preserved.
- No comment is silently posted as a general discussion.

### E2E-006A — GitHub PR merge success

1. Use a test PR that is mergeable for the current account and repository rules.
2. Click Merge and inspect provider, connection, repository, PR number and branches.
3. Confirm merge.
4. Refresh PR state.

Expected:
- Request includes the current PR head SHA.
- PR becomes merged only after GitHub confirms.
- No auto-merge, merge queue or source-branch deletion option is silently enabled.

### E2E-006B — GitLab MR merge success

1. Use a test MR that is mergeable for the current account and project rules.
2. Click Merge and inspect provider, connection, project, MR IID and branches.
3. Confirm merge.
4. Refresh MR state.

Expected:
- Request includes the current source HEAD SHA.
- MR becomes merged only after GitLab confirms.
- No auto-merge-when-pipeline-succeeds or source-branch deletion option is silently enabled.

### E2E-007A — GitHub merge rejection

Run separate tests for:
- Insufficient repository permission.
- Protected branch or repository rule rejection.
- Stale head SHA.
- Closed PR.
- Merge queue required.

Expected:
- GitHub rejection is displayed.
- No false success notification or implicit queue action occurs.
- PR state is refreshed.
- No automatic retry occurs.

### E2E-007B — GitLab merge rejection

Run separate tests for:
- Insufficient permission.
- Conflict.
- Missing approval.
- Failed pipeline.
- Stale source SHA.
- Closed MR.

Expected:
- GitLab rejection is displayed.
- No false success notification.
- MR state is refreshed.
- No automatic retry occurs.

### E2E-008 — Disable and re-enable a connection

1. Create and validate two connections for the same provider.
2. Bind a workspace repository to the first connection and set it as the provider default.
3. Disable the first connection.
4. Attempt repository discovery and an API-backed command through the existing workspace binding.
5. Inspect the provider default and connection registry.
6. Re-enable the first connection and inspect its status.
7. Explicitly test/re-authenticate only if its last-known status requires it.

Expected:
- The first connection is excluded from selection, discovery, default resolution and outbound requests while disabled.
- Its credential, configuration, last-known status and workspace binding remain stored.
- Disabling it clears the provider default and does not auto-promote the second connection.
- The existing workspace binding is blocked rather than silently reassigned.
- Re-enabling does not automatically validate the credential or switch accounts.

## 11. Security test cases

| ID | Threat / test | Expected result |
|---|---|---|
| SEC-TEST-001 | Search repository/settings/logs for GitHub and GitLab PAT fixtures | No PAT persisted outside SecretStorage |
| SEC-TEST-002 | Inspect Webview messages and state | No token exposed |
| SEC-TEST-003 | Malicious pagination Link to another origin | Rejected before authenticated request |
| SEC-TEST-004 | HTML/script in MR description or comment | Safely escaped/sanitized |
| SEC-TEST-005 | External link with javascript/data scheme | Blocked |
| SEC-TEST-006 | Log HTTP error containing sensitive header | Header redacted |
| SEC-TEST-007 | Disconnect one connection | Corresponding SecretStorage key removed |
| SEC-TEST-008 | User lacks merge permission | Merge is rejected by the provider; no bypass path exists |
| SEC-TEST-009 | GitHub general comment and inline review comment are normalized | Resource kind and reply capability are preserved; no synthetic general-comment thread |
| SEC-TEST-010 | Inspect VS Code logs, Webview messages and CI artifacts | No PAT, private diff body or comment content is exposed |

## 12. Performance and resilience checks

Initial targets (to be validated and adjusted after baseline measurement):

- Extension activation does not wait for GitHub or GitLab network.
- Show a loading state immediately when a network-backed view opens.
- With a normal network and a response under 1 MB, PR/MR list first page should render within 2 seconds after the response is received.
- Large diffs should be paginated/lazy-loaded and must not block extension host event processing.
- Changing MR/project cancels obsolete read requests.
- Rate-limit and transient server errors do not create request storms.
- No automatic retry of ambiguous mutations.

## 13. Release gates

MVP release is blocked until:
- All P0 common test cases pass, and every P0 provider-specific workflow passes against both GitHub and GitLab. A provider-specific unsupported capability must pass its negative test.
- All P0 SRS requirements map to at least one test or inspection.
- GitHub inline review comment mapping and GitLab diff position mapping are verified against real test environments.
- GitHub PR head SHA and GitLab MR source SHA preconditions are verified against real test environments.
- Secret handling and Webview security tests pass.
- No known critical/high severity security defect remains.
- Windows, macOS and Linux smoke tests pass.
- Compatibility floor and tested VS Code, GHES and GitLab versions are documented.
- Manual test results are recorded in the release checklist.


## 14. CI and release automation checks

| ID | Scenario | Expected result |
|---|---|---|
| CI-001 | Pull request CI runs lint and formatting checks | Both pass; failure blocks merge |
| CI-002 | Pull request CI runs TypeScript strict typecheck | No type errors |
| CI-003 | Pull request CI runs unit and mocked provider integration tests | All required tests pass without live credentials |
| CI-004 | Pull request CI builds extension and Webview bundles | Build succeeds reproducibly from lockfile |

## 15. Additional performance checks

| ID | Scenario | Expected result |
|---|---|---|
| PERF-001 | Extension activation with all providers unreachable | Activation completes without waiting for network |
| PERF-002 | Open a large PR/MR diff | Diff is paginated/lazy-loaded; extension host remains responsive |
| PERF-003 | Switch repository while multiple reads are pending | Obsolete requests are cancelled or ignored |
| PERF-004 | Repeated rate-limit/network failures | Bounded retries; no request storm |

## 16. Traceability

Maintain a test-to-requirement mapping as implementation progresses:

| Requirement group | Primary test groups |
|---|---|
| AUTH / CONN | API-AUTH, API-GH-AUTH, UNIT-CONN, E2E-001, SEC-TEST |
| PROJ | UNIT-PROJ, API-PROJ, API-GH-REPO, E2E-001 |
| PR / MR / DETAIL | API-MR, API-GH-PR, E2E-002A/B |
| DIFF | UNIT-DIFF, API-DIFF, API-GH-PR, E2E-003A/B, E2E-005A/B |
| DISC / REVIEW COMMENTS | UNIT-CONV, API-DISC, API-GH-COM, E2E-004A/B |
| MERGE | API-MERGE, API-GH-MERGE, E2E-006A/B, E2E-007A/B |
| APR / PIPE | API-APR, API-PIPE |
| UI / NFR | EXT, SEC-TEST, performance checks |

A test case is considered passed only when the observed result and evidence are recorded. A skipped test must include a reason and an approved deferral.


## 17. Cross-provider acceptance matrix

Every P0 workflow is exercised independently against GitHub.com and GitLab.com. Passing one provider does not verify the other. Use provider-specific fixtures and payload assertions.

| Workflow | GitHub evidence | GitLab evidence | Gate |
|---|---|---|---|
| Connection | GET /user; isolated PAT | GET /user; isolated PAT | P0 |
| Binding | Repository ID + PR scope | Project ID + MR IID scope | P0 |
| List/detail/pagination | Pulls endpoints + Link | MR endpoints + pagination | P0 |
| Diff/line mapping | patch + LEFT/RIGHT | diff SHAs + old/new lines | P0 |
| General comment/reply | Issue comments + review reply | Discussions + notes | P0 |
| Inline comment | Head SHA, path, line, side | base/start/head SHA, paths, old/new line | P0 |
| Merge | Current PR head SHA + confirmation | Current MR source SHA + confirmation | P0 |
| Permission/errors | 401/403/404/409/422/rate limit | 401/403/404/409/422/rate limit | P0 |

### 17.1. Negative cases

Credentials never cross connection/provider/host boundaries. A valid identity with insufficient repository permission remains a valid connection. Missing/collapsed diff is not empty success. GitHub general comments are not inline comments; GitLab Notes do not replace discussion threads. Checks/pipelines for another head SHA are not current. Mutation timeout requires state reconciliation; no duplicate retry. Disabled connections cannot be selected, resolved as default or issue requests.

E2E scenarios may be parameterized only when semantics are equivalent. Provider-specific resource behavior needs separate assertions. Record host/version, account permissions, repository/project, test IDs and outcomes.
