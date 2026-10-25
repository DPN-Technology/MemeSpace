ALTER TABLE social_communities ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private'));
CREATE INDEX idx_social_communities_visibility ON social_communities(visibility,created_at DESC);
CREATE TABLE social_community_requests (
 community_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 requested_at INTEGER NOT NULL,
 PRIMARY KEY(community_id,user_id)
);
CREATE INDEX idx_social_community_requests_time ON social_community_requests(community_id,requested_at);
CREATE TABLE social_community_transfers (
 community_id TEXT NOT NULL,
 old_owner_id TEXT NOT NULL,
 new_owner_id TEXT NOT NULL,
 transferred_at INTEGER NOT NULL
);
