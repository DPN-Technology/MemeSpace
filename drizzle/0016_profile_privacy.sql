-- Profile privacy (issue #25): wallet addresses are private unless the owner opts in.
CREATE TABLE social_profile_privacy (
 user_id TEXT PRIMARY KEY NOT NULL,
 show_wallets INTEGER NOT NULL DEFAULT 0 CHECK(show_wallets IN (0,1)),
 updated_at INTEGER NOT NULL
);
