# MemeSpace Security Policy

MemeSpace is maintained by DPN Technology. Security reports should be handled privately.

## Supported code

Security fixes target the current `main` branch and the most recent maintained release. Older snapshots should be upgraded before they are treated as supported.

## Reporting a vulnerability

Do **not** open a public issue containing exploit instructions, credentials, tokens, private user data, or a working proof of concept.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting / Security Advisory flow for this repository when available.
2. If that flow is unavailable, contact the repository owner privately and include the affected commit, impact, reproduction conditions, and the minimum information needed to confirm the issue.

Never send seed phrases, wallet private keys, passwords, session cookies, or unrelated personal data as part of a report.

## Security expectations

The repository security baseline includes:

- pinned GitHub Actions
- least-privilege workflow permissions
- frozen-lockfile dependency installs
- explicit dependency advisory gates
- secret-pattern and dangerous-code policy checks
- TypeScript strict mode
- lint, test, typecheck, and production-build CI
- delayed dependency adoption and restricted dependency build scripts
- ignored environment files, local databases, and backups

## Local-runtime boundary

MemeSpace v2.1 is currently designed to run as a local application bound to loopback. The local sign-in/session model is not a substitute for production internet-facing authentication. Any future public deployment must introduce production-grade identity, authorization, rate limiting, secure-cookie behavior, deployment-specific CSRF protections, and operational monitoring before exposure to untrusted networks.
