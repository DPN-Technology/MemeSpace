# MemeSpace Security Policy

MemeSpace is maintained by DPN Technology. Security reports should be handled privately.

## Supported code

Security fixes target the current `main` branch and the most recent maintained release. The current source line is **MemeSpace v2.5 — Neon Arcade**.

## Reporting a vulnerability

Do not open a public issue containing exploit instructions, credentials, tokens, private user data, MFA material, recovery codes, session cookies, wallet secrets, or a working proof of concept.

Use GitHub private vulnerability reporting / Security Advisory when available. Otherwise contact the repository owner privately with the affected commit, impact, reproduction conditions, and the minimum information required to validate the report.

## Repository security baseline

- pinned GitHub Actions and read-only workflow permissions
- frozen-lockfile installs with pnpm 11.25.0
- seven-day dependency release quarantine with a constrained security-hotfix exception
- explicit high/critical dependency advisory gates
- secret-pattern and dangerous-code policy checks
- TypeScript, lint, regression tests, production build, and static security validation in CI
- ignored environment files, runtime databases, MFA keys, sessions, backups, and generated output
- security headers on the public Next.js application
- separate public-member and Control Center authentication/session models

## Local-runtime boundary

MemeSpace v2.5 is intentionally local-first. The public site and the separate Control Center bind to loopback by default and share the local operating-system trust boundary. The Control Center adds password authentication, authenticator MFA, CSRF/origin enforcement, role permissions, lockouts, audit events, and a separate security database, but this is **not** a production internet-facing deployment model.

Before public exposure, add deployment-grade HTTPS, secure cookies, external identity/access controls, rate limiting, centralized secrets, operational monitoring, encrypted off-machine backups, service isolation, incident response procedures, and a security review of every public/admin route.


## Code scanning verification

MemeSpace uses GitHub CodeQL and Code Quality analysis on the default branch. Security and quality fixes are considered complete only after the corresponding default-branch scans finish successfully so GitHub can reconcile resolved alerts against the current source tree.
