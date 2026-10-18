-- Wallet identity (issue #25): linked Solana wallets and single-use sign-in challenges.
CREATE TABLE wallet_links (
 address TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 linked_at INTEGER NOT NULL,
 last_used_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_wallet_links_user ON wallet_links(user_id);
CREATE TABLE wallet_challenges (
 nonce TEXT PRIMARY KEY NOT NULL,
 address TEXT NOT NULL,
 domain TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('signin','link')),
 user_id TEXT,
 issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_wallet_challenges_expiry ON wallet_challenges(expires_at);
