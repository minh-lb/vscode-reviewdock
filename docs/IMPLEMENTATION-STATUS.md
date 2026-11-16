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

The local test suite passed 87/87 tests across 12 files; typecheck and lint passed after the recovery regression fix. Formatting and traceability checks passed after the cosmetic test-file adjustment. The extension host activated and its contributed command/view metadata passed on macOS with VS Code 1.140 and stable 1.146 (which resolved to 1.146.0) after the recovery fix. The final production VSIX was built, packaged, installed into an isolated VS Code profile and listed by the CLI as `reviewdock.reviewdock@0.1.0`.

The production build emits minified bundles without source maps (extension bundle 85 KB; final VSIX 105.49 KB). A browser preview of synthetic review data showed the overview/diff UI without console errors; this is not a live-provider or VS Code Webview workflow test. The connection-recovery deadlock found in review was fixed and regression-tested. The final scoped code re-review was clean. Provider, compatibility and release acceptance gates remain open. `npm audit --omit=dev` reports zero production vulnerabilities. `npm audit` reports three moderate development-toolchain advisories through `@vscode/vsce` (`glob`/`minimatch`); no forced dependency override has been applied.

## Open acceptance gates

- Live GitHub.com and GitLab.com acceptance for connection permissions, diffs/inline positions, comments/replies, and disposable-resource merges.
- Exact supported GHES and GitLab Self-Managed version/edition floors and compatibility checks.
- Windows and Linux host/install smoke; macOS only is evidenced here.
- Accessibility and high-contrast review, plus Marketplace/release readiness.

OAuth, multiline inline comments, comment edit/delete, GitHub REST thread resolution, approval submission, auto-merge, merge queues and implicit source-branch deletion remain deferred or unsupported. See [Provider Capability Matrix](PROVIDER-CAPABILITY-MATRIX.md) and [Requirement Traceability](REQUIREMENT-TRACEABILITY.md).
