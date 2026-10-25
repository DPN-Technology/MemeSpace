# MemeSpace // Oracle Cloud Always Free ARM64 staging deployment

> **Owner:** DPN Technology · **Tracking:** [Launch Control #41](https://github.com/DPN-Technology/MemeSpace/issues/41) · **Implementation:** [PR #43](https://github.com/DPN-Technology/MemeSpace/pull/43).
> **Release state:** ARM64 staging **provisioning instructions**. Do **not** claim a live URL, persistent-data proof or payment approval until independently verified.

## Verified Oracle limits — October 2026

Per [Oracle Always Free documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), the **VM.Standard.A1.Flex Ampere ARM** allowance in the tenancy **home region** is 1,500 OCPU-hours and 9,000 GB-hours monthly: approximately **2 OCPUs and 12 GB RAM continuously**. This supersedes older 4-OCPU/24-GB statements. OCI also includes **200 GB combined boot/block storage** in the home region; a typical VM boot disk consumes **50 GB** of that allotment. Free capacity is **not guaranteed**; an "out of host capacity" error is not a code defect. Oracle may reclaim idle Always Free instances. Other choices, additional usage, domains or services may incur charges. Confirm every OCI screen says **Always Free eligible** and verify estimated price before submitting.

**Staging shape:** one **VM.Standard.A1.Flex** at **2 OCPUs / 12 GB**, 50-GB boot volume, **Ubuntu 24.04 LTS ARM64 (aarch64)**. One server, one Node/SQLite app, one private database volume, Caddy on TCP 80/443. Avoid both paid shape upgrades and extra instances unless separately approved. An ordinary AMD E2 micro (1 GB) is not a suitable container-build target.

## Part 1 — Create Oracle resources in the console

1. Sign in or register at [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/). Complete Oracle's identity/payment-method verification **in Oracle's own UI**, not GitHub or chat. Choose your **home region** deliberately; Always Free compute/storage must be in that region. Review quota and billing alerts before creating anything. We cannot create or verify OCI account resources from this repository.
2. In **Networking → Virtual Cloud Networks**, create a VCN with **internet connectivity** using Oracle's VCN wizard. Use a **public subnet** with an internet gateway and default route (0.0.0.0/0) through that gateway. Avoid opening any database/admin ports.
3. In **Compute → Instances → Create instance**, name it `memespace-staging-a1`. Choose an **Always Free-eligible Ubuntu 24.04 ARM64 image** and **Ampere → VM.Standard.A1.Flex**. Allocate **2 OCPUs and 12 GB RAM**. Keep the normal 50-GB boot volume, making sure your total Always Free block allocation remains under 200 GB.
4. Attach the new VCN/public subnet and **assign a public IPv4 address**. Keep instance metadata privileges/default instance principals off unless required. Generate a fresh **SSH key pair**, download and securely store the private key on your PC, and use public-key SSH rather than passwords. Do not paste private keys, Oracle API keys or passwords into GitHub/ChatGPT.
5. Configure either the subnet's **security list** or a dedicated **network security group**: stateful **TCP 22 only from your current public IP/32**, TCP **80 and 443 from the internet** for HTTP/HTTPS and ACME; allow normal established outbound connections. **Never expose TCP 5173/5174, database ports, 2375/2376 or Docker APIs.** Optionally omit SSH access from public internet entirely if using OCI Bastion. Enforce the same host-layer rules if its OS firewall blocks 80/443; **do not disable/firewall-flush** just to make the site work.
6. Click **Create** only after the Oracle pricing estimate says you are using Always Free resources. Note the **public IPv4 address** once the instance status becomes Running.

**Capacity errors:** Try another availability/fault domain in the **home region**, or retry later. Do **not** silently switch to paid Pay As You Go, an AMD micro or a non-home region. See [Oracle's capacity troubleshooting](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/troubleshooting-out-of-host-capacity.htm).

## Part 2 — Connect from a Windows PC

Use PowerShell. Replace the bracketed placeholders; the SSH key remains on your own machine.

~~~powershell
ssh -i "C:\Users\YOUR_USER\.ssh\memespace-oracle.key" ubuntu@YOUR_VM_PUBLIC_IP
~~~

The default username for an Oracle Ubuntu platform image is typically `ubuntu`; verify the image's SSH-login help in the console if yours differs. On the VM:

~~~bash
sudo apt-get update
sudo apt-get install -y git
git clone --branch deploy/launch-control-staging-foundation https://github.com/DPN-Technology/MemeSpace.git
cd MemeSpace
# Confirm commit and PR checks before executing scripts from the checkout:
git rev-parse HEAD
sudo bash deploy/oracle/prepare-ubuntu.sh
uname -m          # aarch64
sudo docker compose version
~~~

The setup script requires **Ubuntu 24.04/aarch64** and installs Docker Engine + Compose from [Docker's official signed Ubuntu apt repository](https://docs.docker.com/engine/install/ubuntu/). It does **not** grant Docker root privileges to the SSH user or modify network/SSH firewall rules. Review scripts before running them with sudo.

## Part 3 — Domain, HTTPS and private staging login

Choose a domain/subdomain you own such as `stage.yourdomain.com`. At your DNS provider, create an **A record** pointing to the OCI VM public IPv4 address. Avoid a DNS/CDN proxy until Caddy has successfully obtained its ACME certificate. DNS, OCI ingress rules **and** any Ubuntu firewall must permit TCP 80/443; the Docker app itself only lives on the internal Compose network.

Create an HTTP Basic-auth hash (enter the password interactively; the plaintext should **not** enter your shell history):

~~~bash
sudo docker run --rm -it caddy:2.10.2-alpine caddy hash-password
mkdir -p deploy/staging
umask 077
nano deploy/staging/.env
~~~

Place these three values into `deploy/staging/.env` using the actual domain, a unique viewer name, and the **full hash** output above, surrounded by single quotes:

~~~dotenv
STAGING_DOMAIN=stage.yourdomain.com
STAGING_BASIC_USER=memespaceviewer
STAGING_BASIC_PASSWORD_HASH='$2a$14$PASTE_YOUR_GENERATED_HASH'
~~~

The example hash is a placeholder only. Preserve the dollar signs. `.env*` is gitignored; also run `chmod 600 deploy/staging/.env`. Do **not** configure merchant credentials, Stripe/processor keys, wallet signing keys or payout secrets. The current staging build contains no enabled real-money checkout, financial ledger or paid entitlements.

## Part 4 — Validate host and start the application

Run these commands from the `MemeSpace/` checkout:

~~~bash
bash deploy/oracle/check-host.sh
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml up -d --build
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml ps
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml logs --tail=100 app proxy
~~~

The first build can take time on the free ARM VM. The Compose stack contains **only the public app and Caddy**. It does **not** start the local-only staff Control Center, which needs a separately approved remote-access design.

From your own PC, open `https://stage.yourdomain.com`. You should see the browser's staging-password challenge first; after login, the normal MemeSpace interface should load. Verify from an unprivileged network that **without credentials the website responds 401**, not a public site.

To verify the HTTPS service from your VM or PC without saving plaintext credentials, run `curl -I https://stage.yourdomain.com/` (401 expected) and `curl -u memespaceviewer -fsS https://stage.yourdomain.com/api/health` (curl prompts for the password). Expected authenticated health body: `{"ok":true,"runtime":"node","storage":"sqlite"}`.

If you have Node 24 installed on your PC, an alternative full smoke test is `node scripts/staging-smoke.mjs https://stage.yourdomain.com` with `STAGING_SMOKE_BASIC_USER`/`STAGING_SMOKE_BASIC_PASSWORD` supplied as protected environment variables. Never pass passwords as CLI arguments or commit them.

## Part 5 — Persistence, backup, recovery and security evidence

1. Register a **throwaway staging account**; sign in, navigate the Meme Mind, enter an **unpaid** arcade cabinet; test mobile and desktop.
2. Restart the app **without deleting the database volume**:

~~~bash
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml restart app
~~~

Confirm the same account still exists and can sign in. Do **not** run `docker compose down -v`; that deletes the data volume.

3. Capture a **consistent SQLite online backup** (the script uses `node:sqlite.backup`, not unsafe filesystem copying of a live WAL file):

~~~bash
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml exec -T app node deploy/oracle/backup-sqlite.mjs
~~~

The file appears in the **persistent** `/app/data/snapshots/` directory. This is a **temporary on-VM safety copy only**, not a complete backup strategy: export it securely, encrypt it, store it in a private **off-instance/off-site** location, establish retention, and perform a restore drill in an isolated VM. Never put player data or backups in the public repo or CI artifacts. If the separate admin service is introduced later, independently preserve its control DB **and matching MFA key**.

4. Record the **tested Git commit SHA**, site URL, screenshots (without secrets), Docker health, auth regression results, restore results and any incidents in **Issue #41**. Treat single-VM availability, rate limits, abuse protection and Oracle idle-reclamation policy as launch risks.

### Go/no-go conditions

- [ ] Oracle VM actually provisioned in **Always Free** home region; 2-OCPU/12-GB ARM verified.
- [ ] OCI security rules allow only scoped SSH and public 80/443; 5173/5174 never public.
- [ ] HTTPS DNS resolves and Caddy's authentication gate works; no unauthenticated access to the site.
- [ ] `linux/arm64` CI container and latest main PR CI/security gates pass.
- [ ] Test member login and SQLite persistence survive app restart.
- [ ] Encrypted off-instance backup and restore drill verified.
- [ ] Deploy URL + full SHA documented in Issue #41.
- [ ] **Payments OFF** until processor/jurisdiction/legal approvals, server-validated purchase entitlements, refunds, treasury reconciliation, abuse controls, and an explicit production go-live approval.

Oracle free-tier shape, storage and service availability may change; always use the live [Oracle Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

**DPN Technology // Develop · Pioneer · Navigate // Stage only — no financial processing**
