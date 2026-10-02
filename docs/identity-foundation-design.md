# MemeSpace Identity Foundation — v2.3 Design

## Goal

Replace the current one-click `local_seedy` session with a local, self-contained account foundation that supports registration, sign-in, durable sessions, profile completion, password changes, device/session control, export, and account deletion while preserving every existing v2.2 profile, message, reaction, bookmark, note, lesson, and meme record.

This is a local self-hosted feature. It does not claim to provide public SaaS authentication, email delivery, email verification, OAuth, password recovery through email, or multi-machine account synchronization.

## Account model

Add an `accounts` table keyed by the existing application `user_id` value:

- `user_id` — stable application identifier (`local_seedy` for the migrated legacy owner; `usr_<random>` for new accounts).
- `email` — normalized local account identifier, unique case-insensitively.
- `password_hash` and `password_salt` — Node `scrypt` output and per-account random salt. Never store plaintext passwords.
- `display_name` — required registration name, editable later.
- `created_at`, `updated_at`, `last_login_at` — integer timestamps.
- `failed_attempts`, `locked_until` — bounded local throttling state.
- `deleted_at` — soft-delete marker used during the account-deletion flow.

The migrated `local_seedy` owner has no password that can be recovered. Its first migration writes a random `legacy_unset$...` password marker that can never authenticate. A valid existing signed local-owner session may claim that account once by setting a new password; until then, password login for that account remains disabled.

Add a `sessions` table:

- `id` — random opaque session identifier stored only as a hash in SQLite.
- `user_id` — account owner.
- `label` — short device/browser label captured without storing the full user-agent string.
- `created_at`, `last_seen_at`, `expires_at`, `revoked_at` — lifecycle timestamps.

Existing tables continue to reference `user_id`, so legacy records require no rewrite. The first migration creates the legacy `local_seedy` account from its existing local profile, or creates a safe default if no profile exists.

## Session and request security

- Replace the long-lived signed timestamp cookie with a random opaque session token: the raw token is issued once as an HttpOnly, Secure-when-HTTPS, SameSite=Lax cookie; only its SHA-256 hash is stored.
- Expire idle/absolute sessions on every authenticated request and update `last_seen_at` with a bounded cadence.
- Reject revoked, expired, deleted-account, malformed, cross-origin, and non-loopback requests.
- Keep a compatibility path that recognizes an existing v2.2 legacy cookie and upgrades it to a database session for `local_seedy`; this prevents an upgrade from unexpectedly signing the owner out.
- Registration, login, password change, session revocation, export, and deletion all enforce the existing local origin/host policy and request-size limits.
- Login failures return the same public error for unknown accounts and wrong passwords. Repeated failures trigger a short account lockout; a successful login clears the counter.
- Never log passwords, tokens, recovery values, raw user-agent strings, or full request bodies.

## Auth endpoints

Create Node runtime route handlers:

- `POST /api/auth/register` — validate email/name/password, create account and first session, return a safe public account summary.
- `POST /api/auth/login` — authenticate, enforce lockout, rotate/create session, return summary.
- `POST /api/auth/logout` — revoke current session and clear cookie.
- `GET /api/auth/session` — return the signed-in summary and session count, or `{account:null}`.
- `POST /api/auth/password` — require current password, validate new password, change hash, revoke all other sessions. The only exception is a valid one-time legacy-owner session with the `legacy_unset` marker, which may set the initial password without a current password.
- `GET /api/auth/sessions` — list the current account’s safe session labels/timestamps.
- `DELETE /api/auth/sessions/:id` — revoke one session owned by the current account.
- `POST /api/auth/sessions/revoke-all` — revoke every session except the current one.
- `GET /api/auth/export` — return a JSON download containing the account’s safe profile and owned application data, never password hashes or session tokens.
- `DELETE /api/auth/account` — require current password and an explicit confirmation phrase, soft-delete account-owned data, revoke sessions, and clear the cookie. The local legacy owner has an extra confirmation guard so accidental deletion cannot remove the migrated identity silently.

The existing profile endpoint remains available for profile fields, but identity fields are owned by the auth/account endpoints. Existing module APIs continue to use the authenticated `user_id` from the new session resolver.

## Identity Center UI

Add an `IdentityCenter` client module used from the top bar, profile module, and sign-in prompts:

- Signed-out state: Sign in / Create account tabs with inline validation, password visibility toggle, strength guidance, and a local-only notice.
- Signed-in state: account summary, completion indicator, display name/email, last sign-in, current-device marker, active sessions, sign out current device, sign out all other devices, change password, export data, and delete-account guard.
- Profile and chat use the new auth overlay instead of redirecting directly to the old one-click route.
- Use accessible labels, focus management, keyboard submit/cancel, pending states, generic failure messages, and no secrets in URL parameters.

## Migration and compatibility

- Add one forward SQLite migration. It must be repeatable through the existing migration runner.
- Detect a pre-existing `local_seedy` profile and attach it to the legacy account. If no profile exists, create the account without overwriting module data. Since no old password exists, use a random unusable marker and require the first legacy session to set a password.
- Do not delete or rewrite existing rows in `profiles`, `messages`, `likes`, `reports`, or `saved_items`.
- Keep the old one-click route as a compatibility bridge only for local upgrades: if requested, it creates/upgrades a `local_seedy` session and redirects to the requested safe path. The main UI stops presenting it as the primary sign-in experience.

## Verification requirements

Tests must cover:

1. Registration success, normalization, duplicate email rejection, weak password rejection, and oversized input rejection.
2. Login success, wrong-password generic errors, lockout threshold, and lockout expiry.
3. Session persistence after restart, expiry, current-session lookup, single-session revoke, revoke-all, and logout cookie clearing.
4. Password change requiring the current password and invalidating other sessions.
5. Legacy `local_seedy` data and legacy cookie upgrade without data loss.
6. Export excludes password/session secrets and includes owned records.
7. Account deletion requires the confirmation phrase, revokes sessions, removes owned rows, and does not damage other accounts.
8. Cross-origin and forged hosted-identity headers remain rejected.
9. TypeScript, production build, local startup, compiled-server tests, and browser checks for register → sign in → reload → profile/session controls.

## Scope boundary

This release does not add outbound email, verified email claims, OAuth, public registration over the network, account sharing, administrator impersonation, payment, wallet custody, or production multi-tenant hosting. Those require a separate deployment/authentication design with external security review.
