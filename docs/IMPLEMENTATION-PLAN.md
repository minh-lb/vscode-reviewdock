# ReviewDock — Implementation Plan

> **Document ID:** RVD-PLAN-001  
> **Version:** 0.1.0  
> **Status:** Proposed plan — start after Product Owner approves the implementation baseline  
> **Related:** [SRS.md](./SRS.md), [DECISIONS.md](./DECISIONS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md)

## 1. Purpose

This plan converts the ReviewDock requirements and design into implementation milestones, work packages, dependencies and exit criteria.

It is a sequencing plan, not a delivery-date commitment. Estimate tasks after the first technical spike validates GitLab diff rendering and inline comment position mapping.

## 2. Delivery strategy

Build the MVP in vertical slices. Each slice must include:
- Domain/application logic.
- GitLab API integration where required.
- UI states.
- Automated tests.
- Documentation updates.

Do not build all UI first and defer API validation until the end. The GitLab diff/discussion integration is the highest technical risk and should be prototyped early.

## 3. Proposed repository structure

~~~text
.
├── docs/
│   ├── README.md
│   ├── SRS.md
│   ├── DECISIONS.md
│   ├── SDS.md
│   ├── API-SPEC.md
│   ├── UI-UX.md
│   ├── TEST-PLAN.md
│   └── IMPLEMENTATION-PLAN.md
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

**Goal:** make the repository buildable and testable without implementing GitLab workflows.

Tasks:
- [ ] Approve SRS and proposed decisions.
- [ ] Confirm minimum VS Code engine and GitLab compatibility floor.
- [ ] Create extension manifest and activation entry point.
- [ ] Configure TypeScript strict mode.
- [ ] Configure esbuild for extension host and Webview bundles.
- [ ] Configure ESLint and Prettier.
- [ ] Configure Vitest and @vscode/test-electron.
- [ ] Add CI for lint, typecheck, unit tests and build.
- [ ] Add contribution/development instructions.

Dependencies: none.

Exit criteria:
- Extension compiles and can be launched in Extension Development Host.
- CI passes on pull requests.
- No GitLab token or project secret is required to build/test.

### M1 — Connection and project selection

**Goal:** connect to GitLab and bind the current workspace to a project.

Tasks:
- [ ] Implement GitLab instance configuration.
- [ ] Implement SecretStorage adapter.
- [ ] Implement PAT validation using GET /user.
- [ ] Implement disconnect/replace-token flows.
- [ ] Implement typed GitLab HTTP client.
- [ ] Implement URL normalization and host validation.
- [ ] Implement Git remote parser for HTTPS and SSH forms.
- [ ] Implement project lookup and manual project picker.
- [ ] Implement connection and project empty/error states.
- [ ] Add unit and API integration tests.

Dependencies: M0 and approval of DEC-001/DEC-004/DEC-006.

Exit criteria:
- Valid PAT connects; invalid PAT gives actionable error.
- PAT exists only in SecretStorage.
- A project is resolved from a supported Git remote or manual selection.
- Project mapping survives restart without storing credentials.

### M2 — Merge Request discovery and detail

**Goal:** make MR data discoverable and readable.

Tasks:
- [ ] Implement MR list endpoint adapter.
- [ ] Implement state and scope filters.
- [ ] Implement title/IID search with debounce and cancellation.
- [ ] Implement pagination.
- [ ] Implement native Activity Bar and Tree Views.
- [ ] Implement MR detail retrieval and normalized models.
- [ ] Implement Webview panel lifecycle and message protocol.
- [ ] Implement Overview tab.
- [ ] Implement loading, empty, permission, stale and error states.
- [ ] Add tests for filters, pagination, cancellation and DTO mapping.

Dependencies: M1.

Exit criteria:
- User can browse, filter, search and open MR.
- MR detail reflects GitLab response.
- Switching project/MR does not show results from the previous selection.

### M3 — Diff viewer and inline comments

**Goal:** deliver the core code review experience.

Tasks:
- [ ] Implement diff version retrieval.
- [ ] Implement paginated file diff retrieval.
- [ ] Implement unified diff parser.
- [ ] Implement old/new line mapping for added, removed and context lines.
- [ ] Build Webview file navigator and diff renderer.
- [ ] Display existing diff discussions at line anchors.
- [ ] Implement single-line inline comment composer.
- [ ] Implement stale diff revalidation before comment submission.
- [ ] Handle binary, collapsed, oversized and missing patches.
- [ ] Add parser fixtures and line mapping tests.
- [ ] Verify inline comment positions against a real GitLab test project.

Dependencies: M2 and approval of DEC-002/DEC-003/DEC-005/DEC-012.

Exit criteria:
- All commentable rows map to exact GitLab line positions.
- Added, removed and context line comments are accepted by GitLab.
- Stale diff prevents submission and preserves the draft.
- Unsupported diff states are explicit and do not crash the Webview.

### M4 — Discussions and general comments

**Goal:** complete the review conversation workflow.

Tasks:
- [ ] Implement discussions list and pagination.
- [ ] Implement general discussion creation.
- [ ] Implement reply to discussion.
- [ ] Render thread grouping, author and timestamps.
- [ ] Implement submit-pending and duplicate-submit protection.
- [ ] Implement ambiguous timeout recovery by refreshing discussions.
- [ ] Add API and end-to-end tests.

Dependencies: M2 and M3.

Exit criteria:
- General comments and replies appear in GitLab.
- Discussion thread grouping is preserved.
- Ambiguous POST results do not trigger automatic duplicate submissions.

### M5 — Merge operation

**Goal:** allow safe, explicit immediate merge.

Tasks:
- [ ] Implement merge eligibility presentation from fresh MR data.
- [ ] Implement merge confirmation dialog.
- [ ] Re-fetch MR immediately before merge.
- [ ] Send current source HEAD SHA.
- [ ] Implement typed handling for 401/403/405/409/422 and timeout.
- [ ] Refresh MR list/detail after success or rejection.
- [ ] Add tests for merge success, SHA mismatch, policy rejection and ambiguous timeout.
- [ ] Verify against a non-production GitLab test project.

Dependencies: M2 and approval of DEC-009.

Exit criteria:
- Merge requires explicit confirmation.
- Request includes current SHA.
- No auto-merge or implicit source-branch deletion is requested.
- GitLab rejection is shown accurately.
- No automatic retry of ambiguous merge mutations.

### M6 — P1 capabilities

**Goal:** add pipeline and approval visibility after MVP core workflows are stable.

Tasks:
- [ ] Implement MR pipeline list.
- [ ] Implement pipeline job list.
- [ ] Match pipeline SHA to MR head SHA.
- [ ] Implement basic approval state.
- [ ] Feature-detect detailed approval state and edition/tier limitations.
- [ ] Add unsupported-capability states.
- [ ] Add P1 tests.

Dependencies: M5 and API compatibility verification.

Exit criteria:
- Pipeline and approval state are shown only when returned by GitLab.
- Missing edition-specific fields are not interpreted as failed approval.
- P1 panels do not break MR overview or review workflows.

### M7 — Hardening and release

**Goal:** prepare a reliable Marketplace-ready extension.

Tasks:
- [ ] Run full test plan.
- [ ] Run Windows/macOS/Linux smoke tests.
- [ ] Run GitLab compatibility matrix.
- [ ] Review Webview CSP and message validation.
- [ ] Review token storage and log redaction.
- [ ] Verify keyboard navigation and high-contrast theme.
- [ ] Measure activation and large-diff performance.
- [ ] Add user documentation and screenshots.
- [ ] Configure Marketplace metadata and icon.
- [ ] Package VSIX and verify installation.
- [ ] Prepare release notes and known limitations.

Dependencies: M0–M5; M6 if P1 is included in the release.

Exit criteria:
- All P0 release gates in TEST-PLAN.md pass.
- No open critical/high security issue.
- Compatibility statement matches tested GitLab versions.
- VSIX installs and runs in a clean VS Code profile.

## 6. Dependency graph

~~~mermaid
flowchart TD
  M0[M0 Foundation] --> M1[M1 Connection and Project]
  M1 --> M2[M2 MR Discovery and Detail]
  M2 --> M3[M3 Diff and Inline Comments]
  M2 --> M4[M4 Discussions]
  M3 --> M4
  M2 --> M5[M5 Merge]
  M4 --> M5
  M5 --> M6[M6 Pipeline and Approval P1]
  M5 --> M7[M7 Hardening and Release]
  M6 --> M7
~~~

M3 is the main technical risk. Run a short spike after M2 to validate diff version retrieval and position mapping before committing to the full diff UI implementation.

## 7. Suggested pull request strategy

Keep PRs small and independently reviewable:

1. M0: project scaffold and CI.
2. M1: authentication and project mapping.
3. M2: MR list and detail.
4. M3a: diff parser and line mapper.
5. M3b: diff UI and inline comment.
6. M4: general comments and discussions.
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
| GitLab diff limits or incomplete patches | Some files cannot be reviewed in extension | Handle collapsed/too-large/overflow states; link to GitLab Web |
| Incorrect inline line mapping | Comment lands on wrong code | Parser fixtures, version SHAs, real GitLab integration test |
| GitLab version/edition differences | Feature unavailable on some instances | Compatibility floor, feature detection, graceful degradation |
| PAT api scope is broad | Credential impact if compromised | SecretStorage, no Webview exposure, clear scope disclosure, recommend expiring token |
| MR changes while being reviewed | Stale comments or merge | Revalidate diff SHAs and merge SHA |
| Webview injection | Arbitrary script execution | CSP, local assets, safe Markdown rendering, validated messages |
| Large MR impacts responsiveness | Slow or unresponsive UI | Pagination, lazy loading, bounded concurrency, render virtualization if needed |
| Ambiguous mutation timeout | Duplicate comment or merge | No automatic mutation retry; refresh server state first |

## 9. Definition of Ready

A feature is ready to enter implementation when:
- Relevant SRS requirements are identified.
- Relevant DEC items are approved.
- API endpoints and response fields are documented.
- UI states and user flow are specified.
- Error and permission cases are listed.
- Test cases exist or are planned.
- Dependencies and out-of-scope behavior are explicit.

## 10. Definition of Done

A feature is done when:
- Implementation follows SDS and approved decisions.
- Unit/integration tests pass.
- Relevant UI states are implemented.
- Security requirements are met.
- Manual acceptance criteria pass where required.
- Logs contain no secret or sensitive source data.
- Documentation and requirement traceability are updated.
- No known critical regression remains.
