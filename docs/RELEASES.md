# GitHub Release Guide

SPTMS uses Semantic Versioning (`MAJOR.MINOR.PATCH`). The initial repository version is `1.0.0`.

## Prepare a release

1. Update `version` in `package.json`.
2. Update `CHANGELOG.md` with user-visible changes and migration notes.
3. Run `npm ci` (when a committed npm lockfile exists), `npm test`, `npm run typecheck` and `npm run build`.
4. Review the diff; ensure secrets, `.env` files, generated output and personal data are not included.
5. Commit the release preparation.

## Create a version tag

For version 1.0.0:

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.0.0"
git tag -a v1.0.0 -m "SPTMS v1.0.0"
git push origin main
git push origin v1.0.0
```

Replace `main` with the repository's default branch if different.

## Publish on GitHub

1. Open the repository on GitHub.
2. Go to **Releases → Draft a new release**.
3. Choose the pushed tag (for example, `v1.0.0`).
4. Use the matching heading and notes from `CHANGELOG.md`.
5. Mark as a pre-release only if the version is explicitly experimental (for example `1.1.0-rc.1`).
6. Publish the release.

## Release notes checklist

- Summary of major changes.
- New features and fixes.
- Breaking changes and migration steps, if any.
- Known limitations (especially in-memory state and demo-only integrations).
- Test/build status and supported Node version.

Do not claim a hosted production deployment or attach binaries unless those artifacts have actually been built and tested.
