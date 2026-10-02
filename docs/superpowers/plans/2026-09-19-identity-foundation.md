# MemeSpace Identity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-click local owner session with a secure, self-contained account and session foundation while preserving all existing MemeSpace data and delivering a polished Identity Center.

**Architecture:** Keep the local Node.js/SQLite runtime. Add `accounts` and `sessions` tables, a focused `lib/local-auth.mjs` service for password/session/account operations, and thin route handlers under `app/api/auth`. Use an opaque random session token in an HttpOnly cookie, storing only its SHA-256 hash. Keep the existing signed `local_seedy` cookie as a one-time compatibility bridge that upgrades into a database session.

**Tech Stack:** Next.js 16 App Router, Node.js 24 native `node:sqlite`, `node:crypto` `scryptSync`/`randomBytes`/`createHash`, React 19 client components, existing Radix/shadcn primitives, Node’s built-in test runner, and the existing local startup/build scripts.

**Spec:** `docs/identity-foundation-design.md`

## Global Constraints

- The local package remains bound to loopback and continues to reject cross-origin requests and forged hosted-identity headers.
- Existing `local_seedy` rows in `profiles`, `messages`, `likes`, `reports`, and `saved_items` must remain addressable without rewriting their `user_id` values.
- The migrated `local_seedy` account receives an unusable random `legacy_unset$...` password marker; a valid legacy session can set the initial password once.
- No outbound email, OAuth, hosted identity provider, password reset email, wallet custody, public network registration, or password/token logging is added.
- Node.js 24 or newer and the existing pinned dependency lockfile remain the runtime contract.
- Passwords are 12–128 characters; identifiers are normalized before uniqueness checks; request bodies remain within the existing 4096-byte limit unless a route needs a smaller limit.
- Every auth mutation uses the existing `sameOrigin` policy and returns safe generic public errors.

## Review Focus

- A duplicate identifier differing only by case or surrounding whitespace is rejected; Task 2 pins normalization and Task 3 checks the HTTP response.
- A legacy v2.2 cookie upgrades exactly once without creating a duplicate owner or changing old rows; Task 4 pins the migration path.
- A revoked or expired token cannot access profile/chat/saved APIs even when its cookie shape is valid; Task 2 and Task 5 test this at the resolver and HTTP levels.
- A failed-login storm does not reveal whether an account exists and eventually locks only the targeted account; Task 2 tests the counter and Task 3 tests the public response.
- Export and deletion never expose password hashes/session tokens and deletion cannot target another account; Task 3 tests both payload filtering and ownership predicates.

---

### Task 1: Add failing identity schema and migration tests

**Files:**
- Create: `drizzle/0002_identity_foundation.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `drizzle/meta/0002_snapshot.json`
- Modify: `db/schema.ts`
- Modify: `lib/local-database.mjs`
- Modify: `tests/local-database.test.mjs`

**Interfaces:**
- Consumes: the existing migration runner in `lib/local-database.mjs` and the current `profiles`/`saved_items` schema.
- Produces: `accounts` and `sessions` tables available through `openDatabase()`; all later tasks use the columns named below.

  `accounts(user_id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, display_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login_at INTEGER NOT NULL DEFAULT 0, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER NOT NULL DEFAULT 0)`

  `sessions(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER NOT NULL DEFAULT 0)`

- [ ] **Step 1: Write the failing migration tests**

Add a test that opens a fresh fixture and asserts both tables exist, the account email uniqueness is case-insensitive, and a seeded `local_seedy` profile causes exactly one legacy account with a `legacy_unset$` marker after migration. Add a second test that inserts profile/message/saved rows under `local_seedy`, reopens the database, and verifies every row remains unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/local-database.test.mjs`

Expected: FAIL because the identity tables and migration entry do not exist.

- [ ] **Step 3: Add the migration and Drizzle schema descriptions**

Create `drizzle/0002_identity_foundation.sql` with the two tables, `COLLATE NOCASE` on `accounts.email`, unique indexes on account email and session token hash, and indexes on `sessions.user_id` and `sessions.expires_at`. Add the journal entry and matching snapshot metadata. Add `accounts` and `sessions` exports to `db/schema.ts` using the same naming style as the existing tables. Extend `lib/local-database.mjs` with an idempotent post-migration `ensureLegacyOwner(db)` call that inserts `local_seedy`, `owner@localhost`, `Local Owner`, and a random `legacy_unset$...` marker only when that account is absent; it must never overwrite an existing account or module row.

- [ ] **Step 4: Run the migration tests to verify they pass**

Run: `node --test tests/local-database.test.mjs`

Expected: all database tests pass, including legacy row preservation and repeatable migration checks.

- [ ] **Step 5: Commit the schema slice**

```bash
git add drizzle db/schema.ts tests/local-database.test.mjs
git commit -m "feat: add local identity tables"
```

### Task 2: Build the account and session service with tests first

**Files:**
- Create: `lib/local-auth.mjs`
- Create: `tests/local-auth.test.mjs`
- Modify: `lib/local-session.mjs`

**Interfaces:**
- Consumes: `openDatabase()`/`adapter()` from `lib/local-database.mjs`, `dataDirectory()`, and the new tables from Task 1.
- Produces: `normalizeIdentifier(value)`, `validateRegistration(input)`, `hashPassword(password)`, `verifyPassword(password,encoded)`, `createAccount(db,input)`, `authenticateAccount(db,identifier,password)`, `issueSession(db,userId,label)`, `readAuthSession(headers)`, `revokeSession(db,sessionId,userId)`, `revokeOtherSessions(db,userId,currentSessionId)`, `listSessions(db,userId,currentSessionId)`, `changePassword(db,userId,currentPassword,newPassword)`, `exportAccount(db,userId)`, and `deleteAccount(db,userId,confirmation)`.

- [ ] **Step 1: Write failing service tests**

Cover normalization (`"  Diesel@LocalHost "` becomes `diesel@localhost`), 12-character minimum passwords, random salt/hash differences, correct and incorrect verification, account creation, duplicate normalized identifiers, generic authentication failure, lockout after five failures for fifteen minutes, successful-login reset, session issue/read/revoke, revoke-other-sessions, password change invalidating other sessions, export secret exclusion, and deletion ownership/confirmation checks.

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `node --test tests/local-auth.test.mjs`

Expected: FAIL because `lib/local-auth.mjs` does not exist.

- [ ] **Step 3: Implement password and identifier primitives**

Use `scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:32*1024*1024})`; encode as `scrypt$16384$8$1$<saltBase64url>$<hashBase64url>`. Generate a 16-byte random salt per account. Reject control characters, whitespace-only values, passwords outside 12–128 characters, and identifiers outside 3–254 characters. Return only safe account summaries from service functions.

- [ ] **Step 4: Implement account creation/authentication and lockout**

Normalize identifiers before lookup. On each failed password attempt, increment `failed_attempts`; at the fifth consecutive failure set `locked_until=Date.now()+15*60*1000`. Return one `AUTH_INVALID` error for unknown, deleted, locked, or wrong-password accounts. On success reset counters, set `last_login_at`, and return the account summary.

- [ ] **Step 5: Implement opaque sessions and compatibility lookup**

Generate a 32-byte raw token, store `sha256(token)` in `sessions`, and return the raw token plus session id to the route layer. Use a 30-day absolute expiry and 7-day idle expiry; `readAuthSession(headers)` parses the new cookie, looks up a non-revoked/non-expired session, updates `last_seen_at` at most once per five minutes, and returns `{userId,sessionId,account}`. Keep the existing HMAC cookie verifier as a compatibility-only branch: a valid legacy cookie returns `local_seedy` with `legacy:true`, allowing the route layer to issue a new opaque session while the UI requires the initial password claim.

- [ ] **Step 6: Implement session/account lifecycle operations**

Revoke by session id plus owner id, set the initial password only for a legacy session with the `legacy_unset$` marker or otherwise change password only after verifying the current password, and revoke all other sessions after either operation. Export profile/messages/reactions/reports/saved rows without hashes or token fields, and delete only rows owned by the requested account after exact confirmation `DELETE MY ACCOUNT`. Protect `local_seedy` with the same phrase plus a second `DELETE LEGACY OWNER DATA` confirmation.

- [ ] **Step 7: Run service tests to verify they pass**

Run: `node --test tests/local-auth.test.mjs`

Expected: all account, hashing, lockout, session, export, deletion, and compatibility tests pass.

- [ ] **Step 8: Commit the service slice**

```bash
git add lib/local-auth.mjs lib/local-session.mjs tests/local-auth.test.mjs
git commit -m "feat: add local account and session service"
```

### Task 3: Add auth route handlers and HTTP regression coverage

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/session/route.ts`
- Create: `app/api/auth/password/route.ts`
- Create: `app/api/auth/sessions/route.ts`
- Create: `app/api/auth/sessions/revoke-all/route.ts`
- Create: `app/api/auth/export/route.ts`
- Create: `app/api/auth/account/route.ts`
- Modify: `app/api/common.ts`
- Modify: `app/chatgpt-auth.ts`
- Modify: `tests/local-startup.test.mjs`

**Interfaces:**
- Consumes: Task 2 service functions and the existing `sameOrigin`, `body`, and `failure` helpers.
- Produces: JSON APIs using `{account,sessionCount}` summaries; an HttpOnly `memespace_session` cookie; `GET /api/auth/sessions` safe session rows; and a JSON export download.

- [ ] **Step 1: Write failing HTTP tests**

Extend `tests/local-startup.test.mjs` with fresh-data requests for registration, duplicate-case identifier rejection, login, reload/session lookup, wrong-password generic response, cross-origin rejection, session list, revoke-all, password change, export secret absence, deletion confirmation, and post-deletion 401 behavior. Assert old `/signin-with-chatgpt` still returns a redirect and can upgrade the legacy owner path; assert the legacy owner must set its initial password before password login works.

- [ ] **Step 2: Run the targeted startup test to verify failures**

Run: `node --test tests/local-startup.test.mjs`

Expected: FAIL with 404/401 because the new route handlers and resolver do not exist.

- [ ] **Step 3: Add route-level parsing and safe cookie helpers**

Add helpers for `jsonAccount(account)`, `setSessionCookie(token,maxAge)`, `clearSessionCookie()`, and `authFromRequest(request)`. Every mutation checks `sameOrigin(request)` before parsing the body. Every body uses `body(request)` and maps `INPUT`, `AUTH_INVALID`, `LOCKED`, `DUPLICATE`, `CONFIRMATION`, and `ORIGIN` to safe status/error messages.

- [ ] **Step 4: Implement registration, login, session, and logout routes**

Registration creates the account and first labeled session. Login creates a fresh session and sets the cookie. Session returns `{account:null}` when unauthenticated and account/session count when authenticated. Logout revokes the current session and clears the cookie. If `authFromRequest` sees a valid legacy cookie, it creates an opaque session and sets the replacement cookie before continuing; the returned account summary includes `needsPasswordSetup:true` while the marker remains.

- [ ] **Step 5: Implement session/password/export/deletion routes**

List only the current account’s session id, label, created/last-seen times, and current marker. Allow current-password-protected password changes, single-session revoke, revoke-all-others, safe JSON export, and confirmed account deletion. Never serialize `password_hash`, `password_salt`, `token_hash`, raw tokens, or request headers.

- [ ] **Step 6: Make the shared identity resolver use the new service**

Update `getChatGPTUser()` to resolve new sessions first and perform the legacy upgrade branch second. Keep `ChatGPTUser` fields compatible with existing module consumers and include an internal session id only in server-side auth results, not in module JSON responses.

- [ ] **Step 7: Run the HTTP regression tests to verify they pass**

Run: `node --test tests/local-startup.test.mjs`

Expected: all existing module persistence tests plus the new account/session tests pass.

- [ ] **Step 8: Commit the route slice**

```bash
git add app/api/auth app/api/common.ts app/chatgpt-auth.ts tests/local-startup.test.mjs
git commit -m "feat: expose local registration and session APIs"
```

### Task 4: Build the Identity Center UI and replace primary sign-in prompts

**Files:**
- Create: `app/identity-center.tsx`
- Modify: `app/page.tsx`
- Modify: `app/expanded-modules.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 3 JSON endpoints and the existing Dialog/Tabs/Button/Input styling conventions.
- Produces: `IdentityCenter` with `mode:'signin'|'register'|'account'`, `onAccountChange(account|null)`, and a public `openIdentity()` callback used by the shell and protected module prompts.

- [ ] **Step 1: Add a failing browser-oriented UI contract test**

Add `tests/identity-ui.test.mjs` as a source contract test that asserts `app/identity-center.tsx` contains accessible labels for identifier/password/display name, register/sign-in modes, initial legacy-password setup, change password, active sessions, export, deletion confirmation, and local-only copy. Assert `page.tsx` contains the Identity Center trigger and no primary chat/profile prompt links directly to the legacy one-click sign-in route.

- [ ] **Step 2: Run the UI contract test to verify it fails**

Run: `node --test tests/identity-ui.test.mjs`

Expected: FAIL because the component and shell integration do not yet exist.

- [ ] **Step 3: Implement signed-out Identity Center flows**

Create controlled forms with accessible labels, show/hide password controls, strength guidance, inline error/status regions, submit pending states, mode switching, cancel/escape behavior, and a plain notice that this is a local account with no email delivery. If `needsPasswordSetup` is true, show an initial password setup form before presenting normal account controls. On success, store the returned account summary and close/return to the requested module.

- [ ] **Step 4: Implement signed-in account controls**

Render display name/email, completion state, last sign-in, session list with current-device marker, individual revoke, revoke-all-others, change-password form, export button, sign-out button, and a two-field deletion guard. Refresh account state after every mutation and clear the UI after logout/deletion.

- [ ] **Step 5: Integrate the shell and modules**

Add a signed-out “SIGN IN” control and signed-in account chip to the top bar. Pass the account callback through `ModuleContent`. Replace ChatRoom/Profile/lesson-note “Sign in” anchors with `openIdentity()` so the dialog preserves the current workspace. Keep wallet connection separate from MemeSpace identity.

- [ ] **Step 6: Add responsive styling and accessibility details**

Style the identity dialog as a focused green/black control room, ensure mobile scrolling, visible focus rings, error contrast, password fields with `autoComplete` values, and no secret values in URL/hash state. Add a compact session row layout for narrow windows.

- [ ] **Step 7: Run the UI contract and TypeScript checks**

Run: `node --test tests/identity-ui.test.mjs`

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`

Expected: both commands pass with the new component integrated.

- [ ] **Step 8: Commit the Identity Center slice**

```bash
git add app/identity-center.tsx app/page.tsx app/expanded-modules.tsx app/globals.css tests/identity-ui.test.mjs
git commit -m "feat: add MemeSpace Identity Center"
```

### Task 5: Harden module behavior and migration documentation

**Files:**
- Modify: `app/api/profile/route.ts`
- Modify: `app/api/saved/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `README.md`
- Modify: `IMPLEMENTATION.md`
- Modify: `SOURCE-REVISION.txt`
- Modify: `RELEASE-v2.3.md`

**Interfaces:**
- Consumes: Task 3’s authenticated user resolver and Task 4’s account UX.
- Produces: consistent account-aware module responses, v2.3 upgrade instructions, and explicit local-auth boundaries.

- [ ] **Step 1: Write failing compatibility assertions**

Add HTTP assertions that an account’s profile, chat, saved items, notes, and memes remain available after a logout/login cycle, while an account deletion removes only that account’s rows. Assert module responses never include password/session fields.

- [ ] **Step 2: Run the assertions to establish the current failure**

Run: `node --test tests/local-startup.test.mjs`

Expected: the new multi-account/logout/relogin assertions fail because module requests currently assume the old local identity bridge.

- [ ] **Step 3: Update module response and profile semantics**

Use account `display_name` as the default chat/profile fallback when no profile row exists. Keep the existing profile endpoint for bio/name edits but initialize it from the account summary. Preserve saved-item validation and add account-owned export/deletion coverage.

- [ ] **Step 4: Document upgrade and security boundaries**

Update README setup instructions to say that v2.3 migrates `local_seedy`, creates a local account with an unusable migration marker, and asks the existing local owner to set a password on first sign-in; new identities register normally. Explain that no email reset is available without an external mail adapter. Add the endpoint list, data export/deletion behavior, and password/session safety notes to `RELEASE-v2.3.md`.

- [ ] **Step 5: Run the compatibility assertions**

Run: `node --test tests/local-startup.test.mjs tests/local-database.test.mjs tests/local-auth.test.mjs`

Expected: all tests pass and old data remains intact.

- [ ] **Step 6: Commit the compatibility/documentation slice**

```bash
git add app/api README.md IMPLEMENTATION.md SOURCE-REVISION.txt RELEASE-v2.3.md tests
git commit -m "docs: document local identity upgrade and boundaries"
```

### Task 6: Run full verification and create the downloadable release

**Files:**
- Modify: `SHA256SUMS.txt`
- Create: `/workspace/scratch/ed6d6e00cffb/MemeSpace_v2_3_Identity_Foundation.zip`

**Interfaces:**
- Consumes: all source, tests, documentation, launchers, geometry, and licenses from Tasks 1–5.
- Produces: a self-contained ZIP with no `data`, `node_modules`, `.next`, session keys, backups, temporary preview helpers, or secrets.

- [ ] **Step 1: Run the complete test suite**

Run: `node scripts/local.mjs test`

Expected: database, auth, UI contract, and local startup tests report zero failures.

- [ ] **Step 2: Run the compiled-server suite**

Run: `MEMESPACE_TEST_MODE=serve node scripts/local.mjs test`

Expected: the compiled Next.js server passes the same checks with zero failures.

- [ ] **Step 3: Run the production build and TypeScript check**

Run: `node scripts/local.mjs build`

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`

Expected: both commands exit 0 and Next lists the auth routes.

- [ ] **Step 4: Perform the browser acceptance flow**

Start the managed preview and verify: signed-out Identity Center opens; registration succeeds; reload retains the account; profile/chat/saved actions use the account; a second sign-in shows the session list; single-session and revoke-all work; password change invalidates another session; export has no secret keys; deletion requires the exact confirmation; legacy owner data remains visible after migration.

- [ ] **Step 5: Build and integrity-check the ZIP**

Include the complete source allowlist, geometry binaries, public concept assets, SQL/migration metadata, tests, Windows launchers, README, release notes, and `SHA256SUMS.txt`. Verify every checksum after writing the archive and assert the package version is `2.3.0` and `scripts.dev` remains `node scripts/local.mjs start`.

- [ ] **Step 6: Save the ZIP and persist its Library identity**

Create the ZIP as a new downloadable artifact, save it to the persistent file library, apply returned file metadata to the local ZIP, and return the exact sandbox path with upgrade instructions. Do not overwrite the known-good v2.2 ZIP.

- [ ] **Step 7: Record final evidence**

Write the exact test/build/browser results to `RELEASE-v2.3.md`, including any environment limitation such as no native Windows execution or real external email delivery. Do not claim an external wallet/mail/provider integration was tested.
