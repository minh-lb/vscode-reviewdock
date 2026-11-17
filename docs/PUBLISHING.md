# Publish ReviewDock to the VS Code Marketplace

ReviewDock uses publisher **`minhluu`** and GitHub Actions Trusted Publishing (OIDC). The release workflow is [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). It publishes a **stable GitHub Release**, not every push or pull request, and does not require a long-lived Marketplace Personal Access Token.

## One-time Marketplace setup

After the publishing workflow is merged to `main`:

1. Open [publisher `minhluu`](https://marketplace.visualstudio.com/manage/publishers/minhluu) and select **Trusted Publishing**.
2. Select **Create** and enter:
   - **Policy name:** `ReviewDock release` (descriptive; any name is fine).
   - **Repository owner:** `minh-lb`.
   - **Repository:** `vscode-reviewdock`.
   - **Workflow:** `publish.yml`.
   - **Environment:** leave empty (this workflow does not use a GitHub environment).
3. Save the policy. No `VSCE_PAT` or other GitHub Actions secret is needed.

**Private repository:** the first successful OIDC token exchange must occur within **48 hours** of creating the Trusted Publishing policy. Create the policy when you are ready to publish; if it expires, reopen it from Marketplace. The first successful token exchange permanently activates the policy.

## Release checklist

1. Confirm the implementation, package contents, and Marketplace listing are ready for the public. Existing automated tests do not prove live GitHub/GitLab provider behavior or full Marketplace readiness.
2. On a pull request, bump the version with the matching npm script. Use patch for a fix, minor for a backward-compatible feature, or major for a breaking change:

   ```sh
   npm run version:patch
   # or: npm run version:minor
   # or: npm run version:major
   ```

   These scripts update `package.json` and `package-lock.json` through npm. They do not create a Git commit or tag. Review and commit both changed files with the release preparation, then merge only after CI succeeds.
3. From `main`, create and **publish a non-prerelease GitHub Release** with tag `v<version>`. For example, manifest version `0.1.1` uses tag `v0.1.1`.
4. The [publish workflow](../.github/workflows/publish.yml) checks out that tag, verifies its version and publisher, runs source checks and tests, builds and packages the VSIX, validates the archive contents, then publishes that exact VSIX using `@vscode/vsce@4.1.0 publish --oidc --packagePath <file>`.
5. Check the workflow run and the `minhluu.reviewdock` extension in Marketplace. If the version has already been published, increment the version before publishing again.

Draft releases and prereleases do not trigger a Marketplace publication (prereleases are skipped). Pull requests only validate with the existing CI workflow.

The repo currently locks `@vscode/vsce@3.9.2` for development/packaging, which does **not** support OIDC. The publish job deliberately runs `@vscode/vsce@4.1.0` explicitly so OIDC works without changing the existing lockfile or affecting ordinary CI.

## Manual publish (fallback)

If OIDC is not configured yet, prepare a VSIX locally:

```sh
npm ci
npm run build
npm run package
```

Then upload the resulting `.vsix` through [Manage Extensions](https://marketplace.visualstudio.com/manage/publishers/minhluu) under **New Extension → Visual Studio Code**. This is manual publishing and is independent of the GitHub Actions workflow.

## References

- [VS Code publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace Trusted Publishing](https://developer.microsoft.com/blog/trusted-publishing-visual-studio-marketplace/)

## Current readiness

The extension is marked `preview: true`. Its manifest includes a PNG Marketplace icon, keywords, an explicit Restricted Mode declaration and desktop/remote workspace-host placement. Packaging builds fresh bundles and validates the resulting archive. License, privacy, changelog and bundled React license notices are included.

The current proprietary license notice preserves the previous closed-source intent; review it before distributing. It is not an open-source license. Confirm that publisher `minhluu` belongs to your Marketplace account before creating a release. A checked-in publisher ID and workflow do not establish ownership or a working Trusted Publishing policy.

The GitHub repository is currently private, so its README documentation, homepage and issue links are inaccessible to Marketplace users without repository access. Provide a public support/documentation destination before a broad public launch. The packaged README, license and privacy files remain available inside the VSIX.

The package and automated checks establish a local preview candidate, not production acceptance. Run the live-provider and host acceptance checks in `IMPLEMENTATION-STATUS.md` before a stable public launch. No Marketplace upload, account policy creation or release is performed by the local readiness checks.

## Local validation evidence (2026-11-17)

- Typecheck, lint, formatting, traceability and 128 tests passed after integrating `origin/main`.
- VS Code activation/contributed-metadata smoke passed on macOS with 1.140.0 and 1.146.0 using extension ID `minhluu.reviewdock`.
- The 124.34 KB VSIX contains 13 files; required metadata/assets/notices match the manifest. Deliberately altered fixture archives missing the license, using another publisher or containing an `.env` file were rejected.
- Installation into an isolated VS Code profile succeeded; the CLI reported `minhluu.reviewdock@0.1.0`.
- The production dependency audit reported zero known vulnerabilities. The full development audit still reports three moderate entries through VSCE/glob/minimatch; those packaging dependencies are absent from the VSIX. The latest registry VSCE 4.1.1 still depends on the affected minimatch range, so no forced incompatible override was applied. Track [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) upstream. This is advisory-database evidence, not proof of absence of vulnerabilities.

No live provider writes, remote CI run for this local commit, Trusted Publishing exchange or Marketplace publication was performed.
