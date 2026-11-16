# ReviewDock — Multi-provider UI/UX Specification

> **Document ID:** RVD-UX-001  
> **Version:** 0.1.0  
> **Status:** Proposed — depends on approval of [DECISIONS.md](./DECISIONS.md)  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md)

## 1. UX goals

ReviewDock should let a developer manage multiple GitHub/GitLab connections, discover a Pull Request or Merge Request, understand its changes, discuss code and safely merge without leaving VS Code for routine work.

UX priorities:
1. Make the current GitLab instance and project obvious.
2. Keep MR discovery fast and predictable.
3. Make diff and discussion the primary review surface.
4. Make comment position and diff version visible enough to avoid reviewing stale code.
5. Make merge a deliberate, explicit action.
6. Follow VS Code theme, keyboard and accessibility conventions.

## 2. Navigation model

### 2.1. Activity Bar

Add an Activity Bar container named **ReviewDock**. The connection manager is a first-class view; do not assume a single GitLab account.

### 2.2. Sidebar views

~~~text
REVIEWDOCK
  [Workspace repository / Connection selector]

  CONNECTIONS
    Personal GitHub · @user · Connected
    Company GitHub · @user · Connected
    Personal GitLab · @user · Connected
    Company GitLab · @user · Re-auth required
    [+ Add Connection]

  REVIEW REQUESTS
    Review requested
    Assigned to me
    Created by me
    Open
    Closed
    Merged
~~~

Rules:
- Each workspace folder/repository has its own active connection + repository binding.
- A selector shows provider, connection name, account login, host and repository/project path.
- A workspace binding takes precedence over the default connection for its provider.
- A default connection is maintained separately for GitHub and GitLab.
- Review request groups use lazy loading and pagination.
- Tree items show provider-native identifier (PR number or MR IID), title and concise state indicators.
- Use VS Code badges/context values where supported; do not encode all status information only by color.
- Empty views provide an action to connect GitLab or select a project.
- Refresh is available from the view title and context menu.

### 2.3. Commands

| Command | Purpose | Availability |
|---|---|---|
| ReviewDock: Add Connection | Create a GitHub or GitLab connection | P0 |
| ReviewDock: Manage Connections | Test, rename, re-authenticate, disconnect, delete, set default | P0 |
| ReviewDock: Select Connection | Select the account for the active workspace repository | P0 |
| ReviewDock: Select Repository | Select or resolve GitHub repository / GitLab project | P0 |
| ReviewDock: Refresh | Refresh active view/MR | P0 |
| ReviewDock: Open Review Request | Open selected GitHub PR or GitLab MR detail | P0 |
| ReviewDock: Open on GitLab | Open MR web URL | P1 |
| ReviewDock: Merge Merge Request | Start confirmed merge workflow | P0 |
| ReviewDock: Add Comment | Create general or inline comment from active review context | P0 |



## 3. Connection management

### 3.1. Connection list

~~~text
┌─ CONNECTIONS ───────────────────────────────────────────────────────┐
│ [+ Add Connection]                                      [Refresh]   │
├────────────────────────────────────────────────────────────────────┤
│ [GitHub] Personal GitHub                         ● Connected        │
│         github.com · @minh-lb                    [⋯]                │
│                                                                    │
│ [GitHub] Company GitHub                          ● Connected        │
│         github.company.com · @minh-lb            [⋯]                │
│                                                                    │
│ [GitLab] Personal GitLab                         ● Connected        │
│         gitlab.com · @minh-lb                    [⋯]                │
│                                                                    │
│ [GitLab] Internal GitLab                         ! Re-auth required│
│         git.internal.example · @developer        [⋯]                │
└────────────────────────────────────────────────────────────────────┘
~~~

Each connection row shows provider icon, display name, server host, authenticated account login, status and default marker. The actions menu contains:
- Test connection
- Rename
- Re-authenticate
- Set as default for provider
- Disconnect
- Delete

A duplicate display name is allowed, but the UI must show provider, host and account login to disambiguate.

### 3.2. Add connection wizard

~~~text
┌─ Add Connection ────────────────────────────────────────────────────┐
│ Provider type *                                                     │
│ [ GitHub ▾ ]                                                        │
│                                                                    │
│ Connection name *                                                   │
│ [ Personal GitHub                                               ]  │
│                                                                    │
│ Server URL *                                                        │
│ [ https://github.com                                             ]  │
│                                                                    │
│ Authentication *                                                    │
│ (●) Personal Access Token                                           │
│ [ •••••••••••••••••••••••••••••••••••••                         ]  │
│                                                                    │
│ [Test Connection]                                                   │
│                                                                    │
│ Account: @minh-lb · Validation successful                           │
│                                      [Cancel] [Save Connection]    │
└────────────────────────────────────────────────────────────────────┘
~~~

Form behavior:
1. Provider type is required: GitHub or GitLab.
2. Connection name is required and user-defined.
3. Server URL is pre-filled for GitHub.com/GitLab.com; custom HTTPS URL is available for Enterprise/Self-Managed.
4. Authentication method and token guidance are provider-specific.
5. Save is disabled until Test Connection succeeds.
6. Show the resolved account login and server before saving.
7. Invalid credentials are not saved. Preserve non-secret form fields after validation failure.
8. Provider type and server URL are immutable after creation; changing server means creating a new connection.

### 3.3. Connection defaults and workspace selection

- Allow one optional default connection per provider.
- The active workspace folder binding takes precedence over the provider default.
- When multiple connections on the same host can access a remote, ask the user to select the account.
- Different workspace folders may use different providers/accounts.
- Switching a connection cancels requests for the previous connection and reloads repository/review request data.
- If a connection is disconnected/deleted, show the affected workspace binding as unresolved; never silently switch accounts.

### 3.4. Connection status

| Status | UI behavior |
|---|---|
| Connected | Normal provider/account indicator |
| Re-authentication required | Warning + Re-authenticate action |
| Unreachable | Show last successful validation and Retry |
| Configuration error | Explain invalid host/API base URL |
| Disconnected | Keep connection record but disable API-backed actions |


## 4. Pull Request / Merge Request detail surface

### 3.1. Layout

The detail surface is a local React Webview panel. It has a compact header, tab navigation and a scrollable content area. The provider-native title is shown (Pull Request for GitHub, Merge Request for GitLab).

~~~text
┌────────────────────────────────────────────────────────────────────┐
│ GitHub · Personal GitHub · owner/repo · #42       [Open on GitHub] │
│ Fix token refresh race condition                                  │
│ author · source-branch  →  main · updated 2h ago                    │
│                                                                    │
│ [Overview] [Changes 4] [Discussions 6] [Pipeline] [Approvals]      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Active tab content                                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
~~~

P0 tabs:
- Overview
- Changes
- Discussions

P1 tabs:
- Pipeline
- Approvals

If a P1 capability is unsupported by the current GitLab edition/version, show a concise "Not available on this instance" state rather than a misleading empty result.

### 3.2. Header

Display:
- Provider, connection name, account login and repository/project path.
- Provider-native identifier (GitHub PR number or GitLab MR IID).
- Review request title and draft/open/closed/merged state.
- Author.
- Source branch → target branch.
- Updated timestamp.
- Open on GitLab action.

Primary action:
- Merge button for eligible open PRs/MRs.
- Disabled state with a short reason when the current server state clearly blocks merge.
- The button must not claim mergeability based only on stale or incomplete data.

### 3.3. Overview tab

~~~text
┌─ Overview ──────────────────────────────────────────────────────────┐
│ Description                                                        │
│ Markdown-rendered MR description                                   │
│                                                                    │
│ Review information                                                 │
│ Author: ...     Assignees: ...     Reviewers: ...                   │
│ Labels: [bug] [backend]                                             │
│                                                                    │
│ Change summary                                                     │
│ 4 files changed      +82 additions      -21 deletions               │
│                                                                    │
│ Merge status                                                       │
│ Detailed status returned by GitLab                                 │
└────────────────────────────────────────────────────────────────────┘
~~~

Rules:
- Render Markdown with raw HTML disabled and unsafe links filtered.
- Display only fields returned by GitLab.
- Distinguish "unknown/not available" from "none".
- Show detailed_merge_status when available; do not rely on deprecated merge_status.

## 5. Changes tab and diff viewer

### 4.1. Layout

~~~text
┌─ Changes ───────────────────────────────────────────────────────────┐
│ Files (4)                     Diff mode: [Unified ▾] [Refresh]       │
├───────────────────────────────┬────────────────────────────────────┤
│ M src/auth/token.ts           │ src/auth/token.ts                   │
│ A src/auth/lock.ts            │  12  const token = ...               │
│ D src/auth/old.ts             │  13- return cachedToken              │
│ R src/auth/session.ts         │  14+ return await refreshToken()     │
│                               │       [Add comment]                  │
│                               │                                      │
│                               │ Existing discussion                  │
│                               │ reviewer: Please handle timeout...   │
│                               │ [Reply]                              │
└───────────────────────────────┴────────────────────────────────────┘
~~~

### 4.2. File list

Each file row shows:
- Status: added, modified, deleted or renamed.
- New path and old path for renamed files.
- Addition/deletion summary when available.
- Comment count when known.

Selecting a file scrolls the diff pane to that file. The file list supports keyboard navigation.

### 4.3. Diff display

MVP:
- Unified diff rendering.
- File-level navigation.
- Added/removed/context line styling.
- Old and new line numbers.
- Single-line comment affordance on valid diff rows.
- Existing discussions anchored to their diff position.
- Clear handling for binary, collapsed, too-large and unavailable patches.

Side-by-side display may be added after the unified renderer and line mapping are stable. Do not make side-by-side mode a release blocker.

### 4.4. Inline comment interaction

1. User activates the comment affordance on a changed/context line.
2. A composer appears next to the selected line or in a docked composer region.
3. The composer shows file path and line context.
4. User enters a comment and submits.
5. Submit is disabled while sending.
6. On success, render the new discussion at the line and refresh discussion state.
7. On stale diff or invalid position, preserve the draft text, reload the diff and require the user to select a valid line again.

~~~text
  42  + const refreshed = await refreshToken();
      ┌──────────────────────────────────────────────┐
      │ Add review comment                           │
      │ This token can be undefined during refresh.  │
      │                              [Cancel] [Send]  │
      └──────────────────────────────────────────────┘
~~~

Only a line represented in the current GitLab diff can be selected. Hunk headers and non-code metadata are not commentable. MVP supports single-line comments only.

### 4.5. Discussion display

- Display thread root and replies together.
- Show author, timestamp, body and resolved state.
- Show line/path anchor for diff discussions.
- Provide Reply on replyable threads.
- Provide Resolve/Reopen only in a later approved phase.
- Distinguish system notes from user-authored comments.

## 6. Discussions tab

The Discussions tab provides a chronological/threaded view of provider-supported review conversations, including general comments and diff comments. GitHub issue comments and review comments remain distinct API resources even when presented in a shared view.

~~~text
┌─ Discussions ───────────────────────────────────────────────────────┐
│ Filter: [All ▾]                                      [Refresh]       │
├────────────────────────────────────────────────────────────────────┤
│ reviewer-a · 10:42 · src/auth/token.ts:42                           │
│ "Please handle the refresh timeout."                                │
│   author · 10:51                                                    │
│   "Added a timeout guard."                                          │
│   [Reply...]                                                        │
│                                                                    │
│ reviewer-b · 11:10 · General                                        │
│ "Can we add a regression test?"                                     │
│ [Reply...]                                                         │
├────────────────────────────────────────────────────────────────────┤
│ New general comment                                                 │
│ [Write a comment...                                             ]  │
│                                                    [Send comment]  │
└────────────────────────────────────────────────────────────────────┘
~~~

Behavior:
- General comment submission creates a top-level discussion thread.
- Reply submits to the selected discussion ID.
- Preserve unsent draft text when navigating within the same MR.
- Refresh the thread after successful mutation.
- Do not retry a timed-out POST automatically.

## 7. Checks/Pipeline and Approvals tabs — P1

### Checks / Pipeline

Display provider-specific data:
- GitHub: Check Runs and GitHub Actions workflow runs.
- GitLab: MR pipelines and jobs.
- Status, commit SHA and web link.
- A warning when the check/pipeline SHA does not match the current PR/MR HEAD SHA.
- Do not imply that GitHub Checks and GitLab Pipelines have identical lifecycle semantics.

### Approvals

Display:
- Current user's can-approve / has-approved state when returned.
- Approved state.
- Approval counts/rules only when supported by the instance and edition.
- Clear unsupported state for fields unavailable on Community Edition.

MVP does not expose approve/unapprove actions.

## 8. Merge interaction

### 7.1. Confirmation dialog

~~~text
┌─ Confirm merge ─────────────────────────────────────────────────────┐
│ Merge !42 — Fix token refresh race condition?                       │
│                                                                    │
│ Project: group/service                                              │
│ Source:  fix/token-refresh                                          │
│ Target:  main                                                       │
│                                                                    │
│ ReviewDock will refresh the MR and submit the current source SHA.   │
│ GitLab project policies and permissions remain authoritative.      │
│                                                                    │
│                                      [Cancel] [Confirm merge]       │
└────────────────────────────────────────────────────────────────────┘
~~~

### 7.2. Safety behavior

- Show provider, connection name, repository/project, PR number or MR IID, source and target branches.
- Require explicit confirmation.
- Refresh MR immediately before submission.
- Send the current source HEAD SHA.
- Do not enable auto-merge.
- Do not request source branch deletion.
- Do not override project squash policy.
- Show server error on rejection and refresh the MR state.
- On timeout, do not repeat merge automatically; first query MR state.

## 9. Global UX states

Every data-driven view must support:

| State | Presentation |
|---|---|
| Loading | Progress indicator and short label |
| Empty | Explain what is empty and provide the next useful action |
| Authentication required | Connect/reconnect action |
| Permission denied | Explain insufficient GitLab permission |
| Network error | Error message + safe Retry |
| Rate limited | Explain temporary limit and retry timing if available |
| Stale data | Show stale indicator and Refresh action |
| Unsupported capability | Explain that the instance/version/tier does not expose the feature |
| Mutation pending | Disable duplicate submit and show progress |
| Mutation success | Confirmation and refreshed data |
| Mutation outcome unknown | Refresh server state before allowing another attempt |

## 10. Accessibility and interaction

- All primary actions must be reachable by keyboard.
- Provide accessible labels for icon-only controls.
- Preserve focus when switching tabs or refreshing where possible.
- Use VS Code theme tokens and support light/dark/high-contrast themes.
- Do not rely only on red/green to distinguish diff states.
- Maintain readable line-height and spacing for long code lines.
- Provide tooltips for abbreviated status labels.
- Respect reduced-motion preferences.

## 11. Webview security requirements

- Use local bundled assets only; no CDN scripts or remote stylesheets.
- Configure a restrictive Content Security Policy.
- Use VS Code Webview URI conversion for local assets.
- Restrict localResourceRoots to the built Webview asset directory.
- Do not store PATs in Webview localStorage/sessionStorage.
- Do not put secrets in Webview messages or HTML.
- Validate message payloads in the extension host.
- Treat MR descriptions, branch names, filenames and comment bodies as untrusted input.
- Render Markdown with raw HTML disabled and sanitize links.
- Open external links only after URL validation and through the extension host.

## 12. UX acceptance checklist

- [ ] User can identify provider, connection name, account and active repository/project.
- [ ] User can create multiple GitHub/GitLab connections and manage each independently.
- [ ] User can bind different workspace folders to different connections.
- [ ] User is prompted when multiple accounts on one host can access a remote.
- [ ] User can navigate MR groups and open a selected MR.
- [ ] User can read overview, branches and MR state.
- [ ] User can navigate changed files and read diff.
- [ ] User can add a comment to a valid diff line.
- [ ] User can create a general comment and reply to a thread.
- [ ] Stale diff prevents inline comment submission without losing the draft.
- [ ] Merge requires explicit confirmation and displays the exact target branch.
- [ ] Loading, empty, error, permission and stale states are visible.
- [ ] Keyboard and high-contrast usage are supported.
- [ ] Webview never receives credentials.
