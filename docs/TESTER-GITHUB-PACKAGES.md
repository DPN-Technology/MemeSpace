# MemeSpace tester distributions

**Every new published GitHub release** with a tag like `v2.6.0` triggers [Publish MemeSpace release distributions](../.github/workflows/publish-release-distributions.yml). Two jobs produce:

- **Windows launcher ZIP** under the matching GitHub **Release → Assets** as `MemeSpace-v2.6.0-Windows-Tester.zip`.
- **Versioned GitHub Packages container** `ghcr.io/dpn-technology/memespace-tester:2.6.0`.

The workflow selects the **published release's tag and exact Git commit**. It creates a version-specific Windows launcher that downloads that commit, rather than the current `main` branch. The container is built from the same release commit. The ZIP is a bootstrap launcher that requires Node.js 24+ and network access for first-time setup; it is not an offline EXE.

## How to publish

1. Update the app and bump `package.json` version for the planned release.
2. Publish a GitHub Release from the repository with tag `vX.Y.Z` pointing at the desired commit. Or run **Actions → Publish stable release**, which creates a release from the current package version.
3. Wait for **Publish MemeSpace release distributions** to finish successfully.
4. Give testers the **Releases → Assets** ZIP. Technical testers can use **Packages** for Docker.

**Important:** GitHub workflows using `GITHUB_TOKEN` to create a Release do not cause a separate `release.published` workflow event. The distribution workflow also listens for successful completion of **Publish stable release** and verifies that the new release points at the same commit. No personal GitHub token is required.

For a re-run, open the distribution workflow and choose **Run workflow** with an existing tag. It will replace only that release's matching ZIP asset and versioned container image.

Security: packaging checks out only trusted templates on `main` and uses the release commit for app source. The container runs locally and does not expose a public website by default.

## Windows tester

1. Download the corresponding `MemeSpace-vX.Y.Z-Windows-Tester.zip` asset.
2. Extract it and install Node.js 24+ if needed.
3. Double-click `LAUNCH-MEMESPACE.cmd`; keep the terminal open.
4. The local web app opens at http://127.0.0.1:5173.
5. Optionally run `LAUNCH-CONTROL-CENTER.cmd` for separate administrative testing.

## Docker tester

```sh
docker volume create memespace-tester-data
docker run --rm --name memespace-tester -p 127.0.0.1:5173:5175 -v memespace-tester-data:/app/data ghcr.io/dpn-technology/memespace-tester:2.6.0
```

Replace `2.6.0` with the version you want. For private images, testers must have read access and authenticate to GHCR. The Control Center remains separate. Do not share real member databases, staff credentials, or recovery codes.
