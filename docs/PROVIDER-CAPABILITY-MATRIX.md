# Provider Capability Matrix

This is the cross-provider product contract and local adapter capability snapshot; endpoint details remain in [API-SPEC.md](./API-SPEC.md). Mocked adapter tests do not establish live host acceptance.

## Support policy

- Supported means implemented for the named API contract; actual endpoint permissions and host compatibility depend on the selected host, account and repository/project settings. Conditional requires runtime detection of version, edition, repository settings or permission. Deferred is not promised in MVP.
- Never convert absent fields to false/empty. Distinguish Empty, Unsupported, Not authorized, Unknown and Not configured.
- Stable identity is provider + connection ID + repository/project ID + native PR number/MR IID.
- Shared services use provider-neutral ports. Adapters retain native IDs, URLs, comment types and diff-position semantics.
- GHES and GitLab Self-Managed minimum versions are release gates until selected and tested.

## Feature matrix

| Feature | GitHub | GitLab | Phase | Contract |
|---|---|---|---|---|
| Validate connection | GET /user | GET /user | P0 | Stable account ID/login; later repo 403 is operation-level permission |
| Repository/project | GET /user/repos; GET /repos/{owner}/{repo} | GET /projects; GET /projects/:id | P0 | Scope to selected connection; manual choice on ambiguity |
| List/detail | Pull Requests endpoints | Merge Requests endpoints | P0 | Normalize common fields, retain native ID/number/IID |
| Pagination | Link header | page/per_page | P0 | Adapter owns pagination; validate origin before credentials |
| Diff | PR files/patch | Diff versions + diff endpoint | P0 | Binary/large/collapsed/missing patch is explicit unavailable state |
| General comment | Issue comment endpoint | Create MR discussion | P0 | Preserve native resource type |
| Inline comment | PR review comment endpoint | MR discussion position | P0 | Single-line; exact SHA/path/line; never downgrade to general comment |
| Reply | Review-comment reply | Discussion notes endpoint | P0 | Supported thread types only |
| Existing threads | Reviews + review comments | Discussions + notes | P0 | Preserve grouping and native IDs |
| Resolve/reopen | Different semantics/API | Discussion resolve endpoint | Deferred | No assumed parity or MVP shared action |
| Edit/delete | Resource/permission dependent | Note edit/delete | Deferred | No MVP UI; ownership check required |
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
| GitHub Enterprise Server | TBD | No host-version test | Blocked: floor open |
| GitLab.com | Managed | Mocked adapter contracts; see `test/integration/gitlabAdapter.test.ts` | Live P0 workflows not run |
| GitLab Self-Managed | TBD | No host-version test | Blocked: floor open |

Marketplace claims must not exceed tested versions. Any endpoint/permission/edition/normalization change updates this matrix, API-SPEC, SRS traceability, SDS, TEST-PLAN and IMPLEMENTATION-PLAN in the same PR.
