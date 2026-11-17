# Provider Capability Matrix

This is the cross-provider product contract and local adapter capability snapshot; endpoint details remain in [API-SPEC.md](./API-SPEC.md). Mocked adapter tests do not establish live host acceptance.

## Support policy

- Implemented locally means the behavior exists in the local extension and has the stated local verification; it does not establish live-provider acceptance. Supported means implemented for the named API contract; actual endpoint permissions and host compatibility depend on the selected host, account and repository/project settings. Conditional requires runtime detection of version, edition, repository settings or permission. Deferred is not promised in MVP.
- Never convert absent fields to false/empty. Distinguish Empty, Unsupported, Not authorized, Unknown and Not configured.
- Stable identity is provider + connection ID + repository/project ID + native PR number/MR IID.
- Shared services use provider-neutral ports. Adapters retain native IDs, URLs, comment types and diff-position semantics.
- Candidate lower bounds derived from vendor policy are planning inputs only. They do not establish ReviewDock compatibility. GHES and GitLab Self-Managed release claims require live-host acceptance and exact tested versions.

## Feature matrix

| Feature | GitHub | GitLab | Phase / status | Contract |
|---|---|---|---|---|
| Validate connection | GET /user | GET /user | P0 | Stable account ID/login; later repo 403 is operation-level permission |
| Repository/project | GET /user/repos; GET /repos/{owner}/{repo} | GET /projects; GET /projects/:id | P0 | Scope to selected connection; manual choice on ambiguity |
| List/detail | Pull Requests endpoints | Merge Requests endpoints | P0 | Normalize common fields, retain native ID/number/IID |
| Pagination | Link header | page/per_page | P0 | Adapter owns pagination; validate origin before credentials |
| Connection → repository/project → PR/MR tree | Existing list/detail APIs | Existing list/detail APIs | Implemented locally; final host observation pending | Lazy child loading, pagination and selected-connection auth guard |
| Changed-file tree | PR files/patch | Diff versions + diff endpoint | Implemented locally; final host observation pending | Hierarchical paths; draggable width resize and hide/show; keyboard operable |
| Diff views and anchors | PR files/patch + exact revision contents | Diff versions + exact revision contents | Implemented locally; final host observation pending | Global gear menu Layout Unified/Split; base/head path and line anchors |
| Markdown source/rich diff | Exact base/head file contents | Exact base/head file contents | Implemented locally; final host observation pending | Per-file header Source/Rich icon toggle; no patch reconstruction; safe rendering; full rich verification open |
| PR/MR commit history | Pull Request Commits API | Merge Request Commits API | Implemented locally; final host observation pending | Paginated Commits tab; rows show subject, committer, committed time, short SHA; provider link via SHA |
| General comment | Issue comment endpoint | Create MR discussion | P0 | Preserve native resource type |
| Inline comment | PR review comment endpoint | MR discussion position | P0 | Single-line; exact SHA/path/line; never downgrade to general comment |
| Reply | Review-comment reply | Discussion notes endpoint | Implemented locally; final host observation pending | Supported thread types; inline reply composer; live writes not verified |
| Existing threads | Reviews + review comments | Discussions + notes | P0 | Preserve grouping and native IDs |
| Resolve/reopen | GraphQL native review-thread operation (capability-dependent) | Discussion resolve endpoint | Implemented locally | Native supported threads only; retain provider semantics and permission failures; live writes pending |
| Delete comment | REST resource delete endpoints (ownership-dependent) | Discussion note delete endpoint | Implemented locally | Native IDs and provider permission/ownership rules; no resource-type substitution; live writes pending |
| Edit PR/MR metadata | PR update and assignee/reviewer/label APIs | MR update and assignee/reviewer/label APIs | Implemented locally; final host observation pending | Native IDs; preserve fields not being changed; surface permission/unsupported; live writes pending |
| Quick scroll and status tags | Local review UI | Local review UI | Implemented locally; final host observation pending | Quick scroll at lower-right; tags reflect provider state |
| Approval | Submit PR review | MR approval API/rules | P1 | Comment is not approval; GitLab tier/version conditional |
| CI | Commit statuses, Check Runs, Actions | Pipelines and jobs | P1 | Match current head SHA; retain source type |
| Merge | PR merge with head SHA | MR merge with source SHA | P0 | Explicit confirmation; server authoritative; no implicit auto-merge/bypass/delete |
| Open in browser | PR html_url | MR web_url | P0 | Provider-aware action, never hardcode GitLab |

## Normalized model

Retain provider, connection ID, server origin, repository/project ID, native request ID and number/IID, native URL, branches, head SHA and provider-required diff position metadata. Discussion/comment models retain native resource kind, IDs, grouping, line side/position and resolution capability. Absence is not false/zero/empty.

## Error mapping

| Category | Typical response | Behavior |
|---|---|---|
| Authentication | 401 | Re-authenticate selected connection |
| Authorization | 403 | Keep valid connection; show operation-level permission |
| Not found/inaccessible | 404 | Avoid leaking details; refresh/reselect |
| Conflict/validation | 409/422 | Show safe reason; refresh stale context |
| Rate limit | 429/provider 403 | Respect retry metadata; no blind mutation retry |
| Network/timeout | Transport error | Mutation outcome unknown; reconcile server state |
| Unsupported | Missing endpoint/field/tier | Show Unsupported, not Empty |

## Compatibility evidence

| Host | Minimum version | Evidence | Status |
|---|---|---|---|
| GitHub.com | Managed | Mocked adapter contracts; see `test/integration/githubAdapter.test.ts` | Live P0 workflows not run |
| GitHub Enterprise Server | Candidate 3.19 (vendor-policy snapshot 2026-11-17; see DEC-005) | No host-version test | Blocked: candidate is not an accepted/tested floor |
| GitLab.com | Managed | Mocked adapter contracts; see `test/integration/gitlabAdapter.test.ts` | Live P0 workflows not run |
| GitLab Self-Managed | Candidate 19.3 (vendor-policy snapshot 2026-11-17; see DEC-005) | No host-version test | Blocked: candidate is not an accepted/tested floor |

Marketplace claims must not exceed tested versions. Any endpoint/permission/edition/normalization change updates this matrix, API-SPEC, SRS traceability, SDS, TEST-PLAN and IMPLEMENTATION-PLAN in the same PR.
