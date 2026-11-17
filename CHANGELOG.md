# Changelog

## 1.0.0

- Select and save the repositories shown under each connection in the sidebar.
- Render complete Markdown files with tables, task lists, ordered lists and readable code blocks; improve typography and move comment controls outside the document text.
- Keep the previous Markdown version collapsible in Unified view and adapt Split preview to narrow panels.
- Support selecting unchanged lines for inline comments, including expanded context and both sides of Split view. Provider acceptance of comments outside the original patch still requires live verification.
- Add icon-based file collapse controls, incremental context expansion and hover-only comment actions; align file names to the left.
- Update the packaging tool to @vscode/vsce 4.1.1, use the locked version for publishing and require Node.js 22 or later for development (Node.js 24 in CI).

## 0.1.1

- Shorten the Marketplace README and add practical setup and review instructions.
- Add patch, minor and major version commands that keep the manifest and lockfile synchronized without creating commits or tags.

## 0.1.0

Initial preview of ReviewDock for VS Code desktop.

- Connect to GitHub and GitLab with personal access tokens stored in SecretStorage.
- Browse repositories and pull/merge requests; read details, checks, approvals and commits.
- Review changes using a resizable file tree, Unified/Split layouts and per-file Markdown Source/Rich views.
- Compose inline comments and supported replies; edit request metadata and manage supported native discussion actions.
- Show request status tags and quick-scroll controls.

Live mutation acceptance, complete accessibility review and exact Enterprise/Self-Managed compatibility remain open. See the README for supported scope and limitations.
