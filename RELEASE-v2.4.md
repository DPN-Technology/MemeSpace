# MemeSpace v2.4 — Separate Control Center

Release date: 2026-09-19

## Shipped

A standalone admin process and frontend on loopback port 5174, separate from the public site on 5173. Staff authentication and auditing use their own SQLite database and MFA encryption key. The panel supports real overview metrics, member controls, report review, reversible message moderation, announcement drafts/publication, scoped staff invitations, audit inspection, site switches and verified local backups.

Public APIs now enforce operational settings, hidden-message visibility and suspended-member restrictions. The old unauthenticated owner sign-in shortcut is closed. Valid unclaimed v2.2 cookies can upgrade once; a local terminal wizard can claim an unclaimed legacy member if its old browser session is gone. Member deletion requires the current password. Account-scoped browser drafts prevent one identity from loading another identity's new drafts. Editing a saved meme updates that creation and preserves its style settings.

The live binary renderer, eye glow, brain pulses, viewport-safe node previews and module workspaces remain included. Existing SQL migrations were not edited; public schema 0003 is additive. Admin migrations are maintained independently. Dependencies and pnpm lockfile are unchanged.

## Verified on Node.js 24 / Linux

- Production Next.js build with webpack: passed.
- TypeScript check: passed, both standalone and during the final production build.
- JavaScript syntax checks for the admin server, operations, security and frontend: passed.
- Full regression suite against the final compiled public site: **18 tests passed, 0 failed**.
- MFA algorithm checked against six independent RFC 6238 vectors, including times past 2038.
- One-time enrollment and MFA/recovery replay rejection, encrypted secret storage, admin session expiry, invitation email binding, permissions, rate limiting and protected audit triggers: passed.
- Actual admin HTTP requests: rejected foreign origins, forged Host, public cookies, missing CSRF and unauthorized roles. Staff disabling and session revocation: passed.
- Complete public-site/admin-service integration: registration, login, password change, export/deletion, signed legacy migration, content persistence, report submission/hiding/restoration, draft/public announcement visibility, registration pause, read-only chat, account suspension/restoration and separate cookie stores: passed.
- Verified backup reopened as an independent SQLite database; expected records and integrity checks: passed.
- Repeated migration, reopen and old-database import preserve existing records: passed.
- Public runtime tested with Workers runtime imports explicitly denied.

## Verification limits

The provided cloud browser could not open the local admin address (`ERR_BLOCKED_BY_CLIENT`). The admin frontend therefore received source/syntax review but no successful visual browser inspection in this environment. Do not treat API test coverage as visual or accessibility certification. Windows launchers were included and reviewed; direct Windows execution was not available. Admin MFA was tested with deterministic and generated fixtures; enrollment in a physical authenticator app was not performed here.

This is a local operations foundation. The complete Build Bible roadmap, Internet deployment, OS-level service isolation, managed identity, full content/media CMS, upload scanning, marketing/game analytics and off-machine encrypted backup automation remain future work. The admin audit log is append-only at application level; the computer owner can still modify its files.

## Package

The ZIP contains application and admin source, tests, migrations, locked dependency manifests, assets, licenses, launchers and instructions. It excludes installed dependencies, built output, development credentials, local databases, MFA keys, sessions, logs and test fixtures. Setup installs dependencies for the user's operating system.

The per-file SHA-256 manifest is generated from the final staged package. Prior releases and the hosted Sites project remain unchanged.
