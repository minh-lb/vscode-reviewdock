# Development Guide

## Source of truth

Executable commands and tool versions match `package.json`, `package-lock.json`, TypeScript/bundler configuration and `.github/workflows/ci.yml`. Update this guide when those change.

## Setup

- Node.js 24 as pinned by `.nvmrc` and npm.
- VS Code with Extension Development Host support for host tests.
- Dedicated disposable GitHub/GitLab test resources for any live mutation checks; never use production credentials or repositories.

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
npm run test:extension
npm run package
```

`typecheck` checks both the extension-host TypeScript project (`tsconfig.json`) and Webview project (`tsconfig.webview.json`). `build` bundles the VS Code extension entry and React Webview entry with esbuild. `test:unit` runs `test/unit`; `test:integration` runs mocked provider adapter tests under `test/integration`; `test:extension` compiles `test/extension/index.ts` and launches the Extension Development Host via `@vscode/test-electron`. `package` creates a VSIX using `@vscode/vsce`.

The extension host entry and complete UI are still being integrated. A command that requires those pending sources may fail until integration completes; record actual output rather than treating configured scripts as passing evidence.

## Current source boundaries

- `src/domain/models.ts`, `src/domain/errors.ts`: provider-neutral models and errors; no VS Code or provider DTO dependencies.
- `src/domain/diff/`: unified diff parser and GitHub/GitLab line position mapping.
- `src/application/ports.ts`: provider and secret-storage ports.
- `src/application/connectionService.ts`, `repositoryService.ts`, `reviewService.ts`: connection, repository binding and review use cases.
- `src/infrastructure/http/providerHttpClient.ts`: provider request transport and URL/auth constraints.
- `src/infrastructure/providers/github/`, `gitlab/`: REST adapters and DTO mappers.
- `src/presentation/webview/messageProtocol.ts`: runtime validation for Webview requests.
- `webview-ui/src/`: React Webview entry and styles.
- `package.json`: VS Code view/command contributions; source registration in the extension host is not complete.

Dependency direction: presentation → application → domain; infrastructure implements application ports. Provider adapters normalize DTOs while retaining native identifiers and semantics. Webview code must not read credentials or call provider APIs. Check that connections are enabled before retrieving credentials or attaching authorization.

## Test and release safety

Use deterministic sanitized fixtures for provider and diff tests. Do not commit tokens, real repository URLs, private diffs, comment bodies, or other user data. Before claiming release readiness, additionally verify live GitHub.com and GitLab.com behavior, each exact Enterprise/Self-Managed compatibility target, Windows/macOS/Linux, accessibility, Webview security, SecretStorage/log redaction, responsiveness, and clean-profile VSIX installation. Those external gates are not established by mocked tests or compilation.
