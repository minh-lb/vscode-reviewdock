# Implementation status

The owner has adopted the proposed decisions in `DECISIONS.md` as the implementation baseline. This resolves design defaults for implementation; it does not establish vendor compatibility or release acceptance. Deferred behavior remains deferred: OAuth, merge queues, automatic merge, implicit source-branch deletion, multi-line comments, and comment edit/delete UI.

## Current source

- Domain contracts and typed errors: `src/domain/models.ts`, `src/domain/errors.ts`, `src/application/ports.ts`.
- Connection and repository use cases: `src/application/connectionService.ts`, `src/application/repositoryService.ts`.
- Provider transport and adapters: `src/infrastructure/http/providerHttpClient.ts`, `src/infrastructure/providers/github/`, `src/infrastructure/providers/gitlab/`.
- Review orchestration and diff safety: `src/application/reviewService.ts`, `src/domain/diff/`.
- Webview request validation and initial React entry: `src/presentation/webview/messageProtocol.ts`, `webview-ui/src/`.
- VS Code command/view manifest: `package.json`.

This is an implementation-in-progress snapshot. The host bootstrap and complete presentation integration are not yet established as complete. Current automated checks have not been reconciled after final integration; no test count or pass claim is made here. Use the scripts in `package.json` and record actual outcomes before acceptance.

## External acceptance gates

The following require dedicated test resources or environments and are not established by mocked tests:

- Real GitHub.com and GitLab.com inline position acceptance, discussion replies and disposable-resource merge workflows.
- Exact supported GHES and GitLab Self-Managed version/edition matrix.
- Windows/macOS/Linux manual smoke, accessibility/high-contrast review and clean-profile VSIX installation.
- Marketplace publication or any live repository mutation.
