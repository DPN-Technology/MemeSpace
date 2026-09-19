# Local edition v2.2 additions

This version retains the v2.1 Node runtime and extends the live renderer and every module. See README.md for the release features and upgrade instructions, and RELEASE-v2.2.md for validation.

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
