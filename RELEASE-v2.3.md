# MemeSpace v2.3 — Identity Foundation release notes

## What changed

v2.3 keeps the live binary head/brain renderer and v2.2 module workspaces, then adds a local account foundation:

- Identity Center for registration, sign-in, initial legacy-owner password claim, account summary and sign-out.
- `accounts` and `sessions` SQLite tables with a repeatable forward migration.
- Node.js `scrypt` password hashes with independent salts, normalized case-insensitive identifiers, generic login errors and a five-failure/15-minute lockout.
- Opaque random session tokens stored only as SHA-256 hashes, HttpOnly loopback cookies, 30-day absolute expiry, seven-day idle expiry and bounded last-seen updates.
- Active-session list, one-session revoke, revoke-all-other-sessions and password rotation.
- JSON account export that excludes password hashes, salts, raw tokens, token hashes and request headers.
- Confirmed account deletion scoped to the current owner. `local_seedy` additionally requires `DELETE LEGACY OWNER DATA`.
- v2.2 signed-cookie compatibility bridge. Existing module rows continue to use their original `user_id` values.
- Profile and chat name fallbacks from the account display name, plus Identity Center prompts in the shell, chat, profile and lesson notes.

## Endpoints

All auth mutations are Node runtime routes and require the local loopback/origin policy.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create a local account and first session. |
| `POST /api/auth/login` | Authenticate and issue a fresh session. |
| `POST /api/auth/logout` | Revoke the current session and clear cookies. |
| `GET /api/auth/session` | Return the safe account summary and session count. |
| `POST /api/auth/password` | Claim a migrated legacy password or rotate a current password. |
| `GET /api/auth/sessions` | List safe labels and timestamps for this account. |
| `DELETE /api/auth/sessions/:id` | Revoke one owned non-current session. |
| `POST /api/auth/sessions/revoke-all` | Revoke every other active session. |
| `GET /api/auth/export` | Download owned application data without secrets. |
| `GET/DELETE /api/auth/account` | Read the safe account or perform confirmed deletion. |

## Upgrade notes

1. Stop the old server and extract v2.3 to a new folder.
2. Copy the complete existing `data` folder beside the new `package.json`, or keep the earlier `.wrangler` folder for automatic import.
3. Run `SETUP-WINDOWS.cmd`, then `START-WINDOWS.cmd` (Node.js 24+).
4. Open the Identity Center from **SIGN IN**. The migrated owner is preserved with an unusable `legacy_unset$…` marker and must set an initial password once. New accounts can register normally.

There is deliberately no email delivery or password-reset adapter in this local release. Keep a database backup before deletion or password changes. Wallet connection remains separate from MemeSpace identity and never requests a signature or private key.

## Verification record

The release verification commands and results for this source export:

- `MEMESPACE_TEST_MODE=serve node scripts/local.mjs test`: **12 passed, 0 failed** (database, auth service, UI contract and compiled startup/module persistence).
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed**.
- `node scripts/local.mjs build`: **passed**; Next listed all auth routes, including sessions/[id] and sessions/revoke-all.
- The API acceptance flow covered registration → duplicate rejection → login → session list/revoke-all → module writes → export secret filtering → password change → logout/relogin → scoped deletion → legacy owner initial-password claim.
- Direct Windows execution, external email delivery, and an external Phantom extension were not available in the build environment. The browser verification CLI was not installed in this source workspace; compiled HTTP/startup checks were used instead.
