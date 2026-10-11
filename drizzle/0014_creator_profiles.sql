-- Public creator identity customization. Images live in local SQLite as validated binary assets.
CREATE TABLE social_creator_profiles (
 user_id TEXT PRIMARY KEY NOT NULL,
 headline TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL DEFAULT '',
 website TEXT NOT NULL DEFAULT '',
 interests TEXT NOT NULL DEFAULT '',
 accent TEXT NOT NULL DEFAULT 'mint' CHECK(accent IN ('mint','violet','coral','amber')),
 avatar_mime TEXT,
 avatar_content BLOB,
 banner_mime TEXT,
 banner_content BLOB,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_creator_profiles_accent ON social_creator_profiles(accent,updated_at DESC);
