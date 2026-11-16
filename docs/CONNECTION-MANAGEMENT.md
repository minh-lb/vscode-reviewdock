# ReviewDock — Connection Management Specification

> **Document ID:** RVD-CONN-001  
> **Version:** 0.2.0  
> **Status:** Proposed — Product Owner approval required  
> **Related:** [SRS.md](./SRS.md), [DECISIONS.md](./DECISIONS.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md)

## 1. Purpose

ReviewDock supports multiple independent connections to source-control providers. A user may connect multiple GitHub and GitLab accounts, including multiple accounts on the same host, and select the correct connection for each workspace repository.

Terms:
- **Provider:** GitHub or GitLab.
- **Server:** provider host, such as github.com, a GitHub Enterprise Server URL, gitlab.com or a GitLab Self-Managed URL.
- **Connection:** one named account identity authenticated against one provider server.
- **Repository binding:** association between a VS Code workspace folder/repository and a connection plus a repository/project.
- **Active connection:** connection selected for a workspace folder. It is not a global singleton.

## 2. Core requirements

1. Users can create any practical number of connections; no arbitrary small fixed limit.
2. Provider type is selected explicitly: GitHub or GitLab.
3. Each connection has a user-defined display name.
4. Multiple connections may use the same provider and server but different accounts.
5. GitHub.com, GitHub Enterprise Server, GitLab.com and GitLab Self-Managed hosts are supported within the published compatibility matrix.
6. Credentials are stored separately per connection in VS Code SecretStorage.
7. Every API request is routed through the selected connection's provider adapter and server.
8. A token from one connection must never be sent to another connection, provider or host.
9. Each workspace folder/repository can be bound to a different connection and repository.
10. The user can test, rename, re-authenticate, disconnect, delete and set a default connection.
11. Connection health is distinct from the last API request's business outcome.
12. Provider-specific capabilities must be surfaced honestly; GitHub Pull Requests and GitLab Merge Requests are normalized for shared workflows but are not assumed to have identical features.
13. Every connection has an independent enabled configuration flag, defaulting to true when created.
14. A disabled connection must not be selected for repository discovery, default resolution or any outbound provider API request.
15. Disabling a connection preserves its configuration, credential, last-known connection status and workspace bindings.
16. A disabled connection cannot be set as a provider default. Disabling the current default clears that provider's default without automatically selecting another connection.
17. A workspace binding to a disabled connection remains stored but is blocked until the user enables that connection or explicitly assigns another one.

## 3. Connection data model

### 3.1. Non-secret connection record

~~~ts
type ProviderType = "github" | "gitlab";

type ConnectionStatus =
  | "connected"
  | "reauthentication-required"
  | "unreachable"
  | "configuration-error"
  | "disconnected";

type Connection = {
  id: string;                 // immutable UUID
  provider: ProviderType;     // immutable after creation
  displayName: string;        // user-defined
  serverUrl: string;          // normalized HTTPS origin/base URL
  accountId: string;          // provider-issued stable account ID
  accountLogin: string;       // username/login
  accountDisplayName?: string;
  avatarUrl?: string;
  enabled: boolean;           // user-controlled; defaults to true
  status: ConnectionStatus;   // last-known provider/connectivity state; independent of enabled
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  lastUsedAt?: string;
};
~~~

Do not store raw access tokens, refresh tokens, authorization headers or other secrets in this record. Persist enabled with the non-secret connection metadata; it is not a credential or a health status.

### 3.2. Credential record

- Store each credential under a SecretStorage key derived from the immutable connection ID, for example `reviewdock.connection.<connectionId>.credential`.
- Keep provider, server and connection ID in the non-secret record; never derive the secret key from a mutable display name.
- Do not pass credentials to the Webview, domain models, workspace settings, logs or telemetry.
- OAuth refresh tokens, if OAuth is introduced later, must be stored under the same connection-specific secret boundary.

### 3.3. Identity and duplicate handling

- Connection ID is the only internal identity. Display name is not a key.
- Display names may repeat; UI must disambiguate using provider, host and account login.
- Warn about a likely duplicate when provider + normalized server URL + provider account ID already exist.
- Allow two accounts on the same server because they may have different permissions and repository visibility.
- Never merge two connection records just because their hostnames match.

## 4. Provider and server configuration

| Provider | Default server URL | API base URL |
|---|---|---|
| GitHub.com | `https://github.com` | `https://api.github.com` |
| GitHub Enterprise Server | User-configured HTTPS URL | `{serverUrl}/api/v3` |
| GitLab.com | `https://gitlab.com` | `{serverUrl}/api/v4` |
| GitLab Self-Managed | User-configured HTTPS URL | `{serverUrl}/api/v4` |

Rules:
- Provider is chosen before server URL and authentication fields are shown.
- Selecting a cloud provider pre-fills its standard server URL.
- Enterprise/Self-Managed hosts require an explicit HTTPS URL.
- Reject URL credentials, query strings and fragments.
- Normalize trailing slashes and API base paths once.
- A server URL change is not a simple rename: create a new connection and validate it. Do not silently move an existing credential to another host.
- For every request, validate that the final URL belongs to the selected connection's configured API origin and path prefix before attaching credentials.

## 5. Authentication proposal

### 5.1. MVP

Use Personal Access Tokens for both providers in MVP, subject to provider-specific permissions:
- GitHub: prefer a fine-grained PAT restricted to the repositories ReviewDock uses. The core workflow needs repository **Metadata: read** and **Pull requests: write**. Metadata read is the baseline repository permission; Pull requests write covers reading PRs/reviews and creating inline review comments/replies. General PR issue comments accept either **Issues** or **Pull requests** permission for the corresponding read/write action, so Issues:write is an alternative, not an additional required grant when Pull requests:write is already granted. Add **Contents: write** only when the user will merge PRs: GitHub's [merge endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request) specifically requires it. Add **Checks: read**, **Commit statuses: read**, and **Actions: read** only for the respective check-run, commit-status, and Actions-run data panels. The adapter has a review-decision submission method requiring Pull requests:write, but no current UI exposes that action; the permission is already needed for inline comments. GitHub documents endpoint permissions in its [fine-grained PAT permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) and individual [Pull requests](https://docs.github.com/en/rest/pulls/pulls), [Reviews](https://docs.github.com/en/rest/pulls/reviews), [Review comments](https://docs.github.com/en/rest/pulls/comments), [Issues comments](https://docs.github.com/en/rest/issues/comments), [Checks](https://docs.github.com/en/rest/checks/runs), [Commit statuses](https://docs.github.com/en/rest/commits/statuses), and [Actions](https://docs.github.com/en/rest/actions/workflow-runs) endpoint references. Organization approval policies may also need to approve a fine-grained token.
- GitHub classic PAT fallback: `repo` is the practical classic scope for private-repository functionality, but it is broad and does not provide fine-grained repository/action permissions. For public-only repositories, `public_repo` is narrower; it does not grant private-repository access. The authenticated-user identity endpoint may work without a classic scope, but the repository, review, comment, and merge operations determine the required access. Prefer a fine-grained PAT where available; do not describe classic `repo` as least privilege. GitHub notes that classic `repo` tokens can access every repository available to the user and recommends fine-grained tokens ([PAT guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)).
- GitLab: the currently exposed write workflows require the `api` PAT scope because ReviewDock creates comments/discussions and replies, and can merge merge requests. GitLab defines `api` as complete read/write API access. `read_api` supports read-only API use but cannot authorize those writes; `read_repository`/`write_repository` are repository-content scopes and do not replace API access for merge-request operations. ReviewDock reads approval and pipeline state where available; approval submission and thread resolution are not exposed in the current UI. The broad `api` scope must be disclosed; recommend a dedicated, expiring token and the narrowest project visibility/role the user can use. See GitLab's [access-token scope reference](https://docs.gitlab.com/security/tokens/access_token_scopes/) and [personal access token documentation](https://docs.gitlab.com/user/profile/personal_access_tokens/).

OAuth is a future option, not a reason to weaken the per-connection credential boundary. Do not implement one provider's token format/header for the other provider.

### 5.2. Provider-specific validation

- GitHub: validate with the authenticated-user endpoint and retrieve stable account ID/login.
- GitLab: validate with `GET /user` and retrieve stable account ID/username.
- Persist a credential only after validation succeeds.
- If validation succeeds but a later repository operation returns insufficient permission, mark the connection as connected and report the operation-level permission error. Do not incorrectly mark a valid token as expired.
- Connection validation currently resolves identity only; ReviewDock does not inspect or verify the token's granted permissions/scopes. Do not imply that the app has verified permissions during connection setup. Users must choose permissions using the provider guidance above; missing access is surfaced when the affected API operation fails, and endpoint behavior may also depend on repository role, organization policy, GitLab edition, or instance settings.

### 5.3. Re-authentication

- Re-authentication updates the credential for the selected connection only.
- Validate the new credential before replacing the old one.
- If the returned provider account ID differs from the existing account ID, show an explicit account-change confirmation or require creating a new connection.
- Never overwrite another connection's credential.

## 6. Connection lifecycle

### 6.1. Create

1. User chooses Add Connection.
2. User selects GitHub or GitLab.
3. User enters a display name.
4. User selects the default cloud host or enters an Enterprise/Self-Managed URL.
5. User chooses the available MVP authentication method and enters a token.
6. ReviewDock validates the server and token using the selected provider adapter.
7. ReviewDock shows the resolved account identity. Permission requirements are documented above; current runtime validation does not read granted PAT permissions/scopes.
8. User confirms Save.
9. ReviewDock writes the secret to SecretStorage and the non-secret connection record to global state.
10. The connection appears in the connection list.

If validation fails, do not save the credential. Preserve non-secret form fields so the user can correct the configuration.

### 6.2. Test connection

- Re-run the provider's authenticated-user validation.
- Update status and lastValidatedAt.
- Show account identity, host and safe permission information.
- Do not create a repository binding or change the active connection.

### 6.3. Rename

- Update displayName only.
- Preserve connection ID, provider, server, account identity and credential.
- Update all connection labels in the UI without changing repository bindings.

### 6.4. Disconnect

- Remove the connection's credential from SecretStorage.
- Keep its non-secret record so the user can reconnect later.
- Set status to disconnected.
- Repository bindings remain but are marked unavailable until the connection is re-authenticated or replaced.

### 6.5. Delete

- Require confirmation identifying provider, host and account.
- Delete only that connection's credential and non-secret record.
- Mark workspace bindings that referenced it as unresolved; do not silently bind them to another account.
- Do not delete repositories, remote URLs or other connections.

### 6.6. Default and active connection

- Support one optional default enabled connection per provider (one GitHub default and one GitLab default).
- A disabled connection cannot be selected as a default. Disabling the current default clears that provider's default; do not silently promote another connection.
- Each workspace folder/repository has its own active connection binding.
- A workspace binding takes precedence over the provider default only while its connection is enabled.
- If a workspace binding points to a disabled connection, keep the binding but block provider operations and ask the user to enable it or explicitly choose another connection.
- The provider default is used only when a user explicitly starts repository selection without an existing binding, and only if that default is enabled.
- Never use one global active connection for all workspace folders.

### 6.7. Enable and disable

- New connections are enabled by default.
- The user can enable or disable each connection independently without deleting or recreating it.
- Disabling changes only the enabled flag. It does not delete the SecretStorage credential, change provider/server/account identity, or rewrite the last-known status.
- While disabled, the connection is excluded from automatic remote matching, manual active-connection selection, default resolution and all provider API requests, including Test Connection.
- The application must check enabled before reading the credential or constructing an authenticated request. A disabled connection must fail locally with a clear ConnectionDisabledError; no request is sent.
- If the disabled connection is the provider default, clear that provider's default. Do not automatically select a different default.
- Preserve workspace repository bindings that reference the disabled connection, but mark them unavailable. Do not silently fail over to another account.
- Re-enabling makes the connection eligible for selection again, but does not validate its credential. The existing status remains authoritative: if re-authentication is required or the connection is disconnected, the user must resolve that state before provider operations.
- Disabling cancels pending read requests where possible. A mutation already submitted to the provider may still complete; do not claim that disabling rolled it back. Reconcile its outcome with a fresh read after the connection is enabled again.

## 7. Repository binding and discovery

A repository binding contains:
- workspace folder/repository identity;
- connection ID;
- provider repository ID (GitHub) or project ID (GitLab);
- full repository path/name;
- web URL;
- last validation timestamp.

Discovery flow:
1. Read Git remotes from the selected workspace repository.
2. Parse host and owner/group/repository path for GitHub or GitLab.
3. Match the remote host to configured connections.
4. Resolve the repository using each candidate connection that the user is allowed to use.
5. If exactly one valid connection/repository pair is found, suggest it.
6. If multiple accounts on the same host can access the repository, show an explicit connection/account picker.
7. If no match is found, offer Add Connection or manual repository selection.
8. Persist the selected connection ID and repository/project ID for that workspace folder.

A remote hostname identifies a provider server, not an account. Never choose an account based on hostname alone when more than one connection matches.

## 8. UX specification

### 8.1. Connection list

Each row displays:
- provider icon and provider name;
- user-defined connection name;
- server host;
- authenticated account login;
- an Enabled/Disabled toggle, independent of connection status;
- last-known connection status;
- default indicator when applicable;
- actions menu.

Actions:
- Enable / Disable
- Test connection (available only when enabled)
- Rename
- Re-authenticate
- Set as default for provider (available only when enabled)
- Disconnect
- Delete

### 8.2. Add connection form

Fields:
1. Provider type — required select: GitHub / GitLab.
2. Connection name — required text.
3. Server URL — required; pre-filled for GitHub.com or GitLab.com.
4. Authentication type — PAT for MVP.
5. Personal Access Token — secret input.
6. Test Connection — required before Save.
7. Account identity and validation result — read-only after successful test.

The form must not expose provider-inapplicable fields. GitHub Enterprise Server and GitLab Self-Managed use their own API base URL rules. A newly saved connection is enabled by default; the user can disable it from the connection list.

### 8.3. Context switching

- The active connection is visible in the ReviewDock project/repository selector.
- PR/MR headers show provider, connection name, account login and repository.
- Only enabled connections can be selected or used for switching.
- If the current workspace binding points to a disabled connection, show a blocked/unavailable state with Enable or Choose another connection actions.
- Switching connection refreshes repository data and cancels in-flight requests from the previous connection.
- If the selected repository is not accessible through the new connection, do not show cached data as if it belongs to the new account.

### 8.4. Enabled state

- Show Enabled/Disabled as a separate control or state from Connected/Unreachable/Re-authentication required.
- A disabled connection may still display its last-known status (for example, Disabled · last known Connected).
- Disable the Test Connection and Set as Default actions while the connection is disabled.
- Disabling the active workspace connection must show a clear blocked state; never switch accounts automatically.
- Re-enabling does not silently trigger API traffic. The user can explicitly test the connection or continue if its last-known status is still valid.

## 9. Connection isolation and security

- Credential lookup is always by immutable connection ID.
- Before credential lookup or request creation, enforce enabled === true; disabled connections produce a local error and no outbound request.
- Provider adapter is selected from the connection's immutable provider type.
- Host allowlisting is evaluated before attaching credentials.
- Redirects to a different origin must not forward credentials.
- Pagination links must remain on the configured API origin/path prefix.
- Cache keys include connection ID, provider, server URL, repository/project ID, review request ID and resource type.
- Disconnecting or deleting one connection must not affect credentials or cache entries belonging to another connection.
- Logs may include connection ID, provider and host, but not tokens, headers or private review content.
- The Webview receives a safe connection summary, never credential material.

## 10. Acceptance criteria

- [ ] User can create one GitHub connection and one GitLab connection.
- [ ] User can create multiple connections for the same provider.
- [ ] User can create two accounts on the same provider host.
- [ ] User can assign a distinct name to every connection.
- [ ] Every new connection is enabled by default and can be independently enabled/disabled.
- [ ] Disabled connections retain their credentials, configuration, last-known status and workspace bindings.
- [ ] Disabled connections are excluded from selection, remote discovery, defaults and all outbound API requests.
- [ ] Disabling a default clears the provider default without silently promoting another connection.
- [ ] Re-enabling does not automatically validate credentials or silently switch workspace bindings.
- [ ] GitHub.com and GitLab.com default URLs are pre-filled correctly.
- [ ] Enterprise/Self-Managed URLs are validated and normalized.
- [ ] Invalid credentials are not saved.
- [ ] Each credential is stored under its own connection ID.
- [ ] Test, rename, re-authenticate, disconnect and delete work independently.
- [ ] Default connection is tracked separately per provider.
- [ ] Different workspace folders can use different connections.
- [ ] Remote discovery asks the user when multiple accounts match.
- [ ] A GitHub token is never sent to GitLab and vice versa.
- [ ] A token is never forwarded to a different host after redirect or pagination.
- [ ] Deleting a connection never silently reassigns its repository bindings.
- [ ] Disabling a connection never silently reassigns its repository bindings.

## 11. Open decisions

- [ ] Confirm PAT-only authentication for MVP; OAuth remains a later phase.
- [ ] Confirm GitHub.com plus GitHub Enterprise Server compatibility target.
- [ ] Confirm GitLab.com plus GitLab Self-Managed compatibility target.
- [ ] Confirm whether GitHub Actions/checks and GitLab pipelines share one normalized status panel or use provider-specific subviews.
- [ ] Confirm whether connection export/import is out of scope for MVP (recommended: out of scope; never export secrets).
