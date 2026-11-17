# ReviewDock

Review GitHub Pull Requests and GitLab Merge Requests directly in VS Code.

## Features

- Connect multiple accounts and browse, filter, or search requests.
- Review changes with a resizable file tree, Unified/Split layouts, and Markdown Source/Rich views.
- Add comments, reply inline, and manage supported discussions.
- Edit titles, descriptions, assignees, reviewers, and labels.
- Inspect commits, checks, pipelines, and approval status.
- Merge supported requests with confirmation and revision checks.

## Quick start

Install **ReviewDock** from the VS Code Marketplace (`minhluu.reviewdock`). Requires VS Code desktop **1.140.0 or newer**.

1. Open the ReviewDock Activity Bar view and choose **Add Connection**.
2. Select GitHub or GitLab, enter the server URL and a personal access token (PAT), then validate and save.
3. Choose **Select Repository** and bind a repository or project to your workspace folder.

## Preview status

ReviewDock is an initial preview. Live write workflows, Enterprise and self-managed host compatibility, and complete accessibility have not been fully verified. Rich Markdown rendering supports a limited subset and may differ from provider rendering.

## Privacy and license

ReviewDock has no publisher-operated backend or telemetry collector. Tokens use VS Code SecretStorage; provider requests go directly to your configured host. See the [privacy notice](PRIVACY.md), [license](LICENSE), and [third-party notices](THIRD-PARTY-NOTICES.txt). Exclude tokens and private code from support reports.

## Development and publishing

See the [Development Guide](docs/DEVELOPMENT-GUIDE.md) for source setup and workflows, and the [Publishing Guide](docs/PUBLISHING.md) for Marketplace publishing details.
