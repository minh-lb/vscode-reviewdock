# ReviewDock — Proposed Technical Decisions

> **Document ID:** RVD-DEC-001  
> **Version:** 0.2.0  
> **Status:** Proposed — Product Owner approval required  
> **Applies to:** MVP implementation baseline

This document records recommended defaults needed to turn the SRS into an implementable baseline for GitHub and GitLab, including multiple independent connections. A proposed decision is not considered approved until the Product Owner accepts it. If a decision is rejected, update this document and the dependent SDS, API-SPEC, UI-UX, TEST-PLAN, and IMPLEMENTATION-PLAN before coding the affected feature.

## Decision summary

| ID | Topic | Proposed MVP decision | Consequence |
|---|---|---|---|
| DEC-001 | Authentication | PAT for GitHub and GitLab in MVP; OAuth deferred | GitHub fine-grained permissions and GitLab `api` scope differ; store one secret per connection |
| DEC-002 | UI architecture | Hybrid: native VS Code Tree View + React Webview for PR/MR detail/diff/conversations | Native navigation with a custom review surface |
| DEC-003 | Inline comments | Single-line diff comments in MVP; multi-line comments later | Reduces initial diff-position complexity |
| DEC-004 | Repository discovery | Auto-detect GitHub/GitLab remotes and allow manual selection | Host identifies a server, not necessarily the account; multiple matching connections require a picker |
| DEC-005 | Provider compatibility | GitLab current + previous two maintained minor releases; latest and oldest still-supported GHES at release; current Stable and approved minimum VS Code engine | Dynamic vendor-maintained compatibility floor; publish exact tested versions |
| DEC-006 | Multi-connection workspace model | Multiple GitHub/GitLab connections; one active repository binding per workspace folder; one default per provider | Supports multiple accounts/hosts without a global active-account collision |
| DEC-007 | Review decision | General comments, inline comments and replies in MVP; approve/request-changes actions deferred | Commenting is not approval |
| DEC-008 | Pipeline and approval UI | P1 after core review workflow | Merge remains server-authoritative even without a local pipeline/approval panel |
| DEC-009 | Merge behavior | Immediate merge only; no auto-merge; do not delete source branch by default; respect project squash policy | No deferred merge action or implicit destructive branch cleanup |
| DEC-010 | Localization | English extension UI for MVP; project documentation may be Vietnamese | One UI locale initially; avoid blocking implementation on localization |
| DEC-011 | Webview framework | React + TypeScript, bundled locally | Typed component UI; no remote scripts or runtime CDN |
| DEC-012 | Diff rendering | Normalize GitHub/GitLab file diffs into a shared diff model; provider adapters map comment positions | Comment positions must use provider-specific current commit/diff metadata, never guessed |
| DEC-016 | Connection enablement | Each connection has an independent enabled flag, default true; disabled connections are excluded from selection and all API requests | Preserve credentials/status/bindings; clear disabled defaults; no automatic failover |
| DEC-017 | Review conversation semantics | Preserve GitHub issue comments, inline review comments and review submissions as distinct resources; expose only provider-supported reply/resolve actions | No false cross-provider parity; GitHub general comments are not replyable and GitHub REST thread resolution is unavailable |
| DEC-018 | Review request discovery | Use provider-native filters; GitHub uses Search Issues API for user-scoped filters and GitLab uses MR list scopes | Disclose GitHub search rate limit/result cap; never claim incomplete search is exhaustive |
| DEC-019 | VS Code engine | Proposed minimum VS Code engine is 1.140.0; test minimum and current Stable | Confirm extension API usage and approve before M0 locks package.json |

## Detailed decisions

### DEC-001 — Authentication: provider-specific PATs first

**Decision proposed:** MVP accepts a provider-specific Personal Access Token for each GitHub or GitLab connection.

- GitHub: prefer a fine-grained PAT limited to selected repositories and the minimum permissions required by enabled endpoints. Review-comment creation and merge do not necessarily use the same permission set; validate against GitHub's endpoint permission documentation.
- GitLab: the proposed full-MVP scope is `api` because the extension creates discussions/comments and requests merges. This scope is broad; disclose it clearly.
- Store each token in SecretStorage under an immutable connection ID. Never share credentials between connections, even on the same host.
- Do not create, rotate or revoke provider tokens on the user's behalf.
- Recommend expiring, dedicated tokens and provide provider-specific instructions.
- OAuth may be added later through the same per-connection credential abstraction.

**Trade-off:** PAT setup is simpler for MVP, but permissions differ by provider and GitLab's `api` scope is broad. The connection wizard must show provider-specific guidance and never imply that one scope model applies to both.

### DEC-002 — Hybrid UI

**Decision proposed:**

- Activity Bar and MR/project navigation use native VS Code views and TreeView.
- MR detail, tabs, diff rendering and discussion composer use a local React Webview.
- Opening a file in the local workspace uses the native VS Code editor.
- The Webview receives only the data required to render the current view. It never receives access tokens or unrestricted API capabilities.
- Use a strict Content Security Policy, local bundled assets and validated message contracts.

### DEC-003 — Inline comment scope

**Decision proposed:**

- MVP supports a single changed line per inline comment.
- Added lines map to `new_line`; removed lines map to `old_line`; context lines map to both old and new line numbers.
- A line is commentable only if it is part of the provider-provided diff and all provider-required current commit/diff-version metadata is available.
- GitHub maps the added/context side to RIGHT and removed lines to LEFT using the current PR head SHA; GitLab maps old/new line fields using the selected diff version SHAs.
- Multi-line comments, image diffs and file-level comments are deferred until the single-line mapping is verified.

### DEC-004 — Project discovery

**Decision proposed:**

1. Read Git remotes for each workspace repository.
2. Parse HTTPS and SSH GitHub/GitLab remote URLs.
3. Match the remote hostname to configured provider servers.
4. Resolve the repository/project path through the selected provider adapter.
5. If multiple accounts on the same host can access the repository, require an explicit connection/account choice.
6. If resolution is ambiguous or fails, offer manual connection and repository selection.
7. Never send a remote URL to a third-party service.

### DEC-005 — Vendor-maintained provider compatibility

**Decision proposed:** use GitHub REST API v3 and GitLab REST API v4, with compatibility determined by vendor-maintained server releases at the time of each ReviewDock release.

- GitLab Self-Managed: support the current minor release and the previous two vendor-maintained minor releases at release time. Test the oldest and newest releases in that window.
- GitHub Enterprise Server: support the latest GHES feature release and the oldest feature release still supported by GitHub at release time. Test both.
- GitHub.com and GitLab.com follow their hosted-service API behavior.
- Do not assume GitHub.com and GHES expose identical API versions, headers or capabilities.
- Treat optional response fields as optional and feature-detect endpoint capabilities.
- Publish exact tested versions, editions and known limitations before release.
- Re-check the vendor maintenance policy before every release; never retain an unsupported release as the compatibility floor solely for backward compatibility.

**Compatibility snapshot reviewed 2026-11-16:** GitLab maintained releases were 19.3, 19.4 and 19.5; GHES supported releases included 3.19 through 3.22. These are a dated snapshot, not a permanent support promise.

### DEC-006 — Workspace project model

**Decision proposed:**

- Users may save multiple GitHub and GitLab connections, including multiple accounts on the same provider/server.
- No arbitrary small fixed connection limit is imposed.
- Each workspace folder/repository has one active connection + repository/project binding.
- Multi-root workspaces can use different providers and accounts in different folders.
- Support one optional default connection per provider; a workspace binding takes precedence.
- A repository binding stores connection ID and provider repository/project ID; it never stores credentials.
- Connection IDs are immutable; display names may be renamed and are not identifiers.
- Duplicate display names are allowed but the UI disambiguates with provider, host and account login.
- Switching a workspace binding cancels in-flight requests and invalidates the previous selection's view state.

### DEC-007 / DEC-008 — Review decision, checks/pipeline and approvals

**Decision proposed:**

- MVP includes general comments and single-line inline comments on both providers, plus replies only for provider-supported thread types. GitHub general issue comments cannot be replied to through the selected REST workflow; GitHub inline review replies are limited to one reply level; GitLab discussion notes support replies.
- MVP does not expose GitHub Approve/Request changes or GitLab Approve/Unapprove actions; these are P1 provider-specific review decisions.
- GitHub Checks/Actions and GitLab Pipeline/Jobs panels are P1.
- Approval/review capabilities are provider-specific; missing fields mean unavailable/unknown, not zero or false. GitLab's basic approval-state endpoint is available on Community Edition with a reduced field set; detailed rule fields are edition-dependent.
- Merge is sent to the selected provider and can be rejected by repository/project rules. The client must not infer approval or check status from missing API data.

### DEC-009 — Merge safety

**Decision proposed:**

- MVP performs immediate merge only.
- Do not send `auto_merge=true` or deprecated `merge_when_pipeline_succeeds`.
- Fetch the PR/MR immediately before merge and send its current source/head SHA using the provider's expected request field.
- Require an explicit confirmation showing provider, connection, repository/project, PR number or MR IID, source branch and target branch.
- Do not set source-branch deletion options; source-branch deletion remains governed by repository/project policy unless a separately approved feature is added.
- Do not override repository/project squash policy. Let the provider enforce its configured merge method and restrictions.
- GitHub direct merge does not support merge queues; merge-queue and asynchronous merge workflows are outside MVP.
- Never retry an ambiguous merge mutation automatically.



### DEC-013 — Multi-provider adapter architecture

**Decision proposed:**
- Implement GitHub and GitLab as separate provider adapters behind a provider-neutral application contract.
- Normalize repository, review request, diff file, user, check/pipeline summary and merge result while preserving provider-native identifiers.
- Model conversations as provider-aware resource types; a general issue comment, inline review comment, GitLab discussion note and review submission are not interchangeable.
- Expose reply, resolve, edit and delete operations only when the adapter capability descriptor supports them.
- Display provider-native terminology: Pull Request for GitHub and Merge Request for GitLab.

### DEC-014 — Connection identity and lifecycle

**Decision proposed:**
- Connection ID is an immutable UUID; provider and server URL are immutable after creation.
- Display name is user-editable and may be duplicated.
- A likely duplicate is provider + normalized server URL + provider account ID; warn without merging identities.
- Support Test, Rename, Re-authenticate, Disconnect, Delete and Set Default.
- Support one optional default per provider and one active binding per workspace folder.
- Changing server URL requires creating a new connection and validating it; never move a token silently to another host.
- Disconnect removes only that connection's secret and retains its configuration; Delete removes both and leaves its repository bindings unresolved.

### DEC-015 — Provider capabilities

**Decision proposed:**
- Each adapter exposes a capability descriptor for general comments, inline comments, reply by conversation type, thread resolution, edit/delete, review/approval actions, checks/pipelines and merge options.
- Capability values distinguish supported, unsupported, conditional and unknown; they are not inferred from absent response fields.
- The UI renders only supported actions and uses a clear unavailable state for unsupported capabilities.
- Shared UI must not imply identical behavior across providers.

### DEC-016 — Per-connection enabled state

**Decision proposed:**
- Every connection has a user-controlled enabled boolean, defaulting to true when created.
- enabled is independent from the last-known connection health/authentication status.
- A disabled connection is excluded from workspace resolution, remote discovery, manual selection, provider defaults and all outbound API requests. Enforce this before credential lookup.
- Disabling preserves the credential, configuration, last-known status and workspace bindings.
- A disabled connection cannot be a provider default. Disabling the current default clears it; do not automatically promote another connection.
- Existing workspace bindings to a disabled connection remain stored but blocked until the user enables it or explicitly selects another connection.
- Re-enabling does not trigger implicit validation; the existing status still governs whether provider operations are allowed.
- Pending reads are cancelled where possible. A mutation already submitted may still complete and must be reconciled after re-enabling rather than assumed rolled back.

**Rationale:** allow users to temporarily suspend an account without deleting credentials or losing repository configuration, while preventing accidental use of the wrong account.



### DEC-017 — Review conversation semantics

**Decision proposed:**

- Keep GitHub issue comments, GitHub inline review comments, GitHub review submissions and GitLab discussions/notes as distinct provider-native resource types.
- GitHub general issue comments are standalone timeline comments; do not render a Reply action for them.
- GitHub inline review comments support a reply to a top-level comment only. Do not allow a reply to a reply.
- GitHub REST adapter does not expose GitLab-style resolve/reopen for review threads; do not show that action.
- GitLab general and inline discussions can receive reply notes. Resolve/reopen is exposed only when the endpoint and current user's permission allow it.
- Preserve thread IDs, note/comment IDs, parent relationships, system-note flags and resolution state without synthesizing missing values.

**Rationale:** a common timeline is useful, but flattening provider-specific conversation semantics would expose actions that cannot be fulfilled or would misrepresent review history.

### DEC-018 — Review request discovery and search

**Decision proposed:**

- GitLab uses the Merge Requests list API with explicit scopes such as `created_by_me`, `assigned_to_me`, `reviews_for_me` and `all`.
- GitHub uses the repository Pull Requests list API for ordinary state/pagination and the Search Issues API for title and user-scoped filters such as `author:@me`, `assignee:@me` and `user-review-requested:@me`.
- GitHub Search API results are limited by the search rate limit and the 1,000-result cap. The UI must show a limited/incomplete state when the cap is reached.
- Team review-request discovery is not claimed for MVP unless a team-aware query and membership behavior are implemented and tested.
- Fetch full PR detail before displaying fields not supplied by search results.

**Rationale:** provider-native query semantics are more accurate than downloading all requests and attempting to reconstruct account-level filters locally.

### DEC-019 — Minimum VS Code engine

**Decision proposed:** use VS Code `^1.140.0` as the initial minimum engine target, subject to a compatibility spike before M0 locks the extension manifest.

- Test the minimum engine and the current Stable release.
- If the implementation requires a newer API, either raise the minimum with an explicit decision or use a supported fallback.
- Do not declare compatibility with versions that have not been tested.

**Rationale:** a bounded minimum makes the extension manifest, CI matrix and release support statement implementable. The proposal is based on the 2026-11 compatibility review and must be rechecked before release.

## Approval checklist

- [ ] DEC-001 Provider-specific authentication approved.
- [ ] DEC-002 UI architecture approved.
- [ ] DEC-003 Inline-comment MVP scope approved.
- [ ] DEC-004 Project discovery approved.
- [ ] DEC-005 Vendor-maintained provider compatibility policy approved.
- [ ] DEC-006 Workspace project model approved.
- [ ] DEC-007 / DEC-008 Review conversation, review decision, checks/pipeline and approval scope approved.
- [ ] DEC-009 Merge behavior approved.
- [ ] DEC-010 Localization approved.
- [ ] DEC-011 Webview framework approved.
- [ ] DEC-012 Diff rendering approach approved.
- [ ] DEC-013 Multi-provider adapter architecture approved.
- [ ] DEC-014 Connection identity and lifecycle approved.
- [ ] DEC-015 Provider capability model approved.
- [ ] DEC-016 Per-connection enabled/disabled behavior approved.
- [ ] DEC-017 Review conversation semantics approved.
- [ ] DEC-018 Review request discovery and search approved.
- [ ] DEC-019 Minimum VS Code engine approved.

**Implementation rule:** begin work on a feature only after its relevant proposed decisions are approved. Foundation work that does not depend on unresolved decisions may proceed independently.
