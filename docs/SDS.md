# ReviewDock — Software Design Specification (SDS)

> **Document ID:** RVD-SDS-001  
> **Version:** 0.1.0  
> **Status:** Proposed design — depends on approval of [DECISIONS.md](./DECISIONS.md)  
> **Parent requirement:** [SRS.md](./SRS.md)

## 1. Purpose and design scope

This document describes the proposed multi-provider software structure for implementing ReviewDock with GitHub and GitLab. It translates the SRS into components, responsibilities, data contracts, runtime workflows and design constraints.

The design is based on the proposed MVP decisions in DECISIONS.md:
- TypeScript extension host.
- Native VS Code Tree Views for navigation.
- React + TypeScript Webview for PR/MR detail, diff and review conversations.
- Separate GitHub REST API v3 and GitLab REST API v4 provider adapters behind a common application contract.
- Multiple PAT-backed connections, each stored independently in SecretStorage.
- One active connection + repository binding per workspace folder; one default connection per provider.
- Single-line inline comments in MVP where supported by the provider.
- GitHub Checks/Actions and GitLab Pipeline/Jobs panels are P1.

If a decision is changed, update this SDS and the affected API/UI/test documents before implementation.

## 2. Design goals

1. Keep provider-specific transport, business rules and UI independent.
2. Make API behavior testable without launching VS Code.
3. Keep credentials inside the extension host.
4. Ensure Webview messages are typed, validated and least-privilege.
5. Make diff line mapping deterministic and testable.
6. Prevent stale data from being used for comments or merge.
7. Support GitHub.com/GitHub Enterprise Server and GitLab.com/Self-Managed through configurable server URLs.
8. Avoid blocking extension activation or the VS Code UI thread.

## 3. High-level architecture

### 3.1. Logical architecture

~~~mermaid
flowchart TB
  User[Developer / Reviewer]
  subgraph VSCode[VS Code]
    subgraph UI[Presentation]
      Tree[Activity Bar / Tree Views]
      Panel[MR Detail Webview]
      Commands[Commands / Quick Picks]
      Diff[Diff Renderer]
    end
    subgraph App[Application]
      AuthSvc[Authentication Service]
      ProjectSvc[Project Service]
      MrSvc[Merge Request Service]
      ReviewSvc[Review Service]
      MergeSvc[Merge Service]
      State[Workspace State / Cache]
    end
    subgraph Infra[Infrastructure]
      Providers[Provider Adapter Registry]
      Secret[SecretStorage Adapter]
      Git[Git Remote Resolver]
      Logger[Redacting Logger]
    end
  end
  ProviderAPI[GitHub REST API v3 / GitLab REST API v4]
  User --> Tree
  User --> Panel
  User --> Commands
  Tree --> ProjectSvc
  Tree --> MrSvc
  Panel <--> ReviewSvc
  Panel <--> MrSvc
  Diff --> ReviewSvc
  Commands --> AuthSvc
  Commands --> MergeSvc
  AuthSvc --> Secret
  ProjectSvc --> Git
  ProjectSvc --> Api
  MrSvc --> Api
  ReviewSvc --> Api
  MergeSvc --> Api
  App --> State
  Providers --> ProviderAPI
  Infra --> Logger
~~~

### 3.2. Runtime boundaries

| Boundary | Responsibility | Must not do |
|---|---|---|
| VS Code Extension Host | Lifecycle, commands, views, workspace integration | Render large diff DOM |
| Application services | Use cases and orchestration | Depend on Webview DOM |
| Domain | Types, validation and pure logic | Import VS Code API or perform HTTP |
| GitLab infrastructure | HTTP, auth header, pagination, DTO mapping | Decide UI presentation |
| Webview | Render view state and emit user intent | Store PAT or call GitLab directly |
| SecretStorage adapter | Read/write token secrets | Expose secrets to UI/logs |

### 3.3. Proposed source layout

~~~text
src/
  extension.ts
  commands/
    registerCommands.ts
  domain/
    models/
      gitlabInstance.ts
      project.ts
      mergeRequest.ts
      diff.ts
      discussion.ts
      pipeline.ts
      approval.ts
    errors/
      appError.ts
    diff/
      parseUnifiedDiff.ts
      mapDiffLine.ts
  application/
    services/
      authenticationService.ts
      projectService.ts
      mergeRequestService.ts
      reviewService.ts
      mergeService.ts
    ports/
      providerApi.ts
      secretStore.ts
      workspaceStore.ts
  infrastructure/
    providers/
      providerRegistry.ts
      github/
        githubHttpClient.ts
        githubAdapter.ts
        dto/
      gitlab/
        gitlabHttpClient.ts
        gitlabAdapter.ts
        dto/
    connections/
      connectionRegistry.ts
      connectionService.ts
      credentialStore.ts
    storage/
      vscodeSecretStore.ts
      vscodeWorkspaceStore.ts
    git/
      gitRemoteResolver.ts
    logging/
      redactingLogger.ts
  presentation/
    tree/
      projectTreeProvider.ts
      mergeRequestTreeProvider.ts
    webview/
      mrPanelProvider.ts
      messageProtocol.ts
      security.ts
      webview-ui/
        src/
          App.tsx
          components/
          state/
          styles/
  test/
    unit/
    integration/
    fixtures/
~~~

The exact filenames may change, but the dependency direction must remain: presentation → application → domain; infrastructure implements application ports.

## 4. Component responsibilities

### 4.1. Extension bootstrap

- Register Activity Bar views, commands, serializers and providers.
- Create services through a composition root.
- Register disposal handlers.
- Avoid network calls during activation.
- Start data loading only after the user opens a relevant view or invokes a command.

### 4.2. ConnectionService and AuthenticationService

Responsibilities:
- Create/list/rename/test/re-authenticate/disconnect/delete connections.
- Maintain immutable connection ID, provider, server URL and stable provider account identity.
- Validate credentials through the provider adapter's authenticated-user endpoint.
- Store and retrieve one credential per connection ID through SecretStorage.
- Track connection status and last validation/use timestamps.
- Support one default connection per provider.

Invariant: no method returns raw credential material to presentation, Webview or domain consumers. Provider and server URL are not silently changed on an existing connection.

### 4.3. RepositoryService

Responsibilities:
- Parse supported GitHub and GitLab HTTPS/SSH remote URL formats.
- Match remote host to configured provider servers and candidate connections.
- Resolve GitHub repository or GitLab project through the selected adapter.
- Persist workspace-folder binding as connection ID + repository/project ID without secrets.
- Require an explicit account choice when multiple connections on the same host can access the remote.
- Offer manual selection if auto-detection fails.

### 4.4. ReviewRequestService

Responsibilities:
- List GitHub Pull Requests or GitLab Merge Requests with provider-specific filters and pagination.
- Retrieve review request detail and changed files.
- Normalize provider DTOs into a shared ReviewRequest model while preserving provider-native IDs and fields.
- Mark data as stale when refresh fails.

### 4.5. ReviewService

Responsibilities:
- Retrieve discussions.
- Create general discussion threads.
- Create inline diff discussions.
- Reply to a discussion.
- Resolve/reopen discussion when enabled.
- Validate that the diff version used by the composer is still current.

### 4.6. MergeService

Responsibilities:
- Refresh MR state immediately before merge.
- Require current source HEAD SHA.
- Validate user intent and confirmation result.
- Submit immediate merge request.
- Normalize GitLab merge errors.
- Never auto-retry an ambiguous mutation.

### 4.7. Provider adapters and HTTP clients

Responsibilities:
- Select GitHubAdapter or GitLabAdapter from the immutable provider type on the connection.
- Build provider API URLs (GitHub REST API v3; GitLab REST API v4) from the validated server configuration.
- Apply provider-specific authentication headers; never reuse GitLab headers for GitHub or vice versa.
- Map provider DTOs into shared domain contracts and expose provider capability descriptors.
- Follow pagination links only when their origin and API path prefix match the configured connection.
- Apply timeout, cancellation, rate-limit handling and provider-specific error mapping.
- Retry safe GET requests only under defined conditions; never automatically retry ambiguous mutations.

### 4.8. Webview bridge

- Use a discriminated-union message protocol.
- Validate message type and payload on receipt.
- Bind the Webview to one MR context at a time.
- Do not pass token, SecretStorage handles, arbitrary URLs or unrestricted API methods to the Webview.
- Re-check permissions and current data in the extension host before every mutation.

## 5. Domain model

The following TypeScript shapes are logical contracts. Provider-specific DTOs remain inside adapters; domain models preserve provider identity and do not erase meaningful differences.

~~~ts
type ProviderType = "github" | "gitlab";

type Connection = {
  id: string; // immutable UUID
  provider: ProviderType;
  displayName: string;
  serverUrl: string;
  accountId: string;
  accountLogin: string;
  status: "connected" | "reauthentication-required" | "unreachable" | "configuration-error" | "disconnected";
};

type RepositoryRef = {
  connectionId: string;
  provider: ProviderType;
  repositoryId: string;
  fullName: string;
  webUrl: string;
};

type ReviewRequestSummary = {
  connectionId: string;
  provider: ProviderType;
  repositoryId: string;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  author: UserSummary;
  sourceBranch: string;
  targetBranch: string;
  headSha?: string;
  reviewers: UserSummary[];
  assignees: UserSummary[];
  labels: string[];
  updatedAt: string;
  webUrl: string;
};

type ProviderCapabilities = {
  inlineComments: boolean;
  threadedReplies: boolean;
  resolveThreads: boolean;
  reviewDecisions: boolean;
  checksOrPipelines: boolean;
  merge: boolean;
};

// Shared DiffFile, ReviewConversation and ReviewComment models must retain
// provider-specific identifiers and opaque metadata needed by each adapter.
~~~

A GitHub PR number and a GitLab MR IID are not globally unique. Every review request and cache entry must carry connection ID and repository ID. Missing provider fields must remain unknown rather than being coerced to false.

## 6. State and persistence

### 6.1. Persistent state

| Data | Storage | Notes |
|---|---|---|
| Provider credential (PAT) | SecretStorage | Keyed by immutable connection ID; never mirrored elsewhere |
| Connection registry | GlobalState | Provider, display name, server URL, account identity and status; no secrets |
| Workspace repository binding | WorkspaceState | Workspace folder + connection ID + provider repository/project ID |
| Default connection | GlobalState | One optional default per provider |
| UI preferences | GlobalState | Selected tab, list filters, panel preferences |
| MR/diff/discussion cache | In-memory first | Persistent cache requires a separate decision |

### 6.2. Cache keys

Cache keys must include:
- Connection ID.
- Provider and normalized server URL.
- Provider repository/project ID.
- Review request number/ID.
- Resource type and diff version/head SHA where applicable.

Never reuse cache entries across two accounts or connections, even when host and repository path are identical.

### 6.3. Freshness rules

- PR/MR list/detail may be shown from cache with a visible stale indicator.
- Diff comments require a current diff version.
- Merge always requires a fresh MR fetch and current SHA.
- A failed refresh must not silently convert stale data into current data.
- Mutations invalidate related list/detail/discussion cache entries.

## 7. Diff rendering and line mapping

### 7.1. Data source

1. Retrieve MR detail.
2. Retrieve latest diff version metadata from the MR diff versions endpoint.
3. Store base_commit_sha, start_commit_sha, and head_commit_sha.
4. Retrieve file diffs using the diff endpoint and pagination.
5. Parse unified diff hunks into structured rows.
6. Render the structured rows in the Webview.

Do not use the deprecated /changes endpoint for new implementation.

### 7.2. Diff row model

Each rendered row must identify:
- File path before and after change.
- Row kind: context, added, removed, hunk header.
- Old line number, if applicable.
- New line number, if applicable.
- Hunk identity and diff-version identity.
- Whether a comment can be created at that row.

### 7.3. Single-line position mapping

| Diff row | GitLab position fields |
|---|---|
| Added line | new_line only |
| Removed line | old_line only |
| Context line | old_line and new_line |
| Hunk header / metadata | Not commentable |

Every inline comment request must include:
- position_type=text
- base_sha
- start_sha
- head_sha
- old_path
- new_path
- The appropriate old/new line field(s)

A comment is disabled when any required SHA/path/line value is unavailable. Do not infer line positions from the visible row index.

### 7.4. Stale diff handling

Before submitting an inline comment:
1. Refresh MR detail and latest diff version.
2. Compare the current version SHAs with the version displayed in the composer.
3. If they differ, cancel submission and reload the diff.
4. If GitLab rejects the position, display the API validation error and reload.
5. Never silently post the text as a general comment.

## 8. Runtime workflows

### 8.1. Create and validate a connection

~~~mermaid
sequenceDiagram
  actor User
  participant UI as VS Code UI
  participant Auth as AuthenticationService
  participant Secret as SecretStorage
  participant API as GitLabApiClient
  participant GL as GitLab

  User->>UI: Choose GitHub/GitLab, name, server and PAT
  UI->>Auth: createConnection(provider, server, name, PAT)
  Auth->>API: validate authenticated user
  API->>GL: provider-specific GET /user
  GL-->>API: 200 account profile
  API-->>Auth: normalized account identity
  Auth->>Secret: store credential by connection ID
  Auth-->>UI: connection summary (no token)
  UI-->>User: Connection saved
~~~

Credential persistence should occur only after validation succeeds. The connection registry may retain non-secret form values after a failed validation so the user can correct them.

### 8.2. Load MR and diff

~~~mermaid
sequenceDiagram
  actor User
  participant Tree as TreeView
  participant MR as MergeRequestService
  participant API as GitLabApiClient
  participant GL as GitLab
  participant Web as MR Webview

  User->>Tree: Select MR
  Tree->>MR: getDetail(project, iid)
  MR->>API: GET MR detail
  API->>GL: REST request
  GL-->>API: MR DTO + diff_refs
  API-->>MR: normalized MR
  MR-->>Web: open detail state
  Web->>MR: load changes
  MR->>API: GET diff versions + diffs
  API->>GL: REST requests
  GL-->>API: versions + paginated diffs
  API-->>MR: normalized diff
  MR-->>Web: structured file diffs
~~~

### 8.3. Create inline comment

~~~mermaid
sequenceDiagram
  actor User
  participant Web as MR Webview
  participant Review as ReviewService
  participant MR as MergeRequestService
  participant API as GitLabApiClient
  participant GL as GitLab

  User->>Web: Select changed line + submit
  Web->>Review: createInlineComment(context, line, body)
  Review->>MR: getLatestDiffVersion()
  MR->>API: GET MR + diff versions
  API->>GL: GET requests
  GL-->>API: current SHAs
  API-->>MR: version metadata
  MR-->>Review: current version
  Review->>Review: validate line mapping and SHA
  Review->>API: POST discussions with position
  API->>GL: POST /discussions
  GL-->>API: 201 discussion
  API-->>Review: normalized discussion
  Review-->>Web: success + refresh thread
~~~

### 8.4. Merge

~~~mermaid
sequenceDiagram
  actor User
  participant UI as MR Webview
  participant Merge as MergeService
  participant API as GitLabApiClient
  participant GL as GitLab

  User->>UI: Click Merge
  UI-->>User: Confirm project, IID and branches
  User->>UI: Confirm
  UI->>Merge: merge(project, iid, options)
  Merge->>API: GET MR detail
  API->>GL: GET MR
  GL-->>API: current MR + source SHA
  API-->>Merge: normalized MR
  Merge->>Merge: validate open state and SHA
  Merge->>API: PUT /merge with sha
  API->>GL: PUT merge request
  GL-->>API: success or error
  API-->>Merge: normalized result
  Merge-->>UI: result + refresh state
~~~

## 9. Error model

Use a typed error model with at least:
- AuthenticationError (401)
- AuthorizationError (403)
- NotFoundError (404)
- ValidationError (400/422)
- ConflictError (409)
- RateLimitError (429)
- TimeoutError
- NetworkError
- GitLabServerError (5xx)
- UnsupportedCapabilityError

Each error should include operation, HTTP status if available, GitLab request ID if present and a safe user-facing message. It must not include the token or full request headers.

## 10. Concurrency and cancellation

- Every view load receives a cancellation token.
- Changing project or MR cancels requests for the previous selection.
- Read-only requests may run concurrently with a small per-instance limit (proposed maximum: 4).
- Mutation requests are serialized per MR to avoid duplicate user actions.
- Do not retry POST/PUT merge/comment operations automatically.
- A user-initiated retry after an ambiguous mutation must refresh the resource first.

## 11. Webview security

- Use a strict CSP with nonces for scripts.
- Load scripts/styles only from extension-bundled local resources.
- Set localResourceRoots to the Webview asset directory.
- Disable arbitrary remote network access from the Webview.
- Never include PATs in Webview HTML, state, message payloads or browser storage.
- Validate every incoming message against a runtime schema.
- Escape/render user-supplied Markdown as text or sanitized HTML; disable raw HTML.
- Validate all links before opening them externally.
- Do not trust GitLab comment bodies, MR descriptions, filenames or branch names as HTML.

## 12. Observability

- Use structured, redacted logs.
- Include operation name, instance ID, project ID, MR IID and GitLab request ID where safe.
- Do not log tokens, raw authorization headers, full diff bodies or comment content.
- Provide a user-accessible "Copy diagnostic info" action containing only sanitized metadata.

## 13. Design verification checklist

- [ ] No domain module imports VS Code API.
- [ ] Webview has no credential or direct API access.
- [ ] GitHub and GitLab HTTP calls are isolated behind provider adapters.
- [ ] Credentials are stored and resolved by immutable connection ID.
- [ ] Multiple accounts on the same host require explicit selection when ambiguous.
- [ ] Workspace bindings and cache keys include connection ID.
- [ ] All mutation methods require explicit user intent.
- [ ] Diff parser and line mapper have deterministic unit tests.
- [ ] Inline comment requests use latest diff version SHAs.
- [ ] Merge requests include current source SHA.
- [ ] Cache keys include provider, connection ID and repository identity.
- [ ] API pagination links are origin-validated before following.
- [ ] Secret and user content are excluded from logs.
