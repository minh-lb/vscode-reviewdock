# ReviewDock — Requirement Traceability Matrix

> **Document ID:** RVD-RTM-001  
> **Version:** 0.1.0  
> **Status:** Proposed — maintain throughout implementation  
> **Related:** [SRS.md](./SRS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md), [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

## 1. Purpose and rules

This matrix links each SRS requirement family to its design owner, provider/API contract, implementation milestone and verification evidence.

- The SRS remains the authoritative source for requirement wording and priority.
- A range in the matrix covers every numbered requirement in that range. If an ID is added, removed or renumbered, update this matrix in the same change.
- Test IDs in this document identify planned verification, not passed tests.
- A requirement is **Verified** only after the implementation, test result and evidence link are recorded.
- Unsupported provider behavior is verified by a negative capability test, not by omitting the test.
- Every requirement must be in one of these states: Proposed, Approved, Implemented, Verified or Deferred. Deferred items require an owner and rationale.

## 2. Requirement-to-design-to-test matrix

| Requirement IDs | Design owner / SDS | API and UX contract | Milestone | Planned verification |
|---|---|---|---|---|
| UI-001–UI-010 | Extension bootstrap, Tree Views, Webview bridge, accessibility layer | UI-UX §§2–12 | M0, M2, M3, M4, M5, M7 | EXT-002–EXT-014, EXT-018–EXT-020, E2E-002A/B |
| IF-001–IF-005 | Extension host, application ports, provider registry | SDS §§3–4; API-SPEC §§2–3 | M0, M1 | EXT-001, EXT-008, API-AUTH, API-GH-AUTH |
| COM-001–COM-005 | Provider HTTP clients, URL guard, pagination and redacting logger | API-SPEC §§2–3 | M1–M7 | API-AUTH-003/004, API-GH-PAGE-001, SEC-TEST-003/006, UNIT-ERR |
| AUTH-001–AUTH-019 | ConnectionService, AuthenticationService, SecretStore, ProviderRequestGuard | CONNECTION-MANAGEMENT §§3–8; SDS §§4.2, 6 | M1 | UNIT-CONN-001–022, API-AUTH-001–004, API-GH-AUTH-001–003, EXT-015–017, E2E-001, E2E-008 |
| PROJ-001–PROJ-009 | RepositoryService, GitRemoteResolver, WorkspaceBindingStore | API-SPEC §§4, 13.1; UI-UX §3 | M1 | UNIT-PROJ-001–006, API-PROJ-001/002, API-GH-REPO-001, E2E-001 |
| MR-001–MR-010 | ReviewRequestService, provider adapters, list filters and pagination | API-SPEC §§5.1, 13.2, 13.2A; UI-UX §§2, 4 | M2 | API-MR-001–006, API-GH-PR-001–004, E2E-002A/B |
| DETAIL-001–DETAIL-006 | ReviewRequestMapper and detail view model | API-SPEC §§5.2, 13.2; UI-UX §4 | M2 | API-MR-006, API-GH-PR-001, E2E-002A/B |
| DIFF-001–DIFF-012 | DiffService, UnifiedDiffParser, GitHubLineMapper, GitLabPositionMapper | SDS §7; API-SPEC §§5.3–5.4, 13.2–13.3; UI-UX §5 | M3 | UNIT-DIFF-001–009, API-DIFF-001–003, API-GH-PR-002, API-GH-COM-002–004/009, E2E-003A/B, E2E-005A/B |
| DISC-001–DISC-013 | ReviewService, ConversationMapper, capability guard | SDS §§4.5, 5, 8; API-SPEC §§6, 13.3A; UI-UX §§5–6 | M4 | UNIT-CONV-001–005, API-DISC-001–006, API-GH-COM-001–008, E2E-004A/B |
| APR-001–APR-005 | ReviewDecisionService, ApprovalMapper, capability descriptor | API-SPEC §§7, 13.4; UI-UX §7 | M6 (P1) | API-APR-001–005, API-GH-REVIEW-001–003 |
| PIPE-001–PIPE-005 | CheckPipelineService, HeadShaMatcher | API-SPEC §§8, 13.5; UI-UX §7 | M6 (P1) | API-PIPE-001–003, API-GH-CHECK-001–003 |
| MERGE-001–MERGE-010 | MergeService, provider merge adapters, confirmation controller | SDS §8.4; API-SPEC §§9, 13.6; UI-UX §8 | M5 | API-MERGE-001–004, API-GH-MERGE-001–004, E2E-006A/B, E2E-007A/B |
| BR-001–BR-010 | Domain invariants, connection and mutation guards | SRS §5; SDS §§5–10 | M1–M7 | UNIT-CONN, UNIT-DIFF, UNIT-CONV, UNIT-ERR, E2E-001–008 |
| DATA-001–DATA-007 | SecretStore, GlobalState, WorkspaceState, cache key factory | SRS §6; CONNECTION-MANAGEMENT §3; SDS §6 | M1 | UNIT-CONN-007–022, SEC-TEST-001/002/007 |
| ERR-001–ERR-010 | AppError mapper, provider error adapters, UI state mapper | SRS §8; SDS §9; API-SPEC §3.4 | M1–M7 | UNIT-ERR-001–008, API error cases, EXT-003/013, E2E-005A/B, E2E-007A/B |
| NFR-PERF-001–005 | Async activation, request scheduler, cancellation and lazy diff loading | SRS §7.1; SDS §§4, 10 | M0–M7 | EXT-001/004/016, PERF-001–004 |
| NFR-SEC-001–009 | SecretStore, URL guard, CSP, schema validation, redacting logger | SRS §7.2; SDS §§6, 11–12; API-SPEC §2.5 | M1, M7 | SEC-TEST-001–010, EXT-006–011/015 |
| NFR-REL-001–005 | Typed errors, stale-data handling, mutation reconciliation | SRS §7.3; SDS §§9–10 | M1–M7 | UNIT-ERR, API error cases, EXT-013/017, E2E-005A/B, E2E-007A/B |
| NFR-COMP-001–004 | Build matrix, compatibility policy and release pipeline | SRS §7.4; PROVIDER-CAPABILITY-MATRIX §7; DEVELOPMENT-GUIDE §8 | M0, M7 | CI-001–004, E2E smoke tests on Windows/macOS/Linux, compatibility test report |
| NFR-MAIN-001–005 | TypeScript strict build, ports/adapters, DTO validation and test architecture | SDS §§3–5; DEVELOPMENT-GUIDE §§3–7 | M0–M7 | CI-001–004, unit/API suite, code review inspection |
| NFR-UX-001–004 | Keyboard navigation, theme tokens, accessible labels and status text | UI-UX §§9–12 | M2–M7 | EXT-018–020, manual accessibility checklist |
 
## 3. Verification evidence record

Implementation must maintain an evidence table. Add one row per requirement or approved requirement group; do not mark a whole family verified when only one representative test has run.

| Requirement ID / group | Test or inspection ID | Provider / version | Result | Evidence link | Verified by | Date |
|---|---|---|---|---|---|---|
| Example: AUTH-007 | UNIT-CONN-007, SEC-TEST-001 | VS Code minimum + current Stable | Pending | — | — | — |

Allowed results: Pending, Passed, Failed, Blocked, Deferred. A test marked Blocked or Deferred is not a pass.

## 4. Release traceability gates

Before MVP release:

1. Every P0 SRS ID appears in this matrix.
2. Every P0 ID maps to at least one test or explicit inspection.
3. GitHub and GitLab P0 provider-specific tests are both represented.
4. Provider limitations have negative tests proving unsupported actions are not exposed.
5. All test results have evidence; skipped tests have approved deferral records.
6. No P0 requirement is Deferred without Product Owner approval.
7. The release checklist references the exact compatibility matrix and test report.

## 5. Change control

When a requirement changes:

1. Update SRS wording and version history.
2. Update the provider capability matrix if provider behavior or availability changes.
3. Update SDS and API-SPEC where design or endpoint contracts change.
4. Update UI-UX and TEST-PLAN acceptance behavior.
5. Update the implementation milestone and this traceability matrix.
6. Include all affected requirement IDs in the pull request description.
