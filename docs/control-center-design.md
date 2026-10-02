# MemeSpace 2.4 — Separate Control Center

The existing cinematic site remains on port 5173. A separate Node process serves the Control Center on 5174. It has its own assets, authentication database, cookies, sessions, permissions and launcher; there is no admin route in the public Next app. Both processes read the local platform SQLite database. Only the Control Center opens `data/admin/control.sqlite` and `data/admin/mfa.key`.

This implements Build Bible sections 15–16 and 30–34 as a local operations foundation: account management, reversible message moderation, reports, announcement drafts/publication, site switches, staff invitations with mandatory authenticator MFA, session revocation, protected audit history, database health and verified local backups. Overview charts use actual records, never invented traffic or wallet activity.

Permission checks happen at every API operation. The initial system owner is enrolled using a one-time code printed in the local terminal. Staff invitations expire in one hour; MFA enrollment expires in ten minutes. Passwords are scrypt-hashed; TOTP secrets are encrypted at rest; single-use recovery codes and session tokens are hashed. Admin sessions expire after eight hours or thirty minutes idle. Mutations require exact Origin and a session-bound CSRF token.

Local deployment is loopback-only. Browser origins on different ports are distinct, but cookies share a host; different cookie names and separate token stores prevent identity crossover. This is not OS-level isolation: a public service compromised under the same OS account could read its files. Internet deployment needs separate service users/hosts, TLS, a managed authentication review, centralized encrypted backups and monitoring. Audit triggers prevent application updates/deletes, not modification by the machine owner.

Verification: RFC TOTP vectors; enrollment/credential replay/rate limits; public/admin session separation; CSRF and permission denial; suspensions invalidating public access; moderation visibility; announcement publication; backups opened and integrity checked; existing account/module flows; production build and browser inspection where available.
