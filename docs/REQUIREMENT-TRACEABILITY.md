# Requirement Traceability Matrix

**Status:** planning baseline. Planned does not mean implemented or verified.

## Rules

- Every normative SRS requirement ID must have exactly one row.
- Design owner is the primary boundary; milestones are plans, not completion evidence.
- Test-family references must resolve to concrete test names/manual cases before milestone acceptance.
- Status: Planned, In progress, Implemented, Verified, Deferred, Blocked. Only Verified means evidence exists.
- Update this matrix whenever SRS, API, SDS, UI, tests or milestones change.

## Requirement mapping

| Prefix | Design owner | Milestone | Verification family |
|---|---|---|---|
| AUTH | ConnectionService, CredentialStore, ProviderRequestGuard | M1 | API-AUTH; E2E-001/008 |
| PROJ | ProjectService, GitRemoteResolver, WorkspaceStore | M1 | API-PROJ; E2E-001 |
| MR/DETAIL | ReviewRequestService, provider adapters, DTO mappers | M2 | API-MR; API-GH-PR; E2E-002 |
| DIFF | DiffService, UnifiedDiffParser, DiffLineMapper | M3 | API-DIFF; parser/line-map tests; E2E-003/005 |
| DISC | ReviewService, DiscussionRepository, CommentComposer | M4 | API-DISC; API-GH-COM; E2E-004/005 |
| MERGE | MergeService, confirmation UI, provider mutation adapters | M5 | API-MERGE; API-GH-MERGE; E2E-006/007 |
| APR | ApprovalService, capability adapter | M6 (P1) | Approval API tests |
| PIPE | PipelineService, CheckRun/Job adapters | M6 (P1) | Pipeline API tests |
| NFR/SEC | Cross-cutting architecture/security/performance | M0-M7 | Unit/integration/E2E/security/performance |
| UI/IF/COM | Presentation, provider clients, message protocol | M1-M7 | Extension/Webview/API protocol tests |
| DATA/BR/ERR | Domain models, storage, validation and error mapping | M1-M7 | Persistence/business-rule/error tests |

## Verification evidence

A requirement is Implemented only after code exists and review is complete. It is Verified only after named tests pass or manual records capture environment, steps and result; provider mutations are checked against test instances; security, cancellation, stale-data and error paths pass; and no P0/P1 defect blocks acceptance.

## Maintenance gate

CI should compare IDs extracted from SRS against this mapping and fail on missing/duplicate IDs. Until that validator exists, reviewers must compare manually. Before milestone acceptance, add an ID-level row for every SRS ID and replace test-family references with concrete test IDs. This document is a group-level baseline, not proof of complete per-ID traceability.
