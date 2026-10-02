# Local edition v2.5 — Neon Arcade

Current setup, controls and upgrade steps are in README.md. Release validation and limits are in RELEASE-v2.5.md. The Game Center now mounts a six-cabinet lobby in `app/arcade/arcade-center.tsx`; individual cabinets load on demand. The live binary portal and brain remain included.

Pure TypeScript engines in `app/arcade/engines/` separate physics/rules from React and drawing. A fixed 120 Hz game loop subdivides physics at 240 Hz. Canvas renderers use the same geometry as collisions, bounded device-pixel resolution, real-time ball motion, material shading and aiming guides. High-frequency positions stay in refs; the score display updates at a lower cadence. Window blur, visibility and help pause pinball/pool. The reel machine settles a cryptographically sampled result into browser storage before animating, blocks overlapping spins, and restores the recorded outcome after reload.

Personal records and reel history are local and identity-scoped; they are not authoritative multiplayer scores. Pool uses documented simplified eight-ball rules and a geometric computer shot planner. These games do not use funds or wallet transactions.

Migration 0004 adds six availability settings. The public `/api/arcade` endpoint exposes the fixed catalog and current availability. Owner/administrator roles have `games.manage` only in the separate admin service, with validated cabinet IDs, CSRF/origin checks, and audited changes. Pausing prevents new lobby visits; open cabinets stay playable. Existing migrations and dependencies were not modified.

Historical implementation notes follow.

---

# Local edition v2.4 — Separate Control Center

The authoritative current setup and behavior are in README.md and RELEASE-v2.4.md. A separate Node process on loopback port 5174 owns the Control Center frontend, privileged API, staff database and MFA key. The public Next application on port 5173 exposes no admin UI or privileged route.

Operations cover aggregate overview, member search/suspension/session revocation, report review, reversible message hiding, draft/published announcements, staff invitation/revocation, permission enforcement, protected audit records, site availability switches and verified local platform snapshots. Authentication uses scrypt, encrypted RFC 6238 secrets, single-use recovery codes, hashed sessions, short admin idle expiry, rate limits, exact Origin checks and CSRF tokens. See docs/control-center-design.md for deployment boundaries.

The forward public migration 0003 preserves prior data. Admin schema migration history is independent. Public APIs enforce suspensions, hidden messages, registration availability and read-only chat. Browser drafts now have account-specific keys, member deletion checks the current password, and the old unauthenticated owner shortcut has been removed. Saved meme edits persist style values and update existing creations.

The live glyph-based head and brain, green eyes, accessible module previews and existing workspaces remain included. No live database, generated credentials, MFA key, test fixture or build output is included in the source ZIP. Historical notes below describe earlier releases; statements about missing local admin functionality there are superseded by v2.4.

---

# Local edition v2.3 additions

This version adds a self-contained local identity foundation without changing the existing live binary renderer. `accounts` and `sessions` are applied as one forward SQLite migration. The migrated `local_seedy` owner receives a random unusable `legacy_unset$…` marker; a valid legacy local session can set the initial password once. New accounts use normalized identifiers, Node `scrypt`, five-failure/15-minute lockout, opaque SHA-256-backed sessions, 30-day absolute expiry and seven-day idle expiry.

Identity Center is the primary sign-in surface. It exposes registration, sign-in, initial legacy password claim, session list/revocation, password rotation, JSON export and explicit account deletion. Export omits password hashes, salts and token material. The local-only notice is intentional: no outbound email, password reset, OAuth, hosted registration, administrator role or wallet custody is included. The historical one-click route remains only as a compatibility bridge for v2.2 cookies.

Module APIs continue to authorize through the new account resolver and preserve existing `user_id` rows. Profile GET falls back to the account display name when no profile row exists; chat uses account names when a profile has not yet been completed. Saved-item validation, per-account ownership predicates, origin checks and response filtering remain in place.

The complete endpoint and migration notes are in README.md and RELEASE-v2.3.md. The current source export is not a Git checkout, so verification is recorded in the SDD ledger rather than commit history.

This version retains the working Node.js/Next.js runtime and v2.2 live renderer/module workspaces. See README.md for release features and upgrade instructions, and RELEASE-v2.3.md for the identity validation record.

Notes use the existing `saved_items` table with kind `note`; no destructive migration or new table is required. Meme settings are optional fields, so earlier saved creations still open with the original defaults. The new game best scores, visual settings and note drafts stay in browser local storage; chat drafts last for the current browser-tab session.

The Wallet dashboard is a public-address connection interface. No balance service, transaction signing, trading, ownership verification or public multi-user authentication is added. Phantom integration follows its official provider documentation: https://docs.phantom.com/solana/establishing-a-connection

Historical implementation notes follow.

# Local edition v2.1 runtime note

This export uses Node.js/Next.js and local SQLite instead of the hosted Worker/D1 runtime described below. Local authentication uses signed cookies and ignores hosted identity headers. See README.md and FIX-REPORT.md for the repair and validation. The original implementation notes below describe the published Sites version.

# MemeSpace interactive binary world

The portal renders 6,372 sampled head vertices as individually animated 0/1 glyphs. The brain uses anatomical surface geometry, sampled from multiple directions, with binary illumination waves and traveling signals. The renderer performs live 3D rotation, perspective projection, surface-normal shading and depth sorting on Canvas 2D; it works without WebGL. There is no head or brain photograph in the scene. Actual geometry sources, attribution and licenses are in public/geometry. A reproducible asset conversion script is in scripts/assets. The head follows pointer movement, with small breathing and blink deformations and independent binary irises. The camera is constrained; this is not a fully rigged cinematic character.

The original concept images are retained only in the Media Vault and meme editor, clearly identified as concept artwork.

Modules: eight culture stories and four token-culture guides with filtering, article readers and saved bookmarks; six lessons with knowledge checks and stored completion; Binary Match and Binary Reactor games; four community channels with message search, replies, likes, own-message editing/deletion and reports; a caption editor with PNG export and saved editable creations; profile and saved-library summaries; cross-content search; Phantom public-address connection. Search opens the relevant module. Chat polls periodically rather than using WebSockets.

Persistent data uses Sites identity and D1. Identity is checked on writes, cross-origin writes are rejected, SQL is parameterized, and all user content is rendered as text. Chat inserts enforce five messages per minute. Saved collections are capped at 300 items per user. Wallet connection does not request signatures or transactions. No fabricated balances or chat activity are shown.

The full Build Bible remains a roadmap. Public registration, privileged RBAC/admin MFA, operational moderation, uploads/scanning, content CMS, indexed full-text search, notifications, blockchain balances/history and native apps are not implemented.

Validation: TypeScript and production builds; browser inspection of live geometry, changing animation frames and pointer gaze; archive filtering and reading, lesson feedback, arcade play, chat sign-in handling, and caption preview. Schema migrations were applied successfully to the local preview database. Signed-in hosted writes and wallet-extension interaction require verification in their actual authenticated environment. Local fixtures are not shipped. Production migrations are schema-only.
