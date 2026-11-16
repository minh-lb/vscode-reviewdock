# ReviewDock Documentation

Tài liệu dự án ReviewDock — extension cho Visual Studio Code để quản lý GitHub Pull Requests và GitLab Merge Requests, với nhiều connection/account độc lập.

## Additional implementation references

- [Provider Capability Matrix](./PROVIDER-CAPABILITY-MATRIX.md)
- [Requirement Traceability](./REQUIREMENT-TRACEABILITY.md)
- [Development Guide](./DEVELOPMENT-GUIDE.md)

## Document map

| Document | Purpose | Status |
|---|---|---|
| [SRS.md](./SRS.md) | Software requirements for GitHub/GitLab multi-provider workflows and connection management. | Draft v1.0.4 |
| [DECISIONS.md](./DECISIONS.md) | Proposed MVP defaults and technical decisions requiring Product Owner approval. | Proposed |
| [CONNECTION-MANAGEMENT.md](./CONNECTION-MANAGEMENT.md) | Connection model, fields, provider/server selection, authentication, enabled/disabled lifecycle, workspace binding, isolation and acceptance criteria. | Proposed |
| [SDS.md](./SDS.md) | Software architecture, components, domain models, runtime flows, state and security design. | Proposed |
| [API-SPEC.md](./API-SPEC.md) | GitHub REST API v3 and GitLab REST API v4 endpoints, authentication, pagination, permissions and mutation safety. | Proposed v0.2.0 |
| [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md) | Provider feature parity, resource semantics, API limitations and vendor-maintained compatibility policy. | Proposed v0.1.0 |
| [UI-UX.md](./UI-UX.md) | Navigation, MR detail, diff/discussion layouts, wireframes, states and accessibility. | Proposed |
| [TEST-PLAN.md](./TEST-PLAN.md) | Provider-specific unit, API, extension, E2E, security and release-gate test cases. | Proposed v0.2.0 |
| [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md) | SRS requirement → design → implementation milestone → verification mapping. | Proposed v0.1.0 |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | Provider-aware milestones, tasks, dependencies, exit criteria and release sequence. | Proposed v0.2.0 |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | Local development setup, build, debugging, testing and VSIX release workflow. | Proposed v0.1.0 |

## Project status

- Product: ReviewDock
- Repository: minh-lb/vscode-reviewdock
- Current stage: Requirements and design baseline
- Implementation: Not started
- Current documentation branch: docs/initial-spec
- Pull request: [#1 — ReviewDock documentation baseline](https://github.com/minh-lb/vscode-reviewdock/pull/1)

## Recommended review order

1. Review SRS scope, P0/P1 priorities and provider-specific requirements.
2. Review PROVIDER-CAPABILITY-MATRIX.md and confirm GitHub/GitLab differences and compatibility policy.
3. Approve or revise each item in DECISIONS.md.
4. Review CONNECTION-MANAGEMENT.md for connection lifecycle and isolation.
5. Review SDS and API-SPEC for architecture, endpoint correctness and resource semantics.
6. Review UI-UX and TEST-PLAN for provider-specific actions and negative tests.
7. Confirm REQUIREMENT-TRACEABILITY.md coverage for every SRS requirement.
8. Confirm IMPLEMENTATION-PLAN.md and DEVELOPMENT-GUIDE.md milestones, scripts and release gates.
9. Approve the documentation baseline before implementation begins.

## Working agreement

1. SRS defines what the product must do; CONNECTION-MANAGEMENT defines connection lifecycle and security; SDS defines the proposed design; API-SPEC defines provider contracts; UI-UX defines user interaction; TEST-PLAN defines verification.
2. Every requirement ID must be traceable to a design component, implementation task and test case.
3. Proposed decisions are not approved until the Product Owner accepts them.
4. Update all affected documents when scope, API behavior, architecture or acceptance criteria change.
5. Do not store credentials, real private code or production data in documentation or test fixtures.
6. Implementation must not bypass GitHub repository rules, GitLab authorization, approval rules, protected branches or merge checks.
7. GitHub and GitLab review conversations must retain their provider-native resource types and supported actions.
8. Compatibility claims must match vendor-maintained versions actually tested for the release.
