# ReviewDock — Proposed Technical Decisions

> **Document ID:** RVD-DEC-001  
> **Version:** 0.1.0  
> **Status:** Proposed — Product Owner approval required  
> **Applies to:** MVP implementation baseline

This document records recommended defaults needed to turn the SRS into an implementable baseline for GitHub and GitLab, including multiple independent connections. A proposed decision is not considered approved until the Product Owner accepts it. If a decision is rejected, update this document and the dependent SDS, API-SPEC, UI-UX, TEST-PLAN, and IMPLEMENTATION-PLAN before coding the affected feature.

## Decision summary

| ID | Topic | Proposed MVP decision | Consequence |
|---|---|---|---|
| DEC-001 | Authentication | PAT for GitHub and GitLab in MVP; OAuth deferred | GitHub fine-grained permissions and GitLab `api` scope differ; store one secret per connection |
| DEC-002 | UI architecture | Hybrid: native VS Code Tree View + React Webview for MR detail/diff/discussions | Native navigation with a custom review surface |
| DEC-003 | Inline comments | Single-line diff comments in MVP; multi-line comments later | Reduces initial diff-position complexity |
| DEC-004 | Repository discovery | Auto-detect GitHub/GitLab remotes and allow manual selection | Host identifies a server, not necessarily the account; multiple matching connections require a picker |
| DEC-005 | Provider compatibility | GitLab 17.0+ REST API v4 target; GitHub.com + a tested GitHub Enterprise Server target using REST API v3 | Validate exact server versions; feature-detect optional capabilities |
| DEC-006 | Multi-connection workspace model | Multiple GitHub/GitLab connections; one active repository binding per workspace folder; one default per provider | Supports multiple accounts/hosts without a global active-account collision |
| DEC-007 | Review decision | General comments, inline comments and replies in MVP; approve/request-changes actions deferred | Commenting is not approval |
| DEC-008 | Pipeline and approval UI | P1 after core review workflow | Merge remains server-authoritative even without a local pipeline/approval panel |
| DEC-009 | Merge behavior | Immediate merge only; no auto-merge; do not delete source branch by default; respect project squash policy | No deferred merge action or implicit destructive branch cleanup |
| DEC-010 | Localization | English extension UI for MVP; project documentation may be Vietnamese | One UI locale initially; avoid blocking implementation on localization |
| DEC-011 | Webview framework | React + TypeScript, bundled locally | Typed component UI; no remote scripts or runtime CDN |
| DEC-012 | Diff rendering | Normalize GitHub/GitLab file diffs into a shared diff model; provider adapters map comment positions | Comment positions must use provider-specific current commit/diff metadata, never guessed |

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
- A line is commentable only if it is part of a GitLab-provided diff and its diff version metadata is available.
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

### DEC-005 — GitLab compatibility

**Decision proposed:** use GitLab REST API v4 with GitLab 17.0 as the initial technical floor, and GitHub REST API v3 for GitHub.com plus a GitHub Enterprise Server version selected and tested before release.

- Do not assume GitHub.com and GitHub Enterprise Server expose identical API versions or capabilities.
- Treat optional response fields as optional and feature-detect endpoint capabilities.
- Verify all required workflows against the oldest supported GitLab instance, current GitLab.com, GitHub.com and the selected GHES version.
- Publish the exact tested compatibility matrix before release.

GitLab 17.0 is a proposed technical floor, not a statement that this version remains within GitLab's vendor support window.

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

- MVP includes general comments, inline review comments and replies for both GitHub PRs and GitLab MRs where the provider supports the operation.
- MVP does not expose Approve/Request changes or GitLab Approve/Unapprove actions.
- GitHub Checks/Actions and GitLab Pipeline/Jobs panels are P1.
- Approval/review capabilities are provider-specific; missing fields mean unavailable/unknown, not zero or false.
- Merge is sent to the selected provider and can be rejected by repository/project rules. The client must not infer approval or check status from missing API data.

### DEC-009 — Merge safety

**Decision proposed:**

- MVP performs immediate merge only.
- Do not send `auto_merge=true` or deprecated `merge_when_pipeline_succeeds`.
- Fetch the MR immediately before merge and send its current source HEAD SHA as `sha`.
- Require an explicit confirmation showing project, MR IID, source branch and target branch.
- Do not set `should_remove_source_branch=true`; source-branch deletion remains governed by project settings unless a separately approved feature is added.
- Do not override the project's squash policy. If the server requires or disallows squash, let GitLab enforce it.
- Never retry an ambiguous merge mutation automatically.



### DEC-013 — Multi-provider adapter architecture

**Decision proposed:**
- Implement GitHub and GitLab as separate provider adapters behind a common application contract.
- Normalize shared concepts such as repository, review request, diff file, review conversation, check status and merge result.
- Preserve provider-specific IDs, fields and capabilities in adapter DTOs.
- Do not force GitHub review threads and GitLab discussions into identical semantics where the APIs differ.
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
- Each adapter exposes a capability descriptor for inline comments, replies, thread resolution, review/approval actions, checks/pipelines and merge options.
- The UI renders only supported actions and uses a clear unavailable state for unsupported capabilities.
- Shared UI must not imply identical behavior across providers.

## Approval checklist

- [ ] DEC-001 Provider-specific authentication approved.
- [ ] DEC-002 UI architecture approved.
- [ ] DEC-003 Inline-comment MVP scope approved.
- [ ] DEC-004 Project discovery approved.
- [ ] DEC-005 GitLab compatibility floor approved.
- [ ] DEC-006 Workspace project model approved.
- [ ] DEC-007 / DEC-008 Review, pipeline and approval scope approved.
- [ ] DEC-009 Merge behavior approved.
- [ ] DEC-010 Localization approved.
- [ ] DEC-011 Webview framework approved.
- [ ] DEC-012 Diff rendering approach approved.
- [ ] DEC-013 Multi-provider adapter architecture approved.
- [ ] DEC-014 Connection identity and lifecycle approved.
- [ ] DEC-015 Provider capability model approved.

**Implementation rule:** begin work on a feature only after its relevant proposed decisions are approved. Foundation work that does not depend on unresolved decisions may proceed independently.
