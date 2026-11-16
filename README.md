# ReviewDock

Review GitHub Pull Requests and GitLab Merge Requests from Visual Studio Code.

> **Project status:** Early implementation. Provider-neutral review contracts, GitHub and GitLab adapters, connection/repository services, diff parsing and Webview message validation are present. The VS Code extension host entry point and full user interface are still in progress. No live provider acceptance is claimed.

## Current implementation

- Shared models and `ReviewProvider` contract in `src/domain/models.ts` and `src/application/ports.ts`.
- Provider HTTP transport and GitHub/GitLab adapters under `src/infrastructure/`.
- Connection and repository binding logic under `src/application/`.
- Unified diff parsing and provider-specific line mapping in `src/domain/diff/`.
- Runtime validation for Webview messages in `src/presentation/webview/messageProtocol.ts`.
- VS Code commands, views and welcome content are declared in `package.json`; the extension host registration is not complete yet.

## Development

Requires Node.js 24 (`.nvmrc`) and npm.

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

The extension-host test requires a built extension and VS Code test runtime. See [Development Guide](docs/DEVELOPMENT-GUIDE.md) for command details and current verification limits.

## Specifications

The product and provider behavior are documented in [SRS](docs/SRS.md), [SDS](docs/SDS.md), [API Specification](docs/API-SPEC.md), [Provider Capability Matrix](docs/PROVIDER-CAPABILITY-MATRIX.md), [UI/UX](docs/UI-UX.md), [Technical Decisions](docs/DECISIONS.md), and [Requirement Traceability](docs/REQUIREMENT-TRACEABILITY.md). The owner has adopted the proposed decisions as the implementation baseline; external provider/version compatibility and release acceptance remain open.
