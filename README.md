# ReviewDock

Review GitHub Pull Requests and GitLab Merge Requests from Visual Studio Code. This initial preview brings review details, diffs and discussions into your editor.

## Features

- Add and manage multiple GitHub and GitLab connections. Tokens are stored in VS Code SecretStorage. Disabled connections are excluded from defaults, selection and request resolution; existing bindings stay blocked until the connection is enabled again.
- Bind each workspace folder to a connection and repository/project. A single-root workspace can resolve its active folder automatically; ambiguous or multi-root choices are explicit.
- Browse, filter and search pull/merge requests; open request details, changed-file tree, diffs, conversations and paginated Commits tab. Set Layout Unified/Split in the global gear menu; each Markdown file has its own Source/Rich toggle in the file header. Commits rows show subject, committer, committed time and short SHA.
- Add general comments, single-line inline comments and supported replies. The inline reply composer stays with its thread. GitHub general issue comments are not replyable; supported GitHub thread resolution uses GraphQL because the REST workflow does not expose it.
- Review current check, pipeline/job and approval/review state when returned by the provider. Merge is an explicit, SHA-guarded operation; the provider remains authoritative.

Hierarchical navigation, anchored diff modes, Markdown source/rich views, supported native thread actions, metadata editing, lazy connection-to-PR/MR loading, quick scroll and status tags are implemented locally. Local implementation does not establish live mutation acceptance, and full rich rendering has not been verified. See [Review Enhancements](docs/REVIEW-ENHANCEMENTS.md) and the [Provider Capability Matrix](docs/PROVIDER-CAPABILITY-MATRIX.md). OAuth, multiline comments, approval submission, auto-merge and merge queues remain outside this enhancement scope. Enterprise and self-managed host compatibility has not been established.

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

## Preview status and compatibility

ReviewDock is an initial preview for VS Code desktop **1.140.0 or newer**. It runs in the workspace extension host; it is not a browser-only web extension. Node.js is bundled by VS Code for end users; Node.js 24 is needed only for source development.

The current source has 128 passing unit, contract and webview tests. These checks do not establish live mutation acceptance. Full GitHub/GitLab write workflows, exact Enterprise/Self-Managed versions, complete accessibility acceptance and full Windows/Linux workflows remain unverified. Rich Markdown rendering covers a limited subset and may differ from provider rendering. See [Implementation Status](docs/IMPLEMENTATION-STATUS.md) for evidence and remaining acceptance gates.

## Privacy and license

ReviewDock has no publisher-operated backend or telemetry collector. Tokens use VS Code SecretStorage, and provider requests go directly to your configured host. Read the included [privacy notice](PRIVACY.md) before connecting an account.

ReviewDock remains proprietary; this release does not convert the project to open source. See [LICENSE](LICENSE) and [third-party notices](THIRD-PARTY-NOTICES.txt). Please exclude tokens and private code from support reports.

## Publish to the VS Code Marketplace

ReviewDock uses Marketplace publisher `minhluu`. Publishing a stable GitHub Release (for example, `v0.1.0`) triggers the OIDC-based Marketplace workflow after its one-time Trusted Publishing policy is configured. See the [Publishing Guide](docs/PUBLISHING.md) for setup, versioning, release steps, and manual VSIX upload. Publishing remains a separate decision from the development/verification snapshot above.
