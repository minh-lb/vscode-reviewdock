# Requirement Traceability Matrix

**Status:** Implementation traceability snapshot. Code presence does not mean requirement acceptance or provider compatibility is verified.

## Rules

- Every unique requirement/decision ID extracted from SRS is listed below; this mapping must be updated when SRS changes.
- The implementation mapping names current source paths; absent acceptance evidence remains open.
- Status: Planned, In progress, Implemented, Verified, Deferred, Blocked. Only Verified means named checks passed or manual evidence exists.
- In progress means relevant implementation exists but integration/acceptance is incomplete.
- Decision IDs (DEC-*) record the owner-adopted baseline, not runtime behavior.

## Requirement-level mapping

| ID | Primary design owner | Implementation / verification mapping | Status |
|---|---|---|---|
| APR-001 | ApprovalService; capability adapter | `src/application/reviewService.ts; provider getApprovalState methods` | In progress |
| APR-002 | ApprovalService; capability adapter | `src/application/reviewService.ts; provider getApprovalState methods` | In progress |
| APR-003 | ApprovalService; capability adapter | `src/application/reviewService.ts; provider getApprovalState methods` | In progress |
| APR-004 | ApprovalService; capability adapter | `src/application/reviewService.ts; provider getApprovalState methods` | In progress |
| APR-005 | ApprovalService; capability adapter | `src/application/reviewService.ts; provider getApprovalState methods` | In progress |
| AUTH-001 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-002 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-003 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-004 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-005 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-006 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-007 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-008 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-009 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-010 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-011 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-012 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-013 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-014 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-015 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-016 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-017 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-018 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| AUTH-019 | ConnectionService; ConnectionRegistry; CredentialStore; ProviderRequestGuard | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| BR-001 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-002 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-003 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-004 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-005 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-006 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-007 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-008 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-009 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-010 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-011 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-012 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-013 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| BR-014 | Domain validation and application services | `src/domain/errors.ts; src/application/reviewService.ts; src/domain/diff/` | In progress |
| COM-001 | Provider HTTP clients and request routing guard | `src/infrastructure/http/providerHttpClient.ts` | In progress |
| COM-002 | Provider HTTP clients and request routing guard | `src/infrastructure/http/providerHttpClient.ts` | In progress |
| COM-003 | Provider HTTP clients and request routing guard | `src/infrastructure/http/providerHttpClient.ts` | In progress |
| COM-004 | Provider HTTP clients and request routing guard | `src/infrastructure/http/providerHttpClient.ts` | In progress |
| COM-005 | Provider HTTP clients and request routing guard | `src/infrastructure/http/providerHttpClient.ts` | In progress |
| DATA-001 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-002 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-003 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-004 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-005 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-006 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DATA-007 | Domain models, workspace storage, SecretStorage | `src/domain/models.ts; src/application/connectionService.ts; src/application/repositoryService.ts` | In progress |
| DEC-001 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-002 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-003 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-004 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-005 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-006 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-007 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-008 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-009 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-010 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-011 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-012 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-013 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-014 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-015 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-016 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-017 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-018 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DEC-019 | Decision register / owner-adopted implementation baseline | `Owner-adopted baseline in docs/IMPLEMENTATION-STATUS.md; decision evidence only` | Implemented |
| DETAIL-001 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DETAIL-002 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DETAIL-003 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DETAIL-004 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DETAIL-005 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DETAIL-006 | ReviewRequestService; DTO mappers; detail view model | `GitHub/GitLab provider mappers under src/infrastructure/providers/` | In progress |
| DIFF-001 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-002 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-003 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-004 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-005 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-006 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-007 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-008 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-009 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-010 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-011 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DIFF-012 | DiffService; UnifiedDiffParser; DiffLineMapper | `src/domain/diff/; test/unit/diffParser.test.ts; test/unit/diffPosition.test.ts` | In progress |
| DISC-001 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-002 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-003 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-004 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-005 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-006 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-007 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-008 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-009 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-010 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-011 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-012 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| DISC-013 | ReviewService; DiscussionRepository; CommentComposer | `src/application/reviewService.ts; provider adapters under src/infrastructure/providers/` | In progress |
| ERR-001 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-002 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-003 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-004 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-005 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-006 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-007 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-008 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-009 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| ERR-010 | AppError mapping and view states | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| IF-001 | Provider HTTP clients, DTO mappers, message protocol | `src/application/ports.ts; provider adapters; src/presentation/webview/messageProtocol.ts` | In progress |
| IF-002 | Provider HTTP clients, DTO mappers, message protocol | `src/application/ports.ts; provider adapters; src/presentation/webview/messageProtocol.ts` | In progress |
| IF-003 | Provider HTTP clients, DTO mappers, message protocol | `src/application/ports.ts; provider adapters; src/presentation/webview/messageProtocol.ts` | In progress |
| IF-004 | Provider HTTP clients, DTO mappers, message protocol | `src/application/ports.ts; provider adapters; src/presentation/webview/messageProtocol.ts` | In progress |
| IF-005 | Provider HTTP clients, DTO mappers, message protocol | `src/application/ports.ts; provider adapters; src/presentation/webview/messageProtocol.ts` | In progress |
| MERGE-001 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-002 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-003 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-004 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-005 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-006 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-007 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-008 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-009 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| MERGE-010 | MergeService; confirmation UI; provider mutation adapters | `src/application/reviewService.ts; provider adapter merge methods` | In progress |
| NFR-COMP-001 | Runtime and packaging compatibility | `package.json; .github/workflows/ci.yml` | In progress |
| NFR-COMP-002 | Runtime and packaging compatibility | `package.json; .github/workflows/ci.yml` | In progress |
| NFR-COMP-003 | Runtime and packaging compatibility | `package.json; .github/workflows/ci.yml` | In progress |
| NFR-COMP-004 | Runtime and packaging compatibility | `package.json; .github/workflows/ci.yml` | In progress |
| NFR-COMP-005 | Runtime and packaging compatibility | `package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-001 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-002 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-003 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-004 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-005 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| NFR-MAIN-006 | TypeScript configuration and quality gates | `tsconfig.json; package.json; .github/workflows/ci.yml` | In progress |
| MR-001 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-002 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-003 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-004 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-005 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-006 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-007 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-008 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-009 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-010 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| MR-011 | ReviewRequestService; provider adapters | `provider adapters and mappers under src/infrastructure/providers/` | In progress |
| NFR-PERF-001 | Extension lifecycle and request orchestration | `src/extension.ts; src/application/` | In progress |
| NFR-PERF-002 | Extension lifecycle and request orchestration | `src/extension.ts; src/application/; webview-ui/src/` | In progress |
| NFR-PERF-003 | Extension lifecycle and request orchestration | `src/application/; src/infrastructure/providers/` | In progress |
| NFR-PERF-004 | Extension lifecycle and request orchestration | `src/application/; src/infrastructure/http/` | In progress |
| NFR-PERF-005 | Extension lifecycle and request orchestration | `src/application/; src/presentation/` | In progress |
| PIPE-001 | PipelineService; CheckRun/Job adapters | `provider check methods; src/presentation/webview/messageProtocol.ts` | In progress |
| PIPE-002 | PipelineService; CheckRun/Job adapters | `provider check methods; src/presentation/webview/messageProtocol.ts` | In progress |
| PIPE-003 | PipelineService; CheckRun/Job adapters | `provider check methods; src/presentation/webview/messageProtocol.ts` | In progress |
| PIPE-004 | PipelineService; CheckRun/Job adapters | `provider check methods; src/presentation/webview/messageProtocol.ts` | In progress |
| PIPE-005 | PipelineService; CheckRun/Job adapters | `provider check methods; src/presentation/webview/messageProtocol.ts` | In progress |
| PROJ-001 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-002 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-003 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-004 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-005 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-006 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-007 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-008 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| PROJ-009 | ProjectService; GitRemoteResolver; WorkspaceStore | `src/application/repositoryService.ts; provider repository methods` | In progress |
| NFR-SEC-001 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-002 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-003 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-004 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-005 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-006 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-007 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-008 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-SEC-009 | SecretStorage, request guard, redacting logger, Webview security | `src/application/connectionService.ts; src/infrastructure/http/providerHttpClient.ts; src/presentation/webview/messageProtocol.ts` | In progress |
| NFR-REL-001 | Error handling and state recovery | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| NFR-REL-002 | Error handling and state recovery | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| NFR-REL-003 | Error handling and state recovery | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| NFR-REL-004 | Error handling and state recovery | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| NFR-REL-005 | Error handling and state recovery | `src/domain/errors.ts; src/infrastructure/http/providerHttpClient.ts` | In progress |
| UI-001 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-002 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-003 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-004 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-005 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-006 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-007 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-008 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-009 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| UI-010 | Commands, Tree Views, Webview components | `package.json contributions; src/presentation/webview/messageProtocol.ts; webview-ui/src/` | In progress |
| NFR-UX-001 | VS Code interaction and accessibility | `src/presentation/; webview-ui/src/` | In progress |
| NFR-UX-002 | VS Code interaction and accessibility | `src/presentation/; webview-ui/src/` | In progress |
| NFR-UX-003 | VS Code interaction and accessibility | `src/presentation/; webview-ui/src/` | In progress |
| NFR-UX-004 | VS Code interaction and accessibility | `src/presentation/; webview-ui/src/` | In progress |
| NFR-UX-005 | VS Code interaction and accessibility | `src/presentation/; webview-ui/src/` | In progress |

## Verification evidence

Do not move a row to Verified until named tests pass or manual records capture environment, steps and results. Provider mutations require test instances; security, cancellation, stale-data and error paths require evidence; no P0/P1 defect may block acceptance. This snapshot does not mark implementation rows Verified.

## Maintenance gate

CI compares declared SRS requirement and decision IDs against this table, including duplicate and unknown matrix rows. The paths above are implementation pointers, not proof of complete behavior or release acceptance.


## Additional decision traceability

| ID | Design/approval owner | Implementation / verification evidence | Status |
|---|---|---|---|
| DEC-020 | Compatibility owner | Select and test exact GHES release floor; external evidence pending | Blocked |
| DEC-021 | Compatibility owner | Select and test exact GitLab Self-Managed release floor; external evidence pending | Blocked |
| DEC-022 | Security / provider adapters | Least-privilege PAT guidance and live endpoint permission tests pending | In progress |
| DEC-023 | QA / provider adapters | Independent GitHub.com/GitLab.com P0 acceptance remains an external gate | In progress |
| DEC-024 | Developer / CI | `scripts/check-traceability.mjs` and CI ID comparison | Implemented |
