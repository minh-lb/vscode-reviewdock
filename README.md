# ReviewDock

GitHub Pull Request and GitLab Merge Request review and merge management inside Visual Studio Code.

> **Project status:** Documentation and specification phase. Product implementation has not started.

## Planned capabilities

- Manage GitHub Pull Requests and GitLab Merge Requests from VS Code.
- Inspect changes and discussions, add general and inline comments, and merge when permitted by the provider.
- Connect multiple GitHub and GitLab accounts, including multiple accounts on the same provider host.
- Bind workspace folders/repositories to the appropriate connection.
- Keep each connection's credentials isolated in VS Code SecretStorage.

## Connection management

Each connection has its own immutable ID, provider, user-defined name, server URL, account identity, enabled state and connection status.

| Setting / state | Meaning |
|---|---|
| Provider | GitHub or GitLab |
| Name | User-defined display name |
| Server URL | GitHub.com, GitLab.com or supported Enterprise / Self-Managed host |
| Enabled | User-controlled switch; new connections are enabled by default |
| Status | Last-known connection/authentication state, independent of Enabled |

### Enabled and Disabled behavior

- **Enabled:** the connection can be selected and used, subject to its connection status and provider permissions.
- **Disabled:** the connection remains in the connection list, but cannot be selected, used for remote discovery, resolved as a default, or used for any provider API request.
- Disabling preserves the connection configuration, credential, last-known status and workspace bindings.
- Disabling the current provider default clears that default; ReviewDock does not automatically promote another connection.
- A workspace binding to a disabled connection remains stored but is blocked. ReviewDock never silently switches to another account.
- Re-enabling does not automatically validate credentials. The existing connection status still determines whether re-authentication is required.

Connection enablement is not the same as connection health: a connection can be enabled but unreachable, or disabled while its last-known status is Connected.

## Documentation

Detailed specifications are maintained in the docs directory.

| Document | Description |
|---|---|
| [SRS](./docs/SRS.md) | Software requirements, functional requirements and business rules |
| [Connection Management](./docs/CONNECTION-MANAGEMENT.md) | Multi-connection model, lifecycle, enabled/disabled behavior and credential isolation |
| [SDS](./docs/SDS.md) | Software architecture, domain model and component responsibilities |
| [API Specification](./docs/API-SPEC.md) | GitHub and GitLab API contracts and request isolation |
| [UI/UX Specification](./docs/UI-UX.md) | Connection Manager and review experience |
| [Test Plan](./docs/TEST-PLAN.md) | Unit, integration, security and end-to-end test scenarios |
| [Technical Decisions](./docs/DECISIONS.md) | Proposed architecture and product decisions requiring approval |
| [Implementation Plan](./docs/IMPLEMENTATION-PLAN.md) | Milestones and implementation sequence |

## Current scope

The current specification targets GitHub and GitLab. Provider-specific differences in review, approval, pipeline/check and merge capabilities must be represented explicitly; the shared interface must not imply that both providers support identical behavior.

Authentication and provider compatibility details remain subject to the decisions recorded in DECISIONS.md. The specifications are proposals until reviewed and approved.
