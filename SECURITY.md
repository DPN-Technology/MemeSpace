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

## October 23, 2026 remediation (issue #44 / PR #43)

Public-origin self-registration fails closed by default: an externally gated beta is the only temporary unverified-email mode. Full public onboarding needs email verification and trusted-edge IP throttling. Public password crypto is asynchronous and capped at four concurrent jobs; persistent SQLite admission controls bound global and per-identifier requests. Public CSP is enabled with Next hydration-compatible inline allowances that warrant a future nonce-based hardening pass. Payments remain off and PR #43 does not authorize production deployment.

GitHub withdrew the development-only braces advisory GHSA-vfj7-8cjw-p6xm on October 23, 2026. The exception was removed, restoring a fully blocking high/critical audit for all dependencies.

## Local-runtime boundary

MemeSpace v2.5 is intentionally local-first. The public site and the separate Control Center bind to loopback by default and share the local operating-system trust boundary. The Control Center adds password authentication, authenticator MFA, CSRF/origin enforcement, role permissions, lockouts, audit events, and a separate security database, but this is **not** a production internet-facing deployment model.

Before public exposure, add deployment-grade HTTPS, secure cookies, external identity/access controls, rate limiting, centralized secrets, operational monitoring, encrypted off-machine backups, service isolation, incident response procedures, and a security review of every public/admin route.


## Code scanning verification

MemeSpace uses GitHub CodeQL and Code Quality analysis on the default branch. Security and quality fixes are considered complete only after the corresponding default-branch scans finish successfully so GitHub can reconcile resolved alerts against the current source tree.


## Report a vulnerability

Please report suspected vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/DPN-Technology/MemeSpace/security/advisories/new). For repository security status and published advisories, use the [MemeSpace Security page](https://github.com/DPN-Technology/MemeSpace/security).
