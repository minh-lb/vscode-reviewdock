# ReviewDock — GitLab API Specification

> **Document ID:** RVD-API-001  
> **Version:** 0.1.0  
> **Status:** Proposed — verify against the selected GitLab compatibility matrix  
> **API:** GitLab REST API v4  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md), [DECISIONS.md](./DECISIONS.md)

## 1. Purpose

This document defines the GitLab REST API operations required by ReviewDock MVP and P1. It specifies endpoint paths, parameters, request behavior, response fields used by the extension, error handling and safety constraints.

GitLab documentation is the authoritative contract. The implementation must not depend on undocumented fields or deprecated endpoints.

## 2. Connection and authentication

### 2.1. Base URL

For a configured GitLab instance:

- GitLab.com base URL: https://gitlab.com
- Self-Managed base URL: user-configured HTTPS origin, optionally including an installation context path if supported by that instance.
- API root: {baseUrl}/api/v4

Normalize the configured base URL once. Reject URLs containing credentials, query strings or fragments. HTTPS is required for MVP.

### 2.2. MVP authentication

Use a Personal Access Token (PAT) in the request header:

~~~http
PRIVATE-TOKEN: <token>
Accept: application/json
~~~

Proposed required scope for full MVP: **api**. The read_api scope is not sufficient for creating discussions/comments and merging. The api scope is broad; disclose this clearly in the connection UI and recommend a dedicated token with an expiry date.

OAuth 2.0 is deferred. Do not implement both authentication methods in the first release unless DEC-001 is changed.

### 2.3. Connection validation

| Operation | Method and endpoint | Purpose |
|---|---|---|
| Current user | GET /user | Validate token and obtain current user identity |
| Project lookup | GET /projects/:id | Resolve and validate selected project |
| Project search | GET /projects?membership=true&search={query} | Manual project discovery |

Only persist the PAT after GET /user succeeds. The extension must not log the token or return it to the Webview.

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
| 401 | AuthenticationError | Ask user to reconnect/replace token |
| 403 | AuthorizationError | Explain insufficient permission or tier limitation |
| 404 | NotFoundError | Project/MR/resource is unavailable or not visible |
| 405 | OperationNotAllowed | MR cannot currently be merged or operation is unsupported |
| 409 | ConflictError | Refresh resource; for merge/comment position, require user action again |
| 422 | ValidationError / MergeRejected | Show server reason; do not claim success |
| 429 | RateLimitError | Respect Retry-After and let user retry |
| 5xx | GitLabServerError | Show temporary server failure; keep extension responsive |
| No HTTP response | NetworkError / TimeoutError | Show connection failure and safe retry option |

Capture GitLab request ID headers where available for diagnostics, but never capture credentials or comment/diff contents.

## 4. Project API

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

## 5. Merge Request API

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
- If collapsed is true, request the specific file/version detail if supported; otherwise show an unavailable diff state.
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

## 6. Discussions and comments API

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

## 7. Approval API — P1

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

## 8. Pipeline API — P1

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

## 9. Merge API

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

## 12. Official references

- [REST API overview, authentication and pagination](https://docs.gitlab.com/api/rest/)
- [Projects API](https://docs.gitlab.com/api/projects/)
- [Merge Requests API](https://docs.gitlab.com/api/merge_requests/)
- [Discussions API](https://docs.gitlab.com/api/discussions/)
- [Notes API](https://docs.gitlab.com/api/notes/)
- [Merge Request Approvals API](https://docs.gitlab.com/api/merge_request_approvals/)
- [Pipelines API](https://docs.gitlab.com/api/pipelines/)
- [Jobs API](https://docs.gitlab.com/api/jobs/)
- [Personal Access Tokens](https://docs.gitlab.com/user/profile/personal_access_tokens/)
