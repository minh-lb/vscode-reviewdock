# ReviewDock

Review GitHub Pull Requests and GitLab Merge Requests from Visual Studio Code. ReviewDock is a local implementation snapshot: provider workflows have automated mock and UI coverage, but live provider acceptance and the full release matrix remain open.

## What works locally

- Add and manage multiple GitHub and GitLab connections. Tokens are stored in VS Code SecretStorage. Disabled connections are excluded from defaults, selection and request resolution; existing bindings stay blocked until the connection is enabled again.
- Bind each workspace folder to a connection and repository/project. A single-root workspace can resolve its active folder automatically; ambiguous or multi-root choices are explicit.
- Browse, filter and search pull/merge requests; open request details, changed files, diffs and conversations in ReviewDock.
- Add general comments, single-line inline comments and supported replies. GitHub general issue comments are not replyable; GitHub REST review-thread resolution is unavailable.
- Review current check, pipeline/job and approval/review state when returned by the provider. Merge is an explicit, SHA-guarded operation; the provider remains authoritative.

OAuth, multiline comments, comment edit/delete, GitHub thread resolution, approval submission, auto-merge and merge queues are not part of the current feature set. Enterprise and self-managed host compatibility has not been established.

## Install and develop

Development requirements: Node.js 24 (see `.nvmrc`) and npm. The extension declares VS Code engine range `^1.140.0`.

```sh
npm ci
npm run build
npm run package
```

This creates a versioned `.vsix` in the repository root. In VS Code, run **Extensions: Install from VSIX...** and select that file. The extension is also available for development with **F5** from this repository's launch configuration.

For source development, use `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:extension`, and `npm run format:check`. See [Development Guide](docs/DEVELOPMENT-GUIDE.md) for prerequisites and detailed workflows.

## Connect a provider

1. Open the ReviewDock Activity Bar view and choose **Add Connection**.
2. Select GitHub or GitLab, enter the server URL and a personal access token, then validate and save the connection.
3. Grant only the scopes/permissions needed for the operations you use. Read access is needed to browse; comment/reply and merge operations require corresponding provider permissions. ReviewDock displays operation-level provider errors when an otherwise valid token lacks a permission.
   ReviewDock validates account identity only; it does not inspect the PAT's granted permissions or scopes. Insufficient access is reported by the affected provider operation.
4. Choose a connection and repository/project for the active workspace folder. ReviewDock does not silently switch accounts when a binding is blocked or a remote matches multiple accounts.

For multiple workspace folders, select the connection and repository for each folder. With no enabled connection/default or no binding, ReviewDock asks you to configure one before loading requests.

## Commands

Use the Command Palette and search `ReviewDock:` for Add Connection, Manage Connections, Select Connection, Select Repository, Refresh, Search Requests, Open Review Request, Open on Provider, Add Comment and Merge. The Connections and Pull Requests / Merge Requests views are in the ReviewDock Activity Bar container.

## Verification snapshot

The local test suite passed 87/87 tests across 12 files; typecheck and lint passed after the recovery regression fix. Formatting and traceability checks passed after the cosmetic test-file adjustment. VS Code extension activation and command/view metadata passed on macOS with VS Code 1.140 and stable 1.146 (which resolved to 1.146.0) after the recovery fix. The final production VSIX was built, packaged, installed into an isolated VS Code profile and listed by the CLI as `reviewdock.reviewdock@0.1.0`.

These checks do not establish live GitHub.com/GitLab.com mutation behavior, GHES or GitLab Self-Managed compatibility, Windows/Linux behavior, accessibility acceptance or Marketplace readiness. See [Implementation Status](docs/IMPLEMENTATION-STATUS.md), [Test Plan](docs/TEST-PLAN.md), and [Provider Capability Matrix](docs/PROVIDER-CAPABILITY-MATRIX.md).

## Publish to the VS Code Marketplace

ReviewDock uses Marketplace publisher `minhluu`. Publishing a stable GitHub Release (for example, `v0.1.0`) triggers the OIDC-based Marketplace workflow after its one-time Trusted Publishing policy is configured. See the [Publishing Guide](docs/PUBLISHING.md) for setup, versioning, release steps, and manual VSIX upload. Publishing remains a separate decision from the development/verification snapshot above.
