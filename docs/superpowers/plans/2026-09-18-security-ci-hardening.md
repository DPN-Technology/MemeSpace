# MemeSpace Security CI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add enforceable, reproducible repository quality and security checks for MemeSpace v2.1 without changing its local-only authentication boundary.

**Architecture:** Keep runtime changes small and put repository policy into two read-only GitHub Actions workflows plus a dependency-free Node security scanner. Preserve the existing pnpm supply-chain policy and make CI verify it cannot be weakened silently.

**Tech Stack:** Node.js 24, pnpm 11.25.0, Next.js 16, TypeScript, ESLint, Node test runner, GitHub Actions, Dependabot.

**Spec:** User request in this conversation: audit MemeSpace and add security gates, CI, and related repository hardening.

## Global Constraints

- Preserve the local loopback-only execution model.
- Do not introduce secrets or required cloud credentials.
- Use frozen lockfile installs.
- Pin third-party GitHub Actions to immutable commit SHAs.
- Use least-privilege workflow permissions.
- Keep Windows local setup functional.

## Review Focus

- A future workflow using a mutable action tag must fail the repository security gate.
- A tracked environment/credential file must fail the repository security gate.
- Cross-site local sign-in/sign-out attempts must remain blocked.
- Dependency advisories at configured severity must fail the security workflow.
- Security headers must not require HTTPS for localhost.

---

### Task 1: Repository policy gate

**Files:**
- Create: `scripts/security-gate.mjs`
- Modify: `package.json`

- [x] Add a dependency-free tracked-file scanner.
- [x] Enforce immutable GitHub Action refs and least-risk workflow triggers.
- [x] Enforce existing pnpm supply-chain controls.
- [x] Expose `pnpm security:gate` and `pnpm ci:verify`.

### Task 2: CI and dependency security workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/security-gate.yml`
- Create: `.github/dependabot.yml`

- [x] Run lint, typecheck, tests, and production build on pull requests and main.
- [x] Run explicit production and critical dependency audits.
- [x] Add weekly dependency/action maintenance.

### Task 3: Runtime and regression hardening

**Files:**
- Modify: `next.config.ts`
- Modify: `tests/local-startup.test.mjs`

- [x] Add non-HTTPS-dependent security headers.
- [x] Add cross-site auth-route regression coverage.
- [x] Verify headers in startup integration test.

### Task 4: Repository governance and audit record

**Files:**
- Create: `SECURITY.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/pull_request_template.md`
- Create: `docs/security/SECURITY-AUDIT-2026-09-18.md`

- [x] Document private vulnerability reporting expectations.
- [x] Add ownership and PR security checks.
- [x] Record findings, controls, and residual risks.
