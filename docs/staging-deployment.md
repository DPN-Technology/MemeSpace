# MemeSpace // staging deployment runbook

**Launch Control:** [Issue #41](https://github.com/DPN-Technology/MemeSpace/issues/41)
**State:** deployment package, **not evidence of an active public deployment**.

This is the first deployable infrastructure slice. It uses **a single Node.js 24/Next.js instance**, native SQLite on a persistent Docker volume, and a Caddy HTTPS reverse proxy with **HTTP Basic authentication** in front of the entire preview. Caddy obtains and renews a TLS certificate after DNS is configured. The app is **not** a horizontally scaled stateless service: do not add replicas while using local SQLite.

**Not enabled:** live payments, credits with financial value, treasury transactions, gambling, token operations, NFT minting, or public staff Control Center. Browser-local arcade records are **not** suitable as verified paid entry entitlements.

## Preconditions

- An operator-controlled Linux VM/VPS with Docker Engine and Docker Compose plugin, accessible via SSH; DNS A/AAAA record for the staging hostname pointing at the VM.
- Open inbound TCP 80 and 443 for ACME and HTTPS. Keep SSH restricted. The app's TCP 5173 must **not** be published from the host.
- A hostname owned by MemeSpace, e.g. stage.your-domain.example, and permission to create its DNS records.
- Capacity sufficient for the Node build; a copy of the repository checked out from the trusted, reviewed commit.
- A unique, strong staging HTTP Basic username and password, stored locally as operator secrets and never in Git.
- An encrypted **off-host backup location** and operator responsible for recovery. Docker named volumes alone do not constitute backups.

## Configure

From the repository root on the staging VM:

1. Check out the reviewed deployment commit. Review files and confirm latest CI/security gates.
2. Run `docker run --rm -it caddy:2.10.2-alpine caddy hash-password` and enter a unique staging password interactively. Copy its bcrypt output.
3. Create **`deploy/staging/.env`** (git-ignored by the repository's global `.env*` pattern) with the settings below. Put the bcrypt output in **single quotes** so dollar signs are preserved.

~~~dotenv
STAGING_DOMAIN=stage.your-domain.example
STAGING_BASIC_USER=stagingviewer
STAGING_BASIC_PASSWORD_HASH='$2a$14$REPLACE_WITH_HASH_GENERATED_BY_CADDY'
~~~

Do not copy the placeholder hash into a live environment. Confirm your chosen Caddy image tag/digest through the trusted release channel before deployment. Do not commit a real password, credentials or environment file.

## Bring up staging

~~~bash
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml config --quiet
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml up -d --build
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml ps
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml logs --tail=100 app proxy
~~~

Wait for `app` to be healthy and Caddy to obtain TLS. Staging should return an authentication challenge to unauthenticated visitors rather than expose the site. For a noninteractive read-only test, supply the **plaintext** staging credentials to the command through your protected shell environment (do not add them as command-line arguments or print them):

~~~bash
STAGING_SMOKE_BASIC_USER='stagingviewer' STAGING_SMOKE_BASIC_PASSWORD='REDACTED' \
  node scripts/staging-smoke.mjs https://stage.your-domain.example
~~~

Do not store the plaintext password in the repository or a CI job with untrusted PR code. `/api/health` must report `ok: true`, `runtime: node`, `storage: sqlite`. Then manually test registration, login, account session persistence, navigation and an **unpaid** skill-game session on desktop/mobile.

## Safety boundaries

- `MEMESPACE_PUBLIC_ORIGIN` is exactly the HTTPS staging origin (no trailing slash) and enables external same-origin auth without permitting arbitrary request origins. `MEMESPACE_BIND_HOST=0.0.0.0` is rejected by the app without a valid HTTPS public origin. Local defaults remain loopback-only.
- Caddy is the only published service. The app listens only on the private Compose network; HTTP Basic auth is an *additional staging access gate*, not app identity.
- The administrative Control Center is **not published** and is not started by this Compose stack. Remote staff access requires a separately reviewed secure operator-access design before go-live. Do not proxy or expose the admin service directly.
- The SQLite volume `memespace_data` is required for all member data and session material. Never use `docker compose down -v` for upgrades or rollback.
- Do not claim this is production approved. Merchant acceptance, legal review, signed payment webhooks, financial audit trail, verified entitlement ledger, refund/chargeback behavior, backups, and disaster recovery must be completed for real-money launch.

## Backups / restore / rollback

**Before changes**, stop writes or use SQLite's backup API to make a consistent copy of `/app/data/memespace.sqlite`; filesystem-copying a live WAL database is unsafe. Store the backup (including any additional admin DB + MFA key if Control Center is eventually introduced) **off the VM**, encrypted. Practice restoring to a clean, isolated VM with a matching app version. Avoid backing up exclusively inside the Docker volume.

For a code rollback, redeploy the previously tested image/commit **without deleting the named volume**. Note that older application versions may not support new schema migrations; plan database compatibility before upgrading and restore from the verified snapshot when required.

Stop exposure temporarily with:

~~~bash
docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml stop proxy
~~~

## Release evidence checklist

- [ ] Host, domain, DNS, TLS certificate and project ownership verified.
- [ ] Staging HTTPS URL reachable and gated by HTTP Basic auth.
- [ ] Running revision/SHA documented, Compose services healthy, origin/auth tests green.
- [ ] Durable volume restart test shows registered accounts persist.
- [ ] Sensitive data not exposed in logs, repository, or generated image.
- [ ] Off-host encrypted backup + successful restore drill recorded.
- [ ] Production staff access architecture, payment/treasury review and go/no-go approval completed **before** public paid release.

Do not mark Launch Control's “staging deployed” checklist complete until URL, SHA and observed evidence are posted.
