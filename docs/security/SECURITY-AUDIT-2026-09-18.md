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
- React, React DOM, and `react-server-dom-webpack` are now aligned on `19.2.8`, which remediates the later Server Functions denial-of-service advisory affecting the `19.2.0` through `19.2.7` line.

### Gaps found

1. **No GitHub Actions CI existed.** A bad commit could reach `main` without lint, typecheck, tests, or a production build.
2. **No repository security workflow existed.** Dependency advisories and repository secret/policy regressions were not automatically gated.
3. **No Dependabot policy existed.** Dependency and action updates relied on manual tracking.
4. **No CODEOWNERS or pull-request security checklist existed.**
5. **No repository security reporting policy existed.**
6. **No GitHub repository ruleset exists.** Workflows can run, but GitHub will not block a direct push or merge solely because checks failed until required-status rules are enabled in repository settings.
7. **Security headers were minimal.** The application now adds clickjacking, MIME-sniffing, referrer, and browser-capability restrictions without adding HSTS, which would be inappropriate for the current localhost HTTP model.
8. **Cross-site auth-route behavior was not explicitly regression-tested.** Coverage is added.
9. **The dependency audit exposed two HIGH-severity Browserslist advisories in the locked graph (`browserslist 4.28.2`).** The graph is now overridden and locked to `browserslist 4.28.7`, the patched release, and the vulnerable `4.28.2` resolution is no longer present.
10. **A second full dependency audit found 18 HIGH-severity advisories in development/tooling paths.** Affected packages included Undici, ws, Vite, brace-expansion, js-yaml, `react-server-dom-webpack`, and image-size through Cloudflare/Vite, ESLint, vinext, and related tooling. Patched same-major or maintenance releases are now locked.
11. **The package-age quarantine blocked the newly released image-size security fix by design.** A single exact exception for `image-size@2.0.3` is now declared and enforced by the repository security policy; arbitrary release-age exceptions remain disallowed.

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
- high/critical advisories anywhere in the dependency graph

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

## Post-remediation advisory state

The final second-pass audit on the hardening branch reports:

- production graph: **2 advisories — 1 low, 1 moderate**
- complete dependency graph: **5 advisories — 2 low, 3 moderate**
- **0 high**
- **0 critical**

The security workflow now fails on HIGH-or-higher advisories across the complete graph, not only production dependencies. Remaining low/moderate advisories stay visible for Dependabot and future maintenance rather than being represented as zero risk.

## Residual risks / next controls


- Create a GitHub ruleset for `main` and require both CI jobs before merge.
- Require pull requests instead of direct pushes when the project moves beyond solo development.
- Enable GitHub private vulnerability reporting.
- Enable GitHub secret scanning / push protection if available for the account.
- Enable GitHub CodeQL / code scanning if Advanced Security is available for this private repository.
- Revisit authentication, secure-cookie behavior, global rate limiting, moderation controls, and production observability before any internet-facing deployment.
- Continue reviewing prerelease infrastructure dependencies such as `vinext` before public production use.
- Keep the `browserslist: 4.28.7` override until upstream dependency ranges naturally resolve to an equal or newer patched release; Dependabot and the security workflow will flag future changes.
- Remove the exact `image-size@2.0.3` minimum-release-age exception after the package has aged beyond the normal seven-day quarantine and the lockfile remains reproducible without it.
- Continue reducing the remaining low/moderate advisory count when compatible upstream releases become available.

## Gate names to require in a future GitHub ruleset

- `CI / Lint · Typecheck · Test · Build`
- `Security Gate / Static policy · Dependency audit`
