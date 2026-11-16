# Development Guide

## Source of truth

Executable commands/tool versions must match committed package scripts, lockfile, TypeScript/bundler config and CI. If they differ from this guide, update the guide; do not invent commands or versions.

## Prerequisites and setup

- VS Code with Extension Development Host support.
- Node.js version from .nvmrc, .node-version or package engines when present.
- Package manager matching the committed lockfile, Git and repository access.
- Isolated GitHub test repository and GitLab test project; Enterprise/Self-Managed hosts for compatibility claims.
- Clone repository, inspect scripts/config/CI, install with lockfile package manager, run lint/typecheck/unit tests/build, then launch the committed Extension Development Host task. Add missing commands as M0 work and record exact names here.

Never use production credentials or repositories for mutation tests.

## Architecture rules

- Dependency direction: presentation → application → domain; infrastructure implements ports.
- Domain must not import VS Code, React/Webview or provider DTO/SDK types.
- Separate GitHub REST v3 and GitLab REST v4 clients own transport, auth, pagination, rate limits and raw responses.
- Provider adapters normalize DTOs while retaining native IDs and semantics.
- Application services depend on provider-neutral ports/capabilities, never provider-specific HTTP clients.
- Webview receives sanitized view models and emits validated intent messages; it never receives PATs or calls provider APIs.
- Check connection enabled state before SecretStorage lookup and credential attachment.

## Secrets and test safety

Tokens only in VS Code SecretStorage keyed by immutable connection ID; metadata is separate. Never commit tokens, test credentials, private diff fixtures, real repository URLs or user data. Use dedicated least-privilege expiring tokens; disclose GitLab's proposed api scope is broad. Redact auth headers, tokens, private code and comment bodies. Use deterministic sanitized fixtures for PR/MR, diffs, discussions, pagination and errors. Include added/removed/context/renamed/binary/oversized/malformed diff cases. Use disposable resources for mutation tests and document cleanup.

## Feature workflow

1. Identify SRS IDs and acceptance criteria.
2. Confirm provider capability and traceability mapping.
3. Implement domain behavior and unit tests.
4. Implement provider DTO mapping and mocked HTTP integration tests.
5. Implement application orchestration, cancellation and typed errors.
6. Implement VS Code UI/Webview and message validation.
7. Run targeted and full quality gates.
8. Update SDS/API/UI/TEST/IMPLEMENTATION docs in the same PR when contracts change.
9. Attach requirement IDs, test evidence and known limitations to PR.

## Quality gates

M0 must provide canonical scripts for lint/format, strict TypeScript typecheck, unit tests, provider API integration, extension-host tests, Webview/message tests, production build and VSIX packaging/install smoke test. Exact names must match package.json and CI. A skipped gate requires documented reason and reviewer approval.

## Diagnostics and release

Log correlation ID, provider, host alias, operation, duration and safe status/rate metadata only. Distinguish transport failure, provider HTTP error and mutation outcome unknown. After ambiguous comment/merge timeout, refresh server state before retry. For stale inline comments, preserve draft text and require refreshed diff context.

Before release run P0 tests independently on GitHub.com and GitLab.com; test every Enterprise/Self-Managed version claimed; smoke-test Windows/macOS/Linux; review Webview CSP/sanitization/message validation, SecretStorage and log redaction; measure activation/large-diff responsiveness; package VSIX and install in a clean profile; publish supported versions, token permissions and limitations.

## Definition of done

Requirements implemented, traceability updated, tests pass, provider-specific limitations documented, secrets protected and review evidence attached. Compilation or success against one provider does not establish cross-provider verification.
