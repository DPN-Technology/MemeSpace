# MemeSpace v2.2 — Emerald Mind

## Included changes

The live head gains individually rendered binary irises, emerald light spill, pupils, blink timing and pointer response. Glow intensity is adjustable from zero to 150%. The brain adds curved electrical digit trails, and hovering or focusing a module draws activity toward its receptor. The renderer pauses behind module dialogs and when the browser tab is hidden. The head still contains 6,372 geometry samples; the brain contains 15,469. These are runtime-rendered 0 and 1 glyphs, not the concept images in the Media Vault.

Module previews now use a portal with automatic collision handling and 16px viewport padding. Wallet's preview flips below its trigger when there is insufficient space above. Keyboard focus can reveal the same previews.

Every module has additions: archive ordering and direct article links; three games including Signal Sequence; multiline per-channel chat drafts and sync controls; meme typography and editing saved creations; lesson notes; a fuller Wallet connection panel; and a filterable profile library with removal and JSON export. See README.md for the user-facing list.

## Verification

- TypeScript: passed.
- Production build: `node scripts/local.mjs build` passed with Next.js 16.3.4 in webpack mode.
- Development runtime suite: 3 tests passed.
- Compiled runtime suite: `MEMESPACE_TEST_MODE=serve node scripts/local.mjs test` passed, 3 tests.
- The runtime checks deny Cloudflare worker-runtime imports and verify readiness, geometry delivery, local sign-in, profile reads/writes, bookmarks, chat, reactions, note creation/update/deletion, meme style validation, tampered cookies, forged identity headers and cross-origin rejection.
- Database checks verify reopening saved data, repeatable migrations and preserving a legacy database during import.
- Browser checks covered the live head and brain, Wallet preview placement within a 1363x936 viewport, the expanded Wallet panel and direct lesson link, persistent note drafts, separate multiline channel drafts, Signal Sequence scoring and failure state, archive ordering, search-to-story navigation, profile library controls and eye-glow settings.
- The meme canvas rendered custom caption size/color and generated a PNG Blob with a direct download link. The remote browser did not expose a completed download event, so saving that PNG to disk was not independently confirmed here.

## Compatibility

The local launcher, Windows batch files, SQLite adapter, signed-session implementation, database migrations, dependency lockfile and Next configuration are unchanged from the working v2.1 package. Notes use the existing saved-items table. Existing saved memes open with the original font and color defaults.

Checks ran on Linux with Node.js 24.19.0. Native Windows execution and a real Phantom extension/account connection were not available in this test environment. Wallet event handling follows the official provider documentation: https://docs.phantom.com/solana/establishing-a-connection

This remains a single-user local edition. Public multi-user accounts, live moderation, on-chain balances, transaction signing and the remaining Build Bible roadmap are not part of this release.

## Upgrade

Stop the old server. Extract v2.2 to a new folder and copy your whole existing `data` folder into it before setup. Run SETUP-WINDOWS.cmd, then START-WINDOWS.cmd. Keep the old folder until you have checked your saved information.

The archive contains the full source, geometry, concept assets, licenses, database migrations, dependency lockfile, launchers and documentation. It excludes installed dependencies, compiled output, local databases, session keys, test data and temporary preview files. SHA256SUMS.txt covers every packaged file except itself.
