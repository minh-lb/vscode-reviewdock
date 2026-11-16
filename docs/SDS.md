# ReviewDock — Software Design Specification (SDS)

> **Document ID:** RVD-SDS-001  
> **Version:** 0.2.0  
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
  subgraph VSCode[VS Code Extension Host]
    subgraph Presentation[Presentation]
      Tree[Activity Bar / Tree Views]
      Panel[PR / MR Detail Webview]
      Commands[Commands / Quick Picks]
      Editor[Native VS Code Diff / Editor]
    end
    subgraph Application[Application]
      Connection[Connection Service]
      Repository[Repository Service]
      ReviewRequest[Review Request Service]
      Review[Review Service]
      Merge[Merge Service]
      Capability[Capability Resolver]
      State[Workspace State / Cache]
    end
    subgraph Infrastructure[Infrastructure]
      Registry[Provider Adapter Registry]
      GitHub[GitHub Adapter + REST Client]
      GitLab[GitLab Adapter + REST Client]
      Secret[SecretStorage Adapter]
      Git[Git Remote Resolver]
      Logger[Redacting Logger]
    end
  end
  GitHubAPI[GitHub REST API v3]
  GitLabAPI[GitLab REST API v4]
  User --> Tree
  User --> Panel
  User --> Commands
  Tree --> Repository
  Tree --> ReviewRequest
  Panel <--> Review
  Panel <--> ReviewRequest
  Commands --> Connection
  Commands --> Merge
  Connection --> Secret
  Repository --> Git
  Repository --> Registry
  ReviewRequest --> Registry
  Review --> Registry
  Merge --> Registry
  Registry --> GitHub
  Registry --> GitLab
  GitHub --> GitHubAPI
  GitLab --> GitLabAPI
  Application --> State
  Infrastructure --> Logger
  Review --> Editor
~~~

### 3.2. Runtime boundaries

| Boundary | Responsibility | Must not do |
|---|---|---|
| VS Code Extension Host | Lifecycle, commands, views, workspace integration and secure provider requests | Block activation on network; render large diff DOM |
| Presentation | Render state and collect user intent | Call GitHub/GitLab HTTP endpoints or read credentials |
| Application services | Orchestrate use cases and enforce domain invariants | Depend on Webview DOM or provider DTOs |
| Domain | Provider-neutral types, validation and pure logic | Import VS Code API or perform HTTP |
| Provider adapters | Provider-specific HTTP, authentication, pagination, DTO mapping, capability and error mapping | Leak raw DTOs or secrets into UI |
| Webview | Render the current PR/MR and emit validated user intent | Store PAT, call provider APIs or access arbitrary workspace files |
| SecretStorage adapter | Read/write per-connection credential | Return secret material to presentation or logs |

Dependency direction: presentation → application → domain. Infrastructure implements application ports. Provider-specific DTOs must not cross the adapter boundary.

### 3.3. Proposed source layout

~~~text
src/
  extension.ts
  commands/
    registerCommands.ts
  domain/
    models/
      connection.ts
      repository.ts
      reviewRequest.ts
      diff.ts
      reviewConversation.ts
      providerCapability.ts
      checkStatus.ts
      approvalState.ts
      mergeResult.ts
    errors/
      appError.ts
    diff/
      parseUnifiedDiff.ts
      mapGitHubReviewLine.ts
      mapGitLabDiscussionPosition.ts
  application/
    services/
      connectionService.ts
      authenticationService.ts
      repositoryService.ts
      reviewRequestService.ts
      reviewService.ts
      mergeService.ts
    ports/
      reviewProvider.ts
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
      reviewRequestTreeProvider.ts
    webview/
      reviewRequestPanelProvider.ts
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
  extension/
  fixtures/
~~~

The exact filenames may change, but domain and application code remain provider-neutral. Provider-specific HTTP clients and DTOs stay under their respective adapters.

## 4. Component responsibilities

### 4.1. Extension bootstrap

- Register Activity Bar views, commands, serializers and providers.
- Create services through a composition root.
- Register disposal handlers.
- Avoid network calls during activation.
- Start data loading only after the user opens a relevant view or invokes a command.

### 4.2. ConnectionService and AuthenticationService

Responsibilities:
- Create/list/rename/test/re-authenticate/disconnect/delete and enable/disable connections.
- Maintain immutable connection ID, provider, server URL and stable provider account identity.
- Persist the user-controlled enabled flag independently from connection health/status.
- Reject selection, default resolution and API operations for disabled connections before credential lookup.
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
- Retrieve provider-native conversation resources and normalize them without erasing resource type or parent/thread identity.
- Create general timeline comments and inline comments through the selected provider adapter.
- Reply only when the conversation type and provider capability permit it.
- Resolve/reopen only when the adapter exposes the capability and the current user is authorized.
- Validate the current PR head SHA or GitLab diff-version SHAs before inline comment submission.
- Preserve system-note flags, resolution state and provider-native IDs.

### 4.6. MergeService

Responsibilities:
- Refresh PR/MR state immediately before merge.
- Require the current source/head SHA expected by the selected provider endpoint.
- Validate user intent and explicit confirmation.
- Submit immediate merge through the selected provider adapter.
- Normalize provider-specific merge errors while preserving the server reason.
- Never auto-retry an ambiguous mutation.

### 4.7. Provider adapters and HTTP clients

Responsibilities:
- Select GitHubAdapter or GitLabAdapter from the immutable provider type on the connection.
- Build provider API URLs (GitHub REST API v3; GitLab REST API v4) from the validated server configuration.
- Apply provider-specific authentication headers; never reuse headers, tokens or request defaults across providers/connections.
- Map provider DTOs into shared domain contracts while preserving provider-native resource type and identifiers.
- Expose provider capability descriptors for each operation and conversation kind.
- Follow pagination links only when their origin and API path prefix match the configured connection.
- Apply timeout, cancellation, rate-limit handling and provider-specific error mapping.
- Retry safe GET requests only under defined conditions; never automatically retry ambiguous mutations.

### 4.8. Webview bridge

- Use a discriminated-union message protocol.
- Validate message type and payload on receipt.
- Bind the Webview to one PR/MR context at a time.
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
  enabled: boolean; // user-controlled; defaults to true
  status: "connected" | "reauthentication-required" | "unreachable" | "configuration-error" | "disconnected"; // last-known provider health, independent of enabled
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
  draft?: boolean; // undefined means provider did not supply the field
  author: UserSummary;
  sourceBranch: string;
  targetBranch: string;
  headSha?: string;
  reviewers?: UserSummary[]; // undefined = unavailable; [] = explicitly none
  assignees?: UserSummary[]; // undefined = unavailable; [] = explicitly none
  labels?: string[]; // undefined = unavailable; [] = explicitly none
  updatedAt: string;
  webUrl: string;
};

type ProviderCapability = "supported" | "unsupported" | "conditional" | "unknown";

type ProviderCapabilityDescriptor = {
  generalComments: ProviderCapability;
  inlineComments: ProviderCapability;
  replyToGeneralComment: ProviderCapability;
  replyToInlineComment: ProviderCapability;
  replyToReply: ProviderCapability;
  resolveThreads: ProviderCapability;
  editOwnComment: ProviderCapability;
  deleteOwnComment: ProviderCapability;
  reviewDecision: ProviderCapability;
  approvalRules: ProviderCapability;
  checksOrPipelines: ProviderCapability;
  immediateMerge: ProviderCapability;
  mergeQueue: ProviderCapability;
};

// Shared DiffFile, ReviewConversation and ReviewComment models must retain
// provider-specific identifiers and source resource types needed by each adapter.
~~~

A GitHub PR number and a GitLab PR number/MR IID are not globally unique. Every review request and cache entry must carry connection ID and repository ID. Missing provider fields must remain unknown rather than being coerced to false.


### 5.1. Provider-aware conversation model

The following discriminated union is the minimum semantic model. It is illustrative TypeScript; the final implementation may refine field names but must preserve these distinctions.

~~~ts
type ConversationKind =
  | "github-issue-comment"
  | "github-inline-review-comment"
  | "github-review-submission"
  | "gitlab-discussion";

type ReplyCapability = "supported" | "unsupported" | "unknown";

type ReviewConversation = {
  connectionId: string;
  provider: ProviderType;
  repositoryId: string;
  reviewRequestId: string;
  kind: ConversationKind;
  providerResourceId: string;
  parentResourceId?: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  updatedAt?: string;
  webUrl?: string;
  replyCapability: ReplyCapability;
  resolution: "resolved" | "unresolved" | "not-applicable" | "unknown";
  position?: ProviderDiffPosition;
  systemNote?: boolean;
};

type ProviderDiffPosition =
  | {
      provider: "github";
      path: string;
      line: number;
      side: "LEFT" | "RIGHT";
      commitSha: string;
    }
  | {
      provider: "gitlab";
      oldPath: string;
      newPath: string;
      oldLine?: number;
      newLine?: number;
      baseSha: string;
      startSha: string;
      headSha: string;
    };
~~~

Invariants:
- GitHub issue comments have `replyCapability="unsupported"` in the selected REST workflow.
- GitHub inline review comments can be replied to only when the target is a top-level comment; replies-to-replies are unsupported.
- GitHub REST thread resolution is not available in the selected adapter.
- GitLab discussion replies and resolution are controlled by the API and current user's permission.
- Missing provider data is `unknown`, not `false`, empty or resolved.

## 6. State and persistence

### 6.1. Persistent state

| Data | Storage | Notes |
|---|---|---|
| Provider credential (PAT) | SecretStorage | Keyed by immutable connection ID; never mirrored elsewhere |
| Connection registry | GlobalState | Provider, display name, server URL, account identity, enabled flag and last-known status; no secrets |
| Workspace repository binding | WorkspaceState | Workspace folder + connection ID + provider repository/project ID |
| Default connection | GlobalState | One optional enabled default per provider; disabling the current default clears it |
| UI preferences | GlobalState | Selected tab, list filters, panel preferences |
| PR/MR/diff/conversation cache | In-memory first | Persistent cache requires a separate decision |

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
- Merge always requires a fresh PR/MR fetch and current source/head SHA.
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

### 7.3. Provider-specific single-line position mapping

| Diff row | GitLab position | GitHub review comment |
|---|---|---|
| Added line | `new_line` only | New-side line with `side=RIGHT` |
| Removed line | `old_line` only | Old-side line with `side=LEFT` |
| Context line | Both `old_line` and `new_line` | New-side line with `side=RIGHT` |
| Hunk header / metadata | Not commentable | Not commentable |

GitLab request requires `position_type=text`, base/start/head SHAs, old/new paths and the applicable old/new line fields from one collected diff version.

GitHub request requires current PR head `commit_id`, file `path`, `line` and `side`. Use `line`/ `side`; do not introduce new use of the deprecated `position` offset.

A comment is disabled when any provider-required SHA/path/line value is unavailable. Do not infer line positions from the visible row index.

### 7.4. Stale diff handling

Before submitting an inline comment:
1. Refresh PR detail/head SHA or MR detail/latest diff version.
2. Compare the current version SHAs with the version displayed in the composer.
3. If they differ, cancel submission and reload the diff.
4. If the selected provider rejects the position, display the API validation error and reload.
5. Never silently post the text as a general comment.

## 8. Runtime workflows

### 8.1. Create and validate a connection

~~~mermaid
sequenceDiagram
  actor User
  participant UI as VS Code UI
  participant Auth as AuthenticationService
  participant Secret as SecretStorage
  participant API as ProviderApiClient
  participant Provider as GitHub or GitLab

  User->>UI: Choose GitHub/GitLab, name, server and PAT
  UI->>Auth: createConnection(provider, server, name, PAT)
  Auth->>API: validate authenticated user
  API->>Provider: provider-specific GET /user
  Provider-->>API: 200 account profile
  API-->>Auth: normalized account identity
  Auth->>Secret: store credential by connection ID
  Auth-->>UI: connection summary (no token)
  UI-->>User: Connection saved
~~~

Credential persistence should occur only after validation succeeds. The connection registry may retain non-secret form values after a failed validation so the user can correct them.

### 8.1.1. Enable and disable a connection

- The ConnectionService persists the enabled flag in the non-secret connection registry.
- All connection resolution paths (workspace binding, provider default, remote discovery and explicit selection) must reject a disabled connection.
- The provider request pipeline performs a final enabled check before SecretStorage lookup and before attaching authentication headers.
- A disabled connection returns a local ConnectionDisabledError; it must not reach the network.
- Disabling the provider default clears that provider's default. Workspace bindings are retained and surfaced as blocked; no implicit fallback is allowed.
- Re-enabling restores eligibility but does not change the last-known status or perform an implicit validation request.
- Pending read requests should be cancelled where possible. For an already-submitted write, the result is not assumed to be rolled back; refresh/reconcile after re-enabling before allowing a retry.

### 8.2. Load PR/MR and diff

~~~mermaid
sequenceDiagram
  actor User
  participant Tree as TreeView
  participant MR as MergeRequestService
  participant API as ProviderApiClient
  participant Provider as GitHub or GitLab
  participant Web as MR Webview

  User->>Tree: Select MR
  Tree->>MR: getDetail(project, iid)
  MR->>API: GET MR detail
  API->>Provider: provider REST request
  Provider-->>API: PR/MR DTO + provider diff metadata
  API-->>MR: normalized MR
  MR-->>Web: open detail state
  Web->>MR: load changes
  MR->>API: GET diff versions + diffs
  API->>Provider: provider REST requests
  Provider-->>API: provider diff metadata + paginated files
  API-->>MR: normalized diff
  MR-->>Web: structured file diffs
~~~

### 8.3. Create provider-specific inline comment

~~~mermaid
sequenceDiagram
  actor User
  participant Web as MR Webview
  participant Review as ReviewService
  participant MR as MergeRequestService
  participant API as ProviderApiClient
  participant Provider as GitHub or GitLab

  User->>Web: Select changed line + submit
  Web->>Review: createInlineComment(context, line, body)
  Review->>MR: getLatestDiffVersion()
  MR->>API: GET MR + diff versions
  API->>Provider: provider GET requests
  Provider-->>API: current PR head SHA or GitLab diff-version SHAs
  API-->>MR: version metadata
  MR-->>Review: current version
  Review->>Review: validate line mapping and SHA
  Review->>API: provider-specific inline comment request
  API->>Provider: POST review comment or discussion
  Provider-->>API: 201 comment/thread
  API-->>Review: normalized discussion
  Review-->>Web: success + refresh thread
~~~

### 8.4. Merge PR/MR

~~~mermaid
sequenceDiagram
  actor User
  participant UI as MR Webview
  participant Merge as MergeService
  participant API as ProviderApiClient
  participant Provider as GitHub or GitLab

  User->>UI: Click Merge
  UI-->>User: Confirm project, IID and branches
  User->>UI: Confirm
  UI->>Merge: merge(project, iid, options)
  Merge->>API: GET MR detail
  API->>Provider: GET PR/MR
  Provider-->>API: current PR/MR + source HEAD SHA
  API-->>Merge: normalized MR
  Merge->>Merge: validate open state and SHA
  Merge->>API: PUT /merge with sha
  API->>Provider: provider immediate-merge endpoint
  Provider-->>API: success or error
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
- ProviderServerError (5xx)
- UnsupportedCapabilityError

Each error should include operation, HTTP status if available, provider request ID if present and a safe user-facing message. It must not include the token or full request headers. HTTP 401 must be classified with provider context: validate the authenticated-user endpoint before marking the connection invalid, because some GitLab mutation endpoints can use 401 for operation-level permission failure.

## 10. Concurrency and cancellation

- Every view load receives a cancellation token.
- Changing repository/project or PR/MR cancels requests for the previous selection.
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
- Do not trust GitHub/GitLab comment bodies, PR/MR descriptions, filenames or branch names as HTML.

## 12. Observability

- Use structured, redacted logs.
- Include operation name, connection ID, provider, repository/project ID, PR number/PR number/MR IID and provider request ID where safe.
- Do not log tokens, raw authorization headers, full diff bodies or comment content.
- Provide a user-accessible "Copy diagnostic info" action containing only sanitized metadata.

## 13. Design verification checklist

- [ ] No domain module imports VS Code API.
- [ ] Webview has no credential or direct API access.
- [ ] GitHub and GitLab HTTP calls are isolated behind provider adapters.
- [ ] GitHub issue comments, inline review comments and review submissions remain distinct resource types.
- [ ] Reply/resolve/edit/delete actions are gated by provider and conversation-kind capabilities.
- [ ] GitHub and GitLab diff positions are mapped by separate tested functions.
- [ ] Missing provider fields remain unknown rather than false/zero.
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
