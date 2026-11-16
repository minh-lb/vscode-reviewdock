# ReviewDock — GitHub and GitLab API Specification

> **Document ID:** RVD-API-001  
> **Version:** 0.1.0  
 > **Status:** Proposed — verify against the GitHub/GitLab compatibility matrix  
> **API:** GitHub REST API v3 + GitLab REST API v4  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md), [DECISIONS.md](./DECISIONS.md), [CONNECTION-MANAGEMENT.md](./CONNECTION-MANAGEMENT.md)

## 1. Purpose

This document defines the GitHub REST API v3 and GitLab REST API v4 operations required by ReviewDock MVP and P1. It specifies endpoint paths, parameters, request behavior, response fields used by the extension, error handling and safety constraints.

The selected connection determines the provider adapter, API base URL, authentication scheme and endpoint set. Provider documentation is authoritative; the implementation must not depend on undocumented fields or deprecated endpoints.

## 2. Connection and authentication

### 2.1. Provider base URLs

| Provider/server | Base URL | API root |
|---|---|---|
| GitHub.com | https://github.com | https://api.github.com |
| GitHub Enterprise Server | User-configured HTTPS URL | {serverUrl}/api/v3 |
| GitLab.com | https://gitlab.com | {serverUrl}/api/v4 |
| GitLab Self-Managed | User-configured HTTPS URL | {serverUrl}/api/v4 |

Normalize each server URL once. Reject URL credentials, query strings and fragments. HTTPS is required for MVP. Provider and server URL are immutable for a saved connection; changing server requires a new connection.

### 2.2. GitHub authentication

Use a GitHub Personal Access Token with:

~~~http
Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
~~~

Prefer a fine-grained PAT restricted to the repositories ReviewDock needs. Required permissions vary by endpoint: reading PRs, writing review comments, creating issue comments and merging can require different repository permissions. Use GitHub's endpoint permission documentation and the X-Accepted-GitHub-Permissions response header; do not assume one universal permission set. Avoid requesting broad classic-token scopes when a fine-grained token is sufficient.

For GitHub Enterprise Server, use its supported API version and API root; do not assume the GitHub.com API version header is supported by every GHES release.

### 2.3. GitLab authentication

Use a GitLab Personal Access Token:

~~~http
PRIVATE-TOKEN: <token>
Accept: application/json
~~~

The proposed full-MVP scope is **api** because the extension creates discussions/comments and requests merges. This scope is broad; disclose it and recommend a dedicated expiring token. OAuth is deferred for MVP.

### 2.4. Connection validation

| Provider | Method and endpoint | Purpose |
|---|---|---|
| GitHub | GET /user | Validate token and obtain stable account ID/login |
| GitLab | GET /user | Validate token and obtain stable account ID/username |
| GitHub | GET /repos/{owner}/{repo} | Resolve and validate a selected repository |
| GitLab | GET /projects/:id | Resolve and validate a selected project |

Persist the credential only after authenticated-user validation succeeds. Store one secret per immutable connection ID; never expose it to the Webview.

### 2.5. Request routing isolation

- Resolve provider adapter and credential from connection ID, not from a display name or current global setting.
- Attach only the selected provider's authentication header.
- Validate every request URL against the selected connection's API origin and path prefix before attaching credentials.
- Do not forward credentials across redirects to another origin.
- Follow pagination links only when they remain on the same configured API origin/path prefix.
- A valid authenticated-user response with a later 403/permission failure means the connection can remain connected; report the operation-level permission error.

## 3. Common request and response rules

### 3.1. HTTP behavior

- Use JSON response parsing for JSON endpoints.
- Use documented form fields for nested discussion position parameters.
- Set an explicit request timeout (proposed: 30 seconds).
- Support AbortSignal/cancellation.
- Do not send an Authorization header to an untrusted host.
- Never follow a pagination URL unless its origin and API path prefix match the configured GitLab instance.

### 3.2. Pagination

Use offset pagination where the endpoint supports it:
- page: starts at 1.
- per_page: default 20; maximum 100 unless endpoint documentation specifies otherwise.

Prefer the response Link header with rel="next" when present. Do not construct a next URL if GitLab provides one. GitLab.com may omit some pagination headers; treat an absent next link as end-of-list unless the endpoint response provides another supported cursor.

For MR diffs and discussions, support pagination even if the UI initially loads only the first page.

### 3.3. Retry policy

| Request type | Retry |
|---|---|
| GET | May retry on transient network errors, 429 and selected 5xx with bounded exponential backoff and Retry-After support |
| POST comment/discussion | Never retry automatically after an ambiguous outcome |
| PUT merge | Never retry automatically after an ambiguous outcome |
| PUT resolve/update | No automatic retry unless the operation is proven idempotent and the user-visible state has been refreshed |

### 3.4. Error mapping

| HTTP status | Application category | Required behavior |
|---|---|---|
| 400 | ValidationError | Show actionable API validation message |
| 401 | AuthenticationError or endpoint-specific authorization failure | Validate with GET /user first; some mutation endpoints (including merge) can use 401 for insufficient permission, so do not automatically ask for a new token when the token is valid |
| 403 | AuthorizationError | Explain insufficient permission or tier limitation |
| 404 | NotFoundError | Project/MR/resource is unavailable or not visible |
| 405 | OperationNotAllowed | MR cannot currently be merged or operation is unsupported |
| 409 | ConflictError | Refresh resource; for merge/comment position, require user action again |
| 422 | ValidationError / MergeRejected | Show server reason; do not claim success |
| 429 | RateLimitError | Respect Retry-After and let user retry |
| 5xx | GitLabServerError | Show temporary server failure; keep extension responsive |
| No HTTP response | NetworkError / TimeoutError | Show connection failure and safe retry option |

Capture GitLab request ID headers where available for diagnostics, but never capture credentials or comment/diff contents.

## 4. GitLab Project API

### 4.1. Resolve a project by path or ID

~~~http
GET /projects/:id
~~~

- Prefer numeric project ID after resolution.
- When resolving namespace/project path, URL-encode the full path as a single path parameter (including slash characters).
- Use response fields: id, name, path_with_namespace, web_url, default_branch, visibility, archived.
- If the project is inaccessible or missing, offer manual project selection rather than guessing.

### 4.2. Search accessible projects

~~~http
GET /projects?membership=true&search={query}&simple=true&page=1&per_page=20
~~~

Use only for manual selection/search. Do not enumerate every project during extension activation.

### 4.3. Git remote matching

Recognize common forms:
- HTTPS: https://gitlab.example.com/group/subgroup/project.git
- SSH: git@gitlab.example.com:group/subgroup/project.git
- SSH URL: ssh://git@gitlab.example.com/group/project.git

Rules:
1. Parse hostname and namespace path.
2. Match hostname against a configured GitLab instance.
3. Remove a terminal .git suffix.
4. URL-encode namespace path for project lookup.
5. Do not match a remote to a different host based only on repository name.
6. If parsing or lookup is ambiguous, request manual selection.

## 5. GitLab Merge Request API

### 5.1. List project merge requests

~~~http
GET /projects/:project_id/merge_requests
  ?state=opened
  &scope=all
  &order_by=updated_at
  &sort=desc
  &page=1
  &per_page=20
~~~

Supported UI filters:

| UI filter | API query |
|---|---|
| Open | state=opened |
| Closed | state=closed |
| Merged | state=merged |
| Created by me | scope=created_by_me |
| Assigned to me | scope=assigned_to_me |
| Review requested from me | scope=reviews_for_me |

For project-scoped requests, use the scope values supported by the deployed GitLab version. The default scope differs by endpoint; always set it explicitly.

Search:
- search={text}
- in=title,description (or title only if the UI explicitly selects that scope)
- Do not issue a request for every keystroke; debounce input and cancel superseded requests.

Minimum fields used by ReviewDock:
- id, iid, project_id, title, description, state
- author, assignees, reviewers, labels
- source_branch, target_branch
- draft, updated_at, created_at, web_url
- detailed_merge_status, sha, diff_refs
- pipeline summary when present

Use detailed_merge_status rather than deprecated merge_status. Treat missing fields as unknown, not as false.

### 5.2. Retrieve a merge request

~~~http
GET /projects/:project_id/merge_requests/:merge_request_iid
~~~

Optional parameters:
- render_html=false by default. Render Markdown locally using a safe renderer.
- include_diverged_commits_count only when the UI needs it.

The response is the source for current MR metadata and source HEAD SHA. The diff_refs object contains:
- base_sha: merge base.
- start_sha: target branch SHA at the start of the diff.
- head_sha: source branch HEAD for the diff.

diff_refs may be empty while GitLab is preparing a new MR diff. Show a preparing/loading state and retry with bounded delay only for this read operation.

### 5.3. List changed files and diffs

Preferred endpoint:

~~~http
GET /projects/:project_id/merge_requests/:iid/diffs?page=1&per_page=20&unidiff=true
~~~

Response fields per file:
- old_path, new_path
- diff
- new_file, deleted_file, renamed_file
- collapsed and too_large when supported by the instance
- a_mode and b_mode

Rules:
- Do not use GET /changes for new implementation; it is deprecated.
- Handle pagination.
- If collapsed is true, retry retrieval through the specific diff-version endpoint when available; if the patch remains unavailable, show an unavailable diff state. Do not invent or synthesize patch content.
- If too_large is true, do not attempt to render missing patch content.
- Diff limits can restrict the returned result set; never assume an empty diff means no changes if the API reports overflow/limits.

### 5.4. Diff version metadata

~~~http
GET /projects/:project_id/merge_requests/:iid/versions
GET /projects/:project_id/merge_requests/:iid/versions/:version_id?unidiff=true
~~~

Use the latest collected diff version. Required SHA mapping:

| API field | Domain field | Discussion position field |
|---|---|---|
| base_commit_sha | baseSha | position[base_sha] |
| start_commit_sha | startSha | position[start_sha] |
| head_commit_sha | headSha | position[head_sha] |

Do not substitute MR sha or diff_refs fields for version metadata without verifying they represent the same diff version. The version list may be empty or still preparing; inline commenting must remain disabled until all required SHAs and line positions are available.

## 6. GitLab Discussions and comments API

### 6.1. List MR discussions

~~~http
GET /projects/:project_id/merge_requests/:iid/discussions?page=1&per_page=20
~~~

Use discussions rather than only the Notes endpoint for the review UI because discussions preserve thread grouping and diff position.

Relevant fields:
- discussion id
- individual_note
- notes[]
- note id, body, author, created_at, updated_at, system
- resolved, resolvable, resolved_by, resolved_at
- position for diff notes

System notes should be distinguishable from user comments. Do not present system notes as if written by the current user.

### 6.2. Create a general MR comment

Create a top-level discussion thread so that a reply can be added later:

~~~http
POST /projects/:project_id/merge_requests/:iid/discussions
Content-Type: application/x-www-form-urlencoded

body=<comment text>
~~~

Expected success: 201 Created with a discussion object.

### 6.3. Create an inline diff comment

~~~http
POST /projects/:project_id/merge_requests/:iid/discussions
Content-Type: multipart/form-data

body=<comment text>
position[position_type]=text
position[base_sha]=<base_commit_sha>
position[start_sha]=<start_commit_sha>
position[head_sha]=<head_commit_sha>
position[old_path]=<path before change>
position[new_path]=<path after change>
position[old_line]=<old line, when applicable>
position[new_line]=<new line, when applicable>
~~~

Line rules:
- Added line: provide new_line; do not provide old_line.
- Removed line: provide old_line; do not provide new_line.
- Context line: provide both old_line and new_line.
- Do not create a position for a hunk header or a line that is not part of the diff.
- MVP does not submit multiline line_range positions.

Use the exact version SHA set displayed in the UI. Refresh and compare the version immediately before sending. On a stale-position validation error, reload the diff and require a new user action.

### 6.4. Reply to a discussion

~~~http
POST /projects/:project_id/merge_requests/:iid/discussions/:discussion_id/notes
Content-Type: application/x-www-form-urlencoded

body=<reply text>
~~~

Expected success: 201 Created.

### 6.5. Resolve or reopen a discussion

P1 operation:

~~~http
PUT /projects/:project_id/merge_requests/:iid/discussions/:discussion_id
Content-Type: application/x-www-form-urlencoded

resolved=true
~~~

Only expose the action if the API and current user permissions allow it. A locked discussion or insufficient role must be surfaced as an authorization error.

### 6.6. Edit/delete a note

P1 only:
- PUT /projects/:project_id/merge_requests/:iid/discussions/:discussion_id/notes/:note_id with body to edit.
- DELETE /projects/:project_id/merge_requests/:iid/discussions/:discussion_id/notes/:note_id to delete.

Only allow operations on notes owned by the current user and only when GitLab accepts the operation. Do not include edit/delete in MVP UI.

## 7. GitLab Approval API — P1

### 7.1. Retrieve approval state

~~~http
GET /projects/:project_id/merge_requests/:iid/approvals
~~~

Use fields when present:
- approved
- approved_by
- user_can_approve
- user_has_approved
- approvals_required / approvals_left where supported
- approval_rules_left where supported

Important compatibility rule:
- GitLab Community Edition returns a reduced field set.
- Approval rules and detailed approval state may require Premium/Ultimate.
- Missing fields mean "not available from this instance/tier", not zero approvals and not failed approval.

### 7.2. Retrieve detailed approval state

~~~http
GET /projects/:project_id/merge_requests/:iid/approval_state
~~~

Use only when supported by the instance/edition. A 403 or unsupported response should degrade the panel to the basic approvals response; it must not fail the MR detail page.

### 7.3. Approve/unapprove

P1 only:

~~~http
POST /projects/:project_id/merge_requests/:iid/approve
POST /projects/:project_id/merge_requests/:iid/unapprove
~~~

When approving, send the current MR HEAD SHA in the sha parameter when available. GitLab rejects a mismatched SHA with 409. Approval is not part of MVP and must not be confused with creating a comment.

## 8. GitLab Pipeline API — P1

### 8.1. List pipelines for an MR

~~~http
GET /projects/:project_id/merge_requests/:iid/pipelines?page=1&per_page=20
~~~

Display the most recent relevant pipeline and its:
- id
- sha
- ref
- status
- web_url
- created_at / updated_at when returned

The pipeline SHA should be compared with the MR head SHA before presenting it as the current MR pipeline.

### 8.2. List jobs for a pipeline

~~~http
GET /projects/:project_id/pipelines/:pipeline_id/jobs?page=1&per_page=20
~~~

Use:
- id, name, stage, status
- allow_failure
- web_url
- started_at, finished_at, duration when returned

Do not retrieve job logs in MVP. Link to GitLab Web for full job details.

## 9. GitLab Merge API

### 9.1. Immediate merge

~~~http
PUT /projects/:project_id/merge_requests/:iid/merge
Content-Type: application/json

{
  "sha": "<current source HEAD SHA>"
}
~~~

Optional request fields, only when explicitly supported by the approved UX:
- squash: boolean
- should_remove_source_branch: boolean
- merge_commit_message
- squash_commit_message

MVP rules:
- Always send the current source HEAD SHA.
- Do not send auto_merge=true.
- Do not send deprecated merge_when_pipeline_succeeds.
- Do not set should_remove_source_branch=true.
- Do not override squash policy; omit squash unless a separately approved UI explicitly lets the user choose and the project permits it.
- Treat the server response as authoritative.

### 9.2. Merge preflight

Immediately before merge:
1. Fetch MR detail.
2. Verify state is opened.
3. Verify source HEAD SHA is present.
4. Verify the user has explicitly confirmed the operation.
5. Send PUT merge with sha.
6. On success, refresh MR detail and the list.
7. On 409, refresh and ask the user to review the updated MR.
8. On 405/422, show GitLab's merge rejection reason.
9. On timeout or lost response, refresh MR state before allowing another merge attempt.

Client-side checks improve UX only; GitLab enforces all approvals, pipelines, branch protection, conflicts, permissions and other merge checks.

## 10. API-to-feature matrix

| Feature | Endpoint group | Priority |
|---|---|---|
| Validate token / identity | GET /user | P0 |
| Project lookup/search | Projects API | P0 |
| MR list/filter/search | Project Merge Requests API | P0 |
| MR detail | Single Merge Request API | P0 |
| File diff | Merge Request Diffs API | P0 |
| Diff version SHAs | Merge Request Versions API | P0 |
| General comment | Discussions API | P0 |
| Inline comment | Discussions API with position | P0 |
| Discussion reply | Discussion Notes API | P0 |
| Resolve discussion | Discussions API | P1 |
| Approval state | Merge Request Approvals API | P1 |
| Approve/unapprove | Merge Request Approvals API | P1 |
| Pipeline/job status | MR Pipelines + Jobs APIs | P1 |
| Merge | Merge Requests API | P0 |

## 11. Compatibility and feature detection

- API version remains v4.
- Proposed technical floor is GitLab 17.0+; see DEC-005.
- Avoid deprecated fields such as merge_status and approvals_before_merge.
- Use detailed_merge_status for merge-state presentation.
- The diff response fields collapsed and too_large were introduced in GitLab 18.4; handle them when present but do not require them for the 17.0 compatibility floor.
- The MR list draft filter was introduced in GitLab 19.0; do not use it as a required filter. Filter draft state client-side if needed.
- Approval response shape depends on GitLab edition/tier.
- Maintain contract fixtures for the oldest supported version and a current version.



## 13. GitHub REST API v3

This section defines the GitHub adapter. It uses GitHub.com REST API v3 and the corresponding REST API v3 root on GitHub Enterprise Server. Use the current API version supported by the target host.

### 13.1. Repository discovery

~~~http
GET /user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100
GET /repos/{owner}/{repo}
~~~

Use repository response fields:
- id, node_id, name, full_name
- owner
- private, archived, default_branch
- html_url

Use numeric repository ID as the stable provider repository identifier. Do not assume repository names are unique across owners or servers.

### 13.2. List and retrieve Pull Requests

~~~http
GET /repos/{owner}/{repo}/pulls?state=open&sort=updated&direction=desc&per_page=100
GET /repos/{owner}/{repo}/pulls/{pull_number}
GET /repos/{owner}/{repo}/pulls/{pull_number}/files?per_page=100
~~~

Normalize these fields where available:
- number, id, title, body, state, draft
- user, assignees, requested_reviewers
- head.ref, head.sha, base.ref
- merged, mergeable, mergeable_state
- created_at, updated_at, closed_at, merged_at
- html_url
- changed file fields: filename, previous_filename, status, additions, deletions, changes, patch, blob_url/raw_url when returned

GitHub Pull Request numbers are repository-scoped. Store connection ID and repository ID with every PR. The files endpoint can be paginated and may omit patch text for binary or large files; show an explicit unavailable diff state.

### 13.3. General comments and review conversations

List general timeline comments:

~~~http
GET /repos/{owner}/{repo}/issues/{issue_number}/comments?per_page=100
~~~

List submitted reviews and inline review comments:

~~~http
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews?per_page=100
GET /repos/{owner}/{repo}/pulls/{pull_number}/comments?per_page=100
~~~

Create a general PR timeline comment:

~~~http
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
Content-Type: application/json

{ "body": "<comment text>" }
~~~

Create a single-line inline review comment:

~~~http
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments
Content-Type: application/json

{
  "body": "<comment text>",
  "commit_id": "<current head SHA>",
  "path": "src/file.ts",
  "line": 42,
  "side": "RIGHT"
}
~~~

For a removed line use the LEFT side. For an added line use RIGHT. The line number is the line in the diff, not the line number inferred from a rendered row index. Use the current PR head commit SHA. Multi-line comments using start_line/start_side are deferred until separately approved.

Reply to an inline review comment:

~~~http
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies
Content-Type: application/json

{ "body": "<reply text>" }
~~~

GitHub general issue comments and inline review comments are different resource types. The domain adapter may normalize them into a common review-conversation view, but must preserve provider IDs and semantics. Do not assume GitLab-style resolve/reopen behavior exists for every GitHub review thread through REST API.

### 13.4. Review decision — P1

~~~http
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
Content-Type: application/json

{
  "commit_id": "<current head SHA>",
  "event": "APPROVE"
}
~~~

Supported review events include provider-defined states such as APPROVE, REQUEST_CHANGES and COMMENT. This is P1; MVP must not infer approval from a comment. Confirm the current head SHA and endpoint permissions before submitting a review decision.

### 13.5. Checks and GitHub Actions — P1

~~~http
GET /repos/{owner}/{repo}/commits/{ref}/check-runs?per_page=100
GET /repos/{owner}/{repo}/commits/{ref}/status
GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}&per_page=100
~~~

Display check/workflow status only when it belongs to the current PR head SHA. Check Runs and Actions workflow runs are related but distinct resources; preserve their source/type in the normalized status model. Link to GitHub Web for full job/log details in P1.

### 13.6. Merge a Pull Request

MVP direct merge endpoint:

~~~http
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
Content-Type: application/json

{
  "sha": "<current head SHA>"
}
~~~

Optional merge_method values are provider-specific and must be omitted unless the approved UX explicitly asks the user to choose a supported method. Do not set any bypass-rules option. GitHub's server remains authoritative for repository rules, permissions, checks, reviews and merge queue policies.

Behavior:
- Re-fetch PR detail immediately before merge.
- Require explicit confirmation with provider, connection, repository, PR number, source and target branches.
- Send current head SHA.
- On 409, refresh and require a new user action.
- On 403/405/422, show GitHub's rejection reason.
- On timeout, refresh PR state before allowing another attempt.
- Do not automatically retry a merge mutation.

GitHub also documents an asynchronous merge endpoint for merge queues and stacked PR workflows. It is not part of the immediate-merge MVP; evaluate it as a separate P1/P2 capability rather than silently changing merge semantics.

### 13.7. GitHub pagination, rate limits and permissions

- Use the Link response header and follow rel="next" URLs only after origin/path validation.
- Respect rate-limit headers and Retry-After where provided.
- Use the endpoint's documented fine-grained PAT permissions. A valid token can still lack permission for one repository or operation.
- Capture request IDs and safe rate-limit metadata for diagnostics; never log tokens, private diff bodies or review content.
- Preserve 403, 404, 409, 422 and rate-limit distinctions in provider error mapping.


## 14. Official references

- [GitHub REST API overview and authentication](https://docs.github.com/en/rest)
- [GitHub REST API authentication](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api)
- [GitHub repository API](https://docs.github.com/en/rest/repos/repos)
- [GitHub Pull Requests API](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub pull request review comments API](https://docs.github.com/en/rest/pulls/comments)
- [GitHub pull request reviews API](https://docs.github.com/en/rest/pulls/reviews)
- [GitHub fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub Checks API](https://docs.github.com/en/rest/checks/runs)
- [GitHub Actions workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs)
- [REST API overview, authentication and pagination](https://docs.gitlab.com/api/rest/)
- [Projects API](https://docs.gitlab.com/api/projects/)
- [Merge Requests API](https://docs.gitlab.com/api/merge_requests/)
- [Discussions API](https://docs.gitlab.com/api/discussions/)
- [Notes API](https://docs.gitlab.com/api/notes/)
- [Merge Request Approvals API](https://docs.gitlab.com/api/merge_request_approvals/)
- [Pipelines API](https://docs.gitlab.com/api/pipelines/)
- [Jobs API](https://docs.gitlab.com/api/jobs/)
- [Personal Access Tokens](https://docs.gitlab.com/user/profile/personal_access_tokens/)
