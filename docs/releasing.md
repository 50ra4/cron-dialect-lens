# Releasing

**English** | [日本語](./releasing.ja.md)

Releases are cut from `main`, using Node.js 24 and the locked dependencies in
`package-lock.json`.

## 1. Bump the version and verify

Specifying the next version updates `package.json` and `package-lock.json`
together.

```sh
npm version 0.1.0 --no-git-tag-version
npm ci
npm run check-type
npm run lint
npm run test
npm run package
npm run e2e
```

`npm run package` builds, verifies the manifest, and stores only the
distributable files from `extension/` in `extension.zip` at the repository
root. Development icons are excluded. The build and package checks require
`THIRD_PARTY_LICENSES.txt`, including versioned copyright notices and complete
MIT terms for every direct and transitive runtime dependency enumerated from
`package-lock.json`. The same source, Node.js version, and lockfile always
produce a byte-identical zip. `npm run zip` is a compatibility alias.

Before tagging, complete [manual-test.md](./manual-test.md), verify that the
manifest matches [web-store-permissions.md](./web-store-permissions.md), and
review the privacy policy, listing copy, icon, and 1280×800 screenshot.

To inspect the artifact manually, unzip `extension.zip` and load the extracted
directory in Chrome via `chrome://extensions` → **Load unpacked**.

## 2. Push main and the tag

After the version bump is reviewed and merged, tag the latest `main` with a
`v`-prefixed tag.

```sh
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

For prereleases, keep the package version and the tag in sync, e.g.
`1.1.0-rc.1` / `v1.1.0-rc.1`. If the tag and the `package.json` version do not
match, the Release workflow fails. The Chrome manifest records the numeric
core in `version` (`1.1.0`) and the full prerelease string in `version_name`.

After the tag is pushed, GitHub Actions runs the type check, lint, unit tests,
manifest verification, and the real-Chromium E2E. Only if everything passes is
a GitHub Release created, with auto-generated notes and `extension.zip`
attached.

Upload the verified `extension.zip` manually in the Chrome Web Store developer
dashboard only after the GitHub Release succeeds.
