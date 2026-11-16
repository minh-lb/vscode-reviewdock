# ReviewDock — Connection Management Specification

> **Document ID:** RVD-CONN-001  
> **Version:** 0.1.0  
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
  status: ConnectionStatus;   // last known validation state
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  lastUsedAt?: string;
};
~~~

Do not store raw access tokens, refresh tokens, authorization headers or other secrets in this record.

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
- GitHub: prefer a fine-grained PAT restricted to the required repositories and minimum endpoint permissions. The exact permission set depends on enabled actions; read operations, review comments and merge operations do not all require the same permission.
- GitLab: use a PAT with the minimum scope that supports the enabled workflows. The proposed full MVP scope is `api`, which is broad and must be disclosed.

OAuth is a future option, not a reason to weaken the per-connection credential boundary. Do not implement one provider's token format/header for the other provider.

### 5.2. Provider-specific validation

- GitHub: validate with the authenticated-user endpoint and retrieve stable account ID/login.
- GitLab: validate with `GET /user` and retrieve stable account ID/username.
- Persist a credential only after validation succeeds.
- If validation succeeds but a later repository operation returns insufficient permission, mark the connection as connected and report the operation-level permission error. Do not incorrectly mark a valid token as expired.

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
7. ReviewDock shows the resolved account identity and requested permissions/scopes.
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

- Support one optional default connection per provider (one GitHub default and one GitLab default).
- Each workspace folder/repository has its own active connection binding.
- A workspace binding takes precedence over the provider default.
- The provider default is used only when a user explicitly starts repository selection without an existing binding.
- Never use one global active connection for all workspace folders.

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
- status;
- default indicator when applicable;
- actions menu.

Actions:
- Test connection
- Rename
- Re-authenticate
- Set as default for provider
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

The form must not expose provider-inapplicable fields. GitHub Enterprise Server and GitLab Self-Managed use their own API base URL rules.

### 8.3. Context switching

- The active connection is visible in the ReviewDock project/repository selector.
- PR/MR headers show provider, connection name, account login and repository.
- Switching connection refreshes repository data and cancels in-flight requests from the previous connection.
- If the selected repository is not accessible through the new connection, do not show cached data as if it belongs to the new account.

## 9. Connection isolation and security

- Credential lookup is always by immutable connection ID.
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

## 11. Open decisions

- [ ] Confirm PAT-only authentication for MVP; OAuth remains a later phase.
- [ ] Confirm GitHub.com plus GitHub Enterprise Server compatibility target.
- [ ] Confirm GitLab.com plus GitLab Self-Managed compatibility target.
- [ ] Confirm whether GitHub Actions/checks and GitLab pipelines share one normalized status panel or use provider-specific subviews.
- [ ] Confirm whether connection export/import is out of scope for MVP (recommended: out of scope; never export secrets).
