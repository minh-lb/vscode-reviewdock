# ReviewDock — Implementation Plan

> **Document ID:** RVD-PLAN-001
> **Version:** 0.2.0
> **Status:** Delivery snapshot plus original implementation/acceptance plan. See the delivery status below; the milestones and checklists remain the design baseline and are not a claim that their external gates have passed.
> **Related:** [SRS.md](./SRS.md), [DECISIONS.md](./DECISIONS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md), [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md), [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md), [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)

## Delivery status snapshot (2026-11-17)

The owner adopted the proposed decisions as the implementation baseline. On 2026-11-17, `npm test` passed 88/88 tests across 12 files; typecheck, lint, format check, traceability check and build passed. Packaging succeeded with a 105.81 KB VSIX; the packager emitted a license warning because package metadata declares `UNLICENSED`. macOS VS Code 1.140.0 and stable 1.146.0 host activation smoke passed. The inline comment modal has automated focus-trap, Escape and focus-restoration regression coverage. GitHub Actions run [43929736927](https://github.com/minh-lb/vscode-reviewdock/actions/runs/43929736927) passed all seven jobs at `48f8d0b76492e0dccbd5c629581f7054387e7b5f`: quality and extension-host on Linux x64 and Windows x64 with VS Code 1.140.0 and 1.146.0, plus macOS arm64 with both versions. This run predates the current local empty-state fix at `21bcd27`. Its host smoke covers activation and contributed metadata only, not full cross-OS UI, SecretStorage, provider workflows or installation. These checks do not establish live provider acceptance or production readiness.

| Work package | Local status | Remaining evidence / gate |
|---|---|---|
| Foundation and host | Implemented | Post-fix macOS VS Code 1.140 and stable 1.146 activation/manifest smoke passed. |
| Connections and repository binding | Implemented | Mocked unit/transport coverage; validate real provider account and permission behavior. |
| GitHub/GitLab discovery and review | Implemented locally | Mocked adapter and UI coverage; live P0 acceptance remains open. |
| Diff and inline positioning | Implemented locally | Parser/mapping fixtures pass; validate positions on disposable resources for both providers. |
| Conversations and merge | Implemented locally | Mocked mutation and orchestration checks; live comments/replies/merge acceptance remains open. |
| P1 checks, jobs and approval/review state | Implemented locally | Mocked adapter coverage; live permission and edition/version behavior remains open. |
| Package and installation | Locally verified | Production minified VSIX build/package and isolated install/list confirmation for the final artifact passed. |

Next gates are live GitHub.com/GitLab.com acceptance using disposable resources; selecting and testing exact GHES and GitLab Self-Managed floors; full cross-OS UI, SecretStorage, provider-workflow and installation smoke; manual screen-reader, high-contrast and complete keyboard workflow review; and final artifact/release review. PAT scope guidance is documented, but the app does not inspect granted permissions. OAuth, multiline inline comments, comment edit/delete, GitHub REST review-thread resolution, approval submission, automatic merge and merge queues remain deferred or unsupported. See [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md), [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md) and [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md).

The detailed milestone checklists below retain the original sequence and acceptance criteria. Checkboxes are planned criteria, not current status; use the delivery snapshot and requirement matrix for current evidence.

## 1. Purpose

This plan converts the ReviewDock requirements and design into implementation milestones, work packages, dependencies and exit criteria.

It is a sequencing plan, not a delivery-date commitment. The work has now been implemented locally; the original milestone tasks below retain design intent and are not a live checklist. See the delivery snapshot above for current status and remaining acceptance gates.

## 2. Delivery strategy

Build the MVP in vertical slices. Each slice must include:
- Domain/application logic.
- provider API integration where required.
- UI states.
- Automated tests.
- Documentation updates.

Do not build all UI first and defer API validation until the end. Provider-specific diff/comment semantics are the highest technical risk. Prototype GitHub line/side mapping and GitLab diff-version position mapping early, and verify conversation reply semantics on both providers.

## 3. Proposed repository structure

~~~text
.
├── docs/
│   ├── README.md
│   ├── SRS.md
│   ├── DECISIONS.md
│   ├── CONNECTION-MANAGEMENT.md
│   ├── SDS.md
│   ├── API-SPEC.md
│   ├── PROVIDER-CAPABILITY-MATRIX.md
│   ├── UI-UX.md
│   ├── TEST-PLAN.md
│   ├── REQUIREMENT-TRACEABILITY.md
│   ├── IMPLEMENTATION-PLAN.md
│   └── DEVELOPMENT-GUIDE.md
├── src/
│   ├── extension.ts
│   ├── commands/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
│       ├── tree/
│       └── webview/
├── test/
│   ├── unit/
│   ├── integration/
│   ├── extension/
│   └── fixtures/
├── webview-ui/
│   ├── src/
│   └── package.json
├── .github/
│   └── workflows/
├── package.json
├── tsconfig.json
├── esbuild.mjs
├── eslint.config.js
└── README.md
~~~

The extension host and Webview may be built as separate bundles. Keep dependencies and output boundaries explicit.

## 4. Toolchain proposal

| Area | Proposed tool |
|---|---|
| Language | TypeScript with strict mode |
| Extension API | vscode package types |
| Extension bundling | esbuild |
| Webview UI | React + TypeScript |
| Unit/API tests | Vitest |
| Extension-host tests | @vscode/test-electron |
| Lint | ESLint |
| Formatting | Prettier |
| Packaging | @vscode/vsce |
| CI | GitHub Actions |

Use pinned dependency versions and a lockfile. Keep runtime dependencies minimal. Do not introduce a GitLab SDK unless a documented need outweighs the maintenance and compatibility cost; a small typed REST adapter is preferred for the MVP.

## 5. Milestones

### M0 — Baseline and repository foundation

**Goal:** make the repository buildable and testable without implementing provider workflows.

Tasks:
- [ ] Approve SRS and proposed decisions.
- [ ] Approve DEC-005 and DEC-019; confirm the minimum VS Code engine and vendor-maintained GHES/GitLab compatibility policy.
- [ ] Create PROVIDER-CAPABILITY-MATRIX.md and REQUIREMENT-TRACEABILITY.md baselines (maintain as implementation proceeds).
- [ ] Implement the required npm scripts and DEVELOPMENT-GUIDE.md setup/debug workflow.
- [ ] Create extension manifest and activation entry point.
- [ ] Configure TypeScript strict mode.
- [ ] Configure esbuild for extension host and Webview bundles.
- [ ] Configure ESLint and Prettier.
- [ ] Configure Vitest and @vscode/test-electron.
- [ ] Add CI for lint, formatting, typecheck, unit tests, mocked provider contract tests and build.
- [ ] Add contribution/development instructions and F5 Extension Development Host launch configuration.

Dependencies: none.

Exit criteria:
- Extension compiles and can be launched in Extension Development Host.
- CI passes on pull requests.
- No GitHub/GitLab token or project secret is required to install, build, lint or run mocked tests.

### M1 — Connection and project selection

**Goal:** manage multiple independent GitHub/GitLab connections and bind each workspace repository to the correct provider account and repository.

Tasks:
- [ ] Implement provider registry for GitHub and GitLab.
- [ ] Implement connection CRUD with immutable UUID, provider, display name, server URL and account identity.
- [ ] Implement per-connection enabled flag (default true), enable/disable UI and persistence independent from connection health.
- [ ] Implement per-connection SecretStorage keys; never key secrets by mutable display name.
- [ ] Implement GitHub PAT validation using the authenticated-user endpoint and GitLab PAT validation using GET /user.
- [ ] Implement test, rename, re-authenticate, disconnect and delete actions independently per connection.
- [ ] Implement one optional enabled default connection per provider and per-workspace repository binding.
- [ ] Exclude disabled connections from all resolution/selection paths and enforce a local request guard before SecretStorage lookup; clear a provider default when its connection is disabled.
- [ ] Preserve disabled connection credentials/status/bindings and show blocked workspace bindings without automatic failover.
- [ ] Implement separate typed GitHub REST API v3 and GitLab REST API v4 clients behind provider adapters.
- [ ] Implement server URL normalization, API-origin validation and credential redirect/pagination isolation.
- [ ] Implement Git remote parser for GitHub/GitLab HTTPS and SSH forms.
- [ ] Implement repository lookup and manual connection/repository picker; require user choice when multiple accounts match.
- [ ] Implement connection and repository empty/error/permission states.
- [ ] Add unit and provider API integration tests for multi-account isolation.

Dependencies: M0 and approval of DEC-001/DEC-004/DEC-005/DEC-006/DEC-013/DEC-014/DEC-015/DEC-016/DEC-019.

Exit criteria:
- User can create multiple GitHub and GitLab connections, including multiple accounts on the same host.
- Every connection has its own immutable ID, user-defined display name, independently validated account identity and enabled flag (default true).
- Credentials are stored only in connection-scoped SecretStorage entries.
- Test, rename, re-authenticate, enable/disable, disconnect and delete affect only the selected connection.
- Disabled connections cannot be resolved or issue API requests; credentials, last-known status and workspace bindings remain intact; no automatic failover occurs.
- Each provider has at most one optional default; each workspace folder has its own active repository binding.
- Ambiguous remote/account matches require an explicit user choice.
- No token is sent to another provider, connection or host.
- Repository bindings survive restart without storing credentials.

### M2 — Pull Request / Merge Request discovery and detail

**Goal:** make GitHub PRs and GitHub PR / GitLab MRs discoverable and readable through provider-native queries.

Tasks:
- [ ] Implement GitHub PR list adapter and GitHub PR / GitLab MR list adapter.
- [ ] Implement state filters and provider-native scopes (GitHub Search Issues qualifiers; GitHub PR / GitLab MR list scopes).
- [ ] Implement title/number search with debounce and cancellation; surface GitHub Search API cap/rate-limit states.
- [ ] Implement pagination.
- [ ] Implement native Activity Bar and Tree Views.
- [ ] Implement PR/MR detail retrieval and normalized models that preserve provider/repository identity.
- [ ] Implement Webview panel lifecycle and message protocol.
- [ ] Implement Overview tab.
- [ ] Implement loading, empty, permission, stale and error states.
- [ ] Add GitHub/GitLab contract tests for filters, pagination, cancellation and DTO mapping.

Dependencies: M1 and approval of DEC-018.

Exit criteria:
- User can browse, filter, search and open PR/MR on both providers.
- PR/MR detail reflects the selected provider response without leaking provider DTOs into the domain.
- Switching repository/project or PR/MR does not show results from the previous selection.

### M3 — Provider-aware diff viewer and inline comments

**Goal:** deliver the core code review experience with separate, verified GitHub and GitLab line-position mappers.

Tasks:
- [ ] Implement GitLab diff-version retrieval and GitHub current-head/diff metadata retrieval.
- [ ] Implement paginated GitHub PR files and GitHub PR / GitLab MR diffs retrieval; represent provider result caps/partial responses.
- [ ] Implement unified diff parser.
- [ ] Implement shared unified-diff row parsing plus GitHub line/side mapping and GitLab old/new position mapping.
- [ ] Build Webview file navigator and diff renderer.
- [ ] Display existing GitHub review comments and GitLab discussions at line anchors.
- [ ] Implement single-line inline comment composer.
- [ ] Implement GitHub PR head-SHA and GitLab diff-version SHA revalidation before comment submission.
- [ ] Handle binary, collapsed, oversized and missing patches.
- [ ] Add parser fixtures and line mapping tests.
- [ ] Verify GitHub line/side and GitLab old/new position mapping against non-production test repositories/projects.

Dependencies: M2 and approval of DEC-002/DEC-003/DEC-005/DEC-012/DEC-017.

Exit criteria:
- All commentable rows map to exact provider-specific positions; unsupported rows are not commentable.
- Added, removed and context line comments are accepted by both providers using their native position contract.
- Stale diff prevents submission and preserves the draft.
- Unsupported diff states are explicit and do not crash the Webview.

### M4 — Provider-aware conversations and comments

**Goal:** complete general-comment, inline-comment and reply workflows without flattening GitHub/GitLab conversation semantics.

Tasks:
- [ ] Implement GitHub issue comments/review comments/reviews retrieval and GitLab discussions/notes retrieval with pagination.
- [ ] Implement GitHub general issue comments and GitLab top-level discussions.
- [ ] Implement replies only for supported conversation kinds: GitHub top-level inline review comments; GitLab discussion notes.
- [ ] Render provider-native resource kind, thread grouping, parent IDs, author, timestamps, system notes and resolution state.
- [ ] Implement submit-pending and duplicate-submit protection.
- [ ] Implement ambiguous timeout recovery by refreshing the relevant provider conversation collections (issue comments/review comments or discussions).
- [ ] Add GitHub/GitLab API and provider-specific E2E tests, including negative tests for unsupported reply/resolve actions.

Dependencies: M2 and M3 plus approval of DEC-017.

Exit criteria:
- General comments and supported replies appear on the correct GitHub/GitLab resource.
- GitHub issue comments, inline review comments and GitLab discussions remain distinguishable; thread grouping is preserved where the provider supplies it.
- Ambiguous POST results do not trigger automatic duplicate submissions.

### M5 — Provider-aware merge operation

**Goal:** allow safe, explicit immediate merge for GitHub PRs and GitHub PR / GitLab MRs.

Tasks:
- [ ] Implement merge eligibility presentation from fresh PR/MR data while keeping provider status values distinct.
- [ ] Implement merge confirmation dialog with provider-native PR/MR identity and current branch/SHA details.
- [ ] Re-fetch PR/MR immediately before merge.
- [ ] Send current PR head SHA or GitLab source HEAD SHA according to the selected provider endpoint.
- [ ] Implement typed handling for 401/403/405/409/422 and timeout.
- [ ] Refresh PR/MR list/detail after success or rejection.
- [ ] Add tests for merge success, SHA mismatch, policy rejection and ambiguous timeout.
- [ ] Verify against non-production GitHub and GitLab test repositories/projects.

Dependencies: M2 and approval of DEC-009.

Exit criteria:
- Merge requires explicit confirmation.
- Request includes current SHA.
- No auto-merge or implicit source-branch deletion is requested.
- Provider rejection is shown accurately.
- No automatic retry of ambiguous merge mutations.

### M6 — P1 provider-specific review, approval and checks capabilities

**Goal:** add pipeline and approval visibility after MVP core workflows are stable.

Tasks:
- [ ] Implement GitHub PR / GitLab MR pipeline list and GitHub Check Runs/commit status list.
- [ ] Implement GitLab pipeline jobs and GitHub Actions workflow run summaries.
- [ ] Match check/pipeline SHA to PR/MR head SHA.
- [ ] Implement GitLab basic approval state and GitHub review decision state.
- [ ] Feature-detect GitLab CE/EE approval fields and GitHub review permission/capability limitations.
- [ ] Add unsupported-capability states.
- [ ] Add P1 tests.

Dependencies: M5, approval of DEC-007/DEC-008 and API compatibility verification.

Exit criteria:
- Checks/pipeline and review/approval state are shown only when returned by the selected provider.
- Missing edition-specific or provider-specific fields are not interpreted as failed approval.
- P1 panels do not break MR overview or review workflows.

### M7 — Hardening and release

**Goal:** prepare a reliable Marketplace-ready extension.

Tasks:
- [ ] Run full test plan.
- [ ] Run Windows/macOS/Linux smoke tests.
- [ ] Run the published VS Code, GitHub.com, GHES, GitLab.com and GitLab Self-Managed compatibility matrix.
- [ ] Review Webview CSP and message validation.
- [ ] Review token storage and log redaction.
- [ ] Verify keyboard navigation and high-contrast theme.
- [ ] Measure activation and large-diff performance.
- [ ] Add user documentation, DEVELOPMENT-GUIDE.md and sanitized screenshots.
- [ ] Configure Marketplace metadata and icon.
- [ ] Package VSIX and verify installation.
- [ ] Prepare release notes and known limitations.

Dependencies: M0–M5; M6 if P1 is included in the release.

Exit criteria:
- All P0 release gates in TEST-PLAN.md pass.
- No open critical/high security issue.
- Compatibility statement matches tested VS Code, GHES and GitLab versions.
- VSIX installs and runs in a clean VS Code profile.

## 6. Dependency graph

~~~mermaid
flowchart TD
  M0[M0 Foundation] --> M1[M1 Connection and Project]
  M1 --> M2[M2 PR/MR Discovery and Detail]
  M2 --> M3[M3 Diff and Inline Comments]
  M2 --> M4[M4 Conversations]
  M3 --> M4
  M2 --> M5[M5 Provider Merge]
  M5 --> M6[M6 Checks and Review Decisions P1]
  M5 --> M7[M7 Hardening and Release]
  M6 --> M7
~~~

M3 is the main technical risk. Run a short spike after M2 to validate GitHub head-SHA/line-side mapping, GitLab diff-version/position mapping, and the separate comment/reply semantics before committing to the full diff UI implementation.

## 7. Suggested pull request strategy

Keep PRs small and independently reviewable:

1. M0: project scaffold and CI.
2. M1: authentication and project mapping.
3. M2: PR/MR list and detail.
4. M3a: diff parser and line mapper.
5. M3b: diff UI and inline comment.
6. M4: provider-aware general comments, inline review comments and discussions.
7. M5: merge workflow.
8. M6: pipeline and approvals.
9. M7: release hardening.

Every PR should:
- Reference requirement IDs.
- Include tests.
- Update docs if behavior changes.
- Avoid mixing unrelated refactors with feature implementation.
- Never include real tokens or production data.

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Provider diff limits or incomplete patches | Some files cannot be reviewed in extension | Handle GitHub's 3,000-file cap and missing patches; handle GitLab collapsed/too-large/overflow states; link to provider Web |
| Incorrect inline line mapping | Comment lands on wrong code | Separate GitHub/GitLab mappers, parser fixtures, current SHAs and real provider integration tests |
| Provider version/edition differences | Feature unavailable on some instances | Vendor-maintained compatibility policy, contract tests, feature detection and graceful degradation |
| Provider PAT permissions differ; GitLab `api` scope is broad | Credential impact if compromised | Prefer GitHub fine-grained PAT, disclose GitLab scope, use SecretStorage, no Webview exposure and recommend expiring tokens |
| PR/MR changes while being reviewed | Stale comments or merge | Revalidate diff SHAs and merge SHA |
| Webview injection | Arbitrary script execution | CSP, local assets, safe Markdown rendering, validated messages |
| Large PR/MR impacts responsiveness | Slow or unresponsive UI | Pagination, lazy loading, bounded concurrency, render virtualization if needed |
| Ambiguous mutation timeout | Duplicate comment or merge | No automatic mutation retry; refresh server state first |

## 9. Definition of Ready

A feature is ready to enter implementation when:
- Relevant SRS requirements are identified.
- Relevant DEC items are approved.
- API endpoints, response fields, provider differences and permission requirements are documented.
- UI states and user flow are specified.
- Error and permission cases are listed.
- Test cases exist or are planned for each affected provider, including unsupported-capability negative tests.
- The requirement-to-design-to-test mapping is updated in REQUIREMENT-TRACEABILITY.md.
- Dependencies and out-of-scope behavior are explicit.

## 10. Definition of Done

A feature is done when:
- Implementation follows SDS and approved decisions.
- Unit/integration tests pass.
- Relevant UI states are implemented.
- Security requirements are met.
- Manual acceptance criteria pass where required.
- Logs contain no secret or sensitive source data.
- Documentation, PROVIDER-CAPABILITY-MATRIX.md and REQUIREMENT-TRACEABILITY.md are updated.
- No known critical regression remains.


## 11. Cross-provider implementation gates

- M0 establishes strict TypeScript, deterministic tests, provider HTTP harnesses, extension-host/Webview tests, CI and reproducible VSIX packaging. Record exact commands in [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md).
- M1 completes independent GitHub/GitLab clients, account isolation, origin validation and repository/project binding before M2.
- M2-M5 are not complete until P0 workflows pass independently on GitHub.com and GitLab.com.
- M3 verifies inline positions against real test resources on both providers; mocks alone are insufficient.
- M5 verifies merge rejection and ambiguous-timeout reconciliation on both providers using disposable resources.
- M7 tests every Enterprise/Self-Managed version claimed. Untested versions are excluded from compatibility claims.
- Maintain [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md) and [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md) as living release gates.
