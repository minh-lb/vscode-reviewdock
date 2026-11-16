# ReviewDock — Proposed Technical Decisions

> **Document ID:** RVD-DEC-001  
> **Version:** 0.1.0  
> **Status:** Proposed — Product Owner approval required  
> **Applies to:** MVP implementation baseline

This document records recommended defaults needed to turn the SRS into an implementable baseline. A proposed decision is not considered approved until the Product Owner accepts it. If a decision is rejected, update this document and the dependent SDS, API-SPEC, UI-UX, TEST-PLAN, and IMPLEMENTATION-PLAN before coding the affected feature.

## Decision summary

| ID | Topic | Proposed MVP decision | Consequence |
|---|---|---|---|
| DEC-001 | Authentication | GitLab Personal Access Token (PAT) first; OAuth 2.0 deferred | Simple setup; PAT with `api` scope is broad and must be stored securely |
| DEC-002 | UI architecture | Hybrid: native VS Code Tree View + React Webview for MR detail/diff/discussions | Native navigation with a custom review surface |
| DEC-003 | Inline comments | Single-line diff comments in MVP; multi-line comments later | Reduces initial diff-position complexity |
| DEC-004 | Project discovery | Auto-detect Git remote and allow manual project selection | Works with common remote formats and unusual setups |
| DEC-005 | GitLab compatibility | Technical compatibility target: GitLab 17.0+ using REST API v4; verify on supported test instances | Avoid depending on newer optional fields; feature-detect optional capabilities |
| DEC-006 | Workspace project model | Multiple saved GitLab instances; one active project per workspace folder in MVP | Keeps navigation predictable while allowing multiple repositories |
| DEC-007 | Review decision | General comments, inline comments and replies in MVP; approve/request-changes actions deferred | Commenting is not approval |
| DEC-008 | Pipeline and approval UI | P1 after core review workflow | Merge remains server-authoritative even without a local pipeline/approval panel |
| DEC-009 | Merge behavior | Immediate merge only; no auto-merge; do not delete source branch by default; respect project squash policy | No deferred merge action or implicit destructive branch cleanup |
| DEC-010 | Localization | English extension UI for MVP; project documentation may be Vietnamese | One UI locale initially; avoid blocking implementation on localization |
| DEC-011 | Webview framework | React + TypeScript, bundled locally | Typed component UI; no remote scripts or runtime CDN |
| DEC-012 | Diff rendering | Render parsed GitLab unified diff in the Webview; use structured line mapping for comments | Comment positions must be derived from GitLab diff refs and hunk metadata, never guessed |

## Detailed decisions

### DEC-001 — Authentication: PAT first

**Decision proposed:** MVP accepts a GitLab Personal Access Token entered by the user.

- Send the token using the `PRIVATE-TOKEN` request header.
- Require the `api` scope for the full MVP because the product creates discussions/comments and invokes merge operations. `read_api` alone is insufficient for those writes.
- Do not create, rotate, or revoke tokens on the user's behalf.
- Store the token in VS Code SecretStorage; never send it to the Webview.
- Recommend that users create a dedicated token with an expiry date and revoke it from GitLab when no longer needed.
- OAuth 2.0 may be added later if the project is prepared to register and maintain an OAuth application and callback flow.

**Trade-off:** PAT setup is straightforward for an individual/developer tool, but the `api` scope grants broad API access. This must be clearly disclosed in the connection UI.

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
2. Parse HTTPS and SSH GitLab remote URLs.
3. Match the remote hostname to a configured GitLab instance.
4. Resolve the namespace/project path through the Projects API.
5. If resolution is ambiguous or fails, offer manual instance and project selection.
6. Never send a remote URL to a third-party service.

### DEC-005 — GitLab compatibility

**Decision proposed:** use GitLab REST API v4 and set GitLab 17.0 as the initial technical compatibility floor.

- Do not rely on fields or filters introduced after 17.0 for MVP behavior.
- Treat optional response fields as optional.
- Feature-detect newer fields such as diff `collapsed` / `too_large` flags introduced in later releases.
- Verify the API workflows against the oldest supported test instance and a current GitLab instance before release.
- Revisit the floor if a required API behavior cannot be supported reliably on 17.0.

This is a proposed technical floor, not a statement that GitLab 17.0 remains within GitLab's vendor support window.

### DEC-006 — Workspace project model

**Decision proposed:**

- Users may save more than one GitLab instance.
- Each workspace folder has one active GitLab project in MVP.
- Multi-root workspaces can have one project mapping per workspace folder.
- A project mapping stores instance identifier and numeric project ID; it must not store credentials.
- Switching active project must cancel in-flight requests from the previously selected project.

### DEC-007 / DEC-008 — Review decision, pipeline and approvals

**Decision proposed:**

- MVP includes general MR comments, inline comments and discussion replies.
- MVP does not expose Approve, Unapprove or Request changes actions.
- Pipeline and approval panels are P1.
- The Merge action is still sent to GitLab and can be rejected by project rules. The client must not infer approval or pipeline state from missing API data.

### DEC-009 — Merge safety

**Decision proposed:**

- MVP performs immediate merge only.
- Do not send `auto_merge=true` or deprecated `merge_when_pipeline_succeeds`.
- Fetch the MR immediately before merge and send its current source HEAD SHA as `sha`.
- Require an explicit confirmation showing project, MR IID, source branch and target branch.
- Do not set `should_remove_source_branch=true`; source-branch deletion remains governed by project settings unless a separately approved feature is added.
- Do not override the project's squash policy. If the server requires or disallows squash, let GitLab enforce it.
- Never retry an ambiguous merge mutation automatically.

## Approval checklist

- [ ] DEC-001 Authentication approved.
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

**Implementation rule:** begin work on a feature only after its relevant proposed decisions are approved. Foundation work that does not depend on unresolved decisions may proceed independently.
