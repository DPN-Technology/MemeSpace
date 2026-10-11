# MemeSpace v2.5.0 — GitHub Packages tester distribution

This publishes an OCI container to **GitHub Packages → Containers**, not to GitHub Releases.
Image: `ghcr.io/dpn-technology/memespace-tester:2.5.0`.
The build explicitly checks out the published `v2.5.0` tag, even if `main` is newer.

## Publish

Merge this PR, then open **Actions → Publish MemeSpace Tester to GitHub Packages → Run workflow**.
The original release already exists, so adding a new workflow does NOT retroactively run its release trigger.
Wait for the workflow to finish successfully, then open the DPN Technology organization's **Packages** page.
Do not tell testers a package exists until the publish run has succeeded.

## Windows tester launch

1. Install and start Docker Desktop for Windows.
2. If the package is private, authenticate using a GitHub token with **read:packages** and access to this package:
   `echo YOUR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin`
   (avoid leaving real tokens in shared scripts, issue comments, or screenshots).
3. From PowerShell run:

```powershell
docker volume create memespace-tester-data
docker run --rm --name memespace-tester -p 127.0.0.1:5173:5173 -v memespace-tester-data:/app/data ghcr.io/dpn-technology/memespace-tester:2.5.0
```

Visit http://localhost:5173 after startup. Use Ctrl+C to stop. Data survives container restarts.
This is a local-only tester image. The app binds to loopback inside the container; if Docker port publishing does not forward to the loopback-bound app, the image will need a tested container-specific host binding before distribution.

## Scope and cautions

This is the public/member site; the Control Center is separate and not auto-exposed.
Keep it offline from the public internet. Avoid distributing real member/admin databases.
A GHCR container appears under GitHub Packages; a ZIP attached to a release does not.
Publishing through the workflow must be verified before the image can be described as available.
