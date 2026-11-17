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
2. On a pull request, update **both** `package.json` and `package-lock.json` to the desired version. Merge only after CI succeeds.
3. From `main`, create and **publish a non-prerelease GitHub Release** with tag `v<version>`. For the current manifest version `0.1.0`, use tag `v0.1.0`.
4. The [publish workflow](../.github/workflows/publish.yml) checks out that tag, verifies its version and publisher, runs source checks and tests, builds and packages the VSIX, then publishes it using `@vscode/vsce@4.1.0 publish --oidc`.
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
