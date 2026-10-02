# MemeSpace Third-Party Software & License Record

MemeSpace application code authored for DPN Technology is distinct from third-party packages, assets, and vendored compatibility files. This file is an inventory aid; the authoritative license text for each dependency remains the license distributed by its copyright holder.

## Runtime and development packages

The exact dependency graph is locked by `pnpm-lock.yaml`. Direct packages are declared in `package.json`, including Next.js, React, Drizzle ORM, Radix/Base UI, shadcn-related packages, Tailwind CSS, Vite/Vinext/Cloudflare development tooling, ESLint, TypeScript, Recharts, Lucide, Zod, and related UI libraries.

Before redistribution or commercial delivery, review the locked dependency graph and retain each package's applicable license notices. Do not represent third-party packages as DPN-owned source.

## Bundled/vendor files

- `vendor/shadcn-tailwind-4.13.0.css` — license retained in `vendor/shadcn-tailwind-4.13.0.LICENSE.md`.
- `build/sites-vite-plugin.ts` — license retained in `build/sites-vite-plugin.LICENSE`.
- `public/geometry/` — geometry/source attribution and license files in that directory must remain with redistributions when present.

## Dependency integrity policy

MemeSpace uses a committed pnpm lockfile, a pinned pnpm version, dependency release-age quarantine, restricted dependency build scripts, integrity re-verification, Dependabot, and GitHub Actions advisory gates. See `pnpm-workspace.yaml`, `.github/dependabot.yml`, and `.github/workflows/security-gate.yml`.

## Maintainer rule

When a dependency or vendored component is added, removed, or materially replaced, update this record in the same change and preserve any required attribution/license files.
