# MemeSpace v2.5 — Neon Arcade

Release date: 2026-09-20

## Shipped

The Game Center is now a six-cabinet arcade lobby with live-rendered table previews, new/classic filters, searchable cabinet links and personal records. The original binary head, green eyes, brain environment, identity flows and separate Control Center remain included.

**Reactor Pinball** has real-time ball and moving-flipper collisions, chrome balls, illuminated bumpers, target circuits, score multipliers, bumper chains, earned multiball, three-ball rounds, a plunger, nine-second ball saves and nudge/tilt controls. A ball that returns to the plunger can be relaunched without consuming a ball or renewing the save timer.

**After Hours Pool** has ball-to-ball collisions, cushion rebounds, six pockets, aiming/ghost-ball guides, cue placement and power control. Modes are solo clearance, computer opponent and two-player pass-and-play. The documented arcade rules include assigned groups, first-contact and cushion fouls, ball in hand, an eight on the break being re-spotted, and a called-pocket eight to win. The computer chooses geometric shots from legal targets.

**Quantum Reels** has animated reels, five fixed paylines, winning-line highlights, a visible weighted-symbol paytable, four line stakes, free credit refills and twelve recent outcomes. Each of the nine cells is sampled independently using browser cryptographic randomness with rejection sampling. The specified mathematical return is 89.075%; this is an engine calculation, not an external certification or a promise about individual sessions. There is no payment, wallet transaction, cash-out or prize. A spin is settled and stored before animation. Leaving or reloading does not award the same spin twice.

Pinball/pool positions update outside React state at a fixed timestep. Their score displays update less frequently, rendering resolution is bounded, and they pause on window blur or visibility loss. Sound is opt-in. Cabinets include keyboard/touch controls, help, fullscreen and reduced-motion handling. Personal records and slot balances are stored in the current browser under the current identity; they do not sync between browsers. In-progress pinball rounds and pool racks are not persisted.

The separate Control Center adds a Game Center view for owners and administrators. Six cabinet availability switches require decision notes and write requested/completed audit entries. Public lobbies refresh availability every thirty seconds. A pause prevents new cabinet visits; already open cabinets remain playable. These local client games do not present a server-verified competitive leaderboard or operator analytics.

Migration 0004 is additive and seeds cabinet switches. All earlier public/admin migrations and the dependency lockfile are byte-for-byte preserved from v2.4. No dependencies were added. The working Node.js launcher remains the default; it does not start Wrangler or a Workers runtime.

## Verified on Node.js 24 / Linux

- Production Next.js build with webpack and TypeScript: passed.
- Complete regression suite against the compiled website and separate admin HTTP service: **32 tests passed, 0 failed**.
- Thirteen arcade tests cover collision momentum, pinball return/launch/ball-save/tilt/multiball behavior, complete three-ball lifecycles, pool frame-rate consistency, pockets/scratches, group assignment, fouls, eight-ball wins/losses, computer shot execution, slot weights/payouts and saved settlements.
- Moving-flipper response was checked with the same incoming ball against resting and actuated flippers; the actuated flipper returns the ball up the table.
- Actual Canvas game renderers were rendered to images and visually inspected for the pinball table and a pool table after a simulated break.
- Admin cabinet changes were exercised through real HTTP requests and observed through the compiled public catalog API. Unauthorized roles, missing CSRF, invalid cabinet IDs/actions, and missing decision notes are rejected; accepted changes appear in the audit log.
- Existing member/authentication, MFA, moderation, announcements, platform switches, backup integrity, migration/import persistence and public/admin separation regressions passed. The public runtime was tested with Workers imports explicitly denied.
- Admin frontend/server JavaScript syntax checks: passed.

## Verification limits

The cloud browser cannot reach this loopback-only application in the available environment. Full browser interaction, responsive-layout checks and touch-device testing were not completed here. Canvas render inspection and automated engine/API tests are not substitutes for end-to-end browser testing. Windows launchers are included and reviewed, but Windows execution was not available.

Pool is a simplified two-dimensional arcade simulation. The computer opponent uses a basic geometric planner. Scores and free play credits are browser-local and editable by the device owner; they are not authoritative records. The rest of the Build Bible roadmap, public hosting, online multiplayer, global rankings, full content/media administration and operational analytics remain future work.

## Source package

The ZIP includes both applications, pure game engines, styles, assets, licenses, locked dependencies manifests, additive migrations, tests, Windows/macOS/Linux launchers and upgrade instructions. Dependencies are installed during setup for the user's operating system. Installed modules, generated builds, local databases, sessions, MFA keys, development credentials and test fixtures are excluded. A fresh SHA-256 manifest covers each packaged file.

Extract into a new folder and copy the entire old `data` folder before setup to retain member and admin data. Keep the old release as a rollback copy. Use the same browser, website address and member identity to retain browser-only arcade records. Prior downloads and the hosted Sites project are unchanged.

## Repository integration hardening

The GitHub source line preserves the newer repository protections that were developed after the earlier source export: pinned-action CI, the static repository security gate, weekly dependency/advisory checks, Dependabot, CODEOWNERS, the PR security checklist, patched React/React DOM/RSC `19.2.8`, Vite `8.0.16`, security response headers, dependency release quarantine, restricted install scripts, and the third-party license inventory. These controls are part of the maintained v2.5 repository baseline and should not be removed by future source-package imports.
