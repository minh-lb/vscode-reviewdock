# ReviewDock Documentation

Tài liệu dự án ReviewDock — extension cho Visual Studio Code để quản lý GitLab Merge Requests và thực hiện code review trong IDE.

## Document map

| Document | Purpose | Status |
|---|---|---|
| [SRS.md](./SRS.md) | Software requirements: scope, actors, functional/non-functional requirements, business rules and acceptance criteria. | Draft v1.0.1 |
| [DECISIONS.md](./DECISIONS.md) | Proposed MVP defaults and technical decisions requiring Product Owner approval. | Proposed |
| [SDS.md](./SDS.md) | Software architecture, components, domain models, runtime flows, state and security design. | Proposed |
| [API-SPEC.md](./API-SPEC.md) | GitLab REST API endpoints, request parameters, response mapping, pagination and mutation safety. | Proposed |
| [UI-UX.md](./UI-UX.md) | Navigation, MR detail, diff/discussion layouts, wireframes, states and accessibility. | Proposed |
| [TEST-PLAN.md](./TEST-PLAN.md) | Unit, API, extension, end-to-end, security and release-gate test cases. | Proposed |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | Milestones, tasks, dependencies, exit criteria and release sequence. | Proposed |

## Project status

- Product: ReviewDock
- Repository: minh-lb/vscode-reviewdock
- Current stage: Requirements and design baseline
- Implementation: Not started
- Current documentation branch: docs/initial-spec
- Pull request: [#1 — ReviewDock documentation baseline](https://github.com/minh-lb/vscode-reviewdock/pull/1)

## Recommended review order

1. Review SRS scope and P0/P1 priorities.
2. Approve or revise each item in DECISIONS.md.
3. Review SDS and API-SPEC for architecture and GitLab API correctness.
4. Review UI-UX and TEST-PLAN.
5. Confirm IMPLEMENTATION-PLAN milestones and release gates.
6. Approve the documentation baseline before implementation begins.

## Working agreement

1. SRS defines what the product must do; SDS defines the proposed design; API-SPEC defines the GitLab contract; UI-UX defines user interaction; TEST-PLAN defines verification.
2. Every requirement ID must be traceable to a design component, implementation task and test case.
3. Proposed decisions are not approved until the Product Owner accepts them.
4. Update all affected documents when scope, API behavior, architecture or acceptance criteria change.
5. Do not store credentials, real private code or production data in documentation or test fixtures.
6. Implementation must not bypass GitLab authorization, approval rules, protected branches or merge checks.
