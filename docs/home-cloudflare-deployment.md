# MemeSpace — Windows PC + Cloudflare Tunnel staging

> **Deployment mode selected October 23, 2026.** [Issue #41](https://github.com/DPN-Technology/MemeSpace/issues/41) · [Draft PR #43](https://github.com/DPN-Technology/MemeSpace/pull/43). **Not a live deployment.**

Use your Windows 10/11 computer as a **single-instance staging server**. Docker Desktop + WSL 2 run the Node 24 website and native SQLite on a persistent **Docker named volume**. A separate `cloudflared` container makes **outbound-only connections** to Cloudflare. **No router port forwarding** and no app/admin host ports are needed. Only the Cloudflare Access-protected hostname routes to `http://app:5173` on the private Compose network.

**IMPORTANT: Cloudflare Tunnel by itself is NOT an access control.** Publishing a hostname without an Access policy makes it reachable by the internet. Configure a Cloudflare **Access self-hosted application** and restrict it to named tester emails **before** creating the published tunnel hostname. The `tunnel` Compose profile is intentionally off by default. Do not enable it until you have verified Access is protecting the exact hostname. [Cloudflare's official guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

**PAYMENTS OFF:** This project has no approved live checkout, paid game entitlements or financial transfer system. Do not configure payment processor, treasury, wallet, casino or NFT credentials, do not offer games for money, and do not accept payments. Any future public paid product requires a separate go/no-go review.

## Step 1: Prepare the Windows computer

1. Confirm you have Windows 10/11 64-bit, virtualization enabled, enough free RAM and disk space, and a reliable always-on internet connection. **A sleeping, rebooting or powered-off PC means MemeSpace goes offline.** Check Windows power settings so it does not enter sleep while hosting. Keep Windows and Docker Desktop updated.
2. Install WSL 2 using Microsoft's supported Windows workflow. From **PowerShell as Administrator** when WSL is not yet installed: `wsl --install`, then restart Windows if prompted. To inspect: `wsl --status`.
3. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) with the **WSL 2 / Linux containers** backend. Start Docker Desktop; wait for Engine Running. Test from PowerShell:

~~~powershell
wsl --status
docker version
docker compose version
docker info --format '{{.OSType}}'
~~~

The last command should print `linux`. Do not enable Docker's unauthenticated remote TCP API. Docker Desktop's commercial-use licensing may apply to certain larger organizations, despite Cloudflare Tunnel itself not needing an infrastructure subscription.

4. Decide which Windows user account owns the VM/data; enable full-disk encryption (for example BitLocker if available) and secure Windows sign-in. Docker Desktop manages persistent volumes inside its Linux VM. Avoid storing the main database in a Windows bind mount. Verify local disk backup/restore procedures before real users are involved.

## Step 2: Check out reviewed MemeSpace code

From PowerShell in a location on a drive with sufficient space:

~~~powershell
git clone --branch deploy/launch-control-staging-foundation https://github.com/DPN-Technology/MemeSpace.git
cd MemeSpace
git rev-parse HEAD
~~~

**Review the final commit and ensure GitHub CI, security gates and the Home Tunnel Packaging Gate are green before using any software for a wider test.** [PR #43](https://github.com/DPN-Technology/MemeSpace/pull/43) is still draft; do not merge automatically. The current Dockerfile remains `Dockerfile.staging` and works on the Windows x64 Linux container runtime.

## Step 3: Choose a Cloudflare-controlled hostname

1. In [Cloudflare Dashboard](https://dash.cloudflare.com/), add or select a **domain you own and control**. To publish a hostname through a managed Cloudflare Tunnel, the domain must be available in Cloudflare DNS (or a supported partial-CNAME setup). A GitHub Pages URL is not a substitute for a Cloudflare-controlled zone.
2. Choose a staging hostname, such as `stage.your-domain.com`. This must not be the eventual production public hostname.
3. In Cloudflare **Zero Trust → Access → Applications → Add an application**, select a **Self-hosted/public hostname** application. Cover that exact hostname and all paths, and create an **Allow** rule for **specific authorized tester email addresses only**. Configure an identity provider or One-time PIN. Do NOT create `Everyone`, blanket-email-domain allowances, public bypass rules, or exclusions for sensitive paths.
4. Save the Access app and review its policy. Unmatched visitors should be **denied** (or shown the Cloudflare Access login), with no access to MemeSpace itself. [Cloudflare Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).
5. Confirm Cloudflare Access plan limits/pricing for your intended tester group. Leave the tunnel route **unpublished** until Access exists.

## Step 4: Configure the protected application locally

Create an ignored file `deploy/home/.env` containing **only your public staging hostname**:

~~~dotenv
MEMESPACE_STAGE_HOSTNAME=stage.your-domain.com
MEMESPACE_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
~~~

The project ignores `.env*`; **no tunnel token belongs in this file**. No origin certificate is needed inside Docker in this design: browsers connect via Cloudflare HTTPS, and the `cloudflared` connector reaches the app over the private Docker network. The application validates the exact external HTTPS Host/Origin for mutations and marks auth cookies Secure.

Run PowerShell preflight from the MemeSpace repository:

~~~powershell
.\deploy\home\verify-host.ps1
~~~

This checks Docker's Linux engine, the hostname and Compose configuration, but starts **no** service. To build the private application and test its SQLite health before any internet exposure:

~~~powershell
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml up -d --build app
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml ps
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml exec -T app node -e "fetch('http://127.0.0.1:5173/api/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
~~~

Expected health JSON: `{"ok":true,"runtime":"node","storage":"sqlite"}`. This is an **internal container check**, not proof the site is online. No ports are bound on the Windows host.

## Step 5: Create a remotely managed Cloudflare Tunnel (without disclosing credentials)

1. In Cloudflare Dashboard, visit **Networking → Tunnels → Create tunnel**, name it `memespace-staging-home`, and select `cloudflared`.
2. Select Docker setup or **Add replica** and copy **only the token value** securely. Do not paste the token in chat, GitHub, PowerShell history, a commit, or screenshot.
3. From PowerShell in the repository root, execute the hidden-entry helper:

~~~powershell
.\deploy\home\set-tunnel-token.ps1
~~~

It prompts without displaying the token, writes an ignored `deploy/home/.secrets/tunnel-token` file with no BOM, and attempts to restrict the NTFS file ACL to your user. **Keep this file out of Docker build contexts and Git.** The runtime mounts it **read-only** as `/run/secrets/tunnel-token` and uses `--token-file` (supported by cloudflared 2025.4.0+). Anyone who gets the token could attach a new tunnel connector, so rotate it if compromised.

4. **Verify Access app protection exists on the exact hostname first.** Then, under your tunnel's **Routes → Add route → Published application**, select the same hostname. For the service URL, enter **`http://app:5173`** (NOT localhost: the connector runs in a different container alongside `app`). The connector resolves the Compose service name `app` across `home_private`. Do not create any admin route, wildcard route or TCP endpoint.
5. After the route is set up and Access policy verified, start the **opt-in** tunnel profile:

~~~powershell
.\deploy\home\install-access-watchdog.ps1
.\deploy\home\start-protected-tunnel.ps1
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml ps
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml logs --tail=60 tunnel
~~~

Before starting the tunnel, the operator explicitly installs a per-user **five-minute Windows Scheduled Task** that rechecks Access and **stops the tunnel if an anonymous route becomes exposed or the check fails**. This task is not guaranteed to run when the Windows owner has logged off, Task Scheduler is disabled, Docker Desktop is stopped, or Windows is offline. It does not automatically restart the tunnel. Use Task Scheduler to confirm that `DPN-MemeSpace-Access-Watchdog` is enabled, has a recent successful run, and is owned by the correct user. Keep your Windows login session and Docker Desktop running during the beta. The installer **does not** enable the tunnel by itself.

Set `MEMESPACE_ACCESS_TEAM_DOMAIN` to the **exact** team hostname from the Cloudflare Access login URL (e.g. `yourteam.cloudflareaccess.com`). A redirect to a *different* Cloudflare Access tenant is not accepted. Use the lowercase hostname only—not a URL.

The guarded launcher **requires you to type `ACCESS POLICY VERIFIED`**, runs the existing Docker/hostname preflight, then opens the tunnel and checks four public routes without cookies or credentials. It requires each to return an HTTPS redirect to the actual `*.cloudflareaccess.com/cdn-cgi/access/login` endpoint. **If even one is exposed, unreachable, or responds unexpectedly, the launcher stops the tunnel** without deleting the persistent volume. The checks detect anonymous exposure, but **cannot independently prove the email allow-list or detect future Cloudflare policy changes**. After policy changes or restarts, re-run the read-only check: `node scripts/home-access-boundary.mjs https://stage.your-domain.com yourteam.cloudflareaccess.com`. Do not start the tunnel using raw Compose commands; use the guarded launcher each time. If Cloudflare Access is configured to return 401 instead of a login redirect, this strict guard fails closed; review the Access setting rather than disabling the check.

Cloudflare should show tunnel status **Healthy**. Connections are outbound to Cloudflare (typically TCP/UDP 7844); there is **no router port-forwarding step**. Cloudflare may create the DNS CNAME for the published hostname automatically. Keep your router's RDP/SSH/backend ports closed or separately protected.

## Step 6: Verify remote access and safe operation

From a private/incognito browser or a different device/network:

1. Open `https://stage.your-domain.com`. You must encounter **Cloudflare Access first**, before the MemeSpace app. Test a disallowed address: it must not reach the app.
2. Sign in as an allowed tester; then use MemeSpace's *own* account sign-in. Confirm registration, cookies/session, responsive navigation and **free-only** arcade play.
3. Restart only the app and confirm the same account and saved content remain:

~~~powershell
docker compose --env-file deploy/home/.env -f deploy/home/compose.yml restart app
~~~

4. Verify updates do not destroy the `memespace_data` volume. **Never run `docker compose down -v`, `docker volume prune`, Docker Desktop Factory Reset, or delete the WSL disk if data matters.** Docker Desktop is not a managed HA database.
5. **Export an authenticated, encrypted backup to a different device** before inviting testers. Connect a removable backup drive (for example E:\MemeSpaceBackups) or mount a restricted independent network share (for example \\backup-host\memespace). The destination must exist. A network share hosted on the SAME computer does not qualify as off-PC disaster recovery. The exporter rejects ordinary local fixed-disk destinations. From PowerShell:

~~~powershell
.\deploy\home\export-encrypted-backup.ps1 -DestinationDirectory 'E:\MemeSpaceBackups'
~~~

The exporter creates a consistent SQLite snapshot in the private Docker volume, copies the snapshot into an access-restricted temporary Windows directory, encrypts it using **AES-256-GCM** with a per-artifact salt and scrypt-derived key, and independently authenticates the ciphertext and verifies SQLite integrity. The passphrase is collected via hidden input, passed over a private child-process stdin pipe (never on the command line or in Git), and must be stored separately in a trusted password manager. The encrypted .msvault file is placed on the selected removable/network destination. The temporary Windows plaintext copy is removed after use.

**Important:** A successful export alone does not prove the artifact is independent of the hosting PC. Disconnect/store removable media separately or use a remote backup server, validate independent recovery, and retain multiple copies.

6. **Practice an isolated restore on a different computer.** Install Node.js 24 and check out this reviewed repository on a separate recovery machine. Select an empty restore directory that is NOT a live Docker volume, then run:

~~~powershell
.\deploy\home\verify-encrypted-restore.ps1 -EncryptedFile 'E:\MemeSpaceBackups\your-backup.msvault' -RestoreDirectory 'C:\MemeSpace-Recovery-Drill'
~~~

The restore helper refuses a non-empty destination, requires explicit ISOLATED RESTORE confirmation, authenticates the encryption tag, checks SQLite integrity, and **does not replace the live database**. Record recovery evidence in Issue #44 **without uploading private SQLite backups, personal data or passwords**. The staging CI gate now also exercises encryption and restore using a disposable CI-only test database; CI is not proof of real off-PC recovery.

7. In PowerShell, check anonymous responses (do not send credentials):

~~~powershell
curl.exe -I https://stage.your-domain.com/
~~~

Unauthenticated requests should receive an Access challenge/redirect or denial—not the MemeSpace page or health JSON. If it is accessible anonymously, immediately stop the tunnel with `docker compose --env-file deploy/home/.env -f deploy/home/compose.yml stop tunnel`, then correct the Access policy. Cloudflare Access protections are external and cannot be proven merely by passing GitHub CI.


### Additional launch protection (Issue #44)

The home tunnel is deliberately opt-in. The new `deploy/home/start-protected-tunnel.ps1` refuses to start without an explicit operator confirmation and live anonymous outside-in checks. Neither a successful redirect nor CI automatically proves the configured identity-provider rules: **manually verify a denied outsider and approved named tester** before inviting participants. The scheduled watchdog now repeats the anonymous checks every **five minutes**, and makes a fail-closed request to stop the tunnel when the exact Cloudflare Access tenant rejects protection. This reduces the time a *detectable* misconfiguration could persist, but does **not** prove the configured email allow-list is correct, nor guarantee zero exposure between checks. A login page can still be presented under an overly permissive Access policy. **Manually test a disallowed identity and an allowed tester** before inviting users and after each policy change. If the watchdog process stops running, stop the tunnel manually.

Anonymous scans alone also cannot protect against policies that are weakened later; rerun them after configuration changes and stop the tunnel if any route becomes public.

## Daily use, updates and rollback

- Keep Docker Desktop running, Windows awake, outbound internet stable, and `cloudflared` updated after reviewing upstream security releases. `restart: unless-stopped` helps after Docker restarts but is not a Windows-uptime guarantee.
- To inspect health: `docker compose --env-file deploy/home/.env -f deploy/home/compose.yml ps`; inspect limited `logs --tail=100 app tunnel` without sharing tokens/session information.
- Before updating, create and move a backup off the PC, review PR gates and migration compatibility, then `git pull` and `docker compose ... up -d --build app`. Keep the named volume.
- To immediately take staging offline: `docker compose --env-file deploy/home/.env -f deploy/home/compose.yml stop tunnel`. For a full emergency block, disable/delete the published route or Access application **without deleting data**.
- Do not serve production paid games or treasury operations from the staging host. Home power loss, bandwidth limitations and shared-PC malware are real availability/security risks.

## Evidence still needed for Launch Control #41

- [ ] Windows Docker Desktop (Linux/WSL 2) local preflight successfully run.
- [ ] Cloudflare-owned hostname plus **specific-email Access policy** tested.
- [ ] Tunnel healthy; no inbound router/Windows ports published for MemeSpace or admin.
- [ ] Real HTTPS URL verified from outside home network, with denial for non-testers.
- [ ] Exact Cloudflare Access team domain confirmed, five-minute Windows watchdog installed and inspected in Task Scheduler, and periodic denial observed (actual Windows host evidence).
- [ ] Member session, game navigation and account data persist across app restart.
- [ ] A real encrypted .msvault artifact stored **off this PC** and an isolated restore on a separate computer documented; disposable CI backup validation alone is insufficient.
- [ ] Exact Git SHA, security gates and uptime observations recorded.
- [ ] Merchant/legal/payment approvals and a new authorized production release (not this staging package) before any money is accepted.

**Reference documents:** [Docker Desktop WSL2](https://docs.docker.com/desktop/features/wsl/), [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/), [Cloudflare Tunnel token-file](https://developers.cloudflare.com/tunnel/reference/run-parameters/), [Cloudflare Access self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).
