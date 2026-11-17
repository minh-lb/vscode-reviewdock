# Privacy

ReviewDock sends authenticated requests directly from the VS Code extension host to the GitHub or GitLab server you configure. It does not run a publisher-operated backend, analytics service, advertising SDK or telemetry collector.

## Stored data

- Personal access tokens are saved using VS Code SecretStorage. Tokens are supplied to the selected provider for authentication and are not sent to the webview.
- Connection details and account identity are stored in VS Code global extension state. Repository bindings are stored in workspace extension state.
- Review data is fetched from the selected provider. Diff preferences are retained using VS Code webview state. Unsaved comment and metadata drafts are held in the open webview's memory.
- ReviewDock reads workspace-folder identity and Git remote metadata to suggest repository bindings. It does not execute workspace code.

In remote development, the extension runs in the workspace extension host; storage and provider requests follow that host's VS Code environment. Your provider, VS Code and Marketplace have their own privacy policies and retention rules.

## Actions and removal

Posting comments, replying, editing metadata, resolving discussions and merging send the corresponding content or instruction to your selected provider. Provider permissions and retention apply. Opening a provider link uses your external browser.

Use **ReviewDock: Manage Connections** to remove a connection and its stored token. Removing a connection does not remove comments or other data already saved at the provider. Uninstalling an extension does not necessarily remove VS Code's stored extension state; use Manage Connections first if you want to remove credentials.

For support, use the repository's issue tracker. Do not attach tokens, private repository content or unredacted logs to public issues.
