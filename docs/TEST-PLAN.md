# ReviewDock — Multi-provider Test Plan

> **Document ID:** RVD-TEST-001  
> **Version:** 0.1.0  
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
- GitHub Enterprise Server: at least one supported test instance before release; verify API root and supported API version.
- GitLab.com: one account with project read access, one with discussion write access and one with merge permission.
- GitLab Self-Managed: test the proposed compatibility floor and a current supported instance.

For each provider, prepare an open PR/MR with added, removed and modified lines, at least one review conversation, and a repository/project with merge restrictions for negative tests. Enable GitHub Checks/Actions or GitLab pipelines if P1 tests are enabled.

The proposed GitLab technical floor is 17.0. The exact GitHub Enterprise Server target and complete provider compatibility matrix must be confirmed before release.

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
- Discussion with multiple replies.
- General note/discussion.
- Inline discussion with old/new line positions.
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

### 7.4. Domain and error mapping

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
| API-GH-PR-002 | Retrieve PR files with pagination | All pages loaded; missing patches represented explicitly |
| API-GH-COM-001 | Create general PR comment | Issue comment endpoint is used |
| API-GH-COM-002 | Create inline comment on added line | Current head SHA, path, line and RIGHT side sent |
| API-GH-COM-003 | Create inline comment on removed line | Current head SHA, path, line and LEFT side sent |
| API-GH-COM-004 | Reply to review comment | Correct review-comment reply endpoint used |
| API-GH-MERGE-001 | Merge PR | Current head SHA included |
| API-GH-MERGE-002 | Head SHA mismatch | 409/conflict shown; no automatic retry |
| API-GH-MERGE-003 | Merge rejected by rules/permission | Server rejection surfaced accurately |
| API-GH-CHECK-001 | Check run SHA differs from PR head | Check is not shown as current |
| API-GH-PAGE-001 | Pagination Link points to another origin | Link rejected before token is attached |

### P1 API tests

| ID | Scenario | Expected result |
|---|---|---|
| API-APR-001 | Community Edition approval response | Only returned fields displayed |
| API-APR-002 | Premium/Ultimate approval state available | Rules and counts displayed |
| API-APR-003 | Approval endpoint unavailable | MR detail remains usable |
| API-PIPE-001 | MR pipelines returned | Pipeline summary mapped |
| API-PIPE-002 | Pipeline SHA differs from MR head | Pipeline marked as not current |
| API-PIPE-003 | Jobs request returns paginated results | Job list loads pages |

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

## 10. Manual end-to-end scenarios

### E2E-001 — Create and use multiple connections

1. Install extension in VS Code.
2. Add a GitHub connection with a display name and PAT; test and save it.
3. Add a GitLab connection with a different display name and PAT; test and save it.
4. Add a second account on one of the same provider hosts.
5. Bind two workspace folders to different connections and repositories.
6. Restart VS Code and reopen ReviewDock.
7. Disconnect one connection and verify the other remains usable.

Expected:
- All connection records and repository bindings remain available.
- Each token is retrieved from its own SecretStorage key.
- The account picker appears when more than one connection matches a remote.
- Disconnecting one connection does not affect another.

### E2E-002 — Discover and open MR

1. Open ReviewDock.
2. Select Review requested.
3. Load more results.
4. Search by title.
5. Open an MR.

Expected:
- Correct MR results and pagination.
- MR detail displays metadata and current state.
- No unrelated project's MR appears in the active project view.

### E2E-003 — Review changed files

1. Open Changes.
2. Navigate through added, modified, deleted and renamed files.
3. Inspect line numbers and hunks.
4. Open a binary or oversized diff.

Expected:
- File state and diff are accurate.
- Unsupported patch is explained.
- Non-diff rows cannot receive comments.

### E2E-004 — Comment and reply

1. Add a general comment.
2. Add a comment on an added line.
3. Add a comment on a removed line.
4. Reply to a discussion.
5. Refresh the MR in GitLab Web.

Expected:
- All comments appear at the correct thread/line.
- No duplicate comments are created.
- The UI shows the server response.

### E2E-005 — Stale diff protection

1. Open an MR diff in ReviewDock.
2. Push a new commit to the source branch from another session.
3. Attempt to submit a comment using the old diff context.

Expected:
- ReviewDock detects the changed diff version or GitLab rejects the stale position.
- Draft text is preserved.
- No comment is silently posted as a general note.

### E2E-006 — Merge success

1. Use a test MR that is mergeable for the current user.
2. Click Merge.
3. Verify the confirmation identifies project, IID and target branch.
4. Confirm merge.
5. Refresh state.

Expected:
- Request includes the current source SHA.
- MR becomes merged only after GitLab confirms.
- No auto-merge or source-branch deletion option is silently enabled.

### E2E-007 — Merge rejection

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
| SEC-TEST-008 | User lacks merge permission | Merge is rejected by GitLab; no bypass path exists |

## 12. Performance and resilience checks

Initial targets (to be validated and adjusted after baseline measurement):

- Extension activation does not wait for GitLab network.
- Show a loading state immediately when a network-backed view opens.
- With a normal network and a response under 1 MB, MR list first page should render within 2 seconds after the response is received.
- Large diffs should be paginated/lazy-loaded and must not block extension host event processing.
- Changing MR/project cancels obsolete read requests.
- Rate-limit and transient server errors do not create request storms.
- No automatic retry of ambiguous mutations.

## 13. Release gates

MVP release is blocked until:
- All P0 test cases pass for both GitHub and GitLab.
- All P0 SRS requirements map to at least one test or inspection.
- GitHub inline review comment mapping and GitLab diff position mapping are verified against real test environments.
- GitHub PR head SHA and GitLab MR source SHA preconditions are verified against real test environments.
- Secret handling and Webview security tests pass.
- No known critical/high severity security defect remains.
- Windows, macOS and Linux smoke tests pass.
- Compatibility floor and tested GitLab versions are documented.
- Manual test results are recorded in the release checklist.

## 14. Traceability

Maintain a test-to-requirement mapping as implementation progresses:

| Requirement group | Primary test groups |
|---|---|
| AUTH / CONN | API-AUTH, API-GH-AUTH, UNIT-CONN, E2E-001, SEC-TEST |
| PROJ | UNIT-PROJ, API-PROJ, API-GH-REPO, E2E-001 |
| PR / MR / DETAIL | API-MR, API-GH-PR, E2E-002 |
| DIFF | UNIT-DIFF, API-DIFF, E2E-003, E2E-005 |
| DISC / REVIEW COMMENTS | API-DISC, API-GH-COM, E2E-004 |
| MERGE | API-MERGE, API-GH-MERGE, E2E-006, E2E-007 |
| APR / PIPE | API-APR, API-PIPE |
| UI / NFR | EXT, SEC-TEST, performance checks |

A test case is considered passed only when the observed result and evidence are recorded. A skipped test must include a reason and an approved deferral.
