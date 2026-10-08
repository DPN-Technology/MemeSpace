# MemeSpace local operations

[← Back to MemeSpace](../README.md)

Run, upgrade and recover the supported **Node.js 24+ / Next.js / native SQLite** installation. These instructions describe the current source; use the matching [release notes](https://github.com/DPN-Technology/MemeSpace/releases) for an older download.

**Jump to:** [Start](#start-the-apps) · [Upgrade](#upgrade-without-losing-data) · [Staff & MFA](#staff-access-and-mfa) · [Backup & recovery](#data-backup-and-recovery) · [Build & test](#build-and-test) · [Troubleshooting](#troubleshooting)

## Start the apps

### Windows

1. Install Node.js 24 or newer.
2. Extract the project into its own folder and open the folder containing `package.json`.
3. Run **SETUP-WINDOWS.cmd** to install locked dependencies and prepare the database.
4. Run **START-WINDOWS.cmd** and open **http://localhost:5173/** once the terminal says ready.
5. Run **START-ADMIN-WINDOWS.cmd** in a second terminal and open **http://127.0.0.1:5174/**.
6. For the first staff identity, copy the **setup code printed in the admin terminal**. Choose **Set up access**, create your staff identity and password, add the shown key to a time-based authenticator, and verify the six-digit code. Save the recovery codes before continuing.

Keep both terminals open. **Ctrl+C** stops the corresponding service. Control Center can run while the public app is stopped. There is no default admin password; a public member account does not grant admin access.

### macOS / Linux / terminal

From the project folder:

```sh
node scripts/local.mjs setup
node scripts/local.mjs start
```

In a second terminal, from the same folder:

```sh
node admin/server.mjs
```

`./start-admin.sh` also launches Control Center. First setup needs npm registry access; no paid API key, Cloudflare account or ChatGPT subscription is required. The optional wallet connection needs a compatible browser extension.

### Ports and data directory

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEMESPACE_PORT` | `5173` | Public app port; also tells Control Center where to check public-site health. |
| `MEMESPACE_ADMIN_PORT` | `5174` | Separate Control Center port. |
| `MEMESPACE_DATA_DIR` | `data/` in the project | Local platform and administrative data location. |

Use different free ports for the two services. Set the same `MEMESPACE_PORT` and `MEMESPACE_DATA_DIR` in both terminals if you override them. In the rest of this guide, `data/` means that configured data directory. Use the same browser address consistently: `localhost` and `127.0.0.1` have separate cookies and browser storage.

## Upgrade without losing data

1. Stop both the public app and Control Center.
2. Keep the old project folder unchanged as a rollback copy.
3. Extract the new release into a **new folder**.
4. **Before setup**, copy the **entire old `data` folder** beside the new `package.json`. This preserves member content, sessions, settings, staff identities and the matching MFA encryption key. If you use `MEMESPACE_DATA_DIR`, keep both services pointed at the preserved directory instead.
5. Run setup, then start the two apps separately. Migrations are additive.
6. Return using the same browser, website address and member identity to keep browser-only preferences, arcade records, challenges and credits.

### Earlier Wrangler data

If your original data is still under `.wrangler/state/v3/d1`, copy the old `.wrangler` folder into the new project before first setup. The launcher imports it only when `data/memespace.sqlite` does not already exist, and keeps the original intact. Wrangler/Workers are not part of the supported current launcher path.

### Preserved v2.2 owner

The `local_seedy` member identity and its content remain intact. A valid legacy v2.2 cookie can migrate once before an initial password is set; the unauthenticated one-click sign-in shortcut is closed.

If that browser session is gone and the legacy owner has **never set a password**, run **CLAIM-LEGACY-OWNER-WINDOWS.cmd** or:

```sh
node scripts/claim-owner.mjs
```

Enter the password in the local terminal; characters are hidden. Then sign in as `owner@localhost`, or the identifier printed by the command. This claims only an unclaimed legacy member identity. It does not reset an existing password or create a staff account.

Database content survives migration. Browser drafts and arcade records are identity-scoped; old unscoped drafts are not assigned to a different member.

## Staff access and MFA

| Role | Access |
| --- | --- |
| **System owner** | All controls, infrastructure settings, backups and staff administration. |
| **Administrator** | Overview, members, session revocation, moderation, announcements, game availability and audit. |
| **Moderator** | Overview, members, suspensions and community moderation. |
| **Observer** | Aggregate overview only. |

Every API enforces role permissions. The initial owner cannot be disabled through the panel. Staff invitations are bound to the invited email address and expire in **one hour**. Initial owner codes expire in **twenty minutes**; restart Control Center before owner enrollment for a fresh code. Authenticator enrollment must finish within **ten minutes**.

Member and staff identities, tokens and sessions are separate. Staff passwords use scrypt; authenticator secrets are encrypted with `data/admin/mfa.key`. Session tokens and recovery codes are stored as hashes. Admin sessions expire after **eight hours**, or **thirty minutes idle**. Sign-in/enrollment attempts are limited, and repeated credential failures temporarily lock the staff identity.

Keep the authenticator device clock automatic. A TOTP code cannot be reused; wait for a new code after signing out. Each recovery code replaces an authenticator code **once** and still requires your password. There is no email reset service. Preserve your password, authenticator, recovery codes and a private recovery copy of the admin directory and its key.

### Day-to-day operations

| Area | Behavior |
| --- | --- |
| Overview | Real counts, authenticated activity in the last five minutes, channel totals and a fourteen-day activity chart. No sample activity is inserted. |
| Members | Search/filter, inspect status, suspend or restore with a reason, and revoke sessions. Suspension takes effect on the next authenticated request. |
| Moderation | Review reports, hide and resolve, dismiss, reopen and record decision notes. |
| Community | Review messages across channels and hide/restore them. Hidden messages disappear from public chat and cannot be edited or reacted to through public endpoints. |
| Announcements | Draft, publish, edit and archive. Only published updates reach the Meme Mind; they refresh within 30 seconds. |
| Game Center | Pause or enable new cabinet visits. Changes need a reason and are audited; lobbies refresh within 30 seconds. Already open cabinets remain playable. |
| Staff & access | Invite staff, assign roles, disable/enable access, revoke invitations and end the owner's other sessions. |
| Audit | Search paginated events with actor, action, target, time, result, source and decision details. Requested and completed actions are separate entries. |
| System | Check reachability, database integrity, migrations, runtime and uptime; control registration/chat; create verified platform backups. |

Player records and credits remain on player browsers. Control Center does not provide verified global rankings, fabricated player analytics or controls over individual slot outcomes.

## Data, backup and recovery

| Location | Contents |
| --- | --- |
| `data/memespace.sqlite` | Members, sessions, profiles, chat, reports, saved items, announcements, settings and cabinet availability. |
| `data/admin/control.sqlite` | Staff identities, encrypted MFA secrets, sessions, invitations, recovery-code hashes and audit events. |
| `data/admin/mfa.key` | MFA encryption key; must be preserved with the matching admin database. |
| `data/session.key` | Legacy member-cookie compatibility key, if previously created. |
| `data/backups/` | Control Center platform snapshots and SHA-256 checksums. |
| Browser local storage | Identity-scoped drafts, arcade records, challenges, milestones and free-play credit history. |
| `backups/` in the project | Snapshots from `node scripts/local.mjs backup`. |

### Platform snapshots

**Control Center backups contain the platform database only. They do not contain the separate admin database or MFA key.**

Each Control Center snapshot is opened and integrity-checked, then saved with a SHA-256 checksum. Failed or unfinished snapshots are not listed as verified. Daily local backups run while the admin service is running. Snapshots are not automatically pruned; they are local, unencrypted files. Copy them to a private, encrypted destination for off-machine recovery.

### Complete recovery copy

Stop **both services**, then copy the **entire `data` directory** to a private backup location. Keep the admin database and its matching key together. Do not distribute this directory with source code. Browser-only data is separate and is not included in a database backup.

### Restore a platform snapshot

1. Stop both services.
2. Move the entire current `data` directory to a safe rollback location.
3. Create a fresh `data` directory and copy the chosen platform snapshot to `data/memespace.sqlite`.
4. Restore the matching `admin` directory and legacy `session.key`, if present, from your trusted recovery copy.
5. Do not mix old SQLite WAL/SHM files with the restored database.
6. Restart both apps and verify the expected records and staff access.

A backup may restore old valid sessions. Revoke sessions after recovery from a security incident. Replacing `mfa.key` with a new random key cannot decrypt existing staff authenticator secrets.

## Build and test

Setup installs the pinned pnpm toolchain through npm and the frozen lockfile. Do not use `npm ci`; the repository does not have an npm lockfile. Do not copy `node_modules` between operating systems.

```sh
node scripts/local.mjs build
node scripts/local.mjs serve
```

To run the full regression suite against the production build:

```sh
# macOS / Linux — after build
MEMESPACE_TEST_MODE=serve node scripts/local.mjs test
```

```powershell
# PowerShell — after build
$env:MEMESPACE_TEST_MODE="serve"
node scripts/local.mjs test
```

Without `MEMESPACE_TEST_MODE=serve`, the startup regression uses development mode. Tests use temporary databases and cover identity, MFA/replay protection, origins/CSRF, permissions, member/staff separation, moderation visibility, announcements, platform controls, recovery, module persistence and arcade engines.

For production browser coverage, build first, install the project's Playwright Chromium, then run the arcade UI suite:

```sh
node scripts/local.mjs build
npm exec -- playwright install chromium
node --test tests/arcade-ui.test.mjs
```

On Linux, Playwright may also need its system browser dependencies; use `npm exec -- playwright install --with-deps chromium` in a suitable development environment. The UI suite can use an existing browser executable through `MEMESPACE_CHROMIUM_EXECUTABLE`.

The standard quality commands are `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm security:gate`. If pnpm is not globally installed, use `npm exec --yes --package=pnpm@11.25.0 -- pnpm <script>`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Wrangler/Vite banner | You are starting an older source folder. Current supported launchers run Node directly. |
| Port already in use | Stop the older instance or choose free `MEMESPACE_PORT` / `MEMESPACE_ADMIN_PORT` values. Keep the site port consistent in both terminals. |
| Setup code missing or expired | Before the first owner is enrolled, restart Control Center and use the new code printed in its terminal. |
| Authenticator rejected | Check the device clock, wait for a fresh unused code, or use an unused recovery code with your password. |
| MFA encryption key missing | Restore the matching `data/admin/mfa.key` from a private backup. A new key will not recover the old secrets. |
| Cannot sign in | Use the launcher's exact address. `localhost` and `127.0.0.1` have separate cookie stores; member and staff identities are independent. |
| Dependency install fails | Check npm registry connectivity, then rerun setup. |
| Pinball or pool pauses | Use Resume. Both pause when focus is lost or Help opens. |
| Cabinet unavailable | Check Control Center → Game Center, then allow up to 30 seconds for lobby refresh. |
| Arcade records missing | Use the same browser, origin and member identity. Clearing browser storage removes local records. |
| SQLite experimental warning | Some Node 24 versions show this warning; it is not itself a startup failure. |

## Runtime and security boundary

The public Next.js app and separate Node HTTP Control Center bind to loopback. The supported installation is local. The two processes share an OS account and platform database; process separation does not protect against a compromised OS account.

Admin requests require an expected local host. Mutations require the exact admin Origin and a session-bound CSRF token. Admin cookies are HttpOnly and SameSite=Strict. Secure cookies and HSTS require an HTTPS deployment. Local audit triggers prevent application-level edits/deletions, but do not make files immutable to the computer owner.

Public hosting needs its own operational review, service identities/hosts, HTTPS, external access controls, encrypted off-machine backups and monitoring. The current local foundation does not include centrally managed authentication, a complete media-upload/scanning pipeline, or verified global game rankings. The optional wallet module remains non-custodial and does not move funds.

See the [security policy](../SECURITY.md), [Control Center design](control-center-design.md) and [third-party licenses](../THIRD_PARTY_LICENSES.md). Retain all geometry and code license files.
