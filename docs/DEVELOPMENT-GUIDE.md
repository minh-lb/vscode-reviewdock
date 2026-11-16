# ReviewDock — Development Guide

> **Document ID:** RVD-DEV-001  
> **Version:** 0.1.0  
> **Status:** Proposed — commands become executable as M0 creates the project scaffold  
> **Related:** [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [TEST-PLAN.md](./TEST-PLAN.md), [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md)

## 1. Purpose and current repository state

This guide defines the expected local workflow for contributors implementing ReviewDock.

**Current state:** the repository is in the requirements/design phase. The source tree, package manifest, launch configuration and npm scripts described below are target artifacts for milestone M0; they are not claimed to exist until M0 is complete.

The guide must be updated when the actual toolchain and scripts are pinned in the repository.

## 2. Prerequisites

Required developer tools:

- Visual Studio Code Stable.
- Git.
- Node.js version pinned by the project in `.nvmrc` or `.node-version`.
- npm version pinned by the project `packageManager` field and lockfile.
- Access to GitHub and/or GitLab test repositories for manual provider integration tests.

M0 must record the exact Node.js and npm versions used by CI. Do not use an unpinned local dependency installation for reproducible builds.

## 3. Repository structure

The implementation should follow the boundaries in SDS.md:

~~~text
src/
  extension.ts
  commands/
  domain/
    models/
    errors/
    diff/
  application/
    services/
    ports/
  infrastructure/
    providers/
      github/
      gitlab/
    connections/
    storage/
    git/
    logging/
  presentation/
    tree/
    webview/
      webview-ui/
test/
  unit/
  integration/
  extension/
  fixtures/
docs/
.github/
.vscode/
~~~

Rules:

- Domain code must not import VS Code APIs or provider SDK/DTO types.
- Application services depend on domain contracts and ports.
- Provider adapters own HTTP, authentication headers, pagination, DTO validation and provider-specific error mapping.
- Presentation code must not call provider HTTP endpoints directly.
- The Webview must never receive a PAT or SecretStorage handle.

## 4. Initial setup

After M0 creates the package manifest and lockfile, the supported clean setup is:

~~~bash
git clone https://github.com/minh-lb/vscode-reviewdock.git
cd vscode-reviewdock
npm ci
~~~

The project must not require a real provider token to install dependencies, build, lint or run unit tests.

Expected local workflow:

1. Open the repository root in VS Code.
2. Run the build/watch task or press F5 to launch the Extension Development Host.
3. Make changes in the extension host or Webview bundle.
4. Run targeted unit tests while iterating.
5. Run the full check suite before opening a pull request.

## 5. Required npm scripts

M0 must implement and document these script names (the exact underlying command may be adjusted with the chosen toolchain):

| Script | Purpose |
|---|---|
| `build` | Production extension and Webview bundles |
| `watch` | Development rebuild for extension and Webview |
| `lint` | ESLint across source and tests |
| `format:check` | Verify Prettier formatting |
| `typecheck` | TypeScript strict type checking |
| `test:unit` | Pure domain and application unit tests |
| `test:integration` | Provider HTTP adapter tests using fixtures/mocks |
| `test:extension` | VS Code Extension Host tests |
| `test` | Run all required automated test suites |
| `package` | Produce a VSIX using the pinned packaging tool |

Expected contributor check:

~~~bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
~~~

If one of these scripts is intentionally omitted, update this guide and the M0 acceptance criteria in the same pull request.

## 6. Running and debugging the extension

M0 must provide:

- `.vscode/launch.json` configuration to launch an Extension Development Host.
- `.vscode/tasks.json` tasks for extension and Webview watch builds.
- Source maps for local debugging, without publishing secrets or private fixture data.
- A clean-profile smoke-test procedure.

Use F5 from the extension project window. The development host should load the local extension bundle. Do not debug against a production user's VS Code profile or stored credentials.

## 7. Test workflow

### 7.1. Unit tests

Use unit tests for pure behavior:

- Connection identity and enabled/disabled invariants.
- Git remote parsing and repository matching.
- Provider DTO-to-domain mapping.
- GitHub line mapping and GitLab diff position mapping.
- Conversation type and reply capability mapping.
- Error normalization and retry classification.
- Cache key isolation.

Unit tests must use deterministic fixtures and mocked ports. They must not access the network.

### 7.2. Provider API integration tests

Use mocked HTTP transport for deterministic request/response tests:

- Correct API root and provider-specific auth header.
- No credential lookup or request for disabled connections.
- Origin/path validation for redirects and pagination.
- GitHub search and PR API behavior.
- GitHub issue comments vs inline review comments.
- GitLab MR discussions, diff positions and approvals.
- Provider error and rate-limit mapping.

Manual tests against non-production test repositories are required for inline position mapping, comment/reply behavior and merge preconditions. Record server version, edition, test case, observed result and evidence.

### 7.3. Extension and Webview tests

Verify:

- Activation without network access.
- Command registration and disposal.
- Workspace switching and request cancellation.
- Webview message schema validation.
- CSP and local asset restrictions.
- Keyboard navigation, accessible labels and theme behavior.
- No secret or unrestricted API access crosses the extension/Webview boundary.

### 7.4. End-to-end tests

Run provider-specific scenarios in TEST-PLAN.md against dedicated test repositories/projects. Never use production repositories for merge tests.

## 8. Compatibility testing

Before a release:

- Test the declared minimum VS Code engine and current Stable.
- Test GitHub.com and the selected supported GHES versions.
- Test GitLab.com and the oldest/newest GitLab Self-Managed versions in the published maintenance window.
- Verify endpoint availability, field shape, permission behavior and error handling.
- Update PROVIDER-CAPABILITY-MATRIX.md with exact tested versions and known limitations.

Compatibility is a release gate, not an assumption based on API version labels alone.

## 9. Credentials and local test data

- Never commit PATs, OAuth tokens, private source code, real comments or production project identifiers.
- Never place provider tokens in `.env`, `settings.json`, workspace files, launch arguments or Webview state.
- Automated tests use clearly fake token fixtures and mocked HTTP responses.
- Manual tests use a dedicated VS Code test profile and dedicated least-privilege provider accounts.
- Enter manual test tokens through the extension's connection wizard so they are stored in SecretStorage.
- Disconnect and revoke test credentials when the test account is retired.
- Do not capture tokens in screenshots, test logs, bug reports or CI artifacts.

## 10. Pull request workflow

Every implementation pull request must:

1. Reference the SRS requirement IDs being implemented.
2. Identify the affected provider(s) and capability-matrix rows.
3. Include unit/API/extension tests appropriate to the change.
4. Update SDS, API-SPEC, UI-UX, TEST-PLAN and REQUIREMENT-TRACEABILITY when contracts or behavior change.
5. Include screenshots or a short recording for material UI changes, using sanitized data.
6. Confirm lint, formatting, typecheck, tests and build pass.
7. Confirm no secret or private production data is included.

Keep changes small and vertical. Do not combine unrelated provider refactors with user-facing features.

## 11. Release and VSIX packaging

The release milestone must:

1. Run the complete CI suite.
2. Run the manual compatibility and E2E matrix.
3. Review CSP, Webview message validation, URL allow-listing and credential isolation.
4. Confirm the declared `engines.vscode` version matches tested builds.
5. Build and package the VSIX using the pinned `@vscode/vsce` version.
6. Install the VSIX into a clean VS Code profile.
7. Verify activation, connection creation, PR/MR browsing, diff, comments and merge on test repositories.
8. Publish release notes, tested compatibility versions and known limitations.

A successful VSIX build alone does not satisfy the release gates.

## 12. Troubleshooting checklist

| Symptom | First checks |
|---|---|
| Extension does not activate | Extension Host output, activation events, build output |
| Webview is blank | Webview console, CSP violations, local resource URI and bundle path |
| Connection is disabled | Enabled flag, workspace binding and provider default; do not bypass the request guard |
| Token is rejected | Validate provider/server URL and token permissions/scopes; distinguish invalid token from operation-level 403 |
| Search result appears incomplete | GitHub search cap/rate limit or provider pagination; show limited/partial state |
| Inline comment is rejected | Refresh diff, verify head/version SHA, path, side and line mapping |
| Reply action is absent | Check provider conversation type and capability descriptor |
| Merge is rejected | Refresh PR/MR and display provider's authoritative reason; do not retry blindly |

## 13. Definition of ready for contributors

A contributor is ready to implement a feature when the relevant decisions are approved, requirement IDs are mapped, provider behavior is specified, test cases exist, and the affected milestone has explicit exit criteria.
