# ReviewDock — Provider Capability and Compatibility Matrix

> **Document ID:** RVD-CAP-001  
> **Version:** 0.1.0  
> **Status:** Proposed baseline — Product Owner approval required  
> **Reviewed:** 2026-11-16  
> **Related:** [SRS.md](./SRS.md), [DECISIONS.md](./DECISIONS.md), [API-SPEC.md](./API-SPEC.md), [SDS.md](./SDS.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md)

## 1. Purpose

This document defines the provider-specific behavior ReviewDock must preserve when presenting GitHub Pull Requests (PRs) and GitLab Merge Requests (MRs) through a shared UI.

The matrix is a product and implementation contract. It does not imply that GitHub and GitLab expose equivalent APIs or identical review semantics. The relevant provider documentation and the deployed server remain authoritative.

## 2. Capability status

| Status | Meaning |
|---|---|
| **P0 — Supported** | Required in the MVP on both providers, subject to the limitations in this document |
| **P1 — Conditional** | Planned after the core MVP; endpoint, permission, version or edition dependent |
| **Provider-specific** | Available only through one provider's API or semantics |
| **Not supported** | Must not be presented as an available action in the current REST adapter |
| **Unknown** | The provider did not return enough information; never convert to false/zero |

## 3. Capability matrix

| Capability | GitHub REST API v3 | GitLab REST API v4 | Product behavior |
|---|---|---|---|
| Multiple independent connections | Supported | Supported | P0; one credential per immutable connection ID |
| GitHub.com / GitLab.com | Supported | Supported | P0 |
| Enterprise / Self-Managed host | GHES API root `/api/v3`; version-dependent | Self-Managed API root `/api/v4`; version-dependent | P0 only within the published compatibility matrix |
| Repository/project discovery | `GET /user/repos`, `GET /repos/{owner}/{repo}` | `GET /projects`, `GET /projects/:id` | P0; scoped to the selected connection |
| Review request list | Repository PR list endpoint | Project or authenticated-user MR list endpoint | P0; provider-specific filters |
| Created by me | Search API qualifier `author:@me` | MR list scope `created_by_me` | P0 |
| Assigned to me | Search API qualifier `assignee:@me` | MR list scope `assigned_to_me` | P0 |
| Review requested from me | Search API qualifier `user-review-requested:@me` | MR list scope `reviews_for_me` | P0; GitHub direct user requests are covered; team-request behavior must be separately verified |
| Search by title | Search Issues API with `is:pr` and `in:title` | MR list `search` and `in=title` | P0; GitHub search has a 1,000-result cap and a separate rate limit |
| Search by PR/MR number | Fetch PR by repository-scoped number | Fetch MR by project-scoped IID | P0; never treat either number as globally unique |
| Review request detail | Pull Requests API | Merge Requests API | P0 |
| File list and diff | PR files endpoint; patch may be omitted | MR diffs endpoint; diff may be collapsed or too large | P0 with explicit unavailable/partial states |
| General timeline comment | Issue comment endpoint | Top-level MR discussion | P0 |
| Reply to general timeline comment | **Not supported by the selected GitHub REST workflow** | Supported as a note in the discussion | Do not show a reply action for GitHub general issue comments |
| Single-line inline comment | Review comment endpoint using `commit_id`, `path`, `line`, `side` | Discussion endpoint using version SHAs, paths and old/new line | P0; separate position mappers |
| Reply to inline comment | One-level reply to a top-level review comment; replies-to-replies are not supported | Reply note in the discussion thread | P0 only where the target thread supports it |
| Resolve/reopen review thread | Not supported by the selected GitHub REST adapter | Supported through Discussions API where permission allows | GitLab-only capability; no GitHub resolve action |
| Edit/delete own comments | Issue comment and review comment endpoints | Discussion note endpoints | P1; ownership and provider permission required |
| Review / approval state | Pull Request Reviews API | Merge Request Approvals API | P1; normalize without implying equivalent policy semantics |
| Detailed approval rules | Not represented by the selected GitHub REST review endpoint | Edition-dependent fields and approval-state endpoint | Conditional; GitLab CE returns a reduced field set |
| Checks / CI status | Commit Statuses and Check Runs | MR Pipelines and Jobs | P1; show only data matching the current head SHA |
| Open provider web page | PR `html_url` | MR `web_url` | P0 |
| Immediate merge | Pull Request merge endpoint | Merge Request merge endpoint | P0; explicit confirmation and current head SHA |
| Auto-merge / merge when pipeline succeeds | Separate provider-specific workflow | Separate provider-specific workflow | Out of MVP; never enable implicitly |
| Source branch deletion | Provider/project policy and explicit options | Project setting and explicit options | Never request deletion implicitly |

## 4. Review conversation semantics

The shared UI may render a common conversation timeline, but the domain model must retain the source resource type and its provider-native identifiers.

### 4.1. GitHub

GitHub exposes distinct resources:

- **Issue comments:** general PR timeline comments, created through the Issues API. They are not inline review comments and do not have a reply-thread operation in the selected REST workflow.
- **Review comments:** comments anchored to a diff line. A top-level review comment can receive a reply. The REST reply endpoint does not support replying to a reply.
- **Pull request reviews:** review submissions such as COMMENT, APPROVE and REQUEST_CHANGES. A review submission is not interchangeable with a general issue comment.

The UI must not:
- Offer Reply on a general issue comment.
- Offer Reply to a reply on an inline review thread.
- Offer GitLab-style resolve/reopen for GitHub threads through the selected REST adapter.
- Treat a review submission or comment as an approval unless the provider explicitly reports the corresponding review state.

### 4.2. GitLab

GitLab Discussions preserve thread grouping, note identity, system-note state, resolution state and diff position.

- A general MR comment is a top-level discussion.
- A reply is a note under the existing discussion.
- An inline comment is a discussion with a diff position.
- Resolve/reopen is available only when the API and current user permissions allow it.
- System notes must be distinguished from user-authored notes.

### 4.3. Shared domain contract

Every conversation item must preserve at least:

- `connectionId`, `provider`, `repositoryId`, `reviewRequestId`.
- Provider-native resource kind and provider-native ID.
- Parent/thread ID where one exists.
- Author, body, created/updated timestamps and web URL when returned.
- Diff position and diff-version identity when applicable.
- Resolution state as `resolved | unresolved | not-applicable | unknown`.
- Reply capability and allowed mutation capability as explicit values.

Do not synthesize parent IDs, reply relationships or resolution state when the provider does not return them.

## 5. GitHub-specific limits and permission boundaries

### 5.1. Search

Use the Search Issues and Pull Requests endpoint for the user-scoped filters:

~~~http
GET /search/issues?q=repo:{owner}/{repo}+is:pr+author:@me
GET /search/issues?q=repo:{owner}/{repo}+is:pr+assignee:@me
GET /search/issues?q=repo:{owner}/{repo}+is:pr+user-review-requested:@me
GET /search/issues?q=repo:{owner}/{repo}+is:pr+in:title+{encoded_text}
~~~

- Search results are discovery results; fetch the full PR detail before showing fields that are not present in the search result.
- Search is subject to a separate rate limit and a maximum of 1,000 results for a query.
- If a query reaches the search cap, the UI must indicate that the result set is limited; it must not claim exhaustive results.
- Direct user review requests are covered by `user-review-requested:@me`. Team review requests must not be claimed as covered unless a separate team-aware query is implemented and tested.

### 5.2. Changed-file limit

The GitHub Pull Request files endpoint returns at most 3,000 files for a PR. A missing later page or a result count at this limit must be represented as partial coverage, not as a complete file list.

### 5.3. Fine-grained PAT permissions

Permission requirements are endpoint-specific. The implementation must validate the actual endpoint documentation and any `X-Accepted-GitHub-Permissions` response header. The expected permission families include:

| Operation | Fine-grained repository permission family |
|---|---|
| Read repository metadata | Metadata: read |
| List/read PRs and PR files | Pull requests: read |
| Create inline review comments / submit reviews | Pull requests: write |
| Create general PR timeline comments | Issues: write |
| Merge a PR | Contents: write |
| Read Check Runs | Checks: read |
| Read Actions workflow runs | Actions: read |

This table is a planning aid, not a guarantee that one token permission set is sufficient for every endpoint or GHES version. A valid token may lack permission for an individual repository or operation; do not mark the whole connection invalid in that case.

## 6. GitLab edition and version behavior

- GitLab Merge Requests and Discussions APIs are available across GitLab.com and Self-Managed offerings, subject to authentication, permission and version.
- The Merge Request Approvals API exposes basic approval state on Community Edition. Community Edition returns only a reduced set of fields such as `approved`, `approved_by`, `user_can_approve` and `user_has_approved`.
- Additional approval-rule fields are edition-dependent. Missing rule/count fields must be shown as unavailable, not zero.
- The current GitLab API documentation identifies the `collapsed` and `too_large` diff attributes as introduced in GitLab 18.4. Handle these fields when returned; do not assume they exist on older supported instances.
- The MR list `draft` filter was introduced in GitLab 19.0. If the published compatibility floor includes older versions, use client-side draft filtering based on the returned field instead of requiring this query parameter.

## 7. Compatibility policy

Compatibility must be defined against vendor-maintained releases, not a permanently frozen old minimum.

| Platform | Policy |
|---|---|
| VS Code | Declare a minimum `engines.vscode` version in the extension manifest; test the declared minimum and current Stable |
| GitHub.com | Use a currently supported REST API version; review API changelog before release |
| GitHub Enterprise Server | Support the latest GHES release and the oldest GHES feature release still supported by GitHub at release time; test both |
| GitLab.com | Follow the current GitLab.com API behavior |
| GitLab Self-Managed | Support the current GitLab minor and the previous two vendor-maintained minor releases at release time; test oldest and newest |

**Compatibility snapshot reviewed 2026-11-16:**

- GitLab maintained releases were 19.3, 19.4 and 19.5. GitLab 19.3 was approaching the end of its maintenance window; re-check the official policy before implementation release.
- GitHub Enterprise Server supported feature releases included 3.19 through 3.22. Re-check the supported set before release.
- VS Code Stable was 1.146. The proposed minimum engine version is recorded as an approval item in DECISIONS.md, not silently treated as approved.

A release must publish the exact tested versions and known limitations. If an instance is older than the published floor, ReviewDock must fail gracefully and must not guess at unsupported endpoint behavior.

## 8. Acceptance rules for provider parity

1. Every P0 workflow has at least one provider-specific API integration test for GitHub and GitLab.
2. Every capability shown in the UI is backed by a provider capability descriptor.
3. Unsupported actions are hidden or disabled with an explanation; they are not simulated.
4. Shared models preserve provider-native IDs and source resource types.
5. All review mutations use the selected connection and provider adapter only.
6. The provider server is authoritative for permission, approval, checks and merge eligibility.
7. Compatibility tests run against the oldest and newest supported server versions before release.

## 9. Official references

- [GitHub REST API — Pull Requests](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub REST API — Pull Request Review Comments](https://docs.github.com/en/rest/pulls/comments)
- [GitHub REST API — Pull Request Reviews](https://docs.github.com/en/rest/pulls/reviews)
- [GitHub Search — Issues and Pull Requests](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [GitHub fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub Enterprise Server supported releases](https://docs.github.com/en/enterprise-server@latest/admin/all-releases)
- [GitLab Merge Requests API](https://docs.gitlab.com/api/merge_requests/)
- [GitLab Discussions API](https://docs.gitlab.com/api/discussions/)
- [GitLab Merge Request Approvals API](https://docs.gitlab.com/api/merge_request_approvals/)
- [GitLab maintenance policy](https://docs.gitlab.com/policy/maintenance/)
- [VS Code release archive](https://code.visualstudio.com/updates/archive)
