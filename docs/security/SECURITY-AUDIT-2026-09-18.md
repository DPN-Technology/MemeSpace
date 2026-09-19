# MemeSpace Security & CI Audit — 2026-09-18

## Scope

Repository: `directordiesel/MemeSpace`  
Baseline audited: `337382fbdc1023dbcaa74ef0ad5560bf4a8af079`  
Application version: `2.1.0`

This audit reviewed repository structure, dependency policy, runtime/session boundaries, API handlers, database access, test coverage, package configuration, and GitHub governance controls.

## Executive findings

### Existing strengths

- Node.js is constrained to version 24 or newer and pnpm is pinned to `11.25.0`.
- `pnpm-lock.yaml` is committed and CI now installs with `--frozen-lockfile`.
- The pnpm workspace policy already uses a seven-day minimum package release age.
- `strictDepBuilds: true` and an explicit `allowBuilds` list reduce dependency post-install execution risk.
- `trustLockfile: false` requires package integrity to be re-verified instead of blindly trusting lockfile metadata.
- Environment files, local databases, backups, build output, Wrangler state, and local agent state are ignored.
- API SQL uses bound parameters rather than interpolated user input.
- Request bodies have a hard size cap and feature-specific length/shape validation.
- Local session signatures use HMAC-SHA256 and timing-safe comparison.
- The local server binds to loopback and validates host/origin context for state-changing requests.
- Existing startup tests already cover spoofed identity headers, untrusted origins, tampered cookies, persistence, and primary API behavior.
- Next.js `16.3.4` is above the patched `16.3.3` floor for the August 25, 2026 critical Next.js security release.
- React / `react-server-dom-webpack` `19.2.6` is at the patched release for the May 2026 React Server Components denial-of-service advisory.

### Gaps found

1. **No GitHub Actions CI existed.** A bad commit could reach `main` without lint, typecheck, tests, or a production build.
2. **No repository security workflow existed.** Dependency advisories and repository secret/policy regressions were not automatically gated.
3. **No Dependabot policy existed.** Dependency and action updates relied on manual tracking.
4. **No CODEOWNERS or pull-request security checklist existed.**
5. **No repository security reporting policy existed.**
6. **No GitHub repository ruleset exists.** Workflows can run, but GitHub will not block a direct push or merge solely because checks failed until required-status rules are enabled in repository settings.
7. **Security headers were minimal.** The application now adds clickjacking, MIME-sniffing, referrer, and browser-capability restrictions without adding HSTS, which would be inappropriate for the current localhost HTTP model.
8. **Cross-site auth-route behavior was not explicitly regression-tested.** Coverage is added.

## Controls added by this hardening pass

### CI workflow

`.github/workflows/ci.yml`

Required validation sequence:

1. pinned checkout action
2. pinned Node setup action
3. pinned pnpm installation
4. repository security policy scan before dependency execution
5. frozen-lockfile install
6. ESLint
7. TypeScript typecheck
8. Node integration/unit tests
9. production build

The workflow uses read-only repository permissions and does not persist checkout credentials.

### Security gate workflow

`.github/workflows/security-gate.yml`

Runs on pull requests, pushes to `main`, manual dispatch, and weekly schedule.

It blocks:

- tracked environment/credential files
- common private-key and token signatures
- dangerous dynamic-code/TLS-bypass patterns in first-party runtime code
- unpinned third-party GitHub Actions
- `pull_request_target`
- `permissions: write-all`
- persisted checkout credentials
- weakening of pnpm release-age / build-script / lockfile-verification policy
- high/critical production dependency advisories
- critical advisories anywhere in the dependency graph

### Dependency maintenance

`.github/dependabot.yml`

Weekly updates are configured for both npm/pnpm dependencies and GitHub Actions.

### Governance

Added:

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `SECURITY.md`

## Application hardening added

`next.config.ts` now disables the framework-powered-by header and returns:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- a restrictive `Permissions-Policy`

HSTS is intentionally not added because the current supported execution model is localhost over HTTP.

## Residual risks / next controls

- Create a GitHub ruleset for `main` and require both CI jobs before merge.
- Require pull requests instead of direct pushes when the project moves beyond solo development.
- Enable GitHub private vulnerability reporting.
- Enable GitHub secret scanning / push protection if available for the account.
- Enable GitHub CodeQL / code scanning if Advanced Security is available for this private repository.
- Revisit authentication, secure-cookie behavior, global rate limiting, moderation controls, and production observability before any internet-facing deployment.
- Continue reviewing prerelease infrastructure dependencies such as `vinext` before public production use.

## Gate names to require in a future GitHub ruleset

- `CI / Lint · Typecheck · Test · Build`
- `Security Gate / Static policy · Dependency audit`
