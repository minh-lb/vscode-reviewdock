# Implementation status

The owner adopted the proposed decisions as the implementation baseline. This records a local delivery snapshot, not a production-readiness or live-provider acceptance claim.

## Implemented locally

- Connection, credential, provider request guard, repository binding and remote resolution: `src/application/connectionService.ts`, `src/application/repositoryService.ts`, `src/infrastructure/http/`, `src/presentation/`.
- GitHub and GitLab review-request, diff, conversation, review/check/approval/pipeline/job and merge adapters: `src/infrastructure/providers/github/`, `src/infrastructure/providers/gitlab/`.
- Fresh-context and diff-position checks for review mutations: `src/application/reviewService.ts`, `src/domain/diff/`.
- VS Code activation, commands, Tree Views, webview composition and React review panels: `src/extension.ts`, `src/presentation/`, `webview-ui/src/`.
- Mocked/provider contract, unit, webview and host smoke coverage: `test/unit/`, `test/integration/`, `test/webview/`, `test/extension/`.

The repository provides `npm run build`, `npm run package`, `npm run test:extension`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test:traceability`.

## Evidence snapshot

On 2026-11-17, `npm test` passed 88/88 tests across 12 files; typecheck, lint, format check, traceability check and build passed. Packaging succeeded and produced a 105.81 KB VSIX, with a license warning because the package metadata declares `UNLICENSED`. Host activation smoke passed on macOS with VS Code 1.140.0 and stable 1.146.0. The inline comment modal now traps keyboard focus, closes on Escape and restores focus to its trigger; a regression test covers those behaviors.

The CI workflow is configured for an Ubuntu/macOS/Windows × VS Code 1.140.0/stable extension-host matrix. GitHub Actions has not run this matrix, and the repository has not been pushed; this configuration is not cross-platform test evidence. Provider, compatibility and release acceptance gates remain open.

A bounded live read-only probe through the actual `GitHubAdapter` and `ProviderHttpClient` against `minh-lb/vscode-reviewdock` authenticated as the expected user and completed repository lookup, PR list/detail, and changed-files retrieval (13 files). Conversations and checks endpoints succeeded but returned zero items, so populated mappings remain unverified. The probe used the `gh` OAuth token in memory; it does not establish PAT, UI or write acceptance. Current environment blockers: the personal GitLab connector reports that its token is not configured, the Docker daemon is unavailable, and the cross-platform matrix has not run.

On 2026-11-17, manual testing in the real macOS `/Applications` VS Code UI with a user-entered PAT verified the connection as Connected, detected and bound the remote to `minh-lb/vscode-reviewdock`, and opened merged PR #1. The UI showed 13 file diffs, the inline composer Tab trap/Escape/focus restore without submitting, and the Approvals unavailable message. The connection and repository binding survived Developer: Reload Window. Checks finished loading but rendered blank for the successful zero-result response; an explicit empty state was added with regression coverage. The rebuilt 105.88 KB VSIX was installed and reloaded; the live Checks tab then displayed “No checks reported”. The resulting local suite passed 90/90 tests; typecheck, lint and build passed. No external comment, reply or merge was attempted.

## Open acceptance gates

- Live GitHub.com and GitLab.com acceptance for connection permissions, diffs/inline positions, comments/replies, and disposable-resource merges.
- Exact supported GHES and GitLab Self-Managed version/edition floors and compatibility checks.
- Ubuntu and Windows host/install smoke; only macOS is evidenced locally. The configured GitHub Actions matrix has not run.
- Manual screen-reader, high-contrast and complete keyboard workflow review, plus Marketplace/release readiness. The inline modal keyboard regression is automated evidence only.
- Live-provider permission behavior. PAT scope guidance is documented, but the application does not inspect granted permissions.

OAuth, multiline inline comments, comment edit/delete, GitHub REST thread resolution, approval submission, auto-merge, merge queues and implicit source-branch deletion remain deferred or unsupported. See [Provider Capability Matrix](PROVIDER-CAPABILITY-MATRIX.md) and [Requirement Traceability](REQUIREMENT-TRACEABILITY.md).
