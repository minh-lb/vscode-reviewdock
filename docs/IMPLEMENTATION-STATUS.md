# Implementation status

The owner has adopted the proposed decisions in `DECISIONS.md` as the implementation baseline. This resolves design defaults for implementation; it does not establish vendor compatibility or release acceptance. Deferred behavior remains deferred: OAuth, merge queues, automatic merge, implicit source-branch deletion, multi-line comments, and comment edit/delete UI.

## Current source

- Domain contracts and typed errors: `src/domain/models.ts`, `src/domain/errors.ts`, `src/application/ports.ts`.
- Connection and repository use cases: `src/application/connectionService.ts`, `src/application/repositoryService.ts`.
- Provider transport and adapters: `src/infrastructure/http/providerHttpClient.ts`, `src/infrastructure/providers/github/`, `src/infrastructure/providers/gitlab/`.
- Review orchestration and diff safety: `src/application/reviewService.ts`, `src/domain/diff/`.
- Webview request validation and initial React entry: `src/presentation/webview/messageProtocol.ts`, `webview-ui/src/`.
- VS Code host composition and command/view registration: `src/extension.ts`, `src/presentation/tree/`, `src/presentation/webview/reviewRequestPanel.ts`, and `package.json`.

The extension host builds and its activation/manifest smoke test passes on macOS at VS Code 1.140.0 and at the current stable channel, which resolved to 1.146.0 during this run. The test checks extension activation plus contributed command/view declarations. It does not verify command behavior, live provider connectivity, or cross-platform compatibility. The complete provider and release acceptance gates below remain open.

## External acceptance gates

The following require dedicated test resources or environments and are not established by mocked tests:

- Real GitHub.com and GitLab.com inline position acceptance, discussion replies and disposable-resource merge workflows.
- Exact supported GHES and GitLab Self-Managed version/edition matrix.
- Windows/macOS/Linux manual smoke (only macOS host smoke has been run), accessibility/high-contrast review and clean-profile VSIX installation.
- Marketplace publication or any live repository mutation.
