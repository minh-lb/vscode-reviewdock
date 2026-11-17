# ReviewDock

Review GitHub Pull Requests and GitLab Merge Requests directly in VS Code.

## Features

- Connect multiple GitHub and GitLab accounts.
- Browse requests and inspect file changes with Unified or Split diffs and Markdown Source or Rich views.
- Add inline and general comments, reply to supported threads, and use available thread actions.
- Edit review details including title, description, assignees, reviewers, and labels.
- View commits, checks, pipelines, and approvals; merge supported requests.

## Get started

Requires VS Code desktop **1.140.0 or newer**. Install **ReviewDock** (`minhluu.reviewdock`) from the Marketplace.

1. Open the ReviewDock Activity Bar view, choose **Add Connection**, select GitHub or GitLab, and enter the provider URL and a personal access token (PAT).
2. Choose **Select Repository**, pick a repository or project, then open a request from the tree.

## Review a request

- **Overview:** Choose **Edit review details** to change the title, description, assignees, reviewers, or labels, then select **Save details**.
- **Changes:** Select a file in the tree to view its diff. Resize or hide the tree as needed. Use the file header icon to switch between Markdown Source and Rich views; use the global gear menu to choose Unified or Split layout.
- **Comments:** Open **Conversations** to add a general comment, or use the **+** button beside a source line for an inline comment. For supported threads, choose **Reply**, write your response, and select **Send reply**. Use **Resolve thread** or **Delete comment** when available.
- **Commits, Checks, and Approvals:** Open these tabs to review the information returned by your provider.
- **Merge:** Choose **Merge** and confirm the action.

Tokens are stored in VS Code SecretStorage. Requests go directly to your provider. ReviewDock collects no telemetry. Markdown rendering supports a limited subset; available actions depend on the provider and request.
