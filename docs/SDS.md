# ReviewDock — Software Design Specification (SDS)

> **Document ID:** RVD-SDS-001  
> **Version:** 0.1.0  
> **Status:** Proposed design — depends on approval of [DECISIONS.md](./DECISIONS.md)  
> **Parent requirement:** [SRS.md](./SRS.md)

## 1. Purpose and design scope

This document describes the proposed software structure for implementing the ReviewDock VS Code extension. It translates the SRS into components, responsibilities, data contracts, runtime workflows and design constraints.

The design is based on the proposed MVP decisions in DECISIONS.md:
- TypeScript extension host.
- Native VS Code Tree Views for navigation.
- React + TypeScript Webview for MR detail, diff and discussions.
- GitLab REST API v4 through a single API client.
- PAT authentication for MVP, stored in SecretStorage.
- One active GitLab project per workspace folder.
- Single-line inline comments in MVP.
- Pipeline and approval UI are P1.

If a decision is changed, update this SDS and the affected API/UI/test documents before implementation.

## 2. Design goals

1. Keep GitLab transport, business rules and UI independent.
2. Make API behavior testable without launching VS Code.
3. Keep credentials inside the extension host.
4. Ensure Webview messages are typed, validated and least-privilege.
5. Make diff line mapping deterministic and testable.
6. Prevent stale data from being used for comments or merge.
7. Support GitLab.com and Self-Managed instances through configurable base URLs.
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
      Api[GitLab API Client]
      Secret[SecretStorage Adapter]
      Git[Git Remote Resolver]
      Logger[Redacting Logger]
    end
  end
  GitLab[GitLab REST API v4]
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
  Api --> GitLab
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
      gitlabApi.ts
      secretStore.ts
      workspaceStore.ts
  infrastructure/
    gitlab/
      gitlabHttpClient.ts
      gitlabApiAdapter.ts
      dto/
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

### 4.2. AuthenticationService

Responsibilities:
- Add/update/remove a GitLab instance configuration.
- Save PAT using SecretStorage.
- Validate a token using GET /user.
- Return a non-secret identity summary.
- Resolve a token for an instance only inside the extension host.

Invariant: no method returns the raw token to presentation or domain consumers.

### 4.3. ProjectService

Responsibilities:
- Parse supported Git remote URL formats.
- Match hostnames to configured GitLab instances.
- Resolve namespace/project path or numeric project ID.
- Persist workspace project mapping without secrets.
- Offer manual selection if auto-detection fails.

### 4.4. MergeRequestService

Responsibilities:
- List MRs with filters and pagination.
- Retrieve MR detail.
- Retrieve diff versions and file diffs.
- Normalize GitLab DTOs into domain models.
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

### 4.7. GitLabApiClient

Responsibilities:
- Build API v4 URLs from a validated instance base URL.
- Attach PRIVATE-TOKEN only to requests for that exact instance origin.
- Serialize query and body parameters.
- Parse JSON and response headers.
- Follow pagination links only when their origin matches the configured GitLab instance.
- Apply request timeout and cancellation.
- Retry safe GET requests only under defined conditions.
- Map HTTP failures to typed application errors.

### 4.8. Webview bridge

- Use a discriminated-union message protocol.
- Validate message type and payload on receipt.
- Bind the Webview to one MR context at a time.
- Do not pass token, SecretStorage handles, arbitrary URLs or unrestricted API methods to the Webview.
- Re-check permissions and current data in the extension host before every mutation.

## 5. Domain model

The following TypeScript shapes are logical contracts; exact optional fields should follow the normalized DTO mapper.

~~~ts
type GitLabInstance = {
  id: string;
  baseUrl: string;       // normalized origin + optional context path
  displayName: string;
};

type ProjectRef = {
  instanceId: string;
  projectId: number;
  pathWithNamespace: string;
  webUrl: string;
};

type MergeRequestSummary = {
  projectId: number;
  iid: number;
  title: string;
  state: "opened" | "closed" | "merged" | "locked";
  draft: boolean;
  author: UserSummary;
  sourceBranch: string;
  targetBranch: string;
  reviewers: UserSummary[];
  assignees: UserSummary[];
  labels: string[];
  updatedAt: string;
  webUrl: string;
};

type DiffRefs = {
  baseSha: string;
  startSha: string;
  headSha: string;
};

type FileDiff = {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  isTooLarge: boolean;
  isCollapsed: boolean;
  unifiedDiff?: string;
};

type Discussion = {
  id: string;
  individualNote: boolean;
  resolved: boolean;
  notes: DiscussionNote[];
  position?: DiffPosition;
};

type DiffPosition = {
  baseSha: string;
  startSha: string;
  headSha: string;
  oldPath: string;
  newPath: string;
  oldLine?: number;
  newLine?: number;
};

type DiscussionNote = {
  id: number;
  body: string;
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
  system: boolean;
};

type UserSummary = {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string;
  webUrl?: string;
};
~~~

Domain models must not assume every API field exists. Missing, null, redacted and unsupported fields must remain distinguishable where they affect behavior.

## 6. State and persistence

### 6.1. Persistent state

| Data | Storage | Notes |
|---|---|---|
| PAT | SecretStorage | Keyed by instance ID; never mirrored elsewhere |
| GitLab instance list | GlobalState or settings | Base URL and display name only |
| Workspace project mapping | WorkspaceState | Instance ID + numeric project ID |
| UI preferences | GlobalState | Selected tab, list filters, panel preferences |
| MR/diff/discussion cache | In-memory first | Persistent cache requires a separate decision |

### 6.2. Cache keys

Cache keys must include:
- Instance ID.
- Project ID.
- MR IID.
- Resource type.
- Diff version/head SHA where applicable.

Never reuse cache entries across two GitLab instances even if project IDs match.

### 6.3. Freshness rules

- MR list/detail may be shown from cache with a visible stale indicator.
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

### 8.1. Connect an instance

~~~mermaid
sequenceDiagram
  actor User
  participant UI as VS Code UI
  participant Auth as AuthenticationService
  participant Secret as SecretStorage
  participant API as GitLabApiClient
  participant GL as GitLab

  User->>UI: Add instance + PAT
  UI->>Auth: connect(instance, PAT)
  Auth->>API: GET /user
  API->>GL: GET /api/v4/user
  GL-->>API: 200 user profile
  API-->>Auth: normalized identity
  Auth->>Secret: store PAT
  Auth-->>UI: connected identity (no token)
  UI-->>User: Connection successful
~~~

Token persistence should occur only after validation succeeds, unless a separate explicit "save unverified token" flow is later approved.

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
- [ ] GitLab HTTP calls are centralized.
- [ ] All mutation methods require explicit user intent.
- [ ] Diff parser and line mapper have deterministic unit tests.
- [ ] Inline comment requests use latest diff version SHAs.
- [ ] Merge requests include current source SHA.
- [ ] Cache keys include GitLab instance identity.
- [ ] API pagination links are origin-validated before following.
- [ ] Secret and user content are excluded from logs.
